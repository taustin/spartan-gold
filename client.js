"use strict";

let EventEmitter = require('events');

let Blockchain = require('./blockchain.js');

let utils = require('./utils.js');

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
   * @param {Object} obj - The properties of the client.
   * @param {String} [obj.name] - The client's name, used for debugging messages.
   * @param {Object} obj.net - The network used by the client
   *    to send messages to all miners and clients.
   * @param {Block} [obj.startingBlock] - The starting point of the blockchain for the client.
   * @param {Object} [obj.keyPair] - The public private keypair for the client.
   */
  constructor({name, net, startingBlock, keyPair} = {}) {
    super();

    this.net = net;
    this.name = name;

    if (keyPair === undefined) {
      this.keyPair = utils.generateKeypair();
    } else {
      this.keyPair = keyPair;
    }

    this.address = utils.calcAddress(this.keyPair.public);

    // Establishes order of transactions.  Incremented with each
    // new output transaction from this client.  This feature
    // avoids replay attacks.
    this.nonce = 0;

    // A map of transactions where the client has spent money,
    // but where the transaction has not yet been confirmed.
    this.pendingOutgoingTransactions = new Map();

    // A map of transactions received but not yet confirmed.
    this.pendingReceivedTransactions = new Map();

    // A map of all block hashes to the accepted blocks.
    this.blocks = new Map();

    // A map of missing block IDS to the list of blocks depending
    // on the missing blocks.
    this.pendingBlocks = new Map();

    if (startingBlock) {
      this.setGenesisBlock(startingBlock);
    }

    // Setting up listeners to receive messages from other clients.
    this.on(Blockchain.PROOF_FOUND, this.receiveBlock);
    this.on(Blockchain.MISSING_BLOCK, this.provideMissingBlock);
  }

  /**
   * The genesis block can only be set if the client does not already
   * have the genesis block.
   * 
   * @param {Block} startingBlock - The genesis block of the blockchain.
   */
  setGenesisBlock(startingBlock) {
    if (this.lastBlock) {
      throw new Error("Cannot set genesis block for existing blockchain.");
    }

    // Transactions from this block or older are assumed to be confirmed,
    // and therefore are spendable by the client. The transactions could
    // roll back, but it is unlikely.
    this.lastConfirmedBlock = startingBlock;

    // The last block seen.  Any transactions after lastConfirmedBlock
    // up to lastBlock are considered pending.
    this.lastBlock = startingBlock;

    this.blocks.set(startingBlock.id, startingBlock);
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
    let pendingSpent = 0;
    this.pendingOutgoingTransactions.forEach((tx) => {
      pendingSpent += tx.totalOutput();
    });

    return this.confirmedBalance - pendingSpent;
  }

  /**
   * Broadcasts a transaction from the client giving gold to the clients
   * specified in 'outputs'. A transaction fee may be specified, which can
   * be more or less than the default value.
   * 
   * @param {Array} outputs - The list of outputs of other addresses and
   *    amounts to pay.
   * @param {number} [fee] - The transaction fee reward to pay the miner.
   * 
   * @returns {Transaction} - The posted transaction.
   */
  postTransaction(outputs, fee=Blockchain.DEFAULT_TX_FEE) {
    // We calculate the total value of gold needed.
    let totalPayments = outputs.reduce((acc, {amount}) => acc + amount, 0) + fee;

    // Make sure the client has enough gold.
    if (totalPayments > this.availableGold) {
      throw new Error(`Requested ${totalPayments}, but account only has ${this.balance}.`);
    }

    // Broadcasting the new transaction.
    let tx = Blockchain.makeTransaction({
      from: this.address,
      nonce: this.nonce,
      pubKey: this.keyPair.public,
      outputs: outputs,
      fee: fee,
    });

    tx.sign(this.keyPair.private);

    // Adding transaction to pending.
    this.pendingOutgoingTransactions.set(tx.id, tx);

    this.nonce++;

    this.net.broadcast(Blockchain.POST_TRANSACTION, tx);

    return tx;
  }

  /**
   * Validates and adds a block to the list of blocks, possibly updating the head
   * of the blockchain.  Any transactions in the block are rerun in order to
   * update the gold balances for all clients.  If any transactions are found to be
   * invalid due to lack of funds, the block is rejected and 'null' is returned to
   * indicate failure.
   * 
   * If any blocks cannot be connected to an existing block but seem otherwise valid,
   * they are added to a list of pending blocks and a request is sent out to get the
   * missing blocks from other clients.
   * 
   * @param {Block | Object} block - The block to add to the clients list of available blocks.
   * 
   * @returns {Block | null} The block with rerun transactions, or null for an invalid block.
   */
  receiveBlock(block) {
    // If the block is a string, then deserialize it.
    block = Blockchain.deserializeBlock(block);

    // Ignore the block if it has been received previously.
    if (this.blocks.has(block.id)) return null;

    // First, make sure that the block has a valid proof. 
    if (!block.hasValidProof() && !block.isGenesisBlock()) {
      this.log(`Block ${block.id} does not have a valid proof.`);
      return null;
    }

    // Make sure that we have the previous blocks, unless it is the genesis block.
    // If we don't have the previous blocks, request the missing blocks and exit.
    let prevBlock = this.blocks.get(block.prevBlockHash);
    if (!prevBlock && !block.isGenesisBlock()) {
      let stuckBlocks = this.pendingBlocks.get(block.prevBlockHash);

      // If this is the first time that we have identified this block as missing,
      // send out a request for the block.
      if (stuckBlocks === undefined) { 
        this.requestMissingBlock(block);
        stuckBlocks = new Set();
      }
      stuckBlocks.add(block);

      this.pendingBlocks.set(block.prevBlockHash, stuckBlocks);
      return null;
    }

    if (!block.isGenesisBlock()) {
      // Verify the block, and store it if everything looks good.
      // This code will trigger an exception if there are any invalid transactions.
      let success = block.rerun(prevBlock);
      if (!success) return null;
    }

    // Storing the block.
    this.blocks.set(block.id, block);

    // If it is a better block than the client currently has, set that
    // as the new currentBlock, and update the lastConfirmedBlock.
    if (this.lastBlock.chainLength < block.chainLength) {
      this.lastBlock = block;
      this.setLastConfirmed();
    }

    // Go through any blocks that were waiting for this block
    // and recursively call receiveBlock.
    let unstuckBlocks = this.pendingBlocks.get(block.id) || [];
    // Remove these blocks from the pending set.
    this.pendingBlocks.delete(block.id);
    unstuckBlocks.forEach((b) => {
      this.log(`Processing unstuck block ${b.id}`);
      this.receiveBlock(b);
    });

    return block;
  }

  /**
   * Request the previous block from the network.
   * 
   * @param {Block} block - The block that is connected to a missing block.
   */
  requestMissingBlock(block) {
    this.log(`Asking for missing block: ${block.prevBlockHash}`);
    let msg = {
      from: this.address,
      missing: block.prevBlockHash,
    };
    this.net.broadcast(Blockchain.MISSING_BLOCK, msg);
  }

  /**
   * Resend any transactions in the pending list.
   */
  resendPendingTransactions() {
    this.pendingOutgoingTransactions.forEach((tx) => {
      this.net.broadcast(Blockchain.POST_TRANSACTION, tx);
    });
  }

  /**
   * Takes an object representing a request for a misssing block.
   * If the client has the block, it will send the block to the
   * client that requested it.
   * 
   * @param {Object} msg - Request for a missing block.
   * @param {String} msg.missing - ID of the missing block.
   */
  provideMissingBlock(msg) {
    if (this.blocks.has(msg.missing)) {
      this.log(`Providing missing block ${msg.missing}`);
      let block = this.blocks.get(msg.missing);
      //this.net.sendMessage(msg.from, Client.PROOF_FOUND, block.serialize());
      this.net.sendMessage(msg.from, Blockchain.PROOF_FOUND, block);
    }
  }

  /**
   * Sets the last confirmed block according to the most recently accepted block,
   * also updating pending transactions according to this block.
   * Note that the genesis block is always considered to be confirmed.
   */
  setLastConfirmed() {
    let block = this.lastBlock;
    let confirmedBlockHeight = block.chainLength - Blockchain.CONFIRMED_DEPTH;
    if (confirmedBlockHeight < 0) {
      confirmedBlockHeight = 0;
    }
    while (block.chainLength > confirmedBlockHeight) {
      block = this.blocks.get(block.prevBlockHash);
    }
    this.lastConfirmedBlock = block;

    // Update pending transactions according to the new last confirmed block.
    this.pendingOutgoingTransactions.forEach((tx, txID) => {
      if (this.lastConfirmedBlock.contains(tx)) {
        this.pendingOutgoingTransactions.delete(txID);
      }
    });
  }

  /**
   * Utility method that displays all confimed balances for all clients,
   * according to the client's own perspective of the network.
   */
  showAllBalances() {
    this.log("Showing balances:");
    for (let [id,balance] of this.lastConfirmedBlock.balances) {
      console.log(`    ${id}: ${balance}`);
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

  /**
   * Print out the blocks in the blockchain from the current head
   * to the genesis block.  Only the Block IDs are printed.
   */
  showBlockchain() {
    let block = this.lastBlock;
    console.log("BLOCKCHAIN:");
    while (block !== undefined) {
      console.log(block.id);
      block = this.blocks.get(block.prevBlockHash);
    }
  }
};
