const net = require('net');
const readline = require('readline');

const FakeNet = require('./fakeNet.js');
const Block = require('./block.js');
const Miner = require('./miner.js');

class TcpNet extends FakeNet {
  sendMessage(address, msg, o) {
    let data = {msg, o};
    const client = this.clients.get(address);
    let clientConnection = net.connect(client.connection, () => {
      clientConnection.write(JSON.stringify(data));
    });
  }

}

class TcpMiner extends Miner {
  static get REGISTER() { return "REGISTER"; }

  constructor({name, startingBlock, miningRounds, connection} = {}) {
    super({name, net: new TcpNet(), startingBlock, miningRounds});

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

  initialize(...knownMinerConnections) {
    super.initialize();
    this.srvr.listen(this.connection.port);
    for (let m of knownMinerConnections) {
      this.registerWith(m);
    }

  }

}

if (process.argv.length < 3) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <port>`);
  process.exit();
}
let port = process.argv[2];
let conn = {port: port};
let name = `Miner${port}`;

let knownMiners = process.argv.slice(3);

let emptyGenesis = new Block();

console.log(`Starting ${name}`);
let minnie = new TcpMiner({name: name, connection: conn, startingBlock: emptyGenesis});
minnie.initialize(...knownMiners);

// Silencing the logging messages
minnie.log = function(){};

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function readUserInput() {
  rl.question(`
  Funds: ${this.availableGold}
  
  What would you like to do?
  *(t)ransfer funds?
  *show (b)alances?
  *show (p)ending transactions?
  *e(x)it?
  
  Your choice: `, (answer) => {
    console.clear();
    switch (answer.trim().toLowerCase()) {
      case 'x':
        console.log(`Shutting down.  Have a nice day.`);
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      case 'b':
        console.log("  Balances: ");
        minnie.showAllBalances();
        break;
      case 't':
        rl.question(`  amount: `, (amt) => {
          if (amt > minnie.availableGold) {
            console.log(`***Insufficient gold.  You only have ${minnie.availableGold}.`);
          } else {
            rl.question(`  address: `, (addr) => {
              let output = {amount: amt, address: addr};
              console.log(`Transfering ${amt} gold to ${addr}.`);
              minnie.postTransaction([output]);
            });
          }
        });
        break;
      case 'p':
        console.log("Coming soon.");
        break;
      default:
        console.log(`Unrecognized choice: ${answer}`);
    }
    console.log();
    setTimeout(readUserInput, 0);
  });
}

readUserInput();

