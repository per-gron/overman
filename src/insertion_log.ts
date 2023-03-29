/*
 * Copyright 2014 Per Eckerdal
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Writable } from 'stream';

/**
 * InsertionLog is a class that helps with printing to the console. The thing it
 * adds over console.log is that it is capable of inserting lines between and
 * replacing already printed lines.
 *
 * InsertionLog will only work if it gets exclusive access to its output stream.
 * If someone else writes to it, it will cause InsertionLog to do the wrong
 * thing. It is ok for someone else to take over after InsertionLog, but then
 * it can't be used anymore.
 */
export default class InsertionLog {
  #messages: { id?: string; contents: string }[] = [];

  constructor(private readonly _stream: Writable) {}

  private cursorUp(n: number) {
    if (n > 0) {
      this._stream.write(`\u001b[${n}A`);
    }
  }

  private deleteLineAndGoToBeginning() {
    this._stream.write(`\u001b[2K\u001b[0G`);
  }

  private getLastMessages(numMessages: number) {
    return this.#messages.slice(this.#messages.length - numMessages);
  }

  private rewindMessages(numMessages: number) {
    const numLines = this.getLastMessages(numMessages).reduce(
      (lines, message) => lines + 1 + (message.contents.match(/\n/g) || []).length,
      0
    );
    this.cursorUp(numLines);
  }

  private printMessages(numMessages: number) {
    this.getLastMessages(numMessages).forEach((message) =>
      message.contents.split(/\n/).forEach((line) => {
        // We need to make sure to clear every line that we write to, otherwise
        // there may be traces left of what was there before.
        this.deleteLineAndGoToBeginning();
        this._stream.write(`${line}\n`);
      })
    );
  }

  private indexOfMessage(messageId: string) {
    const idx = this.#messages.reduce((idx, msg, i) => (msg.id === messageId ? i : idx), -1);

    if (idx === -1) {
      throw new Error(`No message found with id ${messageId}`);
    }
    return idx;
  }

  private logAt(messageIdx: number, message: string, messageId?: string) {
    this.#messages = [
      ...this.#messages.slice(0, messageIdx),
      { contents: message, id: messageId },
      ...this.#messages.slice(messageIdx),
    ];

    const messagesBack = this.#messages.length - messageIdx;
    this.rewindMessages(messagesBack - 1);
    this.printMessages(messagesBack);
  }

  /**
   * Append a message to the end of the log.
   *
   * @param message String. The message to write (should not contain a newline
   *     char).
   * @param messageId String. Optional (defaults to null). Id of the message to
   *     write. If you want to be able to overwrite it or insert messages before
   *     or after this message you need to assign an id to it.
   */
  log(message: string, messageId?: string) {
    this.#messages.push({ id: messageId, contents: message });
    this.printMessages(1);
  }

  /**
   * Insert a new message after a given log message.
   *
   * @param afterMessageId The id of the message to write after. If there are
   *     duplicates, the last message with the given id will be chosen.
   * @param message String. The message to insert (should not contain a newline
   *     char).
   * @param messageId String. Optional (defaults to null). Id of the message to
   *     write. If you want to be able to overwrite it or insert messages before
   *     or after this message you need to assign an id to it.
   */
  logAfter(afterMessageId: string, message: string, messageId?: string) {
    const messageIdx = this.indexOfMessage(afterMessageId);
    this.logAt(messageIdx + 1, message, messageId);
  }

  /**
   * Insert a new message before a given log message.
   *
   * @param beforeMessageId The id of the message to write before. If there are
   *     duplicates, the last message with the given id will be chosen.
   * @param message String. The message to insert (should not contain a newline
   *     char).
   * @param messageId String. Optional (defaults to null). Id of the message to
   *     write. If you want to be able to overwrite it or insert messages before
   *     or after this message you need to assign an id to it.
   */
  logBefore(beforeMessageId: string, message: string, messageId?: string) {
    const messageIdx = this.indexOfMessage(beforeMessageId);
    this.logAt(messageIdx, message, messageId);
  }

  /**
   * Replace an already written log message.
   *
   * @warning It is not allowed to replace a message with one that has a different
   *     number of newlines.
   *
   * @param replacedMessageId The id of the message to replace. If there are
   *     duplicates, the last message with the given id will be chosen.
   * @param message String. The message to insert (should not contain a newline
   *     char)
   */
  replace(replacedMessageId: string, message: string) {
    const messageIdx = this.indexOfMessage(replacedMessageId);
    const messagesBack = this.#messages.length - messageIdx;
    this.rewindMessages(messagesBack);

    this.#messages[messageIdx].contents = message;

    this.printMessages(messagesBack);
  }
}
