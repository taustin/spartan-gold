"use strict";

const BigInteger = require('jsbn').BigInteger;

// Network message constants
const MISSING_BLOCK = "MISSING_BLOCK";
const POST_TRANSACTION = "POST_TRANSACTION";
const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";

// Constants for mining
const NUM_ROUNDS_MINING = 2000;

// Constants related to proof-of-work target
const POW_BASE_TARGET = new BigInteger("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
const POW_LEADING_ZEROES = 15;

// Constants for mining rewards and default transaction fees
const COINBASE_AMT_ALLOWED = 25;
const DEFAULT_TX_FEE = 1;

// If a block is 6 blocks older than the current block, it is considered
// confirmed, for no better reason than that is what Bitcoin does.
// Note that the genesis block is always considered to be confirmed.
const CONFIRMED_DEPTH = 6;


/**
 * The Blockchain class tracks configuration information and settings for the blockchain,
 * as well as some utility methods to allow for easy extensibility.
 */
module.exports = class Blockchain {
  static get MISSING_BLOCK() { return MISSING_BLOCK; }
  static get POST_TRANSACTION() { return POST_TRANSACTION; }
  static get PROOF_FOUND() { return PROOF_FOUND; }
  static get START_MINING() { return START_MINING; }

  static get NUM_ROUNDS_MINING() { return NUM_ROUNDS_MINING; }

  // Configurable properties.
  static get POW_TARGET() { return Blockchain.cfg.powTarget; }
  static get COINBASE_AMT_ALLOWED() { return Blockchain.cfg.coinbaseAmount; }
  static get DEFAULT_TX_FEE() { return Blockchain.cfg.defaultTxFee; }
  static get CONFIRMED_DEPTH() { return Blockchain.cfg.confirmedDepth; }

  /**
   * Produces a new genesis block, giving the specified clients
   * the specified amount of starting gold.  Either clientBalanceMap
   * OR startingBalances can be specified, but not both.
   * 
   * If clientBalanceMap is specified, then this method will also
   * set the genesis block for every client passed in.  This option
   * is useful in single-threaded mode.
   * 
   * @param {Object} cfg - Settings for the blockchain.
   * @param {Class} cfg.blockClass - Implementation of the Block class.
   * @param {Class} cfg.transactionClass - Implementation of the Transaction class.
   * @param {Map} [cfg.clientBalanceMap] - Mapping of clients to their starting balances.
   * @param {Object} [cfg.startingBalances] - Mapping of client addresses to their starting balances.
   * @param {number} [cfg.powLeadingZeroes] - Number of leading zeroes required for a valid proof-of-work.
   * @param {number} [cfg.coinbaseAmount] - Amount of gold awarded to a miner for creating a block.
   * @param {number} [cfg.defaultTxFee] - Amount of gold awarded to a miner for accepting a transaction,
   *    if not overridden by the client.
   * @param {number} [cfg.confirmedDepth] - Number of blocks required after a block before it is
   *    considered confirmed.
   * 
   * @returns {Block} - The genesis block.
   */
  static makeGenesis({
    blockClass,
    transactionClass,
    powLeadingZeroes = POW_LEADING_ZEROES,
    coinbaseAmount = COINBASE_AMT_ALLOWED,
    defaultTxFee = DEFAULT_TX_FEE,
    confirmedDepth = CONFIRMED_DEPTH,
    clientBalanceMap,
    startingBalances,
  }) {

    if (clientBalanceMap && startingBalances) {
      throw new Error("You may set clientBalanceMap OR set startingBalances, but not both.");
    }

    // Setting blockchain configuration
    Blockchain.cfg = { blockClass, transactionClass, coinbaseAmount, defaultTxFee, confirmedDepth };
    Blockchain.cfg.powTarget = POW_BASE_TARGET.shiftRight(powLeadingZeroes);
    
    // If startingBalances was specified, we initialize our balances to that object.
    let balances = startingBalances || {};

    // If clientBalanceMap was initialized instead, we copy over those values.
    if (clientBalanceMap !== undefined) {
      for (let [client, balance] of clientBalanceMap.entries()) {
        balances[client.address] = balance;
      }
    }

    let g = this.makeBlock();

    // Initializing starting balances in the genesis block.
    Object.keys(balances).forEach((addr) => {
      g.balances.set(addr, balances[addr]);
    });

    // If clientBalanceMap was specified, we set the genesis block for every client.
    if (clientBalanceMap) {
      for (let client of clientBalanceMap.keys()) {
        client.setGenesisBlock(g);
      }
    }

    return g;
  }

  /**
   * Converts a string representation of a block to a new Block instance.
   * 
   * @param {Object} o - An object representing a block, but not necessarily an instance of Block.
   * 
   * @returns {Block}
   */
  static deserializeBlock(o) {
    if (o instanceof Blockchain.cfg.blockClass) {
      return o;
    }

    let b = new Blockchain.cfg.blockClass();
    b.chainLength = parseInt(o.chainLength);
    b.timestamp = o.timestamp;

    if (b.isGenesisBlock()) {
      // Balances need to be recreated and restored in a map.
      o.balances.forEach(([clientID,amount]) => {
        b.balances.set(clientID, amount);
      });
    } else {
      b.prevBlockHash = o.prevBlockHash;
      b.proof = o.proof;
      b.rewardAddr = o.rewardAddr;
      // Likewise, transactions need to be recreated and restored in a map.
      b.transactions = new Map();
      if (o.transactions) o.transactions.forEach(([txID,txJson]) => {
        let tx = new Blockchain.cfg.transactionClass(txJson);
        b.transactions.set(txID, tx);
      });
    }

    return b;
  }

  static makeBlock(...args) {
    return new Blockchain.cfg.blockClass(...args);
  }

  static makeTransaction(o) {
    if (o instanceof Blockchain.cfg.transactionClass) {
      return o;
    } else {
      return new Blockchain.cfg.transactionClass(o);
    }
    
  }

};
