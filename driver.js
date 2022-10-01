"use strict";
// const crypto = require('crypto')

let Blockchain = require('./blockchain.js');
let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');
let Transaction = require('./transaction.js');

let FakeNet = require('./fake-net.js');

// const LOTTO_REWARD = 10;

console.log("Starting simulation.  This may take a moment...");

let fakeNet = new FakeNet();

// Clients
let alice = new Client({name: "Alice", net: fakeNet});
let bob = new Client({name: "Bob", net: fakeNet});
let charlie = new Client({name: "Charlie", net: fakeNet});
let richie = new Client({name: "Richie", net: fakeNet});

// Miners
let minnie = new Miner({name: "Minnie", net: fakeNet});
let mickey = new Miner({name: "Mickey", net: fakeNet});

// Creating genesis block
let genesis = Blockchain.makeGenesis({
  blockClass: Block,
  transactionClass: Transaction,
  clientBalanceMap: new Map([
    [alice, 140],
    [bob, 230],
    [charlie, 67],
    [minnie, 400],
    [mickey, 300],
    [richie, 1000]
  ]),
});

// array containing the 'tickets' each miner has for the lotto

// Late miner - Donald has more mining power, represented by the miningRounds.
// (Mickey and Minnie have the default of 2000 rounds).
let donald = new Miner({name: "Donald", net: fakeNet, startingBlock: genesis, miningRounds: 3000});

function showBalances(client) {
  console.log(`Alice has ${client.lastBlock.balanceOf(alice.address)} gold.`);
  console.log(`Bob has ${client.lastBlock.balanceOf(bob.address)} gold.`);
  console.log(`Charlie has ${client.lastBlock.balanceOf(charlie.address)} gold.`);
  console.log(`Minnie has ${client.lastBlock.balanceOf(minnie.address)} gold.`);
  console.log(`Mickey has ${client.lastBlock.balanceOf(mickey.address)} gold.`);
  console.log(`Donald has ${client.lastBlock.balanceOf(donald.address)} gold.`);
  console.log(`Richie has ${client.lastBlock.balanceOf(richie.address)} gold.`);
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");

showBalances(alice);

fakeNet.register(alice, bob, charlie, minnie, mickey, richie);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Alice transfers some money to Bob.
console.log(`Bob is transferring 40 gold to ${richie.address}`);
bob.postTransaction([{ fee: 1, amount: 30, address: richie.address }]);

alice.postTransaction([{ fee: 2, amount: 40, address: richie.address }]);

// bob.postTransaction([{ amount: 40, address: alice.address }]);

setTimeout(() => {
  console.log();
  console.log("***Starting a late-to-the-party miner***");
  console.log();
  fakeNet.register(donald);
  donald.initialize();
}, 2000);


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

  console.log("Alice's adress: " + alice.address)
  console.log("Bob's adress: " + bob.address)

  process.exit(0);
}, 10000);
