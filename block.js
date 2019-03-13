"use strict";

const BigInteger = require('jsbn').BigInteger;

const Transaction = require('./transaction.js');

const utils = require('./utils.js');

const POW_BASE_TARGET = new BigInteger("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
const POW_TARGET = POW_BASE_TARGET.shiftRight(20);
const COINBASE_AMT_ALLOWED = 25;

/**
 * A block is a collection of transactions, with a hash connecting it
 * to a previous block.
 * 
 * The block also stores a list of UTXOs, organizing them by their
 * transaction IDs.
 */
module.exports = class Block {

  /**
   * This method is designed to produce the very first block, known as the
   * genesis block, which does not follow normal rules.  It role is to
   * establish all starting funds for different parties.
   * 
   * @param {Array} clientInitialFunds - A list of pairs specifying a client
   *      and the amount of coins that client should start with.
   */
  static makeGenesisBlock(clientInitialFunds) {
    // Creating outputs
    let outputs = [];
    clientInitialFunds.forEach(({ client, amount }) => {
      let addr = client.wallet.makeAddress();
      let out = { address: addr, amount: amount };
      outputs.push(out);
    });

    // Adding funds to clients' wallets
    let tx = new Transaction({outputs: outputs});
    clientInitialFunds.forEach(({client}, i) => {
      client.wallet.addUTXO(outputs[i], tx.id, i);
    });

    // Creating block
    let genesis = new Block();
    genesis.addTransaction(tx, true);
    return genesis;
  }

  /**
   * Converts a string representation of a block to a new Block instance.
   * We assume that a serialized block intentended for deserialization
   * (in other words, sharing over the network) always includes the UTXOs.
   * 
   * @param {string} str - A string representing a block in JSON format.
   */
  static deserialize(str) {
    let b = new Block();
    let o = JSON.parse(str);
    b.prevBlockHash = o.prevBlockHash;
    b.timestamp = o.timestamp;
    b.proof = o.proof;
    b.chainLength = parseInt(o.chainLength);

    // Serializing the UTXOs simplifies things, but should probably be eliminated.
    b.utxos = o.utxos;

    // Transactions need to be recreated and restored in a map.
    b.transactions = new Map();
    o.transactions.forEach(([txID,txJson]) => {
      let { outputs, inputs } = txJson;
      let tx = new Transaction({outputs, inputs});
      tx.id = txID;
      b.transactions.set(txID, tx);
    });
    return b;
  }

  /**
   * Creates a new Block.  Note that the previous block will not be stored;
   * instead, its hash value will be maintained in this block.
   * 
   * @param {String} rewardAddr - The address to receive all mining rewards for this block.
   * @param {Block} prevBlock - The previous block in the blockchain.
   * @param {number} target - The POW target.  The miner must find a proof that
   *      produces a smaller value when hashed.
   */
  constructor(rewardAddr, prevBlock, target) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.target = target || POW_TARGET;

    // Storing transactions in a Map to preserve key order.
    this.transactions = new Map();

    // Used to determine the winner between competing chains.
    // Note that this is a little simplistic -- an attacker
    // make a long, but low-work chain.  However, this works
    // well enough for us.
    this.chainLength = prevBlock ? prevBlock.chainLength+1 : 1;

    this.timestamp = Date.now();

    // Caching unspent transactions for quick lookup.
    // Each block serves as a snapshot of available coins.
    // Note that we need to do a deep clone of the object.
    this.utxos = prevBlock ? JSON.parse(JSON.stringify(prevBlock.utxos)) : {};

    // We track UTXOs used in this block, but can discard them
    // after the block has been validated.
    this.usedOutputs = {};

    // Add the initial coinbase reward.
    if (rewardAddr) {
      let output = { address: rewardAddr, amount: COINBASE_AMT_ALLOWED};
      // The coinbase transaction will be updated to capture transaction fees.
      this.coinbaseTX = new Transaction({ outputs: [output] });
      this.addTransaction(this.coinbaseTX, true);
    }
  }

  /**
   * The genesis block has special rules.  The coinbase transaction can have
   * limitless outputs and is still valid.  Note that a new Genesis block will
   * be ignored by miners who have a longer chain already.
   */
  isGenesisBlock() {
    return !this.prevBlockHash;
  }

  /**
   * Returns true if the hash of the block is less than the target
   * proof of work value.
   */
  verifyProof() {
    let h = utils.hash(this.serialize());
    let n = new BigInteger(h, 16);
    return n.compareTo(this.target) < 0;
  }

  /**
   * Converts a Block into string form.  Some fields are deliberately omitted.
   */
  serialize(includeUTXOs=false) {
    return `{ "transactions": ${JSON.stringify(Array.from(this.transactions.entries()))},` +
      (includeUTXOs ? ` "utxos": ${JSON.stringify(this.utxos)},` : '') +
      ` "prevBlockHash": "${this.prevBlockHash}",` +
      ` "timestamp": "${this.timestamp}",` +
      ` "target": "${this.target}",` +
      ` "proof": "${this.proof}",` +
      ` "chainLength": "${this.chainLength}" }`;
  }

  /**
   * Returns the cryptographic hash of the current block.
   */
  hashVal() {
    return utils.hash(this.serialize());
  }

  /**
   * Determines whether the block would accept the transaction.
   * A block will accept a transaction if it is not a duplicate
   * and all inputs are valid (meaning they have a matching UTXO).
   * 
   * @param {Transaction} tx - The transaction to validate.
   */
  willAcceptTransaction(tx) {
    if (this.transactions.get(tx.id)) {
      //console.log(`${tx.id} is a duplicate`);
      return false;
    } else if (!tx.isValid(this.utxos)) {
      //console.log(`${tx.id} is invalid`);
      return false;
    }
    return true;
  }

  /**
   * Accepts a new transaction if it is valid.  The validity is determined
   * by the Transaction class.
   * 
   * @param {Transaction} tx - The transaction to add to the block.
   * @param {boolean} forceAccept - Accept the transaction without validating.
   *      This setting is useful for coinbase transactions.
   */
  addTransaction(tx, forceAccept) {
    if (!forceAccept && !this.willAcceptTransaction(tx)) {
      throw new Error(`Transaction ${tx.id} is invalid.`);
    }

    // Store the transaction.
    this.transactions.set(tx.id, tx);

    // We need the total input to determine the miner's transaction fee.
    let totalInput = 0;

    // Delete spent outputs
    tx.inputs.forEach(input => {
      let txUXTOs = this.utxos[input.txID];

      // Track how much input was 
      totalInput += txUXTOs[input.outputIndex].amount;

      // Delete the utxo, and the transaction itself if all the outputs are spent.
      delete txUXTOs[input.outputIndex];
      if (txUXTOs.filter(x => x !== undefined).length === 0) {
        delete this.utxos[input.txID];
      }
    });

    // Add new UTXOs
    this.utxos[tx.id] = [];
    tx.outputs.forEach(output => {
      this.utxos[tx.id].push(output);
    });

    // Add transaction fee
    this.addTransactionFee(totalInput - tx.totalOutput());
  }

  /**
   * Adds the transaction fee to the miner's coinbase transaction.
   *
   * @param {number} fee - The miner's reward for including a given transaction.
   */
  addTransactionFee(fee) {
    // Either the transaction was a coinbase transaction, or there was no transaction fee.
    if (fee <= 0) return;

    if (this.coinbaseTX) {
      // Rather than create a new key, we accumulate all rewards in the same transaction.
      this.coinbaseTX.addFee(fee);
    }
  }

  /**
   * A block is valid if all transactions (except for the coinbase transaction) are
   * valid and the total outputs equal the total inputs plus the coinbase reward.
   */
  isValid(utxos=this.utxos) {
    // The genesis block is automatically valid.
    if (this.isGenesisBlock()) return true;

    // Calculating total inputs.
    let totalIn = COINBASE_AMT_ALLOWED;
    this.transactions.forEach((tx) => {
      tx.inputs.forEach((input, txID) => {
        let txUXTOs = utxos[txID];
        if (txUXTOs[input.outputIndex]) {
          totalIn += txUXTOs[input.outputIndex].amount;
        }
      });
    });

    // Calculating total outputs.
    let totalOut = 0;
    this.transactions.forEach((tx) => {
      totalOut += tx.totalOutput();
    });

    return totalIn === totalOut;
  }

  /**
   * Prints out the value of all UTXOs in the system.
   */
  displayUTXOs() {
    Object.keys(this.utxos).forEach(txID => {
      let txUTXOs = this.utxos[txID];
      txUTXOs.forEach(utxo => {
        console.log(JSON.stringify(utxo));
      });
    });
  }
}
