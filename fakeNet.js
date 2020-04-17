"use strict";

/**
 * Simulates a network by using events to enable simpler testing.
 */
module.exports = class FakeNet {
    
    constructor() {
        this.clients = {};
        this.clientCtr = 0;
    }
    
    /**
     * Registers clients to the network.
     * Clients receive a random identity (e.g. client0, client1...)
     * Miners are registered by name.
     * In the future, may change this method to register by public key regardless of miner/client.
     * 
     * @param {...Object} clientList - clients to be registered to this network (may be Client or Miner)
     */
    register(...clientList) {
        clientList.forEach(client => {
            console.log(`Registering ${client.address}`);
            this.clients[client.address] = client;
        });
    }

    /**
     * Broadcasts to all clients within this.clients the message msg and payload o.
     * 
     * @param {String} msg - the name of the event being broadcasted (e.g. "PROOF_FOUND")
     * @param {Object} o - payload of the message
     */
    broadcast(msg, o) {
        Object.keys(this.clients).forEach((clientName) => {
            this.sendMessage(clientName, msg, o);
        });
    }

    /**
     * Sends message msg and payload o directly to Client name.
     * 
     * @param {String} name - the name of the client or miner to which to send the message
     * @param {String} msg - the name of the event being broadcasted (e.g. "PROOF_FOUND")
     * @param {Objejct} o - payload of the message
     */
    sendMessage(name, msg, o) {
        let client = this.clients[name];
        client.emit(msg, o);
    }

}
