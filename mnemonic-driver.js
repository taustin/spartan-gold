"use strict";

let Blockchain = require('./blockchain.js');

// Used to create a client outside of the blockchain constructor.
let Client = require('./client.js');


// Used to create a miner outside of the blockchain constructor.
let Miner = require('./miner.js');

let FakeNet = require('./fake-net.js');

console.log("Starting simulation.  This may take a moment...");

// Creating genesis block
let bc = Blockchain.createInstance({
  clients: [
    {name: 'Alice', amount: 233, password: 'alice_pswd'},
    {name: 'Bob', amount: 99, password: 'bob_pswd'},
    {name: 'Charlie', amount: 67, password: 'charlie_pswd'},
    {name: 'Minnie', amount: 400, mining: true},
    {name: 'Mickey', amount: 300, mining: true},
  ],
  mnemonic: "antenna dwarf settle sleep must wool ocean once banana tiger distance gate great similar chief cheap dinner dolphin picture swing twenty two file nuclear",
  net: new FakeNet(),
});

// Late client - to demnonstrate that clients can be initialized after blockchain initialization
let trudy = new Client({name: 'Trudy', startingBlock: bc.genesis});
bc.register(trudy);

// Get Alice and Bob
let [alice, bob] = bc.getClients('Alice', 'Bob');

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
alice.showAllBalances();

// The miners will start mining blocks when start is called.  After 5 seconds,
// the code will terminate and show the final balances from Alice's perspective.
bc.start(8000, () => {
  console.log("Final balances, from Alice's perspective:");
  alice.showAllBalances();
});

// Alice transfers some money to Bob.
console.log(`Alice is transferring 40 gold to ${bob.address}`);
alice.postTransaction([{ amount: 40, address: bob.address }]);

// Alice transfers some money to Bob.
console.log(`Alice is transferring 20 gold to ${trudy.address}`);
alice.postTransaction([{ amount: 20, address: trudy.address }]);


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

