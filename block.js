let utils = require('./utils.js');


const NUM_LEADING_ZEROES = 20;

const COINBASE_AMT_ALLOWED = 1;

const BALANCE = "GET_BALANCE";

let unspentChange = 0;

module.exports = class Block {

  // Takes a string and produces a Block object
  static deserialize(str) {
    let b = new Block();
    let o = JSON.parse(str);
    b.transactions = o.transactions;
    // UTXO -- unspent transaction output
    b.utxo = o.utxo ? o.utxo : b.utxo;
    b.prevBlockHash = o.prevBlockHash;
    b.timestamp = o.timestamp;
    b.proof = o.proof;
    b.chainLength = o.chainLength;
    return b;
  }

  constructor(prevBlock, workRequired, transactions) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.workRequired = workRequired || NUM_LEADING_ZEROES;
    this.transactions = transactions || {};
    this.chainLength = prevBlock ? prevBlock.chainLength+1 : 1;
    this.timestamp = Date.now();
    // Caching unspent transactions for quick lookup.
    // Each block serves as a snapshot of available coins
    this.utxo = prevBlock ? Object.assign({},prevBlock.utxo) : {};
  }

  // Returns true if the current proof has the right number of leading zeroes
  verifyProof() {
    let h = utils.hash(this.serialize());
    return utils.hashWork(h) > this.workRequired;
  }

  // Converts a Block into string form.  Some fields are deliberately omitted.
  serialize(includeUTXO) {
    // FIXME: make the utxo optional once we can recalculate them.
    includeUTXO = true;
    return `{ "transactions": ${JSON.stringify(this.transactions)},` +
      (includeUTXO ? ` "utxo": ${JSON.stringify(this.utxo)},` : '') +
      ` "prevBlockHash": "${this.prevBlockHash}",` +
      ` "timestamp": "${this.timestamp}",` +
      ` "workRequired": "${this.workRequired}",` +
      ` "proof": "${this.proof}",` +
      ` "chainLength": "${this.chainLength}" }`;
  }

  // Returns the cryptographic hash of the current block.
  hashVal(includeUTXO) {
    return utils.hash(this.serialize(includeUTXO));
  }

  // Returns the current balance for the specified user.
  balance(id) {
    return this.utxo[id] || 0;
  }

  // Only one coinbase transaction (at most) is allowed per block.
  // This function checks to see if the block already has one.
  hasCoinbaseTransaction() {
    return !!this.coinbase;
  }

  // Given the transaction details & the minerID,
  //this method updates the UTXO values.
  updateUTXO(details, minerId) {
    //Sum amount transferred
    let sumAmtTransfer = 0;
    for(let key in details.output) {
      sumAmtTransfer += details.output[key]
    }

    //Iterating throught the IDs in the transaction
    for(let key in details.output) {

      let payment = details.output[key];
      this.utxo[key] = this.utxo[key] || 0;

     //details.input is the id of the sender
       if(key == details.input){

        unspentChange = (this.utxo[details.input] - sumAmtTransfer);

        delete this.utxo[details.input];

      }
      this.utxo[key] = this.utxo[key] || 0;
      if(key == minerId){
          //Assignining Unspent Change to the Miner
          this.utxo[key] += unspentChange;

      }
      this.utxo[key] += payment;


    }

  }

  // Returns true if the transaction is valid.
  // Note that this method does **not** check the transaction signature.
  legitTransaction(trans) {
    let d = trans.txDetails;
    // No input means that this is a coinbase transaction
    let isCoinbase = !d.input;
    // Only 1 coinbase transaction allowed per block.
    if (isCoinbase && this.hasCoinbaseTransaction()) {
      return false;
    }
    let totalIn = isCoinbase ? 0 : this.balance(d.input);
    let totalOut = 0;
    for(let key in d.output) {
      let payment = d.output[key];
      if (payment <= 0) {
        // All amounts paid must be positive
        return false;
      } else {
        totalOut += payment;
      }
    }
    if (isCoinbase) {
      return totalOut <= COINBASE_AMT_ALLOWED;
    } else {
      return totalIn >= totalOut;
    }
  }

  // This accepts a new transaction if it is valid.
  addTransaction(trans) {
    let tid = utils.hash(JSON.stringify(trans));
    let minerId = ""
    let utxoBeforeTx = {}
    let senderId = trans.txDetails.input
    if (!this.legitTransaction(trans)) {
      throw new Error(`Transaction ${tid} is invalid.`);
    }
    this.transactions[tid] = trans;
    if (!trans.txDetails.input) {
      this.coinbase = trans;
      minerId = trans.txDetails.output
      for(let key in trans.txDetails.output){
        minerId = key
      }

    }
    this.updateUTXO(trans.txDetails, minerId);
  }

}
