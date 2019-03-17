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

// Likewise, use a global wallet with one address,
// since each addresses is expensive to generate.
const wallet = new Wallet();
const addr = wallet.makeAddress();

// Adding a POW target that should be trivial to match.
//const EASY_POW_TARGET = new BigInteger("fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

describe('utils', () => {
  describe('.verifySignature', () => {
    let sig = utils.sign(kp.private, "hello");
    it('should accept a valid signature', () => {
      assert.ok(utils.verifySignature(kp.public, "hello", sig));
    });
    it('should reject an invalid signature', () => {
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
    it("should return the total value of coins stored in the wallet.", () => {
      wallet.empty();
      let utxo1 = { amount: 42, address: addr };
      let utxo2 = { amount: 25, address: addr };
      let tx = new Transaction({
        inputs: [],
        outputs: [utxo1, utxo2],
      });
      wallet.addUTXO(utxo1, tx.id, 0);
      wallet.addUTXO(utxo2, tx.id, 1);
      assert.equal(wallet.balance, 67);
    });
  });
  describe("#spendUTXOs", () => {
    it("should spend sufficient UTXOs to reach the balance.", () => {
      wallet.empty();
      let utxo1 = { amount: 42, address: addr };
      let utxo2 = { amount: 25, address: addr };
      let tx = new Transaction({
        inputs: [],
        outputs: [utxo1, utxo2],
      });
      wallet.addUTXO(utxo1, tx.id, 0);
      wallet.addUTXO(utxo2, tx.id, 1);
      assert.equal(wallet.coins.length, 2);
      // Either UTXO should be sufficient.
      let { inputs } = wallet.spendUTXOs(20);
      let { txID, outputIndex, pubKey, sig } = inputs[0];
      assert.equal(wallet.coins.length, 1);
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

describe('Block', () => {
  describe('#addTransaction', () => {
    // Slow test -- allowing additional time for it to run.
    it("should update the block's utxo if the transaction was successful", () => {
      wallet.empty();
      let aliceWallet = new Wallet();
      let bobWallet = wallet;
      let gb = Block.makeGenesisBlock([
        { client: {wallet: aliceWallet}, amount: 150 },
      ]);
      let { inputs } = aliceWallet.spendUTXOs(125);
      let outInd = inputs[0].outputIndex;
      let tx = new Transaction({
        inputs: inputs,
        outputs: [ { address: addr, amount: 120 } ],
      });
      gb.addTransaction(tx);
      // Testing that wallets are updated correctly.
      bobWallet.addUTXO(tx.outputs[0], tx.id, 0);
      assert.equal(aliceWallet.balance, 0);
      assert.equal(bobWallet.balance, 120);
      // Testing UTXOs
      let utxo = gb.utxos[tx.id][outInd];
      assert.equal(utxo.amount, 120);
      assert.equal(utxo.address, addr);
    }).timeout(5000);
  });
});
