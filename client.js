let EventEmitter = require('events');

let utils = require('./utils.js');

const POST = "POST_TRANSACTION";
const BALANCE = "GET_BALANCE";

// FIXME: Add static method to read keys from files
module.exports = class Client extends EventEmitter {
    constructor(broadcast, keys) {
        super();
        // The broadcast function determines how the client communicates
        // with other entities in the system.
        // (This approach allows us to simplify our testing setup.)
        this.broadcast = broadcast;
        this.keys = keys || utils.generateKeypair();
        this.keys.id = utils.calcId(this.keys.public);
    }

    /**
     * Broadcasts a transaction from the client giving money
     * to the clients specified in 'output'.  Note that all
     * money is given away, so the client must be careful to
     * pay themselves any change left over.
     * @param output
     */
    postTransaction(output) {
        let tx = utils.makeTransaction(this.keys.private, output, this.keys.id);
        let msg = { details: {transaction: tx }};
        this.signMessage(msg);
        this.broadcast(POST, msg);
    }

    /**
     * Broadcasts a request for the balance of an account
     * from all miners.  If 'id' is not specified, then
     * the client's account is used by default.
     * @param id
     */
    requestBalance(id) {
        id = id || this.keys.id;
        let msg = { account: id };
        this.signMessage(msg);
        this.broadcast(BALANCE, msg);
    }


    /**
     * Signs the 'details' field of the 'msg' object.
     * The signature is stored in the 'sig' field,
     * and the public key is stored in the 'pubKey' field.
     * @param msg
     */
    signMessage(msg) {
        // let sig = utils.sign(this.keys.private, msg.details); //JT-
        // msg.sig = sig;//JT-
        msg.sig = utils.sign(this.keys.private, msg.details);
        msg.pubKey = this.keys.public;
    }


    /**
     * Assuming that an object was correctly signed by the signMessage
     * method, this method will validate that signature.
     * @param {Object} msg
     * @param msg.pubKey
     * @param msg.sig
     * @param msg.details
     * @return {boolean}
     */
    verifyMessageSig(msg) {
        if (msg.pubKey && msg.sig && msg.details) {
            return utils.verifySignature(msg.pubKey, msg.details, msg.sig);
        } else {
            return false;
        }
    }
};

