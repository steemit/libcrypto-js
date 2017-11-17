/* global self */
(function(root, factory) {
  if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
    // CommonJS
    factory(exports);
  } else {
    // Browser globals
    root.steemit = root.steemit || {};
    factory((root.steemit.crypto = {}));
  }
})(typeof self !== 'undefined' ? self : this, function(exports) {
  exports.SecretKey = SecretKey;
  exports.PublicKey = PublicKey;
  exports.generateKeys = generateKeys;
  exports.keysFromPassword = keysFromPassword;
  exports.sha256 = sha256;
  exports.ripemd160 = ripemd160;
  exports.hexify = hexify;

  var sjcl = (function() {
    // SJCL is inserted here automatically by the build process.
    // SJCL_INSERT_POINT

    return sjcl;
  })();

  exports.sjcl = sjcl;

  function SecretKey(sec, pub) {
    // we deliberately avoid exposing secret key material on the instance.
    // this is paranoid and probably doesn't protect against a determined
    // attack, but why make things easy?
    this.getPublicKey = function() {
      if (!pub) {
        pub = sjcl.ecc.ecdsa.generateKeys(
          sjcl.ecc.curves.k256,
          undefined,
          sjcl.bn.fromBits(sec.get())
        ).pub;
      }
      return new PublicKey(pub);
    };

    this.sign = function(hash) {
      return fromBits(sjcl.codec.steemit.signRecoverably(sec, toBits(hash)));
    };
  }

  SecretKey.from = function(wif, header) {
    return new SecretKey(sjcl.codec.steemit.deserializeSecretKey(wif, header));
  };

  function PublicKey(pub) {
    this._p = pub;
  }

  PublicKey.from = function(str) {
    return new PublicKey(sjcl.codec.steemit.deserializePublicKey(str));
  };

  PublicKey.recover = function(hash, sig) {
    return new PublicKey(
      sjcl.codec.steemit.recoverPublicKey(toBits(hash), toBits(sig))
    );
  };

  PublicKey.prototype = {
    toString: function() {
      return sjcl.codec.steemit.serializePublicKey(this._p);
    },
    verify: function(hash, signature) {
      try {
        var rawSig = sjcl.bitArray.bitSlice(toBits(signature), 8);
        this._p.verify(toBits(hash), rawSig);
        return true;
      } catch (_) {
        return false;
      }
    }
  };

  function generateKeys() {
    var k = sjcl.ecc.ecdsa.generateKeys(sjcl.ecc.curves.k256);
    return serializePair(k);
  }

  function keysFromPassword(accountName, accountPassword) {
    var keys = sjcl.codec.steemit.keysFromPassword(
      accountName,
      accountPassword
    );
    return {
      owner: serializePair(keys.owner),
      memo: serializePair(keys.memo),
      posting: serializePair(keys.posting),
      active: serializePair(keys.active)
    };
  }

  function sha256(data) {
    return fromBits(sjcl.hash.sha256.hash(toBits(data)));
  }

  function ripemd160(data) {
    return fromBits(sjcl.hash.ripemd160.hash(toBits(data)));
  }

  function hexify(data) {
    var result = '';
    var view = new Uint8Array(data);
    for (var i = 0; i < view.byteLength; i++) {
      if (view[i] < 16) {
        result += '0';
      }
      result += view[i].toString(16);
    }
    return result;
  }

  function serializePair(k) {
    return {
      secret: sjcl.codec.steemit.serializeSecretKey(k.sec),
      public: sjcl.codec.steemit.serializePublicKey(k.pub)
    };
  }

  function toBits(a) {
    if (a instanceof ArrayBuffer) {
      return sjcl.codec.arrayBuffer.toBits(a);
    } else {
      throw new Error('You must supply an ArrayBuffer');
    }
  }

  function fromBits(a) {
    return sjcl.codec.arrayBuffer.fromBits(a, 0, 0);
  }
});
