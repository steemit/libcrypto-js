/* global sjcl */
sjcl.codec.steemit = {
  ROLES: ['owner', 'memo', 'active', 'posting'],
  MAINNET: {
    pubHeader: 0x0,
    privHeader: 0x80,
    pubPrefix: 'STM' 
  },
  TESTNET: {
    pubHeader: 0x0,
    privHeader: 0x80,
    pubPrefix: 'TST' 
  },
  SECRET_HEADER: 0x80,
  keyChecksum: function(bits) {
    return sjcl.bitArray.bitSlice(sjcl.hash.ripemd160.hash(bits), 0, 32);
  },

  keysFromPassword: function(account, password, net) {
    net = net || sjcl.codec.steemit.MAINNET;

    var keyPairs = {};
    var CURVE = sjcl.ecc.curves.k256;
    for (var i = 0; i < sjcl.codec.steemit.ROLES.length; i++) {
      var role = sjcl.codec.steemit.ROLES[i];
      var seed = account + role + password;
      var secret = sjcl.bn.fromBits(
        sjcl.hash.sha256.hash(sjcl.codec.utf8String.toBits(seed))
      );
      keyPairs[role] = sjcl.ecc.ecdsa.generateKeys(CURVE, 0, secret);
    }
    return keyPairs;
  },

  serializePublicKey: function(key, net) {
    net = net || sjcl.codec.steemit.MAINNET;

    var point = key.get();
    var header = net.pubHeader;

    // the public key header sets 0x3 if X is odd, 0x2 if even
    if (sjcl.bn.fromBits(point.y).limbs[0] & 0x1) {
      header |= 0x3;
    } else {
      header |= 0x2;
    }
    return net.pubPrefix + 
      sjcl.codec.base58Check.fromBits(
        header,
        point.x,
        sjcl.codec.steemit.keyChecksum
      )
    ;
  },

  serializePrivateKey: function(key, net) {
    net = net || sjcl.codec.steemit.MAINNET;
    return sjcl.codec.base58Check.fromBits(
      net.privHeader,
      key.get()
    );
  },

  deserializePrivateKey: function(wif, header) {
    header = header || sjcl.codec.steemit.MAINNET.privHeader;
    var curve = sjcl.ecc.curves.k256;
    var payload = sjcl.codec.base58Check.toBits(wif);
    var headerByte = sjcl.bitArray.extract(payload, 0, 8);
    if (headerByte !== header) {
      throw new Error(
        'private key has invalid header: wanted 0x' +
          header.toString(16) +
          ', got 0x' +
          headerByte.toString(16)
      );
    }

    var keyBits = sjcl.bitArray.bitSlice(payload, 8);
    return new sjcl.ecc.ecdsa.secretKey(curve, sjcl.bn.fromBits(keyBits));
  },

  deserializePublicKey: function(pubKey, net) {
    net = net || sjcl.codec.steemit.MAINNET;

    var CURVE = sjcl.ecc.curves.k256;
    var PIDENT = sjcl.ecc.curves.k256.field.modulus
      .add(1)
      .normalize()
      .halveM()
      .halveM()
      .normalize();

    if (pubKey.indexOf(net.pubPrefix) !== 0) {
      throw new Error(
        'Public key is not in correct format, it should begin with "' + net.pubPrefix + '"'
      );
    }

    var payload = sjcl.codec.base58Check.toBits(
      pubKey.slice(3),
      sjcl.codec.steemit.keyChecksum
    );
    var headerByte = sjcl.bitArray.extract(payload, 0, 8);
    var isOdd = headerByte == 0x3;
    if (headerByte & net.pubHeader !== net.pubHeader) {
      throw new Error('public key has invalid header');
    } else if (headerByte & 0x3 === 0 && headerByte & 0x2 === 0) {
      throw new Error(
        'public key has invalid header: should set 0x2 or 0x3, but got 0x' +
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
