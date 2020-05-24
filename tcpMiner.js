const net = require('net');

const FakeNet = require('./fakeNet.js');
const Block = require('./block.js');
const Miner = require('./miner.js');

class TcpNet extends FakeNet {
  sendMessage(address, msg, o) {
    //console.log(`Calling sendMessage ${msg}`);
    let data = {msg, o};
    const client = this.clients.get(address);
    let clientConnection = net.connect(client.connection, () => {
      //console.log(`Writing ${data.msg} to ${JSON.stringify(client.connection)}`);
      clientConnection.write(JSON.stringify(data));
    });
  }

}

class TcpMiner extends Miner {
  static get REGISTER() { return "REGISTER"; }

  constructor({name, startingBlock, miningRounds, connection} = {}) {
    super({name, net: new TcpNet(), startingBlock, miningRounds});
    this.connection = connection;
    this.srvr = net.createServer();
    this.srvr.on('connection', (client) => {
      this.log('Received connection');
      client.on('data', (data) => {
        //this.log(`Received data: ${data}`);
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
    })
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

  showMenu() {
    console.log("What would you like to do?");
    console.log("(t)ransfer funds?");
    console.log("show (b)alances?");
    console.log("show (p)ending transactions?");
    console.log("(e)xit?");
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

setTimeout(() => {
  minnie.showAllBalances();
  process.exit(0);
},5000);
