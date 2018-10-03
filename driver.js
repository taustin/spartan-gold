let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');

let utils = require('./utils.js');
let fakeNet = require('./fakeNet.js');


// Creating a genesis block and miners.
const GENESIS_BLOCK = new Block();

let ak = utils.generateKeypair();
let bk = utils.generateKeypair();
let ck = utils.generateKeypair();

GENESIS_BLOCK.utxo[utils.calcId(ak.public)] = 132;
GENESIS_BLOCK.utxo[utils.calcId(bk.public)] = 49;
GENESIS_BLOCK.utxo[utils.calcId(ck.public)] = 16;

let alice = new Miner(fakeNet.broadcast, ak, GENESIS_BLOCK);
let bob = new Miner(fakeNet.broadcast, bk, GENESIS_BLOCK);
let charlie = new Miner(fakeNet.broadcast, ck, GENESIS_BLOCK);

fakeNet.registerMiner(alice);
fakeNet.registerMiner(bob);
fakeNet.registerMiner(charlie);

// Makes transactions for transferring money between the three parties.
function transfer(sender, a, b, c) {
  let output = {};
  output[alice.keys.id] = a;
  output[bob.keys.id] = b;
  output[charlie.keys.id] = c;
  sender.postTransaction(output);
}



console.log("Initial balances");
console.log(alice.currentBlock.utxo);

console.log("Beginning to mine");

alice.initialize();
bob.initialize();
charlie.initialize();

transfer(alice, 100, 20, 12);

// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log(alice.currentBlock.utxo);
  console.log(bob.currentBlock.utxo);
  console.log(charlie.currentBlock.utxo);
}, 5000);




