"use strict";

let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');

let FakeNet = require('./fakeNet.js');

console.log("Starting simulation.  This may take a moment...");

// Creating genesis block
let genesis = new Block();

let fakeNet = new FakeNet();

// Clients
let alice = new Client(fakeNet, genesis);
let bob = new Client(fakeNet, genesis);
let charlie = new Client(fakeNet, genesis);

// Miners
let minnie = new Miner("Minnie", fakeNet, genesis);
let mickey = new Miner("Mickey", fakeNet, genesis);

// Setting initial gold.
genesis.balances = new Map([
  [alice.address, 133],
  [bob.address, 99],
  [charlie.address, 67],
  [minnie.address, 400],
  [mickey.address, 322],
]);

function showBalances(client) {
  console.log(`Alice has ${client.lastBlock.balanceOf(alice.address)} coins.`);
  console.log(`Bob has ${client.lastBlock.balanceOf(bob.address)} coins.`);
  console.log(`Charlie has ${client.lastBlock.balanceOf(charlie.address)} coins.`);
  console.log(`Minnie has ${client.lastBlock.balanceOf(minnie.address)} coins.`);
  console.log(`Mickey has ${client.lastBlock.balanceOf(mickey.address)} coins.`);
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances(alice);

fakeNet.register(alice, bob, charlie, minnie, mickey);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Alice transfers some money to Bob.
console.log(`Alice is transfering 40 coins to ${bob.address}`);
alice.postTransaction([{ amount: 40, address: bob.address }]);

// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log();
  console.log(`Minnie has a chain of length ${minnie.currentBlock.chainLength}:`);

  console.log();
  console.log(`Mickey has a chain of length ${mickey.currentBlock.chainLength}:`);

  console.log();
  console.log("Final balances (Minnie's perspective):");
  showBalances(minnie);

  console.log();
  console.log("Final balances (Alice's perspective):");
  showBalances(alice);

  throw "TERMINATE";
}, 5000);
