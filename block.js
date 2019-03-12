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
      let out = { pubKeyHash: addr, amount: amount };
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
   */
  static deserialize(str) {
    let b = new Block();
    let o = JSON.parse(str);
    b.transactions = o.transactions;
    b.prevBlockHash = o.prevBlockHash;
    b.timestamp = o.timestamp;
    b.proof = o.proof;
    b.chainLength = o.chainLength;
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
   * @param {Object} transactions - A map of txIDs -> transactions
   */
  constructor(rewardAddr, prevBlock, target, transactions) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.target = target || POW_TARGET;
    this.transactions = transactions || {};

    // Used to determine the winner between competing chains.
    // Note that this is a little simplistic -- an attacker
    // make a long, but low-work chain.  However, this works
    // well enough for us.
    this.chainLength = prevBlock ? prevBlock.chainLength+1 : 1;

    this.timestamp = Date.now();

    // Caching unspent transactions for quick lookup.
    // Each block serves as a snapshot of available coins
    this.utxos = prevBlock ? Object.assign({},prevBlock.utxos) : {};

    // Add the initial coinbase reward.
    if (rewardAddr) {
      let output = { pubKeyHash: rewardAddr, amount: COINBASE_AMT_ALLOWED};
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
  serialize() {
    return `{ "transactions": ${JSON.stringify(this.transactions)},` +
      `"comment": "${this.comment}",` +
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
   * Accepts a new transaction if it is valid.  The validity is determined
   * by the Transaction class.
   */
  addTransaction(tx, forceAccept) {
    if (!forceAccept && !tx.isValid(this.utxos)) {
      throw new Error(`Transaction ${tx.id} is invalid.`);
    }

    // Duplicate transaction.
    if (this.transactions[tx.id]) return;

    // Store the transaction.
    this.transactions[tx.id] = tx;

    // We need the total input to determine the miner's transaction fee.
    let totalInput = 0;

    // Delete spent outputs
    tx.inputs.forEach(input => {
      let txUXTOs = this.utxos[input.txID];

      // Track how much input was 
      totalInput += txUXTOs[input.outputIndex];

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
    this.addTransactionFee(tx.totalOutput() - totalInput);
  }

  addTransactionFee(fee) {
    // Either the transaction was a coinbase transaction, or there was no transaction fee.
    if (fee <= 0) return;

    if (this.coinbaseTX) {
      // Rather than create a new key, we accumulate all rewards in the same transaction.
      this.coinbaseTX.outputs[0].amount += fee;
    }

  }

  /**
   * A block is valid if all transactions (except for the coinbase transaction) are
   * valid and the total outputs equal the total inputs plus the coinbase reward.
   */
  isValid() {
    // The genesis block is automatically valid.
    if (this.isGenesisBlock()) return true;

    let totalIn = COINBASE_AMT_ALLOWED;
    let totalOut = this.coinbaseTX.totalOutput();

    // Skipping coinbase transaction
    for (let i=1; i<this.transactions.length; i++) {
      let tx = this.transactions[i];
      totalOut += tx.totalOutput();
    }
    //console.log(`in: ${totalIn}, out: ${totalOut}`)
    return totalIn === totalOut;
  }

  displayUTXOs() {
    Object.keys(this.utxos).forEach(txID => {
      let txUTXOs = this.utxos[txID];
      txUTXOs.forEach(utxo => {
        console.log(JSON.stringify(utxo));
      });
    });
  }
}
