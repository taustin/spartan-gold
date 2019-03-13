"use strict";

let EventEmitter = require('events');

let Transaction = require('./transaction.js');
let Wallet = require('./wallet.js');

const POST = "POST_TRANSACTION";

const DEFAULT_TX_FEE = 1;

/**
 * A client has a wallet, sends messages, and receives messages
 * on the Blockchain network.
 */
module.exports = class Client extends EventEmitter {

  /**
   * The broadcast function determines how the client communicates
   * with other entities in the system. (This approach allows us to
   * simplify our testing setup.)
   * 
   * @param {function} broadcast - The function used by the client
   *    to send messages to all miners and clients.
   */
  constructor(broadcast) {
    super();

    this.broadcast = broadcast;

    this.wallet = new Wallet();

    // Clients will listen for any funs given to them.
    // They will optimistically assume that all transactons
    // will be accepted and finalized.
    this.on(POST, (tx) => this.receiveOutput(tx));
  }

  /**
   * Broadcasts a transaction from the client giving money to the clients
   * specified in 'outputs'.  Note that any unused money is sent to a new
   * change address.  A transaction fee may be specified, which can be more
   * or less than the default value.
   * 
   * @param {Array} outputs - The list of outputs of other addresses and
   *    amounts to pay.
   * @param {number} fee - The transaction fee reward to pay the miner.
   */
  postTransaction(outputs, fee=DEFAULT_TX_FEE) {
    // We calculate the total value of coins needed.
    let totalPayments = outputs.reduce((acc, {amount}) => acc + amount, 0) + fee;

    // Make sure the client has enough money.
    if (totalPayments > this.wallet.balance) {
      throw new Error(`Requested ${totalPayments}, but wallet only has ${this.wallet.balance}.`);
    }

    // Gathering the needed inputs, and specifying an address for change.
    let { inputs, changeAmt } = this.wallet.spendUTXOs(totalPayments);
    if (changeAmt > 0) {
      let changeAddr = this.wallet.makeAddress();
      outputs.push({ address: changeAddr, amount: changeAmt });
    }

    // Broadcasting the new transaction.
    let tx = new Transaction({
      inputs: inputs,
      outputs: outputs,
    });
    this.broadcast(POST, tx);
  }

  /**
   * Accepts payment and adds it to the client's wallet.
   */
  receiveOutput(tx) {
    tx.outputs.forEach(output => {
      if (this.wallet.hasKey(output.address)) {
        this.wallet.addUTXO(output);
      }
    });
  }
}

