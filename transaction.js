"use strict";

const utils = require('./utils.js');

/**
 * A transaction is made up of a collection of inputs and outputs.
 * The total value of the outputs must equal or exceed the inputs.
 * 
 * One exception: coinbase transactions have no inputs; Their total
 * outputs should match up with the transaction fees from the
 * transactions in the block, plus an extra reward for for the block
 * itself.
 * 
 * For a transaction, the mining fee is specified as the difference
 * between the total value of the inputs and the total value of the
 * outputs.
 * 
*/
module.exports = class Transaction {

  /**
   * The constructor for a transaction specifies an array of inputs
   * and outputs.  The inputs are optional, in order to support
   * coinbase transactions.
   * 
   * An output is a pair of an address and an amount of coins, in the form:
   *  {amount, address}
   * 
   * An address is the hash of a public key.
   * 
   * An input is a triple of a transaction ID, the index of an output
   * within that transaction ID, and the public key that matches the
   * address.  It is in the form:
   *  {txID, outputIndex, pubKey, sig}
   * 
   * @constructor
   * @param {Object} obj - The inputs and outputs of the transaction.
   * @param {Array} obj.outputs - An array of the outputs.
   * @param {Array} obj.inputs - An array of the inputs.
   */
  constructor({outputs, inputs=[], coinBaseReward=0}) {
    this.inputs = inputs;
    this.outputs = outputs;
    this.coinBaseReward = coinBaseReward;

    this.timestamp = Date.now();

    this.id = utils.hash("" + JSON.stringify({inputs, outputs}));
  }

  /**
   * Validates the input and returns the amount of tokens in the output.
   * If the input is invalid, either due to an invalid signature or due
   * to the wrong transaction ID, an exception is raised.
   * 
   * @param {Object} input - The object representing an input
   */
  spendOutput(input) {
    let {txID, outputIndex, pubKey, sig} = input;
    if (txID !== this.id) {
      throw new Error(`Transaction id of input was ${txID}, but this transaction's id is ${this.id}`);
    }
    let output = this.outputs[outputIndex];
    let {amount, pubKeyHash} = output;
    if (utils.calcAddress(pubKey) !== pubKeyHash) {
      throw new Error(`Public key does not match its hash for tx ${this.id}, output ${outputIndex}.`);
    } else if (!utils.verifySignature(pubKey, output, sig)) {
      throw new Error(`Invalid signature for ${this.id}, outpout ${outputIndex}.`);
    } else {
      return amount;
    }
  }

  /**
   * Validates that a transaction's inputs and outputs are valid.
   * In order to validate a transaction, the UTXOs matching the
   * inputs are needed.  The rules for a valid transaction differ
   * between normal transactions and coinbase transactions.
   * 
   * Coinbase transactions have no matching UTXOs.  This method
   * does **not** validate them; the role of validating the
   * coinbase transaction instead lies with the Block class.
   * 
   * For normal transactions, the sum of the UTXOs matching the inputs
   * must be at least as large as the sum out the outputs.  Also, the
   * signatures of the inputs must be valid and match the pubKeyHash
   * specified in the corresponding UTXOs.
   * 
   * @param {Array} matchingOutputs - The UTXOs matching the inputs.
   * @returns {boolean} True if the transaction is valid, false otherwise.
   */
  isValid(utxos) {
    // Coinbase transactions are assumed valid by default.
    // We need to see the whole block to validate it.
    if (this.coinBaseReward !== 0) {
      return true;
    }

    // Building up a map of keys in the inputs.
    let keys = {};
    this.inputs.forEach(({pubKey, sig}) => {
      let keyHash = utils.calcAddress(pubKey);
      keys[keyHash] = {pubKey, sig};
    });

    // Calculating the total input and verifying each key.
    let totalIn = 0;
    for (let i in utxos) {
      let utxo = utxos[i];

      // Track the total inputs
      totalIn += utxo.amount;

      // Make sure the signature is valid, and uses the right key.
      let keySig = keys[utxo.pubKeyHash];
      if (!keySig ||
          !utxo.pubKeyHash ||
          !utils.verifySignature(keySig.pubKey, utxo, keySig.sig)) {
        return false;
      }
    }

    return totalIn >= this.totalOutput();
  }

  /**
   * Calculates the total value of all outputs.
   */
  totalOutput() {
    return this.outputs.reduce(
      (acc, {amount}) => acc + amount,
      0);
  }
}
