"use strict";

const assert = require('chai').assert;
const BigInteger = require('jsbn').BigInteger;

const Block = require('./block.js');
const Client = require('./client.js');
const Miner = require('./miner.js');
const MerkleTree = require('./merkle-tree.js');
const Transaction = require('./transaction.js');
const Wallet = require('./wallet.js');

const utils = require('./utils.js');

// Using these keypairs for all tests, since key generation is slow.
const kp = utils.generateKeypair();
const newKeypair = utils.generateKeypair();

// Adding a POW target that should be trivial to match.
//const EASY_POW_TARGET = new BigInteger("fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

describe('utils', function() {
  describe('.verifySignature', function() {
    let sig = utils.sign(kp.private, "hello");
    it('should accept a valid signature', function() {
      assert.ok(utils.verifySignature(kp.public, "hello", sig));
    });
    it('should reject an invalid signature', function() {
      assert.ok(!utils.verifySignature(kp.public, "goodbye", sig));
    });
  });
});

describe("Transaction", () => {
  describe("#spendOutput", () => {
    let address = utils.calcAddress(kp.public);
    let tx = new Transaction({
      inputs: [],
      outputs: [{amount: 42, address: address}],
    });
    it("should return the amount of tokens in the output if the input matches the output.", () => {
      let nextInput = {
        txID: tx.id,
        outputIndex: 0,
        pubKey: kp.public,
        sig: utils.sign(kp.private, tx.outputs[0])
      };
      assert.equal(tx.spendOutput(nextInput), 42);
    });
    it("should throw an exception if the transaction ID is invalid.", () => {
      let nextInput = {
        txID: 12345,
        outputIndex: 0,
        pubKey: kp.public,
        sig: utils.sign(kp.private, tx.outputs[0]),
      };
      assert.throws(() => {
        tx.spendOutput(nextInput);
      });
    });
    it("should throw and exception if the signature is invalid.", () => {
      let nextInput = {
        txID: tx.id,
        outputIndex: 0,
        pubKey: kp.public,
        sig: utils.sign(newKeypair.private, tx.outputs[0]),
      };
      assert.throws(() => {
        tx.spendOutput(nextInput);
      });
    });
  });
  describe("#isValid", () => {
    let address = utils.calcAddress(kp.public);
    let cbTX = new Transaction({
      coinBaseReward: 1,
      outputs: [{amount: 1, address: address},
                {amount: 42, address: address}],
    });
    let utxos = {};
    utxos[cbTX.id] = cbTX.outputs;
    let input = {
      txID: cbTX.id,
      outputIndex: 1,
      pubKey: kp.public,
      sig: utils.sign(kp.private, cbTX.outputs[1]),
    };
    let newAddress = utils.calcAddress(newKeypair.public);

    it("should consider a transaction valid if the outputs do not exceed the inputs", () => {
      let tx = new Transaction({
        inputs: [input],
        outputs: [{amount: 20, address: newAddress},
                  {amount: 10, address: address}],
      });
      assert.isTrue(tx.isValid(utxos));
    });

    it("should consider a transaction invalid if the outputs exceed the inputs", () => {
      let tx = new Transaction({
        inputs: [input],
        outputs: [{amount: 20, address: newAddress},
                  {amount: 30, address: address}],
      });
      assert.isFalse(tx.isValid(utxos));
    });

    it("should reject a transaction if the signatures on the inputs do not match the UTXOs", () => {
      let badInput = {
        txID: cbTX.id,
        outputIndex: 1,
        pubKey: newKeypair.public,
        sig: utils.sign(newKeypair.private, cbTX.outputs[1]),
      };
      let tx = new Transaction({
        inputs: [badInput],
        outputs: [{amount: 40, address: newAddress}],
      });
      assert.isFalse(tx.isValid(utxos));
    });
  });
});

describe("Wallet", () => {
  describe("#balance", () => {
    let w = new Wallet();
    let addr = w.makeAddress();
    let utxo1 = { amount: 42, address: addr };
    let utxo2 = { amount: 25, address: addr };
    let tx = new Transaction({
      inputs: [],
      outputs: [utxo1, utxo2],
    });
    w.addUTXO(utxo1, tx.id, 0);
    w.addUTXO(utxo2, tx.id, 1);
    it("should return the total value of coins stored in the wallet.", () => {
      assert.equal(w.balance, 67);
    });
  });
  describe("#spendUTXOs", () => {
    let w = new Wallet();
    let addr = w.makeAddress();
    let utxo1 = { amount: 42, address: addr };
    let utxo2 = { amount: 25, address: addr };
    let tx = new Transaction({
      inputs: [],
      outputs: [utxo1, utxo2],
    });
    w.addUTXO(utxo1, tx.id, 0);
    w.addUTXO(utxo2, tx.id, 1);
    it("should spend sufficient UTXOs to reach the balance.", () => {
      assert.equal(w.coins.length, 2);
      // Either UTXO should be sufficient.
      let { inputs } = w.spendUTXOs(20);
      let { txID, outputIndex, pubKey, sig } = inputs[0];
      assert.equal(w.coins.length, 1);
      assert.equal(txID, tx.id);
      // Make sure the signature is valid
      assert.isTrue(utils.verifySignature(pubKey, tx.outputs[outputIndex], sig));
    });
  });
});

describe("MerkleTree", () => {
  describe("#verify", () => {
    const mt = new MerkleTree(["a", "b", "c", "d", "e", "f", "g", "h"]);
    it("should return true if the path is valid.", () => {
      let path = mt.getPath("a");
      assert.isTrue(mt.verify("a", path));
      path = mt.getPath("f");
      assert.isTrue(mt.verify("f", path));
    });
    it("should return false if the wrong path is specified.", () => {
      let path = mt.getPath("a");
      assert.isFalse(mt.verify("d", path));
    });
  });
  describe("#contains", () => {
    const mt = new MerkleTree(["a", "b", "c", "d", "e", "f", "g", "h"]);
    it("should return true if the tree contains the transaction.", () => {
      assert.isTrue(mt.contains("a"));
      assert.isTrue(mt.contains("d"));
      assert.isTrue(mt.contains("g"));
    });
    it("should return false if the tree does not contain the transaction.", () => {
      assert.isFalse(mt.contains("z"));
    });
  });
});

describe('Block', function() {

  describe('.deserialize', function() {
    let aliceWallet = new Wallet();
    let bobWallet = new Wallet()
    let b = Block.makeGenesisBlock([
      { client: {wallet: aliceWallet}, amount: 150 },
      { client: {wallet: bobWallet}, amount: 90 },
    ]);
    b.proof = 42;
    let s = b.serialize(true);
    let b2 = Block.deserialize(s);
    it("should carry over all transactions", function() {
      assert.equal(Object.keys(b2.transactions).length, Object.keys(b.transactions).length);
      Object.keys(b.transactions).forEach((k) => {
        assert.equal(b2.transactions[k], b.transactions[k]);
      });
    });
    it("should carry over UTXO values", function() {
      /*
      assert.equal(b2.utxo[alice], b.utxo[alice]);
      assert.equal(b2.utxo[bob], b.utxo[bob]);
      assert.equal(b2.utxo[charlie], b.utxo[charlie]);
      */
    });
    it("should carry over all metadata", function() {
      /*
      assert.equal(b2.comment, b.comment)
      assert.equal(b2.prevBlockHash, b.prevBlockHash);
      assert.equal(b2.timestamp, b.timestamp);
      assert.equal(b2.target, b.target);
      assert.equal(b2.proof, b.proof);
      assert.equal(b2.chainLength, b.chainLength);
      */
    });
    it("should preserved serialized form", function() {
      /*
      assert.equal(b2.serialize(), s);
      */
    });
  });

  describe('#addTransaction', function() {
    // Slow test.
    /*
    let aliceWallet = new Wallet();
    let bobWallet = new Wallet();
    let charlieWallet = new Wallet();
    let gb = Block.makeGenesisBlock([
      { client: {wallet: aliceWallet}, amount: 150 },
      { client: {wallet: bobWallet}, amount: 90 },
      { client: {wallet: charlieWallet}, amount: 20 },
    ]);
    it("should update the block's utxo if the transaction was successful", function() {
      let { inputs } = aliceWallet.spendUTXOs(25);
      let tx = new Transaction({
        inputs: inputs,
        outputs: [ { address: bobWallet.makeAddress(), amount: 20 } ],
      });
      gb.addTransaction(tx);
      bobWallet.addUTXO(tx.outputs[0], tx.id, 0);
      assert.equal(aliceWallet.balance, 0);
      assert.equal(bobWallet.balance, 110);
    });
    //*/
  });
});
