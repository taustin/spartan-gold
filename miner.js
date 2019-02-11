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
// Miners are clients, but they also mine blocks
// looking for "proofs".
module.exports = class Miner extends Client {
  constructor(broadcast, keys, startingBlock) {
    super(broadcast, keys);

    this.previousBlocks = {};
    this.currentBlock = startingBlock;
    this.startNewSearch();
  }

  // Starts listeners, and begin mining.
  initialize() {
    let minerId = ""
    this.on(START_MINING, this.findProof);
    this.on(PROOF_FOUND, (o) => {
      if (!this.verifyMessageSig(o)){
        return;
      }
      let obj = JSON.parse(o.details.block)
      let trans = Object.values(obj.transactions)[0]
      minerId = Object.keys(trans.txDetails.output)[0]
      this.receiveBlock(o.details.block);
    });
    this.on(POST_TRANSACTION, (o) => {
      if (!this.verifyMessageSig(o)){
        return;
      }
      this.addTransaction(o.details.transaction, o.details.transaction.comment, o.pubKey, minerId);
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

  // Sets up the miner to start searching for a new block
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

  // Looks for a "proof".  It breaks after some time to listen
  // for messages.  (We need to do this since JS does not support
  // concurrency).  The 'oneAndDone' field is used for testing only;
  // It prevents the findProof method from looking for the proof
  // again after the first attempt.
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

  // Broadcast the block, with a valid proof included.
  announceProof() {
    let msg = {details: {block: this.currentBlock.serialize()}};
    this.signMessage(msg);
    this.broadcast(PROOF_FOUND, msg);
  }

  // Returns true if the block's proof is valid.
  isValidBlock(b) {
    if (!b.verifyProof()) return false;
    // FIXME: Validate all transactions.
  }

  // Receives a block from another miner.
  // If it is valid, the block will be stored.
  // If it is also a longer chain, the miner will
  // accept it and replace the currentBlock.
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
      this.currentBlock = b;
      this.startNewSearch();
    }
  }

  // Returns false if transaction is not accepted.
  // Otherwise adds transaction to current block.
  addTransaction(tx, comment, pubKey, minerId) {
    if (!this.currentBlock.legitTransaction(tx)) {
      return false;
    }
    if (!utils.verifySignature(pubKey, tx.txDetails, tx.sig)) {
      return false;
    }
    if (utils.calcId(pubKey) !== tx.txDetails.input) {
      return false;
    }

    this.currentBlock.addTransaction(tx, comment, minerId);
    return true;
  }

  // Returns the balance of coins for the specified ID.
  getBalance(id) {
    return this.currentBlock.balance(id);
  }
}
