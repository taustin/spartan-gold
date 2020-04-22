"use strict";

let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');

let FakeNet = require('./fakeNet.js');

console.log("Starting simulation.  This may take a moment...");


let fakeNet = new FakeNet();

// Clients
let alice = new Client(fakeNet);
let bob = new Client(fakeNet);
let charlie = new Client(fakeNet);

// Miners
let minnie = new Miner("Minnie", fakeNet);
let mickey = new Miner("Mickey", fakeNet);

// Creating genesis block
let genesis = Block.makeGenesis(new Map([
  [alice, 133],
  [bob, 99],
  [charlie, 67],
  [minnie, 400],
  [mickey, 322],
]));

// Late miner
let donald = new Miner("Donald", fakeNet, genesis);

function showBalances(client) {
  console.log(`Alice has ${client.lastBlock.balanceOf(alice.address)} gold.`);
  console.log(`Bob has ${client.lastBlock.balanceOf(bob.address)} gold.`);
  console.log(`Charlie has ${client.lastBlock.balanceOf(charlie.address)} gold.`);
  console.log(`Minnie has ${client.lastBlock.balanceOf(minnie.address)} gold.`);
  console.log(`Mickey has ${client.lastBlock.balanceOf(mickey.address)} gold.`);
  console.log(`Donald has ${client.lastBlock.balanceOf(donald.address)} gold.`);
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances(alice);

fakeNet.register(alice, bob, charlie, minnie, mickey);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Alice transfers some money to Bob.
console.log(`Alice is transfering 40 gold to ${bob.address}`);
alice.postTransaction([{ amount: 40, address: bob.address }]);

setTimeout(() => {
  console.log();
  console.log("***Starting a late-to-the-party miner***");
  console.log();
  fakeNet.register(donald);
  donald.initialize();
}, 2000)

// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log();
  console.log(`Minnie has a chain of length ${minnie.currentBlock.chainLength}:`);

  console.log();
  console.log(`Mickey has a chain of length ${mickey.currentBlock.chainLength}:`);

  console.log();
  console.log(`Donald has a chain of length ${donald.currentBlock.chainLength}:`);

  console.log();
  console.log("Final balances (Minnie's perspective):");
  showBalances(minnie);

  console.log();
  console.log("Final balances (Alice's perspective):");
  showBalances(alice);

  console.log();
  console.log("Final balances (Donald's perspective):");
  showBalances(donald);

  process.exit(0);
}, 5000);
