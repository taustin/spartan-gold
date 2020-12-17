"use strict";

/**
 * Simulates a network by using events to enable simpler testing.
 */
module.exports = class FakeNet {

  /**
   * Specifies a chance of a message failing to be sent and
   * the maximum delay of a message (in milliseconds) if it
   * is sent.
   * 
   * This version is designed to simulate more realistic network
   * conditions for testing.
   * 
   * The messageDelay parameter is the maximum -- a message may
   * be delayed any amount of time between 0 ms and the delay specified.
   * 
   * @param {number} [chanceMessageFails] - Should be in the range of 0 to 1.
   * @param {number} [messageDelay] - Time that a message may be delayed.
   */
  constructor(chanceMessageFails=0, messageDelay=0) {
    this.clients = new Map();
    this.chanceMessageFails = chanceMessageFails;
    this.messageDelayMax = messageDelay;
  }

  /**
   * Registers clients to the network.
   * Clients and Miners are registered by public key.
   *
   * @param {...Object} clientList - clients to be registered to this network (may be Client or Miner)
   */
  register(...clientList) {
    for (const client of clientList) {
      this.clients.set(client.address, client);
    }
  }

  /**
   * Broadcasts to all clients within this.clients the message msg and payload o.
   *
   * @param {String} msg - the name of the event being broadcasted (e.g. "PROOF_FOUND")
   * @param {Object} o - payload of the message
   */
  broadcast(msg, o) {
    for (const address of this.clients.keys()) {
      this.sendMessage(address, msg, o);
    }
  }

  /**
   * Sends message msg and payload o directly to Client name.
   *
   * The message may be lost or delayed, with the probability
   * defined for this instance.
   *
   * @param {String} address - the public key address of the client or miner to which to send the message
   * @param {String} msg - the name of the event being broadcasted (e.g. "PROOF_FOUND")
   * @param {Object} o - payload of the message
   */
  sendMessage(address, msg, o) {
    if (typeof o !== 'object') throw new Error(`Expecting an object, but got a ${typeof o}`);

    // Serializing/deserializing the object to prevent cheating in single threaded mode.
    let o2 = JSON.parse(JSON.stringify(o));

    const client = this.clients.get(address);

    let delay = Math.floor(Math.random() * this.messageDelayMax);

    if (Math.random() > this.chanceMessageFails) {
      setTimeout(() => client.emit(msg, o2), delay);
    }
  }

  /**
   * Tests whether a client is registered with the network.
   * 
   * @param {Client} client - the client to test for.
   * 
   * @returns {boolean} True if the client is already registered.
   */
  recognizes(client) {
    return this.clients.has(client.address);
  }

};
