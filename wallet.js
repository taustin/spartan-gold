"use strict";

const keypair = require('keypair');

const utils = require('./utils.js')

/**
 * A wallet is a collection of utxos and their matching private keys.
 * For simplicity, we will make a JBOK ("just a bag of keys") wallet.
*/
module.exports = class Wallet {
  
  /**
   * Initializes an array for UTXOs and the details needed to spend
   * the UTXOS, as well as an address->keypair map.
   * 
   * A UTXO (unspent transaction output) is a pair of an amount
   * and the hash of the public key needed to spend its contents.
   * 
   * An address is the hash of the corresponding public key.
   */
  constructor() {
    // An array of the UTXOs
    this.utxoDetails = [];

    // An address is the hash of the public key.
    // Its value is the public/private key pair.
    this.addresses = {};
  }

  /**
   * Return the total balance of all UTXOs.
   * 
   * @returns The total number of coins in the wallet.
   */
  get balance() {
    return this.utxoDetails.reduce((acc, {output}) => acc + output.amount, 0);
  }

  /**
   * Accepts and stores a UTXO and the information needed to create
   * the input to spend it.
   * 
   * @param {Object} utxo - The unspent transaction output.
   * @param {String} txID - The hex string representing the ID of the transaction
   *          where the UTXO was created.
   * @param {Number} outputIndex - The index of the output in the transaction.
   */
  addUTXO(utxo, txID, outputIndex) {
    if (this.addresses[utxo.pubKeyHash] === undefined) {
      throw new Error(`Wallet does not have key for ${utxo.pubKeyHash}`);
    }
    this.utxoDetails.push({
      output: utxo,
      txID: txID,
      outputIndex: outputIndex,
    });
  }

  /**
   * Returns inputs to spend enough UTXOs to meet or exceed the specified
   * amount of coins.
   * 
   * Calling this method also **deletes** the UTXOs used. This approach
   * optimistically assumes that the transaction will be accepted.  Just
   * in case, the keys are not deleted.  From the blockchain and the
   * key pair, the wallet can manually recreate the UTXO if it fails to
   * be created.
   * 
   * If the amount requested exceeds the available funds, an exception is
   * thrown.
   * 
   * @param {Number} amount - The amount that is desired to spend.
   * 
   * @returns An array of UTXOs that meet or exceed the amount required.
   */
  spendUTXOs(amount) {
    if (amount > this.balance) {
      throw new Error(`Insufficient funds.  Requested ${amount}, but only ${this.balance} is available.`);
    }

    // Gathering the UTXOs needed.
    let spending = [];
    while (amount > 0) {
      let { output, txID, outputIndex } = this.utxoDetails.pop();
      amount -= output.amount;
      // Creating the needed input
      let kp = this.addresses[output.pubKeyHash];
      let input = {
        txID: txID,
        outputIndex: outputIndex,
        pubKey: kp.public,
        sig: utils.sign(kp.private, output),
      };
      spending.push(input);
    }

    return spending;
  }

  /**
   * Makes a new keypair and calculates its address from that.
   * The address is the hash of the public key.
   * 
   * @returns The address.
   */
  makeAddress() {
    // Make a new key pair, store it, and return the hash value.
    let kp = keypair();
    let addr = utils.calcAddress(kp.public);
    this.addresses[addr] = kp;
    return addr;
  }
}