"use strict";

let Block = require('./block.js');
let Client = require('./client.js');
let Miner = require('./miner.js');

let FakeNet = require('./fakeNet.js');

console.log("Starting simulation.  This may take a moment...");


let fakeNet = new FakeNet();

// Clients
let alice = new Client({name: "Alice", net: fakeNet});
let belle = new Client({name: "Belle", net: fakeNet});
let cinderella = new Client({name: "Cinderella", net: fakeNet});

// Miners
let minnie = new Miner({name: "Minnie", net: fakeNet});
let mickey = new Miner({name: "Mickey", net: fakeNet});

// Malicious client
let maleficent = new Client({name: "Maleficent", net: fakeNet});

// Maleficent listens for transactions where she receives a reward
// so that she can replay them later.
maleficent.on("POST_TRANSACTION", (tx) => {
  if (tx.outputs[0].address === maleficent.address && !maleficent.oldTransaction) {
    maleficent.oldTransaction = tx;
    maleficent.log(`***Recording transaction ${tx.id} for replaying later.`);
  }
});

// Maleficent listens for Minnie to broadcast a new block,
// and then attempts to steal her reward.
maleficent.on("PROOF_FOUND", (block) => {
  if (typeof block === 'string') {
    block = Block.deserialize(block);
  }
  if (block.rewardAddr === minnie.address) {
    maleficent.log("***Attempting to steal reward from Minnie");
    if (maleficent.oldTransaction) {
      maleficent.net.broadcast("POST_TRANSACTION", maleficent.oldTransaction);
    }
  }
});


// Creating genesis block
let genesis = Block.makeGenesis(new Map([
  [alice, 133],
  [belle, 99],
  [cinderella, 67],
  [minnie, 400],
  [mickey, 322],
  [maleficent, 10],
]));

function showBalances(client) {
  console.log(`Alice has ${client.lastBlock.balanceOf(alice.address)} gold.`);
  console.log(`Belle has ${client.lastBlock.balanceOf(belle.address)} gold.`);
  console.log(`Cinderella has ${client.lastBlock.balanceOf(cinderella.address)} gold.`);
  console.log(`Minnie has ${client.lastBlock.balanceOf(minnie.address)} gold.`);
  console.log(`Mickey has ${client.lastBlock.balanceOf(mickey.address)} gold.`);
  console.log(`Maleficent has ${client.lastBlock.balanceOf(maleficent.address)} gold.`);
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances(alice);

fakeNet.register(alice, belle, cinderella, minnie, mickey, maleficent);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Alice transfers some money to Belle.
console.log(`Alice is transfering 40 gold to ${belle.address}`);
alice.postTransaction([{ amount: 40, address: belle.address }]);

// Minnie transfers some money to Maleficent.
console.log(`Minnie is transfering 25 gold to ${maleficent.address}`);
minnie.postTransaction([{ amount: 40, address: maleficent.address }]);

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

  process.exit(0);
}, 5000);

