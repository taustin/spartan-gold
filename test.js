"use strict";

const assert = require('chai').assert;
const BigInteger = require('jsbn').BigInteger;

const Block = require('./block.js');
const Client = require('./client.js');
const Miner = require('./miner.js');
const MerkleTree = require('./merkle-tree.js');

const utils = require('./utils.js');

// Using these keypairs for all tests, since key generation is slow.
const kp = utils.generateKeypair();
const newKeypair = utils.generateKeypair();

// Adding a POW target that should be trivial to match.
const EASY_POW_TARGET = new BigInteger("fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

describe('utils', function() {

  describe('.makeTransaction', function() {
    it('should include a valid signature', function() {
      let tx = utils.makeTransaction(kp.private, {bob: 12, charlie: 5}, "alice");
      assert.ok(utils.verifySignature(kp.public, tx.txDetails, tx.sig));
    });
  });

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
  // Classic security names
  let alice = '404f8fd144';
  let bob = '07f946d659';
  let charlie = 'c214b8bfb6';
  let mike = '02fe8909b9'
  let mini = '3fe8909909'

  // Using the genesis block for additional tests
  let genesisBlock = new Block(null, EASY_POW_TARGET);
  genesisBlock.utxo[alice] = 133;
  genesisBlock.utxo[bob] = 46;
  genesisBlock.utxo[charlie] = 8;
  genesisBlock.utxo[mike] = 4;
  genesisBlock.utxo[mini] = 12;

  describe('.deserialize', function() {
    let b = new Block(genesisBlock);
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
      assert.equal(b2.utxo[alice], b.utxo[alice]);
      assert.equal(b2.utxo[bob], b.utxo[bob]);
      assert.equal(b2.utxo[charlie], b.utxo[charlie]);
    });
    it("should carry over all metadata", function() {
      assert.equal(b2.comment, b.comment)
      assert.equal(b2.prevBlockHash, b.prevBlockHash);
      assert.equal(b2.timestamp, b.timestamp);
      assert.equal(b2.target, b.target);
      assert.equal(b2.proof, b.proof);
      assert.equal(b2.chainLength, b.chainLength);
    });
    it("should preserved serialized form", function() {
      assert.equal(b2.serialize(), s);
    });
  });

  describe('.constructor', function() {
    it("should increase chainLength by 1", function() {
      let b = new Block(genesisBlock);
      assert.equal(genesisBlock.chainLength, 1);
      assert.equal(b.chainLength, 2);
    });
    it("should carry over UTXO values", function() {
      let b = new Block(genesisBlock);
      assert.equal(b.balance(alice), 133);
      assert.equal(b.balance(bob), 46);
      assert.equal(b.balance(charlie), 8);
    });
    it("should record the hash value of the previous block", function() {
      let b = new Block(genesisBlock);
      assert.equal(b.prevBlockHash, genesisBlock.hashVal());
    });
  });

  describe('#addTransaction', function() {
    let b = new Block(genesisBlock);
    it("should reject invalid transactions", function() {
      let output = {};
      output[bob] = 1000000;
      let tx = utils.makeTransaction(kp.private, output, alice);
      assert.throws(function() {
        b.addTransaction(tx);
      });
    });
    it("should update the block's utxo if the transaction was successful", function() {
      let b2 = new Block(genesisBlock);
      let output = {};
      output[alice] = 100;
      output[bob] = 20;
      output[charlie] = 12;
      let tx = utils.makeTransaction(kp.private, output, alice);
      b2.addTransaction(tx);
      assert.equal(b2.balance(alice), 100);
      assert.equal(b2.balance(bob), genesisBlock.balance(bob)+20);
      assert.equal(b2.balance(charlie), genesisBlock.balance(charlie)+12);
    });
  });

  describe('#balance', function() {
    it("should return the unspent outputs for each user", function() {
      assert.equal(genesisBlock.balance(alice), 133);
      assert.equal(genesisBlock.balance(bob), 46);
      assert.equal(genesisBlock.balance(charlie), 8);
    });
    it("should return 0 for other users", function() {
      assert.equal(genesisBlock.balance('face0ff'), 0);
    });
  });

  describe('#legitTransaction', function() {
    it("should reject transactions spending excess coins", function() {
      let outputs = {};
      outputs[bob] = 500;
      let tx = utils.makeTransaction(kp.private, outputs, alice);
      assert.ok(!genesisBlock.legitTransaction(tx));
    });
    it("should reject transactions with negative amounts", function() {
      let outputs = {};
      outputs[bob] = -50;
      let tx = utils.makeTransaction(kp.private, outputs, alice);
      assert.ok(!genesisBlock.legitTransaction(tx));
    });
    it("should accept transactions with sufficient funds", function() {
      let outputs = {};
      outputs[bob] = 50;
      let tx = utils.makeTransaction(kp.private, outputs, alice);
      assert.ok(genesisBlock.legitTransaction(tx));
    });
    it("should accept one coinbase transaction in a block", function() {
      let outputs = {};
      outputs[alice] = 1;
      let tx = utils.makeTransaction(kp.private, outputs);
      assert.ok(genesisBlock.legitTransaction(tx));
    });
    it("should reject coinbase transactions that exceed the payout", function() {
      let outputs = {};
      outputs[alice] = 100000;
      let tx = utils.makeTransaction(kp.private, outputs);
      assert.ok(!genesisBlock.legitTransaction(tx));
    });
    it("should reject multiple coinbase transactions in a block", function() {
      let b = new Block(genesisBlock);
      let outputs = {};
      outputs[alice] = 1;
      let tx = utils.makeTransaction(kp.private, outputs);
      b.addTransaction(tx);
      // Trying to add the coinbase transaction a second time.
      assert.ok(!b.legitTransaction(tx));
    });
    it("should treat unspent coins as miner reward", function() {
      //FIXME
    });
  });

  describe('#updateUTXO', function() {
    let b = new Block(genesisBlock, EASY_POW_TARGET);
    let details = { output: {}};
    details.input = alice;
    details.output[bob] = 20;
    details.output[charlie] = 12;
    details.output[alice] = 100;
    b.updateUTXO(details);
    it("should update UTXO amounts with transaction details", function() {
      assert.equal(b.balance(bob), genesisBlock.balance(bob)+20);
      assert.equal(b.balance(charlie), genesisBlock.balance(charlie)+12);
    });
    it("should update the UTXO for the sender", function() {
      assert.equal(b.balance(alice), genesisBlock.balance(alice)-(20+12) - b.calculateUnspentChange(genesisBlock.balance(alice), (100+20+12)));
    });
  });

  describe('#verifyProof', function() {
    it("should accept a valid proof", function() {
      // Due to the low proof of work setting, we should be able
      // to find a proof within a few attempts.
      // If we have tried 100 proofs, it is overwhelmingly likely
      // that something has broken.
      genesisBlock.proof = 0;
      while (!genesisBlock.verifyProof() && genesisBlock.proof < 100) {
        genesisBlock.proof++;
      }
      assert.isTrue(genesisBlock.verifyProof());
    });
    it("should reject an invalid proof", function() {
      // It should be very easy to find a failing proof,
      // so we don't need to try many times.
      genesisBlock.proof = 0;
      while (genesisBlock.verifyProof() && genesisBlock.proof < 3) {
        genesisBlock.proof++;
      }
      assert.isFalse(genesisBlock.verifyProof());
    });
  });

});

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
  let account = utils.calcId(kp.public);
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
