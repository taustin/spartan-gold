"use strict";

const BigInteger = require('jsbn').BigInteger;

// Constants related to proof-of-work target
const POW_BASE_TARGET = new BigInteger("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
const POW_TARGET = POW_BASE_TARGET.shiftRight(15);

// Constants for mining rewards and default transaction fees
const COINBASE_AMT_ALLOWED = 25;
const DEFAULT_TX_FEE = 1;

// If a block is 6 blocks older than the current block, it is considered
// confirmed, for no better reason than that is what Bitcoin does.
// Note that the genesis block is always considered to be confirmed.
const CONFIRMED_DEPTH = 6;

// Constants for mining
const NUM_ROUNDS_MINING = 2000;

// Netowrk message constants
const MISSING_BLOCK = "MISSING_BLOCK";
const POST_TRANSACTION = "POST_TRANSACTION";
const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";


/**
 * The Blockchain class tracks configuration information and settings for the blockchain,
 * as well as some utility methods to allow for easy extensibility.
 */
module.exports = class Blockchain {
  static get POW_TARGET() { return POW_TARGET; }
  static get COINBASE_AMT_ALLOWED() { return COINBASE_AMT_ALLOWED; }
  static get DEFAULT_TX_FEE() { return DEFAULT_TX_FEE; }
  static get CONFIRMED_DEPTH() { return CONFIRMED_DEPTH; }
  static get NUM_ROUNDS_MINING() { return NUM_ROUNDS_MINING; }
  static get MISSING_BLOCK() { return MISSING_BLOCK; }
  static get POST_TRANSACTION() { return POST_TRANSACTION; }
  static get PROOF_FOUND() { return PROOF_FOUND; }
  static get START_MINING() { return START_MINING; }

  /**
   * Produces a new genesis block, giving the specified clients
   * the specified amount of starting gold.  This method will also
   * set the genesis block for every client passed in.
   * 
   * @param {Map.<Client, number>} clientBalanceMap - A map of clients to
   *    their starting amount of gold.
   * @param The block class implementation.
   * 
   * @returns {Block} - The genesis block.
   */
  static makeGenesis(clientBalanceMap, cfg) {
    Blockchain.cfg = cfg;
    let g = this.makeBlock();

    for (let [client, balance] of clientBalanceMap.entries()) {
      g.balances.set(client.address, balance);
    }

    for (let client of clientBalanceMap.keys()) {
      client.setGenesisBlock(g);
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
    if (o instanceof Blockchain.cfg.Block) {
      return o;
    }

    let b = new Blockchain.cfg.Block();
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
        let tx = new Blockchain.cfg.Transaction(txJson);
        b.transactions.set(txID, tx);
      });
    }

    return b;
  }

  static makeBlock(...args) {
    return new Blockchain.cfg.Block(...args);
  }

  static makeTransaction(o) {
    if (o instanceof Blockchain.cfg.Transaction) {
      return o;
    } else {
      return new Blockchain.cfg.Transaction(o);
    }
    
  }

};
