/* global sjcl */
sjcl.codec.steemit = {
  ROLES: ['owner', 'memo', 'active', 'posting'],
  PUB_KEY_EVEN: 0x2,
  PUB_KEY_ODD: 0x3,
  HEADER: 0x80,
  keyChecksum: function(bits) {
    return sjcl.bitArray.bitSlice(sjcl.hash.ripemd160.hash(bits), 0, 32);
  },

  keysFromPassword: function(account, password) {
    var keyPairs = {};
    var curve = sjcl.ecc.curves.k256;
    for (var i = 0; i < sjcl.codec.steemit.ROLES.length; i++) {
      var role = sjcl.codec.steemit.ROLES[i];
      var seed = account + role + password;
      var secret = sjcl.bn.fromBits(
        sjcl.hash.sha256.hash(sjcl.codec.utf8String.toBits(seed))
      );
      keyPairs[role] = sjcl.ecc.ecdsa.generateKeys(curve, 0, secret);
    }
    return keyPairs;
  },

  serializePublicKey: function(key) {
    var point = key.get();
    var pubKeyHeader;

    // the public key header is 0x3 if X is odd, 0x2 if even
    if (sjcl.bn.fromBits(point.y).limbs[0] & 0x1) {
      pubKeyHeader = sjcl.codec.steemit.PUB_KEY_ODD;
    } else {
      pubKeyHeader = sjcl.codec.steemit.PUB_KEY_EVEN;
    }
    return (
      'STM' +
      sjcl.codec.base58Check.fromBits(
        pubKeyHeader,
        point.x,
        sjcl.codec.steemit.keyChecksum
      )
    );
  },

  serializePrivateKey: function(key, header) {
    return sjcl.codec.base58Check.fromBits(
      header || sjcl.codec.steemit.HEADER,
      key.get()
    );
  },

  deserializePrivateKey: function(wif, header) {
    header = header || sjcl.codec.steemit.HEADER;
    var curve = sjcl.ecc.curves.k256;
    var payload = sjcl.codec.base58Check.toBits(wif);
    var headerByte = sjcl.bitArray.extract(payload, 0, 8);
    if (headerByte !== header) {
      throw new Error(
        'secret key has invalid header: wanted 0x' +
          header.toString(16) +
          ', got 0x' +
          headerByte.toString(16)
      );
    }

    var keyBits = sjcl.bitArray.bitSlice(payload, 8);
    return new sjcl.ecc.ecdsa.secretKey(curve, sjcl.bn.fromBits(keyBits));
  },

  deserializePublicKey: function(pubKey) {
    var CURVE = sjcl.ecc.curves.k256;
    var PIDENT = sjcl.ecc.curves.k256.field.modulus
      .add(1)
      .normalize()
      .halveM()
      .halveM()
      .normalize();

    if (pubKey.slice(0, 3) !== 'STM') {
      throw new Error(
        'Public key is not in Steemit format, it should begin with "STM"'
      );
    }

    var payload = sjcl.codec.base58Check.toBits(
      pubKey.slice(3),
      sjcl.codec.steemit.keyChecksum
    );
    var headerByte = sjcl.bitArray.extract(payload, 0, 8);
    var isOdd = headerByte == 0x3;
    if (headerByte !== 0x3 && headerByte !== 0x2) {
      throw new Error(
        'public key has invalid header: wanted 0x2 or 0x3, got 0x' +
          headerByte.toString(16)
      );
    }

    var xBits = sjcl.bitArray.bitSlice(payload, 8);
    // as this was a compressed public key, we need to re-obtain the Y coordinate
    var x = sjcl.bn.fromBits(xBits);

    var alpha = x
      .powermod(3, CURVE.field.modulus)
      .add(x.mulmod(CURVE.a, CURVE.field.modulus))
      .add(CURVE.b)
      .mod(CURVE.field.modulus);

    var y = alpha.powermod(PIDENT, CURVE.field.modulus);
    var yIsOdd = (y.limbs[0] & 1) == 1;
    if ((yIsOdd && !isOdd) || (!yIsOdd && isOdd)) {
      y = CURVE.field.modulus.sub(y).normalize();
    }

    var point = new sjcl.ecc.point(CURVE, x, y);
    var key = new sjcl.ecc.ecdsa.publicKey(CURVE, point);
    return key;
  }
};
