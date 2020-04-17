"use strict";

let Block = require('./block.js');
let Client = require('./client.js');

const NUM_ROUNDS_MINING = 2000;

const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";
const POST_TRANSACTION = "POST_TRANSACTION";

/**
 * Miners are clients, but they also mine blocks looking for "proofs".
 */
module.exports = class Miner extends Client {
  /**
   * When a new miner is created, but the PoW search is **not** yet started.
   * The initialize method kicks things off.
   * 
   * @constructor
   * @param {String} name - The miner's name, used for debugging messages.
   * * @param {Object} net - The network that the miner will use
   *      to send messages to all other clients.
   * @param {Block} startingBlock - The most recently ALREADY ACCEPTED block.
   */
  constructor(name, net, startingBlock) {
    super(net, startingBlock);

    // Used for debugging only.
    this.name = name;
  }

  /**
   * Starts listeners and begins mining.
   */
  initialize() {
    this.startNewSearch();

    this.on(START_MINING, this.findProof);
    this.on(POST_TRANSACTION, this.addTransaction);

    this.emit(START_MINING);
  }

  /**
   * Sets up the miner to start searching for a new block.
   */
  startNewSearch() {
    this.currentBlock = new Block(this.address, this.lastBlock);

    // Start looking for a proof at 0.
    this.currentBlock.proof = 0;
  }

  /**
   * Looks for a "proof".  It breaks after some time to listen for messages.  (We need
   * to do this since JS does not support concurrency).
   * 
   * The 'oneAndDone' field is used for testing only; it prevents the findProof method
   * from looking for the proof again after the first attempt.
   * 
   * @param {boolean} oneAndDone - Give up after the first PoW search (testing only).
   */
  findProof(oneAndDone=false) {
    let pausePoint = this.currentBlock.proof + NUM_ROUNDS_MINING;
    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.hasValidProof()) {
        this.log(`found proof for block ${this.currentBlock.chainLength}: ${this.currentBlock.proof}`);
        this.announceProof();
        this.startNewSearch();
        break;
      }
      this.currentBlock.proof++;
    }
    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(START_MINING), 0);
    }
  }

  /**
   * Broadcast the block, with a valid proof included.
   */
  announceProof() {
    this.net.broadcast(PROOF_FOUND, this.currentBlock.serialize());
  }

  /**
   * Receives a block from another miner. If it is valid,
   * the block will be stored. If it is also a longer chain,
   * the miner will accept it and replace the currentBlock.
   * 
   * @param {Block | String} s - The block, usually in serialized form.
   */
  receiveBlock(s) {
    let b = super.receiveBlock(s);

    if (b === null) return null;

    // We switch over to the new chain only if it is better.
    if (this.currentBlock && b.chainLength > this.currentBlock.chainLength) {
      this.log(`cutting over to new chain.`);
      this.syncTransactions();
      this.startNewSearch();
    }
  }

  /**
   * **NOT YET IMPLEMENTED**  This function should determine what transactions
   * need to be added or deleted.  It should find a common ancestor (retrieving
   * any transactions from the rolled-back blocks), remove any transactions
   * already included in the newly accepted blocks, and add any remanining
   * transactions to the new block.
   * 
   * @param {Block} newBlock - The newly accepted block.
   */
  syncTransactions(newBlock) {
    // TBD...
  }

  /**
   * Returns false if transaction is not accepted. Otherwise adds
   * the transaction to the current block.
   * 
   * @param {Transaction} tx - The transaction to add.
   */
  addTransaction(tx) {
    return this.currentBlock.addTransaction(tx);
  }

}
