'use strict';

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
function InsertionLog(stream) {
  this._stream = stream;
  this._messages = [];  // Array of { id: [message id], contents: [message contents] }
}

InsertionLog.prototype._cursorUp = function(n) {
  if (n > 0) {
    this._stream.write('\u001b[' + n + 'A');
  }
};

InsertionLog.prototype._deleteLineAndGoToBeginning = function() {
  this._stream.write('\u001b[2K' + '\u001b[0G');
};

InsertionLog.prototype._getLastMessages = function(numMessages) {
  return this._messages.slice(this._messages.length - numMessages);
};

InsertionLog.prototype._rewindMessages = function(numMessages) {
  var self = this;
  var numLines = this._getLastMessages(numMessages).reduce(function(value, message) {
    return value + 1 + (message.contents.match(/\n/g) || []).length;
  }, 0);
  this._cursorUp(numLines);
};

InsertionLog.prototype._printMessages = function(numMessages) {
  var self = this;
  this._getLastMessages(numMessages).forEach(function(message) {
    message.contents.split(/\n/).forEach(function(line) {
      // We need to make sure to clear every line that we write to, otherwise
      // there may be traces left of what was there before.
      self._deleteLineAndGoToBeginning();
      self._stream.write(line + '\n');
    });
  });
};

InsertionLog.prototype._indexOfMessage = function(messageId) {
  var idx = this._messages.reduce(function(foundIdx, message, idx) {
    return message.id === messageId ? idx : foundIdx;
  }, null);

  if (idx === null) {
    throw new Error('No message found with id ' + messageId);
  } else {
    return idx;
  }
};

/**
 * Append a message to the end of the log.
 *
 * @param message String. The message to write (should not contain a newline
 *     char).
 * @param messageId String. Optional (defaults to null). Id of the message to
 *     write. If you want to be able to overwrite it or insert messages before
 *     or after this message you need to assign an id to it.
 */
InsertionLog.prototype.log = function(message, messageId) {;
  this._messages.push({ id: typeof messageId === 'undefined' ? null : messageId, contents: message });
  this._printMessages(1);
};

InsertionLog.prototype._logAt = function(messageIdx, message, messageId) {
  this._messages = [].concat(
    this._messages.slice(0, messageIdx),
    [{ contents: message, id: messageId }],
    this._messages.slice(messageIdx)
  );

  var messagesBack = this._messages.length - messageIdx;
  this._rewindMessages(messagesBack - 1);
  this._printMessages(messagesBack);
};

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
InsertionLog.prototype.logAfter = function(afterMessageId, message, messageId) {
  var messageIdx = this._indexOfMessage(afterMessageId);
  this._logAt(messageIdx + 1, message, messageId);
};

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
InsertionLog.prototype.logBefore = function(beforeMessageId, message, messageId) {
  var messageIdx = this._indexOfMessage(beforeMessageId);
  this._logAt(messageIdx, message, messageId);
};

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
InsertionLog.prototype.replace = function(replacedMessageId, message) {
  var messageIdx = this._indexOfMessage(replacedMessageId);
  var messagesBack = this._messages.length - messageIdx;
  this._rewindMessages(messagesBack);

  this._messages[messageIdx].contents = message;

  this._printMessages(messagesBack);
};

module.exports = InsertionLog;
