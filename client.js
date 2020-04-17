"use strict";

let EventEmitter = require('events');

let Block = require('./block.js');
let Transaction = require('./transaction.js');

let utils = require('./utils.js');

const PROOF_FOUND = "PROOF_FOUND";
const POST = "POST_TRANSACTION";

const DEFAULT_TX_FEE = 1;

// If a block is 6 blocks older than the current block, it is considered
// confirmed, for no better reason than that is what Bitcoin does.
// Note that the genesis block is always considered to be confirmed.
const CONFIRMED_DEPTH = 6;

/**
 * A client has a public/private keypair and an address.
 * It can send and receive messages on the Blockchain network.
 */
module.exports = class Client extends EventEmitter {

  /**
   * The net object determines how the client communicates
   * with other entities in the system. (This approach allows us to
   * simplify our testing setup.)
   * 
   * @constructor
   * @param {Object} net - The network used by the client
   *    to send messages to all miners and clients, or.
   * @param {Block} - The starting point of the blockchain for the client.
   */
  constructor(net, startingBlock) {
    super();

    this.net = net;

    this.keyPair = utils.generateKeypair();
    this.address = utils.calcAddress(this.keyPair.public);

    // Establishes order of transactions.  Incremented with each
    // new output transaction from this client.  This feature
    // avoids replay attacks.
    this.nonce = 0;

    // Transactions from this block or older are assumed to be confirmed,
    // and therefore are spendable by the client. The transactions could
    // roll back, but it is unlikely.
    this.lastConfirmedBlock = startingBlock;

    // The last block seen.  Any transactions after lastConfirmedBlock
    // up to lastBlock are considered pending.
    this.lastBlock = startingBlock;

    // FIXME: Need to restore pending amounts and transactions.
    this.pendingSpent = 0;

    // A map of transactions received but not yet confirmed.
    this.pendingReceivedTransactions = new Map();

    this.on(PROOF_FOUND, this.receiveBlock);

    // A map of all block hashes to the accepted blocks.
    this.blocks = new Map([[startingBlock.id, startingBlock]]);

    // A map of missing block IDS to the list of blocks depending
    // on the missing blocks.
    this.pendingBlocks = new Map();
  }

  /**
   * The amount of gold available to the client, not counting any pending
   * transactions.  This getter looks at the last confirmed block, since
   * transactions in newer blocks may roll back.
   */
  get confirmedBalance() {
    return this.lastConfirmedBlock.balanceOf(this.address);
  }

  /**
   * Any gold received in the last confirmed block or before is considered
   * spendable, but any gold received more recently is not yet available.
   * However, any gold given by the client to other clients in unconfirmed
   * transactions is treated as unavailable.
   */
  get availableGold() {
    return this.confirmedBalance - this.pendingSpent;
  }

  /**
   * Broadcasts a transaction from the client giving gold to the clients
   * specified in 'outputs'. A transaction fee may be specified, which can
   * be more or less than the default value.
   * 
   * @param {Array} outputs - The list of outputs of other addresses and
   *    amounts to pay.
   * @param {number} [fee] - The transaction fee reward to pay the miner.
   */
  postTransaction(outputs, fee=DEFAULT_TX_FEE) {
    // We calculate the total value of gold needed.
    let totalPayments = outputs.reduce((acc, {amount}) => acc + amount, 0) + fee;

    // Make sure the client has enough gold.
    if (totalPayments > this.availableGold) {
      throw new Error(`Requested ${totalPayments}, but account only has ${this.balance}.`);
    }

    // Broadcasting the new transaction.
    let tx = new Transaction({
      from: this.address,
      nonce: this.nonce,
      pubKey: this.keyPair.public,
      outputs: outputs,
      fee: fee,
    });

    tx.sign(this.keyPair.private);

    this.nonce++;

    this.net.broadcast(POST, tx);
  }

  /**
   * Validates and adds a block to the list of blocks, possibly updating the head
   * of the blockchain.  Any transactions in the block are replayed in order to
   * update the gold balances for all clients.  If any transactions are found to be
   * invalid due to lack of funds, the block is rejected and 'null' is returned to
   * indicate failure.
   * 
   * If any blocks cannot be connected to an existing block but seem otherwise valid,
   * they are added to a list of pending blocks and a request is sent out to get the
   * missing blocks from other clients.
   * 
   * @param {Block | string} block - The block to add to the clients list of available blocks.
   * 
   * @returns {Block | null} The block with replayed transactions, or null for an invalid block.
   */
  receiveBlock(block) {
    // If the block is a string, then deserialize it.
    if (typeof block === 'string') {
      block = Block.deserialize(block);
    }

    // Ignore the block if it has been received previously.
    if (this.blocks.has(block.id)) return null;

    // First, make sure that the block has a valid proof. 
    if (!block.hasValidProof()) {
      //throw new Error(`Block ${block.id} does not have a valid proof ${block.proof}.`);
      this.log(`Block ${block.id} does not have a valid proof.`);
      return null;
    }

    // Make sure that we have the previous blocks.
    // If we don't, request the missing blocks and exit.
    let prevBlock = this.blocks.get(block.prevBlockHash);
    if (!prevBlock) {
      this.requestMissingBlocks(block);
      // Add the block to the list of pending blocks, if we don't have it already.
      // FIXME: Change this to a set instead of a list?  And fix the horrible naming.
      let pendingBlocks = this.pendingBlocks.get(block.prevBlockHash) || [];
      if (!pendingBlocks.find(b => b.id === block.id)) {
        pendingBlocks.push(block);
      }
      this.pendingBlocks.set(block.prevBlockHash, pendingBlocks);
      return null;
    }

    // Verify the block, and store it if everything looks good.
    // This code will trigger an exception if there are any invalid transactions.
    let success = block.replay(prevBlock);
    if (!success) return null;

    // Storing the block.
    this.blocks.set(block.id, block);

    // If it is a better block than the client currently has, set that
    // as the new currentBlock, and update the lastConfirmedBlock.
    if (this.lastBlock.chainLength < block.chainLength) {
      this.lastBlock = block;
      this.setLastConfirmed();
    }

    // Go through any pending blocks and recursively call receiveBlock
    let pending = this.pendingBlocks.get(block.id) || [];
    // Remove these blocks from the pending set.
    this.pendingBlocks.delete(block.id);
    pending.forEach((b) => {
      this.receiveBlock(b);
    });

    return block;
  }

  /**
   * NOT YET IMPLEMENTED!
   * 
   * Request the previous block (or blocks?) from the network.
   * 
   * @param {Block} block - The block that is connected to a missing block.
   */
  requestMissingBlocks(block) {
    // Placeholder
    console.log(`Asking for missing blocks for ${block.id}. prev:${block.prevBlockHash}`);
    this.blocks.forEach((b,id) => {
      console.log(`id: ${id}`)
    });
  }

  /**
   * Sets the last confirmed block according to the most recently accepted block.
   * Note that the genesis block is always considered to be confirmed.
   */
  setLastConfirmed() {
    let block = this.lastBlock;
    let confirmedBlockHeight = block.chainLength - CONFIRMED_DEPTH;
    if (confirmedBlockHeight < 0) {
      confirmedBlockHeight = 0;
    }
    while (block.chainLength > confirmedBlockHeight) {
      block = this.blocks.get(block.prevBlockHash);
    }
    this.lastConfirmedBlock = block;
  }

  /**
   * Utility method that displays all confimed balances for all clients,
   * according to the client's own perspective of the network.
   */
  showAllBalances() {
    for (let [id,balance] of this.lastConfirmedBlock.balances) {
      this.log(`${id}: ${balance}`);
    }
  }
 
  /**
   * Logs messages to stdout, including the name to make debugging easier.
   * If the client does not have a name, then one is calculated from the
   * client's address.
   * 
   * @param {String} msg - The message to display to the console.
   */
  log(msg) {
    let name = this.name || this.address.substring(0,10);
    console.log(`${name}: ${msg}`);
  }
}

