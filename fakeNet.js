"use strict";

// Simple "broadcast" setup to enable easy testing

let clients = [];

exports.register = function(...miners) {
  miners.forEach(client => clients.push(client));
}

exports.broadcast = function(msg, o) {
  clients.forEach((client) => {
    client.emit(msg, o);
  });
}

