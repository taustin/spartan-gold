"use strict";

let Blockchain = require("./blockchain.js");
let Client = require("./client.js");
let Miner = require("./miner.js");
let Transaction = require("./transaction.js");
let SpartanScriptBlock = require("./spartan-script-block.js");

let FakeNet = require("./fake-net.js");
let utils = require("./utils.js");

console.log("Starting simulation.  This may take a moment...");

const fs = require("fs");

let fakeNet = new FakeNet();

// Clients
let alice = new Client({ name: "Alice", net: fakeNet });
let bob = new Client({ name: "Bob", net: fakeNet });
let charlie = new Client({ name: "Charlie", net: fakeNet });

// Miners
let minnie = new Miner({ name: "Minnie", net: fakeNet });
let mickey = new Miner({ name: "Mickey", net: fakeNet });

let smartContract1 = new Client({ name: "SmartContract1", net: fakeNet });
let smartContract2 = new Client({ name: "SmartContract2", net: fakeNet });
let smartContract3 = new Client({ name: "SmartContract3", net: fakeNet });
let smartContract4 = new Client({ name: "SmartContract4", net: fakeNet });

// Creating genesis block
let genesis = Blockchain.makeGenesis({
  blockClass: SpartanScriptBlock,
  transactionClass: Transaction,
  clientBalanceMap: new Map([
    [alice, 233],
    [bob, 99],
    [charlie, 67],
    [minnie, 400],
    [mickey, 300],
    [smartContract1, 100],
    [smartContract2, 100],
    [smartContract3, 100],
    [smartContract4, 100],
  ]),
});
// Late miner - Donald has more mining power, represented by the miningRounds.
// (Mickey and Minnie have the default of 2000 rounds).
let donald = new Miner({
  name: "Donald",
  net: fakeNet,
  startingBlock: genesis,
  miningRounds: 3000,
});

function showBalances(client) {
  console.log(
    `Alice has ${client.lastBlock.balanceOf(alice.address)} gold. ${
      alice.address
    }`
  );
  console.log(`Bob has ${client.lastBlock.balanceOf(bob.address)} gold.`);
  console.log(
    `Charlie has ${client.lastBlock.balanceOf(charlie.address)} gold. ${
      charlie.address
    }`
  );
  console.log(`Minnie has ${client.lastBlock.balanceOf(minnie.address)} gold.`);
  console.log(`Mickey has ${client.lastBlock.balanceOf(mickey.address)} gold.`);
  console.log(`Donald has ${client.lastBlock.balanceOf(donald.address)} gold.`);
  console.log(
    `Smart Contract 1 has ${client.lastBlock.balanceOf(
      smartContract1.address
    )} gold.`
  );
  console.log(
    `Smart Contract 2 has ${client.lastBlock.balanceOf(
      smartContract2.address
    )} gold.`
  );
  console.log(
    `Smart Contract 3 has ${client.lastBlock.balanceOf(
      smartContract3.address
    )} gold.`
  );
  console.log(
    `Smart Contract 4 has ${client.lastBlock.balanceOf(
      smartContract4.address
    )} gold.`
  );
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances(alice);

fakeNet.register(alice, bob, charlie, minnie, smartContract1);

// Miners start mining.
minnie.initialize();
// mickey.initialize();

let smartContract1Script =
  "(provide getgold balance)(define getgold (lambda (amt dest) ($transfer amt dest)))(define balance (lambda () ($balance $me)))";
let script2 =
  "(provide counter)(defineState val 0)(define counter (lambda () (set! val (+ val 1))))";
//let script3 = '(provide transferGold)(define transferGold(lambda (addr1 addr2 amount)(if (== (% $timestamp 2) 0)($transfer amount addr1)($transfer amount addr2))))';
// let script4 = '(provide getgold balance)(define getgold (lambda (amt dest) ($transfer amt dest)))(define balance (lambda () ($balance $me)))';

let smartContract1Scripthashtest =
  "(provide getgold balance)(define getgold (lambda (amt dest) ($transfer amt dest)))(define balance (lambda () ($balance $me)))        ";

let script5 =
  "(provide counter)(defineState val)(define counter (lambda () (set! val (+ val 1))(+ 4 5)))";

let script3 = fs.readFileSync("./spartan-script/test-scripts/timestamp.scm").toString();
let script4 = fs
  .readFileSync("./spartan-script/test-scripts/erc20.scm")
  .toString();

// Alice transfers some money to Bob.
console.log(`Alice is transferring 40 gold to ${bob.address}`);
alice.postTransaction([{ amount: 40, address: bob.address }]);

console.log(`Running smart contract 1`);
alice.postGenericTransaction({
  data: {
    type: "ContractDeclaration",
    scriptHash: utils.hashContract(smartContract1Script),
    scriptContent: smartContract1Script,
    address: smartContract1.address,
  },
});
alice.postGenericTransaction({
  data: {
    type: "ContractInvocation",
    scriptHash: utils.hashContract(smartContract1Script),
    call: `(getgold 20 ${alice.address}) (balance) (define a 4)`,
    address: smartContract1.address,
    gasLimit: 200,
  },
});

// console.log(`Running smart contract 2`);
// console.log(alice.postGenericTransaction({data: { type: 'ContractDeclaration', scriptHash: 2, scriptContent: script2, address: smartContract2.address }}));
// console.log(alice.postGenericTransaction({data: { type: 'ContractInvocation', scriptHash: 2, call: `(counter) (counter) (counter)`, address: smartContract2.address, gasLimit: 20 }}));

// console.log(`Running smart contract 3`);
// console.log(alice.postGenericTransaction({data: { type: 'ContractDeclaration', scriptHash: 3, scriptContent: script3, address: smartContract3.address }}));
// console.log(alice.postGenericTransaction({data: { type: 'ContractInvocation', scriptHash: 3, call: `(transferGold ${alice.address} ${bob.address} 10)`, address: smartContract3.address, gasLimit: 200 }}));

// let constructorCall = `(defineState totalSupply 200)(defineState balances makeMap)(defineState allowed makeMap)(setMap balances $sender totalSupply)`;

// let calls = `(totalSupply)(balanceOf $sender)(transfer ${bob.address} 25)`;

// console.log(`Running smart contract 4`);

// alice.postGenericTransaction({
//   data: {
//     type: "ContractDeclaration",
//     scriptHash: utils.hashContract(script4),
//     scriptContent: script4,
//     address: smartContract4.address,
//   },
// });

// alice.postGenericTransaction({
//   data: {
//     type: "ContractInvocation",
//     scriptHash: utils.hashContract(script4),
//     call: constructorCall + calls,
//     address: smartContract4.address,
//     gasLimit: 200,
//   },
// });

// let bobCall = `(approve ${charlie.address} 50)(allowance ${bob.address} ${charlie.address})`;

// let charlieCall = `(transferFrom ${bob.address} ${charlie.address} 25)`;

// console.log(
//   bob.postGenericTransaction({
//     data: {
//       type: "ContractInvocation",
//       scriptHash: utils.hashContract(script4),
//       call: bobCall,
//       address: smartContract4.address,
//       gasLimit: 200,
//     },
//   })
// );

// console.log(
//   charlie.postGenericTransaction({
//     data: {
//       type: "ContractInvocation",
//       scriptHash: utils.hashContract(script4),
//       call: charlieCall,
//       address: smartContract4.address,
//       gasLimit: 200,
//     },
//   })
// );

// console.log(`Running smart contract 5`);
// console.log(alice.postGenericTransaction({data: { type: 'ContractDeclaration', scriptHash: 5, scriptContent: script5, address: smartContract2.address }}));
// console.log(alice.postGenericTransaction({data: { type: 'ContractInvocation', scriptHash: 5, call: `(counter) (counter) (counter)`, address: smartContract2.address, gasLimit: 20 }}));

// setTimeout(() => {
//   console.log();
//   console.log("***Starting a late-to-the-party miner***");
//   console.log();
//   fakeNet.register(donald);
//   donald.initialize();
// }, 2000);

// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log();
  console.log(
    `Minnie has a chain of length ${minnie.currentBlock.chainLength}:`
  );

  // console.log();
  // console.log(`Mickey has a chain of length ${mickey.currentBlock.chainLength}:`);

  // console.log();
  // console.log(`Donald has a chain of length ${donald.currentBlock.chainLength}:`);

  console.log();
  console.log("Final balances (Smart contract 1's perspective):");
  showBalances(smartContract1);

  console.log();
  console.log("Final balances (Minnie's perspective):");
  showBalances(minnie);

  console.log();
  console.log("Final balances (Alice's perspective):");
  showBalances(alice);

  // console.log();
  // console.log("Final balances (Donald's perspective):");
  // showBalances(donald);

  process.exit(0);
}, 5000);
