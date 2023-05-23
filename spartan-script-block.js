"use strict";

const Block = require("./block.js");
const SpartanScriptInterpreter = require("./spartan-script/spartan-script-interpreter.js");

/**
 * A special block collection of transactions and smart contracts, with a hash connecting it
 * to a previous block.
 */
module.exports = class SpartanScriptBlock extends Block {
  /**
   * Creates a new Block.  Note that the previous block will not be stored;
   * instead, its hash value will be maintained in this block.
   *
   * @constructor
   * @param {String} rewardAddr - The address to receive all mining rewards for this block.
   * @param {Block} [prevBlock] - The previous block in the blockchain.
   * @param {Number} [target] - The POW target.  The miner must find a proof that
   *      produces a smaller value when hashed.
   * @param {Number} [coinbaseReward] - The gold that a miner earns for finding a block proof.
   */
  constructor(rewardAddr, prevBlock, target, coinbaseReward) {
    super(rewardAddr, prevBlock, target, coinbaseReward);

    // Storing smart contracts mapped to script hash
    this.contractMap = prevBlock ? new Map(prevBlock.contractMap) : new Map();

    //Store Smart contracts state
    this.contractStateVariables = prevBlock
      ? new Map(prevBlock.contractStateVariables)
      : new Map();
  }

  // TODO - this method can be split to only have specific logic for smart contracts
  /**
   * Accepts a new transaction if it is valid and adds it to the block.
   *
   * @param {Transaction} tx - The transaction to add to the block.
   * @param {Client} [client] - A client object, for logging useful messages.
   *
   * @returns {Boolean} - True if the transaction was added successfully.
   */
  addTransaction(tx, client) {
    if (this.transactions.get(tx.id)) {
      if (client) client.log(`Duplicate transaction ${tx.id}.`);
      return false;
    } else if (tx.sig === undefined) {
      if (client) client.log(`Unsigned transaction ${tx.id}.`);
      return false;
    } else if (!tx.validSignature()) {
      if (client) client.log(`Invalid signature for transaction ${tx.id}.`);
      return false;
    } else if (!tx.sufficientFunds(this)) {
      if (client) client.log(`Insufficient gold for transaction ${tx.id}.`);
      return false;
    }

    // Checking and updating nonce value.
    // This portion prevents replay attacks.
    let nonce = this.nextNonce.get(tx.from) || 0;
    if (tx.nonce < nonce) {
      if (client) client.log(`Replayed transaction ${tx.id}.`);
      return false;
    } else if (tx.nonce > nonce) {
      // FIXME: Need to do something to handle this case more gracefully.
      if (client) client.log(`Out of order transaction ${tx.id}.`);
      return false;
    } else {
      this.nextNonce.set(tx.from, nonce + 1);
    }

    // Adding the transaction to the block
    this.transactions.set(tx.id, tx);

    // Taking gold from the sender
    let senderBalance = this.balanceOf(tx.from);
    this.balances.set(tx.from, senderBalance - tx.totalOutput());

    // Run smart contracts giving gold to the specified output addresses
    switch (tx.data.type) {
      case "ContractDeclaration": {
        // Store smart contracts content on blockchain
        if (!this.contractStateVariables.has(tx.data.address))
          this.contractStateVariables.set(tx.data.address, new Map());

        this.contractStateVariables
          .get(tx.data.address)
          .set("$timestamp", Date.now());
        this.contractMap.set(tx.data.scriptHash, tx.data.scriptContent);
        break;
      }
      case "ContractInvocation": {
        let intrepreter = new SpartanScriptInterpreter(this, tx);

        if (!this.contractMap.has(tx.data.scriptHash)) {
          throw new Error(
            "The smart contract could not be found on the blockchain."
          );
        }

        if (!tx.data.call) {
          throw new Error(
            "The call to the smart contract not specified in the transaction."
          );
        }

        // Call interpreter to perform run smart contract operation
        let result = intrepreter.interpret(
          this.contractMap.get(tx.data.scriptHash) + tx.data.call
        );

        let senderBalance = this.balanceOf(tx.from);
        this.balances.set(tx.from, senderBalance - result.gasUsed);

        let oldBalance = this.balanceOf(this.rewardAddr);
        this.balances.set(this.rewardAddr, oldBalance + result.gasUsed);

        break;
      }
    }

    // Giving gold to the specified output addresses
    tx.outputs.forEach(({ amount, address }) => {
      let oldBalance = this.balanceOf(address);
      this.balances.set(address, amount + oldBalance);
    });

    return true;
  }
};
