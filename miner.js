"use strict";

let Block = require('./block.js');
let Client = require('./client.js');

const NUM_ROUNDS_MINING = 2000;

const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";
const POST_TRANSACTION = "POST_TRANSACTION";

/**
 * Miners are clients, but they also mine blocks looking for "proofs".
 * 
 * Each miner stores a map of blocks, where the hash of the block
 * is the key.
 */
module.exports = class Miner extends Client {
  /**
   * When a new miner is created, but the PoW search is **not** yet started.
   * The initialize method kicks things off.
   * 
   * @param {function} broadcast - The function that the miner will use
   *      to send messages to all other clients.
   */
  constructor(name, broadcast) {
    super(broadcast);

    // Used for debugging only.
    this.name = name;

    this.previousBlocks = {};
  }

  /**
   * Starts listeners and begins mining.
   */
  initialize(startingBlock) {
    this.currentBlock = startingBlock;
    this.startNewSearch();

    this.on(START_MINING, this.findProof);
    this.on(PROOF_FOUND, this.receiveBlock);
    this.on(POST_TRANSACTION, this.addTransaction);

    this.emit(START_MINING);
  }

  /**
   * Sets up the miner to start searching for a new block.
   * 
   * @param {boolean} reuseRewardAddress - If set, the miner's previous
   *      coinbase reward address will be reused.
   */
  startNewSearch(reuseRewardAddress=false) {
    // Creating a new address for receiving coinbase rewards.
    // We reuse the old address if 
    if (!reuseRewardAddress) {
      this.rewardAddress = this.wallet.makeAddress();
    }

    // Create a new block, chained to the previous block.
    let b = new Block(this.rewardAddress, this.currentBlock);

    // Store the previous block, and then switch over to the new block.
    this.previousBlocks[b.prevBlockHash] = this.currentBlock;
    this.currentBlock = b;

    // Start looking for a proof at 0.
    this.currentBlock.proof = 0;
  }

  /**
   * Looks for a "proof".  It breaks after some time to listen for messages.  (We need
   * to do this since JS does not support concurrency).
   * 
   * The 'oneAndDone' field is used
   * for testing only; it prevents the findProof method from looking for the proof again
   * after the first attempt.
   * 
   * @param {boolean} oneAndDone - Give up after the first PoW search (testing only).
   */
  findProof(oneAndDone=false) {
    let pausePoint = this.currentBlock.proof + NUM_ROUNDS_MINING;
    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.verifyProof()) {
        this.log(`found proof for block ${this.currentBlock.chainLength}: ${this.currentBlock.proof}`);
        this.reapRewards();
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
    this.broadcast(PROOF_FOUND, this.currentBlock.serialize(true));
  }

  /**
   * Verifies if a blocks proof is valid and all of its
   * transactions are valid.
   * 
   * @param {Block} b - The new block to be verified.
   */
  isValidBlock(b) {
    // FIXME: Should verify that a block chains back to a previously accepted block.
    if (!b.verifyProof()) {
      this.log(`Invalid proof.`);
      return false;
    }

    // Validating with the used outputs, rather than the unspent outputs.
    if (!b.isValid(b.usedOutputs)) {
      this.log(`Invalid block.`);
      return false;
    }

    return true;
  }

  /**
   * Receives a block from another miner. If it is valid,
   * the block will be stored. If it is also a longer chain,
   * the miner will accept it and replace the currentBlock.
   * 
   * @param {string} s - The block in serialized form.
   */
  receiveBlock(s) {
    let b = Block.deserialize(s);
    // FIXME: should not rely on the other block for the utxos.
    if (!this.isValidBlock(b)) {
      this.log(`rejecting invalid block: ${s}`);
      return false;
    }

    // If we don't have it, we store it in case we need it later.
    if (!this.previousBlocks[b.hashVal()]) {
      this.previousBlocks[b.hashVal()] = b;
    }

    // We switch over to the new chain only if it is better.
    if (b.chainLength > this.currentBlock.chainLength) {
      this.log(`cutting over to new chain.`);
      this.syncTransactions(b);
      this.currentBlock = b;
      this.startNewSearch(true);
    }
  }

  syncTransactions(newBlock) {
    // Initially assuming that both blocks are building off of the same previous block.

    // Return any transactions that are in the oldBlock but not in the newBlock.
  }

  /**
   * Returns false if transaction is not accepted. Otherwise adds
   * the transaction to the current block.
   * 
   * @param {Transaction} tx - The transaction to add.
   */
  addTransaction(tx) {
    if (!this.currentBlock.willAcceptTransaction(tx)) {
      return false;
    }
    // FIXME: Toss out duplicate transactions, but store pending transactions.
    this.currentBlock.addTransaction(tx);
    return true;
  }

  /**
   * After finding a proof, collect the mining rewards.
   */
  reapRewards() {
    let tx = this.currentBlock.coinbaseTX;
    this.wallet.addUTXO(tx.outputs[0], tx.id, 0);
  }

  log(msg) {
    console.log(`${this.name}: ${msg}`);
  }
}
