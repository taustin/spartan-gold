"use strict";

let Block = require('./block.js');
let Client = require('./client.js');
//let Miner = require('./miner.js');

let utils = require('./utils.js');
let fakeNet = require('./fakeNet.js');

let alice = new Client(fakeNet.broadcast);
let bob = new Client(fakeNet.broadcast);
let charlie = new Client(fakeNet.broadcast);

let genesis = Block.makeGenesisBlock([
  { client: alice, amount: 133},
  { client: bob, amount: 99},
  { client: charlie, amount: 50},
]);

console.log(`Alice has ${alice.wallet.balance} coins.`);
console.log(`Bob has ${bob.wallet.balance} coins.`);
console.log(`Charlie has ${charlie.wallet.balance} coins.`);

fakeNet.register(alice, bob, charlie);

let bobAddr = bob.wallet.makeAddress();
alice.postTransaction([{ amount: 40, pubKeyHash: bobAddr }]);

console.log();
console.log("After a transaction:");
console.log(`Alice has ${alice.wallet.balance} coins.`);
console.log(`Charlie has ${charlie.wallet.balance} coins.`);

/*
// Creating a genesis block and miners.
const GENESIS_BLOCK = new Block();

//Generating keypairs for Clients - Alice, Bob & Charlie
// Miners - Mike & Mini
let ak = utils.generateKeypair();
let bk = utils.generateKeypair();
let ck = utils.generateKeypair();
//Add miners
let mk = utils.generateKeypair();
let mn = utils.generateKeypair();


GENESIS_BLOCK.utxo[utils.calcId(ak.public)] = 133;
GENESIS_BLOCK.utxo[utils.calcId(bk.public)] = 49;
GENESIS_BLOCK.utxo[utils.calcId(ck.public)] = 16;
GENESIS_BLOCK.utxo[utils.calcId(mk.public)] = 4;
GENESIS_BLOCK.utxo[utils.calcId(mn.public)] = 12;


let alice = new Client(fakeNet.broadcast, ak);
let bob = new Client(fakeNet.broadcast, bk);
let charlie = new Client(fakeNet.broadcast, ck);
let mike = new Miner(fakeNet.broadcast, mk, GENESIS_BLOCK);
let mini = new Miner(fakeNet.broadcast, mn, GENESIS_BLOCK);


fakeNet.registerMiner(mike);
fakeNet.registerMiner(mini);


// Makes transactions for transferring money between the three parties.
function transfer(sender, a, b, c) {
  let output = {};
  output[alice.keys.id] = a;
  output[bob.keys.id] = b;
  output[charlie.keys.id] = c;
  sender.postTransaction(output);
}


console.log("Initial balances");
console.log(mike.currentBlock.utxo)
console.log(mini.currentBlock.utxo)


console.log("Beginning to mine");

mike.initialize()
mini.initialize()


transfer(alice, 100, 20, 12);


// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log(mike.currentBlock.utxo)
  console.log(mini.currentBlock.utxo)

}, 5000);
*/
