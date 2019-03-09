"use strict";

const utils = require('./utils.js');

// Stores transactions in a MerkleTree format.
// The tree will be perfectly balanced.
module.exports = class MerkleTree {

  // Returns the size
  static calculateSize(numElems) {
    // Calculate a power of 2 at least as large as numElems.
    let n = 1;
    while (n < numElems) {
      n *= 2;
    }
    // We need almost double the space to hold the parent hashes.
    // E.g. if we have 8 transactions, we need to store their 8
    // hashes plus the 7 parent hashes.
    return (n * 2) - 1;
  }

  // Hashes from a node to the Merkle root, or until it does not have
  // the other half of the hash needed to continue to the root.
  static hashToRoot(hashes, i) {
    if (i === 0) return;
    let par = (i-2)/2;
    hashes[par] = utils.hash("" + hashes[i-1] + "," + hashes[i]);

    // Test to see if we are the right subnode.  If so, we can hash
    // with the left subnode to continue one level up.
    if (par%2 === 0) {
      this.hashToRoot(hashes, par);
    }
  }

  constructor(transactions) {
    // Actual transactions
    this.transactions = [];

    // Transaction hashes
    this.hashes = [];

    // hash-to-index Lookup table
    this.lookup = {};

    // We want to maintain a balanced tree, so we may need to pad
    // out the last few elements.
    let numBalancedTree = this.constructor.calculateSize(transactions.length);

    // Hashes of transactions start in the middle of the array.
    let firstTrans = Math.floor(numBalancedTree / 2);

    for (let i=firstTrans; i<numBalancedTree; i++) {
      let tNum = i - firstTrans;

      // If we have less than a power of 2 elements,
      // we pad out the transactions and arrays with the last element
      let v = tNum<transactions.length ? transactions[tNum].toString() : this.transactions[tNum-1];
      let h = utils.hash(v);

      this.transactions[tNum] = v;
      this.hashes[i] = h;
      this.lookup[h] = i;
    }

    // Completing inner nodes of Merkle tree
    for (let i=firstTrans+1; i<this.hashes.length; i+=2) {
      this.constructor.hashToRoot(this.hashes, i);
    }
  }

  // Returns the Merkle root
  get root() {
    return this.hashes[0];
  }

  // Returns the path of a given transaction.
  getPath(transaction) {
    let h = utils.hash(transaction);
    let i = this.lookup[h];
    let path = { txInd: i };
    while (i>0) {
      if (i%2 === 0) {
        path[i-1] = this.hashes[i-1];
        i = (i-2) / 2;
      } else {
        path[i+1] = this.hashes[i+1];
        i = (i-1) / 2;
      }
    }
    return path;
  }

  // Verifies whether a path matches the transaction.
  verify(tx, path) {
    let i = path.txInd;
    let h = utils.hash(tx);
    while (i>0) {
      if (i%2 === 0) {
        let sib = path[i-1];
        h = utils.hash(sib + "," + h);
        i = (i-2) / 2;
      } else {
        let sib = path[i+1];
        h = utils.hash(h + "," + sib);
        i = (i-1) / 2;
      }
    }
    return this.root === h;
  }

  contains(t) {
    let h = utils.hash(t);
    return this.lookup[h] !== undefined;
  }

  // Method to print out the tree, one line per level of the tree.
  // Note that hashes are truncated to 6 characters for the sake
  // of brevity.
  display() {
    let i = 0;
    let nextRow = 0;
    let s = "";

    console.log();

    while (i < this.hashes.length) {
      // Truncating hashes for the sake of readability
      s += this.hashes[i].slice(0,6) + " ";
      if (i === nextRow) {
        console.log(s);
        s = "";
        nextRow = (nextRow+1) * 2;
      }
      i++;
    }
  }
}
