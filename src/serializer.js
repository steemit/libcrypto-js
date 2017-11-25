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

  exports.Context = Context;

  exports.codePointAt = codePointAt;
  exports.utf8Length = utf8Length;
  exports.ucsToUtf8 = ucsToUtf8;

  exports.int8 = int8;
  exports.int16 = int16;
  exports.int32 = int32;
  exports.uint8 = uint8;
  exports.uint16 = uint16;
  exports.uint32 = uint32;
  exports.float64 = float64;

  exports.uvarint = uvarint;
  exports.svarint = svarint;
  exports.boolean = boolean;
  exports.rawString = rawString;
  exports.string = string;
  exports.date = date;
  exports.buffer = buffer;

  exports.array = array;
  exports.map = map;
  exports.optional = optional;
  exports.object = object;  

  function codePointAt(str, pos) { 
    var codePoint = str.charCodeAt(pos);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // surrogate pair.
      var secondCodePoint = str.charCodeAt(pos+1);
      if (secondCodePoint < 0xdc00 || secondCodePoint > 0xdfff) {
        throw new Error('Invalid UTF-16 sequence');
      }
      // recover UCS4 code point
      codePoint = ( ((codePoint - 0xd800) << 10) | (secondCodePoint - 0xdc00) ) + 0x10000; 
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
    var encodedValue;
    if (value < 0x80) {
      // one-byte encoding, identical to ASCII.
      return value;
    } else if (value < 0x800) {
      // two-byte encoding.
      return (
        ((value & 0x7c0) << 2) |
        (value & 0x3f) |
        0xc080
      );
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
    return function(serializer, value) {
      serializer.space(width);
      serializer._view['set'+name](serializer._position, value);
      serializer._position += width;
      return width;
    }
  }

  function int8(context, value) {
    return num('Int8', 1)(context, value);
  }
  
  function int16(context, value) {
    return num('Int16', 2)(context, value);
  }

  function int32(context, value) {
    return num('Int32', 4)(context, value);
  }

  function uint8(context, value) {
    return num('Uint8', 1)(context, value);
  }

  function uint16(context, value) {
    return num('Uint16', 2)(context, value);
  }

  function uint32(context, value) {
    return num('Uint32', 4)(context, value);
  }

  function float64(context, value) {
    return num('Float64', 8)(context, value);
  }

  function uvarint(context, value) {
    context.space(8);
    var len = 0;

    while (value >= 128) {
      context._view.setUint8(context._position+len, (value % 128) | 0x80);
      value = Math.floor(value/128);
      len++;
    }
    context._view.setUint8(context._position+len, value);
    len++;

    context._position += len;
    return len;
  }

  function svarint(context, value) {
    if (value < -4503599627370496) {
      throw new Error('svarint: too small');
    } else if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error('svarint: too large');
    } else if (value < 0) {
      return uvarint(context, (value*-2) - 1); 
    } else {
      return uvarint(context, value*2);
    }
  }

  function boolean(context, value) {
    return uint8(context, value ? 1 : 0);
  }

  function rawString(context, value) {
    context.space(value.length*4);
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
        len += uint32(context, encodedValue);
      } else if (encodedValue > 0xffff) {
        len += uint16(context, encodedValue >> 8) + uint8(context, encodedValue & 0xff);
      } else if (encodedValue > 0xff) {
        len += uint16(context, encodedValue);
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

  function buffer(context, value) {
    var bytes = new Uint8Array(value);
    context.space(bytes.length);
    context._buffer.set(bytes, context._position);
    context._position += bytes.length;
    return bytes.length;
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
        len += keySerializer(context, value[i][0]) + valueSerializer(context, value[i][1]);
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
        throw new Error('object: cannot serialize null');
      }
      for (var i = 0; i < propertySerializers.length; i++) {
        len += propertySerializers[i][1](context, value[propertySerializers[i][0]]);
      }
      return len;
    };
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
