const net = require('net');
const readline = require('readline');
const { readFileSync, writeFileSync } = require('fs');

const FakeNet = require('./fakeNet.js');
const Blockchain = require('./blockchain.js');
const Block = require('./block.js');
const Miner = require('./miner.js');
const Transaction = require('./transaction.js');

/**
 * This extends the FakeNet class to actually communicate over the network.
 */
class TcpNet extends FakeNet {
  sendMessage(address, msg, o) {
    if (typeof o === 'string') o = JSON.parse(o);
    let data = {msg, o};
    const client = this.clients.get(address);
    let clientConnection = net.connect(client.connection, () => {
      clientConnection.write(JSON.stringify(data));
    });
  }

}

/**
 * Provides a command line interface for a SpartanGold miner
 * that will actually communicate over the network.
 */
class TcpMiner extends Miner {
  static get REGISTER() { return "REGISTER"; }

  /**
   * In addition to the usual properties for a miner, the constructor
   * also takes a JSON object for the connection information and sets
   * up a listener to listen for incoming connections.
   */
  constructor({name, startingBlock, miningRounds, keyPair, connection} = {}) {
    super({name, net: new TcpNet(), startingBlock, keyPair, miningRounds});

    // Setting up the server to listen for connections
    this.connection = connection;
    this.srvr = net.createServer();
    this.srvr.on('connection', (client) => {
      this.log('Received connection');
      client.on('data', (data) => {
        let {msg, o} = JSON.parse(data);
        if (msg === TcpMiner.REGISTER) {
          if (!this.net.recognizes(o)) {
            this.registerWith(o.connection);
          }
          this.log(`Registering ${JSON.stringify(o)}`);
          this.net.register(o);
        } else {
          this.emit(msg, o);
        }
      });
    });
  }

  /**
   * Connects with the miner specified using the connection details provided.
   * 
   * @param {Object} minerConnection - The connection information for the other miner.
   */
  registerWith(minerConnection) {
    this.log(`Connection: ${JSON.stringify(minerConnection)}`);
    let conn = net.connect(minerConnection, () => {
      let data = {
        msg: TcpMiner.REGISTER,
        o: {
          name: this.name,
          address: this.address,
          connection: this.connection,
        }
      };
      conn.write(JSON.stringify(data));
    });
  }

  /**
   * Begins mining and registers with any known miners.
   */
  initialize(knownMinerConnections) {
    this.knownMiners = knownMinerConnections;
    super.initialize();
    this.srvr.listen(this.connection.port);
    for (let m of knownMinerConnections) {
      this.registerWith(m);
    }
  }

  /**
   * Prints out a list of any pending outgoing transactions.
   */
  showPendingOut() {
    let s = "";
    this.pendingOutgoingTransactions.forEach((tx) => {
      s += `\n    id:${tx.id} nonce:${tx.nonce} totalOutput: ${tx.totalOutput()}\n`;
    });
    return s;
  }

  saveJson(fileName) {
    let state = {
      name: this.name,
      connection: this.connection,
      keyPair: this.keyPair,
      knownMiners: this.knownMiners,
    };
    writeFileSync(fileName, JSON.stringify(state));
  }

}

if (process.argv.length !== 3) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <config.json>`);
  process.exit();
}
let config = JSON.parse(readFileSync(process.argv[2]));
let name = config.name;

let knownMiners = config.knownMiners || [];

// Clearing the screen so things look a little nicer.
console.clear();

let startingBalances = config.genesis ? config.genesis.startingBalances : {};
let genesis = Blockchain.makeGenesis({
  blockClass: Block,
  transactionClass: Transaction,
  startingBalances: startingBalances
});

console.log(`Starting ${name}`);
let minnie = new TcpMiner({name: name, keyPair: config.keyPair, connection: config.connection, startingBlock: genesis});

// Silencing the logging messages
minnie.log = function(){};

// Register with known miners and begin mining.
minnie.initialize(knownMiners);

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function readUserInput() {
  rl.question(`
  Funds: ${minnie.availableGold}
  Address: ${minnie.address}
  Pending transactions: ${minnie.showPendingOut()}
  
  What would you like to do?
  *(c)onnect to miner?
  *(t)ransfer funds?
  *(r)esend pending transactions?
  *show (b)alances?
  *show blocks for (d)ebugging and exit?
  *(s)ave your state?
  *e(x)it without saving?
  
  Your choice: `, (answer) => {
    console.clear();
    switch (answer.trim().toLowerCase()) {
      case 'x':
        console.log(`Shutting down.  Have a nice day.`);
        process.exit(0);
        /* falls through */
      case 'b':
        console.log("  Balances: ");
        minnie.showAllBalances();
        break;
      case 'c':
        rl.question(`  port: `, (p) => {
          minnie.registerWith({port: p});
          console.log(`Registering with miner at port ${p}`);
          readUserInput();
        });
        break;
      case 't':
        rl.question(`  amount: `, (amt) => {
          amt = parseInt(amt);
          if (amt > minnie.availableGold) {
            console.log(`***Insufficient gold.  You only have ${minnie.availableGold}.`);
            readUserInput();
          } else {
            rl.question(`  address: `, (addr) => {
              let output = {amount: amt, address: addr};
              console.log(`Transferring ${amt} gold to ${addr}.`);
              minnie.postTransaction([output]);
              readUserInput();
            });
          }
        });
        break;
      case 'r':
        minnie.resendPendingTransactions();
        break;
      case 's':
        rl.question(`  file name: `, (fname) => {
          minnie.saveJson(fname);
          readUserInput();
        });
        break;
      case 'd':
        minnie.blocks.forEach((block) => {
          let s = "";
          block.transactions.forEach((tx) => s += `${tx.id} `);
          if (s !== "") console.log(`${block.id} transactions: ${s}`);
        });
        console.log();
        minnie.showBlockchain();
        process.exit(0);
        /* falls through */
      default:
        console.log(`Unrecognized choice: ${answer}`);
    }
    console.log();
    setTimeout(readUserInput, 0);
  });
}

readUserInput();

