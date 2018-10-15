// Simple "broadcast" setup to enable easy testing

let miners = [];

exports.registerMiner = function(m) {
  miners.push(m);
};

exports.broadcast = function(msg, o) {
  miners.forEach((m) => {
    m.emit(msg, o);
  });
};

