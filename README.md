# SpartanGold

SpartanGold (SG) is a simplified blockchain-based cryptocurrency for education and experimentation.

Its design is *loosely* based on Bitcoin.  Like Bitcoin, SpartanGold uses a proof-of-work (PoW) blockchain.  However, several parts of the design are simplified.  For example:

- SpartanGold uses an **account-based** model, rather than Bitcoin's unspent transaction output (UTXO) model.
- No scripting language is used.  Transactions are only designed to transfer money (gold in SG parlance).
- The proof-of-work target is not adjusted during program execution.

All of these features could be added to SpartanGold, but we want to make the design as simple and easy to modify as possible.


## Using SpartanGold

There are two different approaches for running SpartanGold:

1. In *single-threaded mode*, multiple miners and clients can run within the same JavaScript process.
1. Using TcpMiner, the SpartanGold code runs within different JavaScript processes.

### Single-threaded Mode

This mode is designed for quick and easy experimentation, avoiding a lot of unnecessary complexity.

To see an example, run driver.js from the command line:

``
$ node driver.js
``

This script has three miners, *Minnie*, *Mickey*, and *Donald*, along with three additional non-mining clients.  Donald starts after a delay and must spend some time catching up with the other two miners.

One point to note is that Donald is given more mining power, represented as the `miningRounds` parameter.  Minnie and Mickey try 2000 hashes when it is their turn to find a proof, whereas Donald tries 3000 hashes.  Over time, Donald should earn more rewards than the other two miners, despite his late start.

Note that the use of `miningRounds` as a way to specify mining power only works in single-threaded mode.

### Multi-process Mode

In this mode, each SpartanGold miner runs in its own JavaScript process.  All miners run on `localhost` and specify a port at the command line.

To start a miner on localhost, port 9000:

``
$ node tcpMiner.js 9000
``

This presents a text-based menu, including information about the miner's address, its current funds, and any outstanding transactions that it has.  Here is an example:

``` fundamental
Starting Miner9000

  Funds: 0
  Address: 6w6/Z2hWMxJPBDsUM83hM1P2x/hhAtX0i4CZ92os+Kg=
  Pending transactions: 
  
  What would you like to do?
  *(c)onnect to miner?
  *(t)ransfer funds?
  *(r)esend pending transactions?
  *show (b)alances?
  *show blocks for (d)ebugging and exit?
  *e(x)it?
  
  Your choice:
```

In a separate process, you can start an additional miner on another port.  The miner will register with miners at any additional ports listed.  For instance, to start a miner on port 9001 that will connect with the miner on port 9000, run:

``
$ node tcpMiner.js 9001 9000
``

The two miners will now race to find proofs, sending their blocks back and forth.

While this mode is a little more complex, it creates a more realistic feel, and takes away some possible "cheats" that you can get away with in single-threaded mode.

## Projects Based on SpartanGold

SpartanGold is designed to allow students to experiment with a Bitcoin-like cryptocurrency.  A few different projects have used it as the basis of a cryptocurrency prototype:

- For her [master's thesis](https://scholarworks.sjsu.edu/etd_projects/675/), Jisha Pillai developed a fork of SG with [earmarked UTXOs](https://github.com/jishavps/spartan-gold).  Note that this was based on an older version of SG that used a UTXO model.
- Prashant Pardeshi's thesis implemented [TontineCoin](https://scholarworks.sjsu.edu/etd_projects/914/), a proof-of-stake cryptocurrency.  [His implementation](https://github.com/prashantp-git/TontineCoin) combined a TenderMint-like protocol with the Tontine financial structure.
