/* global self, DataView */
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

  var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

  var int8 = num('Int8', 1);
  var int16 = num('Int16', 2);
  var int32 = num('Int32', 4);
  var uint8 = num('Uint8', 1);
  var uint16 = num('Uint16', 2);
  var uint32 = num('Uint32', 4);
  var float64 = num('Float64', 8);

  var authority = object([
    ['weight_threshold', uint32],
    ['account_auths', map(string, uint16)],
    ['key_auths', map(publicKey, uint16)]
  ]);
  var beneficiary = object([['account', string], ['weight', uint16]]);
  var price = object([['base', asset], ['quote', asset]]);
  var signedBlockHeader = object([
    ['previous', bytes],
    ['timestamp', date],
    ['witness', string],
    ['transaction_merkle_root', bytes],
    ['extensions', array(void_t)],
    ['witness_signature', bytes]
  ]);
  var chainProperties = object([
    ['account_creation_fee', asset],
    ['maximum_block_size', uint32],
    ['sbd_interest_rate', uint16]
  ]);
  var operation = staticVariant(getOperationTypes());
  var transaction = object([
    ['ref_block_num', uint16],
    ['ref_block_prefix', uint32],
    ['expiration', date],
    ['operations', array(operation)],
    ['extensions', array(string)]
  ]);

  // exports

  exports.Context = Context;

  exports.codePointAt = codePointAt;
  exports.utf8Length = utf8Length;
  exports.ucsToUtf8 = ucsToUtf8;

  exports.int8 = int8;
  exports.int16 = int16;
  exports.int32 = int32;
  exports.uint8 = int8;
  exports.uint16 = int16;
  exports.uint32 = int32;

  exports.int64 = int64;
  exports.uint64 = uint64;
  exports.float64 = float64;

  exports.uvarint = uvarint;
  exports.svarint = svarint;
  exports.boolean = boolean;
  exports.rawString = rawString;
  exports.string = string;
  exports.date = date;
  exports.bytes = bytes;

  exports.array = array;
  exports.map = map;
  exports.optional = optional;
  exports.object = object;
  exports.publicKey = publicKey;
  exports.staticVariant = staticVariant;
  exports.void_t = void_t;

  exports.asset = asset;
  exports.authority = authority;
  exports.beneficiary = beneficiary;
  exports.price = price;
  exports.signedBlockHeader = signedBlockHeader;
  exports.chainProperties = chainProperties;
  exports.operation = operation;
  exports.transaction = transaction;

  // implementation

  function codePointAt(str, pos) {
    var codePoint = str.charCodeAt(pos);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // surrogate pair.
      var secondCodePoint = str.charCodeAt(pos + 1);
      if (secondCodePoint < 0xdc00 || secondCodePoint > 0xdfff) {
        throw new Error('Invalid UTF-16 sequence');
      }
      // recover UCS4 code point
      codePoint =
        (((codePoint - 0xd800) << 10) | (secondCodePoint - 0xdc00)) + 0x10000;
    }
    return codePoint;
  }

  function utf8Length(str) {
    var len = 0;
    for (var i = 0; i < str.length; i++) {
      var codePoint = codePointAt(str, i);
      if (codePoint < 0x80) {
        len += 1;
      } else if (codePoint < 0x800) {
        len += 2;
      } else if (codePoint < 0x10000) {
        len += 3;
      } else {
        len += 4;
        // this was a surrogate character, so we need to advance positions by 1
        i++;
      }
    }
    return len;
  }

  function ucsToUtf8(value) {
    if (value < 0x80) {
      // one-byte encoding, identical to ASCII.
      return value;
    } else if (value < 0x800) {
      // two-byte encoding.
      return ((value & 0x7c0) << 2) | (value & 0x3f) | 0xc080;
    } else if (value < 0x10000) {
      // three-byte encoding.
      return (
        ((value & 0xf000) << 4) |
        ((value & 0x0fc0) << 2) |
        (value & 0x3f) |
        0xe08080
      );
    } else if (value < 0x200000) {
      // four-byte encoding.
      return (
        ((value & 0x001c0000) << 6) +
        ((value & 0x0003f000) << 4) +
        ((value & 0x0000fc0) << 2) +
        (value & 0x0000003f) +
        0xf0808080
      );
    } else {
      throw new Error('Invalid unicode character');
    }
  }

  function num(name, width) {
    var methodName = 'set' + name;
    return function(context, value, bigEndian) {
      context.space(width);
      context._view[methodName](context._position, value, !bigEndian);
      context._position += width;
      return width;
    };
  }

  function int64(context, value) {
    if (value > MAX_SAFE_INTEGER || value < -MAX_SAFE_INTEGER) {
      throw new Error('int64: unsafe');
    }

    var magnitude = Math.abs(value);
    var neg = value < 0;
    if (neg) {
      magnitude--;
    }
    for (var i = 0; i < 8; i++) {

      var remainder = magnitude % 256;
      magnitude = Math.floor(magnitude/256);

      var digit = neg ? 255-remainder : remainder;

      if (i == 7 && neg) {
        // sign bit
        digit |= 0x80;
      }
      uint8(context, digit);
    }

    return 8;
  }

  function uint64(context, value) {
    // split into 32-bit numbers and write them little-endian
    if (value > MAX_SAFE_INTEGER || value < 0) {
      throw new Error('uint64: unsafe');
    }

    var high32 = Math.floor(value / 4294967296);
    var low32 = value & 0xffffffff;

    return uint32(context, high32) + uint32(context, low32);
  }

  function uvarint(context, value) {
    context.space(8);
    var len = 0;

    while (value >= 128) {
      context._view.setUint8(context._position + len, (value % 128) | 0x80);
      value = Math.floor(value / 128);
      len++;
    }
    context._view.setUint8(context._position + len, value);
    len++;

    context._position += len;
    return len;
  }

  function svarint(context, value) {
    if (value < -4503599627370496) {
      throw new Error('svarint: too small');
    } else if (value > MAX_SAFE_INTEGER) {
      throw new Error('svarint: too large');
    } else if (value < 0) {
      return uvarint(context, value * -2 - 1);
    } else {
      return uvarint(context, value * 2);
    }
  }

  function boolean(context, value) {
    return uint8(context, value ? 1 : 0);
  }

  function rawString(context, value) {
    context.space(value.length * 4);
    var len = 0;
    var encodedValue, codePoint;

    for (var i = 0; i < value.length; i++) {
      codePoint = codePointAt(value, i);
      if (codePoint > 0xffff) {
        // surrogate pair. advance the string position again
        i++;
      }

      encodedValue = ucsToUtf8(codePoint);
      if (encodedValue > 0xffffff) {
        len += uint32(context, encodedValue, true);
      } else if (encodedValue > 0xffff) {
        len +=
          uint16(context, encodedValue >> 8, true) +
          uint8(context, encodedValue & 0xff);
      } else if (encodedValue > 0xff) {
        len += uint16(context, encodedValue, true);
      } else {
        len += uint8(context, encodedValue);
      }
    }
    return len;
  }

  function string(context, value) {
    var encodedStringLength = utf8Length(value);
    return uvarint(context, encodedStringLength) + rawString(context, value);
  }

  function date(context, value) {
    return uint32(context, Math.round(value.getTime() / 1000));
  }

  function bytes(context, value) {
    var b = new Uint8Array(value);
    context.space(b.length);
    context._buffer.set(b, context._position);
    context._position += b.length;
    return b.length;
  }

  function optional(wrappedContext) {
    return function(context, value) {
      if (value !== null && value !== undefined) {
        return uint8(context, 1) + wrappedContext(context, value);
      } else {
        return uint8(context, 0);
      }
    };
  }

  function map(keySerializer, valueSerializer) {
    return function(context, value) {
      var len = uvarint(context, value.length);
      for (var i = 0; i < value.length; i++) {
        len +=
          keySerializer(context, value[i][0]) +
          valueSerializer(context, value[i][1]);
      }
      return len;
    };
  }

  function array(valueSerializer) {
    return function(context, value) {
      var len = uvarint(context, value.length);
      for (var i = 0; i < value.length; i++) {
        len += valueSerializer(context, value[i]);
      }
      return len;
    };
  }

  function object(propertySerializers) {
    return function(context, value) {
      var len = 0;
      if (typeof value !== 'object' || value === null) {
        throw new Error('object: cannot serialize non-objects');
      }
      for (var i = 0; i < propertySerializers.length; i++) {
        len += propertySerializers[i][1](
          context,
          value[propertySerializers[i][0]]
        );
      }
      return len;
    };
  }

  function publicKey(context, value) {
    // the raw 64 bytes of the public key
    return bytes(context, value.toArrayBuffer());
  }

  function staticVariant(choices) {

    // generate lookup
    var lookup = {};
    for (var i = 0; i < choices.length; i++) {
      lookup[choices[i][0]] = {
        code: i,
        serializer: choices[i][1]
      };
    }
 
    return function(context, value) {
      if (typeof value !== 'object' || value === null) {
        throw new Error('variant: cannot serialize null');
      } else if (!lookup[value.type]) {
        throw new Error('Unknown type ' + value.type + ' for static variant');
      }
      return uvarint(context, lookup[value.type].code) + lookup[value.type].serializer(context, value);
    };
  }

  function void_t(context, value) {
    if (value !== undefined && value !== null) {
      throw new Error('Void must be undefined or null');
    }
    return 0;
  }

  function asset(context, value) {
    if (typeof value !== 'object' || value === null) {
      throw new Error('asset: must be an object');
    } else if (!('amount' in value && 'precision' in value && 'symbol' in value)) {
      throw new Error('asset: must have "amount", "precision", and "symbol"');
    } else if (value.precision > 14) {
      throw new Error('asset: bad precision');
    }

    var len = int64(context, value.amount);
    len += int8(context, value.precision);

    var symbolLen = rawString(context, value.symbol);
    if (symbolLen > 6) {
      throw new Error('asset: symbol is too long');
    }
    len += symbolLen;

    for (var i = 7; i > symbolLen; i--) {
      len += uint8(context, 0);
    }

    return len;
  }

  function getOperationTypes() {
    return [
      [
        'vote',
        [
          ['voter', string],
          ['author', string],
          ['permlink', string],
          ['weight', int16]
        ]
      ],
      [
        'comment',
        [
          ['parent_author', string],
          ['parent_permlink', string],
          ['author', string],
          ['permlink', string],
          ['title', string],
          ['body', string],
          ['json_metadata', string]
        ]
      ],
      [
        'transfer',
        [['from', string], ['to', string], ['amount', asset], ['memo', string]]
      ],
      [
        'transfer_to_vesting',
        [['from', string], ['to', string], ['amount', asset]]
      ],
      ['withdraw_vesting', [['account', string], ['vesting_shares', asset]]],
      [
        'limit_order_create',
        [
          ['owner', string],
          ['orderid', uint32],
          ['amount_to_sell', asset],
          ['min_to_receive', asset],
          ['fill_or_kill', boolean],
          ['expiration', date]
        ]
      ],
      ['limit_order_cancel', [['owner', string], ['orderid', uint32]]],
      ['feed_publish', [['publisher', string], ['exchange_rate', price]]],
      [
        'convert',
        [['owner', string], ['requestid', uint32], ['amount', asset]]
      ],
      [
        'account_create',
        [
          ['fee', asset],
          ['creator', string],
          ['new_account_name', string],
          ['owner', authority],
          ['active', authority],
          ['posting', authority],
          ['memo_key', publicKey],
          ['json_metadata', string]
        ]
      ],
      [
        'account_update',
        [
          ['account', string],
          ['owner', optional(authority)],
          ['active', optional(authority)],
          ['posting', optional(authority)],
          ['memo_key', publicKey],
          ['json_metadata', string]
        ]
      ],
      [
        'witness_update',
        [
          ['owner', string],
          ['url', string],
          ['block_signing_key', publicKey],
          ['props', chainProperties],
          ['fee', asset]
        ]
      ],
      [
        'account_witness_vote',
        [['account', string], ['witness', string], ['approve', boolean]]
      ],
      ['account_witness_proxy', [['account', string], ['proxy', string]]],
      [
        'custom',
        [['required_auths', array(string)], ['id', uint32], ['data', bytes]]
      ],
      [
        'report_over_production',
        [
          ['reporter', string],
          ['first_block', signedBlockHeader],
          ['second_block', signedBlockHeader]
        ]
      ],
      ['delete_comment', [['author', string], ['permlink', string]]],
      [
        'custom_json',
        [
          ['required_auths', array(string)],
          ['required_posting_auths', array(string)],
          ['id', string],
          ['json', string]
        ]
      ],
      [
        'comment_options',
        [
          ['author', string],
          ['permlink', string],
          ['max_accepted_payout', asset],
          ['percent_steem_dollars', uint32],
          ['allow_votes', boolean],
          ['allow_curation_rewards', boolean],
          [
            'extensions',
            array(
              staticVariant([object([['beneficiaries', array(beneficiary)]])])
            )
          ]
        ]
      ],
      [
        'set_withdraw_vesting_route',
        [
          ['from_account', string],
          ['to_account', string],
          ['percent', uint32],
          ['auto_vest', boolean]
        ]
      ],
      [
        'limit_order_create2',
        [
          ['owner', string],
          ['orderid', uint32],
          ['amount_to_sell', asset],
          ['fill_or_kill', boolean],
          ['exchange_rate', price],
          ['expiration', date]
        ]
      ],
      [
        'challenge_authority',
        [
          ['challenger', string],
          ['challenged', string],
          ['require_owner', boolean]
        ]
      ],
      ['prove_authority', [['challenged', string], ['require_owner', boolean]]],
      [
        'request_account_recovery',
        [
          ['recovery_account', string],
          ['account_to_recover', string],
          ['new_owner_authority', authority],
          ['extensions', array(void_t)]
        ]
      ],
      [
        'recover_account',
        [
          ['account_to_recover', string],
          ['new_owner_authority', authority],
          ['recent_owner_authority', authority],
          ['extensions', array(void_t)]
        ]
      ],
      [
        'change_recovery_account',
        [
          ['account_to_recover', string],
          ['new_recovery_account', string],
          ['extensions', array(void_t)]
        ]
      ],
      [
        'escrow_transfer',
        [
          ['from', string],
          ['to', string],
          ['agent', string],
          ['escrow_id', uint32],
          ['sbd_amount', asset],
          ['steem_amount', asset],
          ['fee', asset],
          ['ratification_deadline', date],
          ['escrow_expiration', date],
          ['json_meta', string]
        ]
      ],
      [
        'escrow_dispute',
        [
          ['from', string],
          ['to', string],
          ['agent', string],
          ['who', string],
          ['escrow_id', uint32]
        ]
      ],
      [
        'escrow_release',
        [
          ['from', string],
          ['to', string],
          ['agent', string],
          ['who', string],
          ['receiver', string],
          ['escrow_id', uint32],
          ['sbd_amount', asset],
          ['steem_amount', asset]
        ]
      ],
      [
        'escrow_approve',
        [
          ['from', string],
          ['to', string],
          ['agent', string],
          ['who', string],
          ['escrow_id', uint32],
          ['approve', boolean]
        ]
      ],
      [
        'transfer_to_savings',
        [['from', string], ['to', string], ['amount', asset], ['memo', string]]
      ],
      [
        'transfer_from_savings',
        [
          ['from', string],
          ['request_id', uint32],
          ['to', string],
          ['amount', asset],
          ['memo', string]
        ]
      ],
      [
        'cancel_transfer_from_savings',
        [['from', string], ['request_id', uint32]]
      ],
      [
        'custom_bytes',
        [
          ['required_owner_auths', array(string)],
          ['required_active_auths', array(string)],
          ['required_posting_auths', array(string)],
          ['required_auths', array(authority)],
          ['id', string],
          ['data', bytes]
        ]
      ],
      ['decline_voting_rights', [['account', string], ['decline', boolean]]],
      [
        'reset_account',
        [
          ['reset_account', string],
          ['account_to_reset', string],
          ['new_owner_authority', authority]
        ]
      ],
      [
        'set_reset_account',
        [
          ['account', string],
          ['current_reset_account', string],
          ['reset_account', string]
        ]
      ],
      [
        'claim_reward_balance',
        [
          ['account', string],
          ['reward_steem', asset],
          ['reward_sbd', asset],
          ['reward_vests', asset]
        ]
      ],
      [
        'delegate_vesting_shares',
        [
          ['delegator', string],
          ['delegatee', string],
          ['vesting_shares', asset]
        ]
      ],
      [
        'account_create_with_delegation',
        [
          ['fee', asset],
          ['delegation', asset],
          ['creator', string],
          ['new_account_name', string],
          ['owner', authority],
          ['active', authority],
          ['posting', authority],
          ['memo_key', publicKey],
          ['json_metadata', string],
          ['extensions', array(void_t)]
        ]
      ]
    ].map(function(def) {
      return [def[0], object(def[1])];
    });
  }

  function Context(bufferSize) {
    this._result = new Uint8Array(0);
    this._buffer = new Uint8Array(bufferSize || Context.DEFAULT_BUFFER_SIZE);
    this._position = 0;
    this._view = new DataView(this._buffer.buffer);
  }

  Context.DEFAULT_BUFFER_SIZE = 16384;

  Context.prototype = {
    // space ensures that at least `len` bytes of space are available in the buffer.
    // If not, it flushes the buffer to the result.
    // @param {Number} len The number of bytes to ensure are available in the buffer.
    space: function(len) {
      if (this._buffer.length - this._position < len) {
        this.flush();
      }
    },

    flush: function() {
      var result = new Uint8Array(this._result.length + this._position);
      result.set(this._result);
      result.set(this._buffer.subarray(0, this._position), this._result.length);
      this._result = result;
      this._position = 0;
    },

    toString: function() {
      this.flush();
      var x = '';
      for (var i = 0; i < this._result.length; i++) {
        var byte = this._result[i].toString(16);
        if (byte.length == 1) {
          byte = '0' + byte;
        }
        x += byte;
      }
      return x;
    },

    finalize: function() {
      this.flush();
      return this._result.buffer;
    }
  };
});
