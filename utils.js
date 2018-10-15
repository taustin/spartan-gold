const crypto = require('crypto');
const keypair = require('keypair');

// CRYPTO settings
const HASH_ALG = 'sha256';
const SIG_ALG = 'RSA-SHA256';

/**
 *
 * @param {String} s
 * @param {String} [encoding='hex'] Encoding
 * @return {a|*|PromiseLike<ArrayBuffer>}
 */
exports.hash = function hash(s, encoding) {
    encoding = encoding || 'hex';
    return crypto.createHash(HASH_ALG).update(s).digest(encoding);
};

/**
 * Takes in a hash and returns the number of leading zeroes.
 * This approach is not particularly flexible or efficient,
 * but it avoids some of the complexity in the code.
 * @param {String} h hash
 * @return {number} hashWork Number of leading zeroes in h
 */
exports.hashWork = function(h) {
    // let pat = /[1-9,A-F,a-f]/; JT-
    let pat = /[1-9,A-F]/i;//Do a case-insensitive search against the pattern JT+
    if (!h.match(pat)) {
        throw new Error(`Invalid hash: ${h}`);
    }
    let index = h.match(pat).index;
    // Converting number of hex zeroes to number of binary zeroes
    let numZeroBits = 4 * index;
    // Adding in extra leading zeroes.
    // FIXME JT+ Generic logic by converting to binary?
    switch(h.charAt(index)) {
        case '1':
            return numZeroBits + 3;
        case '2':
        case '3':
            return numZeroBits + 2;
        case '4':
        case '5':
        case '6':
        case '7':
            return numZeroBits + 1;
        default:
            return numZeroBits;
    }
};

/**
 * Returns a public-private keypair.
 * @return {Object} {public: {String}, private: {String}}
 */
exports.generateKeypair = function() {
    return keypair();
};

/**
 *
 * @param {String} privKey
 * @param msg
 * @return {number}
 */
exports.sign = function(privKey, msg) {
    let signer = crypto.createSign(SIG_ALG);
    // Convert an object to its JSON representation
    let str = (msg === Object(msg)) ? JSON.stringify(msg) : ""+msg;
    return signer.update(str).sign(privKey, 'hex');
};

/**
 *
 * @param pubKey
 * @param msg
 * @param sig
 * @return {boolean}
 */
exports.verifySignature = function(pubKey, msg, sig) {
    let verifier = crypto.createVerify(SIG_ALG);
    // Convert an object to its JSON representation
    let str = (msg === Object(msg)) ? JSON.stringify(msg) : ""+msg;
    return verifier.update(str).verify(pubKey, sig, 'hex');
};

/**
 *
 * @param key
 * @return {*}
 */
exports.calcId = function(key) {
    return exports.hash(""+key, 'base64');
};

/**
 * Makes a Transaction.
 *
 * @param privKey Private Key
 * @param output Output
 * @param [input] Input
 * @return {Object} tx Transaction comprising input & output
 * signed using privKey
 */
exports.makeTransaction = function(privKey, output, input) {
    let tx = {};
    tx.txDetails = {
        'output': output,
    };
    if (input) {
        tx.txDetails.input = input;
    }
    tx.timestamp = Date.now();
    tx.sig = exports.sign(privKey, tx.txDetails);
    return tx;
};

