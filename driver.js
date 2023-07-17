"use strict";

let Blockchain = require('./blockchain.js');

// FIXME: Figure out how to remove these imports
let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');
let Transaction = require('./transaction.js');

let FakeNet = require('./fake-net.js');

console.log("Starting simulation.  This may take a moment...");

// Creating genesis block
let bc = Blockchain.createInstance({
  blockClass: Block,
  clientClass: Client,
  minerClass: Miner,
  transactionClass: Transaction,
  clients: [
    {name: 'Alice', amount: 233},
    {name: 'Bob', amount: 99},
    {name: 'Charlie', amount: 67},
    {name: 'Minnie', amount: 400, mining: true},
    {name: 'Mickey', amount: 300, mining: true},
  ],
  net: new FakeNet(),
});

// Get Alice and Bob
let [alice, bob] = bc.getClients('Alice', 'Bob');

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
alice.showAllBalances();

// The miners will start mining blocks when start is called.  After 5 seconds,
// the code will terminate and show the final balances from Alice's perspective.
bc.start(5000, () => {
  console.log("Final balances, from Alice's perspective:");
  alice.showAllBalances();
});

// Alice transfers some money to Bob.
console.log(`Alice is transferring 40 gold to ${bob.address}`);
alice.postTransaction([{ amount: 40, address: bob.address }]);

setTimeout(() => {
  // Late miner - Donald has more mining power, represented by the miningRounds.
  // (Mickey and Minnie have the default of 2000 rounds).
  let donald = new Miner({
    name: "Donald",
    startingBlock: bc.genesis,
    miningRounds: 3000,
  });

  console.log();
  console.log("***Starting a late-to-the-party miner***");
  console.log();
  bc.register(donald);
  donald.initialize();
}, 2000);


