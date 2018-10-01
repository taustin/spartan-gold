let EventEmitter = require('events');

let utils = require('./utils.js');

const POST = "POST_TRANSACTION";
const BALANCE = "GET_BALANCE";

// FIXME: Add static method to read keys from files
module.exports = class Client extends EventEmitter {
  constructor(broadcast, keys) {
    super();
    // The broadcast function determines how the client communicates
    // with other entities in the system.
    // (This approach allows us to simplify our testing setup.)
    this.broadcast = broadcast;
    this.keys = keys || utils.generateKeypair();
    this.keys.id = utils.calcId(this.keys.public);
  }

  postTransaction(output) {
    let tx = utils.makeTransaction(this.keys.private, output, this.keys.id);
    let msg = { details: {transaction: tx }};
    this.signMessage(msg);
    this.broadcast(POST, msg);
  }

  requestBalance(id) {
    id = id || this.keys.id;
    let msg = { account: id };
    this.signMessage(msg);
    this.broadcast(BALANCE, msg);
  }

  signMessage(msg) {
    let sig = utils.sign(this.keys.private, msg.details);
    msg.sig = sig;
    msg.pubKey = this.keys.public;
  }

  verifyMessageSig(msg) {
    if (msg.pubKey && msg.sig && msg.details) {
      return utils.verifySignature(msg.pubKey, msg.details, msg.sig);
    } else {
      return false;
    }
  }
}

