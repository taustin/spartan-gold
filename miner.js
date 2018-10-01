let EventEmitter = require('events');
let fs = require('fs');

let Block = require('./block.js');
let Client = require('./client.js');

let utils = require('./utils.js');

const NUM_ROUNDS_MINING = 2000;

const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";
const POST_TRANSACTION = "POST_TRANSACTION";
const BALANCE = "GET_BALANCE";

module.exports = class Miner extends Client {
  constructor(broadcast, keys, startingBlock) {
    super(broadcast, keys);

    this.previousBlocks = {};
    this.currentBlock = startingBlock;
    this.startNewSearch();
  }

  // Starts listeners.
  initialize() {
    this.on(START_MINING, this.findProof);
    this.on(PROOF_FOUND, (o) => {
      if (!this.verifyMessageSig(o)){
        return;
      }
      this.receiveBlock(o.details.block);
    });
    this.on(POST_TRANSACTION, (o) => {
      if (!this.verifyMessageSig(o)){
        return;
      }
      this.addTransaction(o.details.transaction, o.pubKey);
    });
    this.on(BALANCE, (o) => {
      if (!this.verifyMessageSig(o)){
        return;
      }
      let msg = {details: { account: account, balance: balance}};
      this.signMessage(msg);
      let balance = this.getBalance(o.account);
    });
    this.emit(START_MINING);
  }

  startNewSearch() {
    let b = new Block(this.currentBlock);
    this.previousBlocks[b.prevBlockHash] = this.currentBlock;
    this.currentBlock = b;
    let output = {};
    output[this.keys.id] = 1;
    let cbTrans = utils.makeTransaction(this.keys.private, output);
    this.currentBlock.addTransaction(cbTrans, true);
    this.currentBlock.proof = 0;
  }

  findProof(oneAndDone) {
    let pausePoint = this.currentBlock.proof + NUM_ROUNDS_MINING;
    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.verifyProof()) {
        this.announceProof();
        this.startNewSearch();
        break;
      }
      this.currentBlock.proof++;
    }
    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(START_MINING, this.findProof), 0);
    }
  }

  announceProof() {
    let msg = {details: {block: this.currentBlock.serialize()}};
    this.signMessage(msg);
    this.broadcast(PROOF_FOUND, msg);
  }

  isValidBlock(b) {
    if (!b.verifyProof()) return false;
    // FIXME: Validate all transactions.
  }

  receiveBlock(s) {
    let b = Block.deserialize(s);
    if (!this.isValidBlock(b)) {
      return false;
    }
    // If we don't have it, we store it in case we need it later.
    if (!!this.previousBlocks[b.hashVal()]) {
      this.previousBlocks[b.hashVal()] = b;
      // FIXME: May need to recover older blocks in this case.
    }
    // We switch over to the new chain only if it is better.
    if (b.chainLength >= this.currentBlock.chainLength) {
      // FIXME: Need to sync up missing transactions
      // FIXME: Need to sync up missing transactions
      this.currentBlock = b;
      this.startNewSearch();
    }
  }

  // Returns false if transaction is not accepted.
  // Otherwise adds transaction to current block.
  addTransaction(tx, pubKey) {
    if (!this.currentBlock.legitTransaction(tx)) {
      return false;
    }
    if (!utils.verifySignature(pubKey, tx.txDetails, tx.sig)) {
      return false;
    }
    if (utils.calcId(pubKey) !== tx.txDetails.input) {
      return false;
    }
    this.currentBlock.addTransaction(tx);
    return true;
  }

  getBalance(id) {
    return this.currentBlock.balance(id);
  }

  replayBlockchain(newBlock) {
    // FIXME: Implement
    // 1) Find a common ancestor
    //      Recover any missing blocks needed to do so.
    // 2) Role forward from common ancestor, replaying all transactions.
    // 3) Gather a list of still pending transactions return them.
    return {};
  }
}



