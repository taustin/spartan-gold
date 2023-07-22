"use strict";

let crypto = require('crypto');

const { mnemonicToSeedSync } = require('bip39');
const { pki, random } = require('node-forge');


// CRYPTO settings
const HASH_ALG = 'sha256';
const SIG_ALG = 'RSA-SHA256';

exports.hash = function hash(s, encoding) {
  encoding = encoding || 'hex';
  return crypto.createHash(HASH_ALG).update(s).digest(encoding);
};

/**
 * 
 * @param {String} mnemonic 
 * @param {String} password 
 * @returns 
 */
//https://stackoverflow.com/questions/72047474/how-to-generate-safe-rsa-keys-deterministically-using-a-seed
exports.generateKeypairFromMnemonic = function( mnemonic, password ) {
  const seed = mnemonicToSeedSync(mnemonic, password).toString('hex');
  const prng = random.createInstance();
  prng.seedFileSync = () => seed;
  const { privateKey, publicKey } = pki.rsa.generateKeyPair({ bits: 512, prng, workers: 2 });
  return {
      public: pki.publicKeyToPem(publicKey),
      private: pki.privateKeyToPem(privateKey),
  };
};


exports.generateKeypair = function() {
  const kp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
  });
  return {
    public: kp.publicKey,
    private: kp.privateKey,
  };
};

exports.sign = function(privKey, msg) {
  let signer = crypto.createSign(SIG_ALG);
  // Convert an object to its JSON representation
  let str = (msg === Object(msg)) ? JSON.stringify(msg) : ""+msg;
  return signer.update(str).sign(privKey, 'hex');
};

exports.verifySignature = function(pubKey, msg, sig) {
  let verifier = crypto.createVerify(SIG_ALG);
  // Convert an object to its JSON representation
  let str = (msg === Object(msg)) ? JSON.stringify(msg) : ""+msg;
  return verifier.update(str).verify(pubKey, sig, 'hex');
};

exports.calcAddress = function(key) {
  let addr = exports.hash(""+key, 'base64');
  //console.log(`Generating address ${addr} from ${key}`);
  return addr;
};

exports.addressMatchesKey = function(addr, pubKey) {
  return addr === exports.calcAddress(pubKey);
};
