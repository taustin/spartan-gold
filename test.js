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
const EASY_POW_TARGET = new BigInteger("fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

describe('utils', function() {

  /*
  describe('.makeTransaction', function() {
    it('should include a valid signature', function() {
      let tx = utils.makeTransaction(kp.private, {bob: 12, charlie: 5}, "alice");
      assert.ok(utils.verifySignature(kp.public, tx.txDetails, tx.sig));
    });
  });
*/

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
    let pubKeyHash = utils.calcAddress(kp.public);
    let tx = new Transaction({
      inputs: [],
      outputs: [{amount: 42, pubKeyHash: pubKeyHash}],
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
    let pubKeyHash = utils.calcAddress(kp.public);
    let cbTX = new Transaction({
      coinBaseReward: 1,
      outputs: [{amount: 1, pubKeyHash: pubKeyHash},
                {amount: 42, pubKeyHash: pubKeyHash}],
    });
    let utxos = {};
    utxos[cbTX.id] = cbTX.outputs;
    let input = {
      txID: cbTX.id,
      outputIndex: 1,
      pubKey: kp.public,
      sig: utils.sign(kp.private, cbTX.outputs[1]),
    };
    let newPubKeyHash = utils.calcAddress(newKeypair.public);

    it("should consider a transaction valid if the outputs do not exceed the inputs", () => {
      let tx = new Transaction({
        inputs: [input],
        outputs: [{amount: 20, pubKeyHash: newPubKeyHash},
                  {amount: 10, pubKeyHash: pubKeyHash}],
      });
      assert.isTrue(tx.isValid(utxos));
    });

    it("should consider a transaction invalid if the outputs exceed the inputs", () => {
      let tx = new Transaction({
        inputs: [input],
        outputs: [{amount: 20, pubKeyHash: newPubKeyHash},
                  {amount: 30, pubKeyHash: pubKeyHash}],
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
        outputs: [{amount: 40, pubKeyHash: newPubKeyHash}],
      });
      assert.isFalse(tx.isValid(utxos));
    });
  });
});

describe("Wallet", () => {
  describe("#balance", () => {
    let w = new Wallet();
    let addr = w.makeAddress();
    let utxo1 = { amount: 42, pubKeyHash: addr };
    let utxo2 = { amount: 25, pubKeyHash: addr };
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
    let utxo1 = { amount: 42, pubKeyHash: addr };
    let utxo2 = { amount: 25, pubKeyHash: addr };
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
        outputs: [ { pubKeyHash: bobWallet.makeAddress(), amount: 20 } ],
      });
      gb.addTransaction(tx);
      bobWallet.addUTXO(tx.outputs[0], tx.id, 0);
      assert.equal(aliceWallet.balance, 0);
      assert.equal(bobWallet.balance, 110);
    });
    //*/
  });
});

/*
describe('Client', function() {
  describe('.constructor', function() {
    let client = new Client();
    it("should generate a keypair if none is given", function() {
      assert.ok(!!client.keys);
      assert.ok(!!client.keys.public);
      assert.ok(!!client.keys.private);
    });
    it("should calculate an id field", function() {
      assert.ok(!!client.keys.id);
    });
  });

  describe('#postTransaction', function() {
    let client = new Client(null,kp);
    it("should broadcast a message", function() {
      let broadcastCalled = false;
      client.broadcast = function() {
        broadcastCalled = true;
      };
      client.postTransaction({alice: 10});
      assert.ok(broadcastCalled);
    });
    it("should broadcast a signed message object", function() {
      client.broadcast = function(msg, o) {
        assert.ok(!!o.sig);
        assert.ok(!!o.pubKey);
      };
      client.postTransaction({alice: 10});
    });
    it("should broadcast a signed transaction", function() {
      client.broadcast = function(msg, o) {
        assert.ok(!!o.details);
        assert.ok(utils.verifySignature(o.pubKey, o.details.transaction.txDetails, o.details.transaction.sig));
      };
      client.postTransaction({alice: 10});
    });
  });

  describe('#requestBalance', function() {
    let client = new Client(null,kp);
    it("should broadcast a message", function() {
      let broadcastCalled = false;
      client.broadcast = function() {
        broadcastCalled = true;
      };
      client.requestBalance();
      assert.ok(broadcastCalled);
    });
    it("should broadcast a signed message object", function() {
      client.broadcast = function(msg, o) {
        assert.ok(!!o.sig);
        assert.ok(!!o.pubKey);
      };
      client.requestBalance();
    });
    it("should request balance for the specified ID", function() {
      client.broadcast = function(msg, o) {
        assert.equal(o.account, "face0ff");
      };
      client.requestBalance("face0ff");
    });
    it("should request balance for client's ID by default", function() {
      client.broadcast = function(msg, o) {
        assert.equal(o.account, client.keys.id);
      };
      client.requestBalance();
    });
  });

  describe('#signMessage', function() {
    let client = new Client(null,kp);
    let msg = { details: 42 };
    client.signMessage(msg);
    it("should attack a 'sig' field to the message", function() {
      assert.ok(!!msg.sig);
    });
    it("should attack a 'pubKey' field to the message", function() {
      assert.ok(!!msg.pubKey);
    });
  });

  describe('#verifyMessageSig', function() {
    let client = new Client(null,kp);
    let msg = { details: 42 };
    client.signMessage(msg);
    it("should accept valid, signed messages", function() {
      assert.ok(client.verifyMessageSig(msg));
    });
    it("should reject messages with invalid signatures", function() {
      // Tampering with message so that signature is invalid.
      msg.details++;
      assert.ok(!client.verifyMessageSig(msg));
    });
  });
});

describe('Miner', function() {
  let newGen = new Block();
  let account = utils.calcAddress(kp.public);
  newGen.utxo[account] = 100;

  describe('.constructor', function() {
    let miner = new Miner(null, kp);
    it("should create a new 'currentBlock'", function() {
      assert.ok(miner.currentBlock);
    });
    it("should add a new coinbase transaction to currentBlock", function() {
      let b = miner.currentBlock;
      assert.equal(Object.keys(b.transactions).length, 1);
      let tid = Object.keys(b.transactions)[0];
      assert.equal(b.transactions[tid].txDetails.output[miner.keys.id], 1);
    });
  });

  describe('#announceProof', function() {
    let miner = new Miner(null, kp);
    it("should call broadcast", function() {
      let broadcastCalled = false;
      miner.broadcast = function() {
        broadcastCalled = true;
      };
      miner.announceProof();
      assert.ok(broadcastCalled);
    });
    it("should sign the message", function() {
      miner.broadcast = function(msg, o) {
        assert.ok(!!o.sig);
        assert.ok(!!o.pubKey);
      };
      miner.announceProof();
    });
    it("should include currentBlock", function() {
    });
  });

  describe('#receiveBlock', function() {
    it("should reject shorter blockchains", function() {
      // FIXME: Need to set up this test.
    });
    it("should reject invalid blocks", function() {
      // FIXME: Need to set up this test.
    });
    it("should update currentBlock if the new block is better", function() {
      // FIXME: Need to set up this test.
    });
  });

  describe('#addTransaction', function() {
    it("should add a valid transaction to currentBlock", function() {
      let miner = new Miner(null, kp, newGen);
      let output = { alice: 42 };
      let numTrans = Object.keys(miner.currentBlock.transactions).length;
      let tx = utils.makeTransaction(kp.private, output, account);
      miner.addTransaction(tx, tx.comment, kp.public);
      let newNumTrans = Object.keys(miner.currentBlock.transactions).length;
      assert.equal(newNumTrans, numTrans + 1);
    });
    it("should update the utxo for the currentBlock with a valid transaction", function() {
      let miner = new Miner(null, kp, newGen);
      let output = { alice: 42, bob: 50 };
      let tx = utils.makeTransaction(kp.private, output, account);
      miner.addTransaction(tx, tx.comment, kp.public);
      assert.equal(miner.getBalance("alice"), 42);
      assert.equal(miner.getBalance("bob"), 50);
    });
    it("should reject an invalid transaction", function() {
      let miner = new Miner(null, kp, newGen);
      let output = { alice: 40000, bob: 50 };
      let tx = utils.makeTransaction(kp.private, output, account);
      assert.ok(!miner.addTransaction(tx, kp.public));
    });
    it("should reject a transaction without a valid signature", function() {
      let miner = new Miner(null, kp, newGen);
      let output = { alice: 40, bob: 50 };
      let tx = utils.makeTransaction(kp.private, output, account);
      // Tampering with amount for bob
      tx.txDetails.output['bob'] += 1;
      assert.ok(!miner.addTransaction(tx, tx.comment, kp.public));
    });
    it("should reject a transaction where the signature does not match the ID", function() {
      let miner = new Miner(null, kp, newGen);
      let output = { alice: 40, bob: 50 };
      // Signing with a different key than used for the account.
      let tx = utils.makeTransaction(newKeypair.private, output, account);
      assert.ok(!miner.addTransaction(tx, tx.comment, newKeypair.public));
    });
  });

  describe('#isValidBlock', function() {
    it("should reject blocks with invalid transactions", function() {
      // FIXME
    });
    it("should reject blocks with multiple coinbase transactions", function() {
      // FIXME
    });
  });

  describe('#getBalance', function() {
    it("should return the balance for the specified account", function() {
      let miner = new Miner(null, newKeypair, newGen);
      assert.equal(miner.getBalance(account), 100);
    });
  });
});
*/