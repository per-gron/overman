/**
 * OnMessage is a reporter mainly for internal use by the tests. It forwards all
 * gotMessage calls to a callback
 */
function OnMessage(onMessage) {
  this._onMessage = onMessage;
}

OnMessage.prototype.gotMessage = function(testPath, message) {
  this._onMessage(testPath, message);
};

module.exports = OnMessage;
