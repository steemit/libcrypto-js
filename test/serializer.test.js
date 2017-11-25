
var test = require('tape');
var serializer = require('../lib/serializer');
var EVIL_STRINGS = require('./evil-strings.json');

var ctx;

test('codePointAt', function(t) {
  var testStr = 'w\u{1d306}';
  t.equal(serializer.codePointAt(testStr, 0), 119);
  t.equal(serializer.codePointAt(testStr, 1), 0x1d306);
  t.end();
});

test('utf8Length', function(t) {
  var passes = 0;
  for (var i = 0; i < EVIL_STRINGS.length; i++) {
    var s = EVIL_STRINGS[i];
    var len = serializer.utf8Length(s.input);
    if (len !== s.utf8Length) {
      t.fail('string "' + s.input + '" should have ' + s.utf8Length + ' bytes in UTF-8, but got ' + len);
    } else {
      passes++;
    }
  }
  t.equal(passes, EVIL_STRINGS.length, 'got correct UTF-8 encoded length of every string in the evil suite of death');

  t.end();
});

test('ucsToUtf8', function(t) {
  t.equal(serializer.ucsToUtf8(0x7f), 0x7f, 'single byte character');
  t.equal(serializer.ucsToUtf8(0xa9), 0xc2a9, '© (two bytes)');
  t.equal(serializer.ucsToUtf8(0x2070), 0xe281b0, '⁰ (three bytes)'); 
  t.equal(serializer.ucsToUtf8(0x2603), 0xe29883, '☃ (three bytes)');
  t.equal(serializer.ucsToUtf8(0x1d306), 0xf09d8c86, '(four bytes)');
  t.end();
});

test('uint8', function(t) {
  ctx = new serializer.Context();
  var len = 0;
  for (var i = 1; i <= 8; i++) {
    len += serializer.uint8(ctx, i*32 - 1);
  }
  t.equal(len, 8, 'uint8s should be 1 byte long, so 8 bytes total');

  var data = new Uint8Array(ctx.finalize());
  t.equal(data.length, 8, 'uint8 data length');
  data.forEach(function(datum, i) {
    t.equal(datum, ((i+1)*32 - 1), i + 'th byte of uint8 result should be ' + datum);
  });
  t.end();
});

test('int8', function(t) {
  ctx = new serializer.Context();
  
  var len = 0;
  for (var i = -4; i < 4; i++) {
    len += serializer.int8(ctx, i*32); 
  } 
  t.equal(len, 8, 'int8s should be 1 byte long, so 8 bytes total');

  var data = new Int8Array(ctx.finalize());
  t.equal(data.length, 8, 'int8 data length');
  data.forEach(function(datum, i) {
    t.equal(datum, ((i-4)*32), i + 'th byte of uint8 result should be ' + datum);
  });
  t.end();
});

test('uint16', function(t) {
  ctx = new serializer.Context();
  
  var len =
    serializer.uint16(ctx, 0) +
    serializer.uint16(ctx, 256) +
    serializer.uint16(ctx, 65535);

  t.equal(len, 6, 'len should tell us 6 bytes were written');

  result = new Uint8Array(ctx.finalize());
  
  t.equal(result.length, 6, '3 uint16s should be 6 bytes long');
  t.deepEqual(result, new Uint8Array([
    0,0,
    1,0,
    255,255
  ]), 'data should be written with correct endianness');

  t.end();
});

test('int16', function(t) {
  ctx = new serializer.Context();
 
  var len = 
    serializer.int16(ctx, 0) +
    serializer.int16(ctx, 256) +
    serializer.int16(ctx, -32768) +
    serializer.int16(ctx, 32767);

  t.equal(len, 8, 'len should tell us 8 bytes were written');

  result = new Uint8Array(ctx.finalize());
  
  t.equal(result.length, 8, '4 int16s should be 8 bytes long');
  t.deepEqual(result, new Uint8Array([
    0,0,
    1,0,
    128,0,
    127,255
  ]), 'data should be written with correct endianness using 2s complement');

  t.end();
});

test('uint32', function(t) {
  ctx = new serializer.Context();
  
  var len =
    serializer.uint32(ctx, 0) +
    serializer.uint32(ctx, 16777216) +
    serializer.uint32(ctx, Math.pow(2, 32)-1);

  t.equal(len, 12, 'len should tell us 12 bytes were written');

  result = new Uint8Array(ctx.finalize());
  
  t.equal(result.length, 12, '3 uint32s should be 12 bytes long');
  t.deepEqual(result, new Uint8Array([
    0, 0, 0, 0,
    1, 0, 0, 0,
    255,255,255,255
  ]), 'data should be written with correct endianness');

  t.end();
});

test('int32', function(t) {
  ctx = new serializer.Context();
  
  var INT32_MIN = -Math.pow(2, 31);
  var INT32_MAX = Math.pow(2, 31)-1;

  var len =
    serializer.int32(ctx, INT32_MIN) +
    serializer.int32(ctx, -16777216) +
    serializer.int32(ctx, 0) +
    serializer.int32(ctx, INT32_MAX);

  t.equal(len, 16, 'len should tell us 16 bytes were written');

  result = new Uint8Array(ctx.finalize());
  
  t.equal(result.length, 16, 'four int32s should be 16 bytes long');
  t.deepEqual(result, new Uint8Array([
    128, 0, 0, 0,
    255, 0, 0, 0,
    0, 0, 0, 0,
    127,255,255,255
  ]), 'data should be written with correct endianness');

  t.end();
});

test('float64', function(t) {
  ctx = new serializer.Context();

  var len = 
    serializer.float64(ctx, 1) +
    serializer.float64(ctx, -2) +
    serializer.float64(ctx, 0) + 
    serializer.float64(ctx, Number.EPSILON) +
    serializer.float64(ctx, 3.1415927410) +  
    serializer.float64(ctx, -Infinity);
 
  t.equal(len, 48, 'len should tell us 48 bytes were written');

  result = new Uint8Array(ctx.finalize());
  
  t.equal(result.length, 48, '6 float64s should be 48 bytes long');
  t.deepEqual(result, new Uint8Array([
    0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x3c, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x40, 0x09, 0x21, 0xfb, 0x5f, 0xff, 0x91, 0x68,
    0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]), 'data should be written correctly');

  t.end();
});

test('uvarint', function(t) {
  ctx = new serializer.Context();   
  
  var len = 
    serializer.uvarint(ctx, 0) +
    serializer.uvarint(ctx, 127) +
    serializer.uvarint(ctx, 128) +
    serializer.uvarint(ctx, 128*128-1) +
    serializer.uvarint(ctx, 128*128) +
    serializer.uvarint(ctx, 128*128*128-1) +
    serializer.uvarint(ctx, 128*128*128) +
    serializer.uvarint(ctx, Math.pow(2,32)-1) +
    serializer.uvarint(ctx, Number.MAX_SAFE_INTEGER);

  t.equal(len, 29, 'the provided values should sum to 29 total bytes written');

  result = new Uint8Array(ctx.finalize());

  t.equal(result.length, 29, 'the values should be 29 bytes long');
  t.deepEqual(result, new Uint8Array([
    0x00,
    0x7f,
    0x80, 0x01,
    0xff, 0x7f,
    0x80, 0x80, 0x01,
    0xff, 0xff, 0x7f,
    0x80, 0x80, 0x80, 0x01,
    0xff, 0xff, 0xff, 0xff, 0x0f,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f
  ]), 'data should be written correctly');

  t.end();
});

test('svarint', function(t) {
  ctx = new serializer.Context();   
  
  // invalid values
  t.throws(function() { serializer.svarint(Number.MAX_SAFE_INTEGER+1) }, 'values too large will throw');
  t.throws(function() { serializer.svarint(Math.floor(Number.MIN_SAFE_INTEGER/2)-1) }, 'values too large on the negative side will throw' );

  var len = 
    serializer.svarint(ctx, 0) +
    serializer.svarint(ctx, 1) +
    serializer.svarint(ctx, -1) +
    serializer.svarint(ctx, 2) +
    serializer.svarint(ctx, -2) +
    serializer.svarint(ctx, 63) +
    serializer.svarint(ctx, -64) +
    serializer.svarint(ctx, 64) +
    serializer.svarint(ctx, -65) +
    serializer.svarint(ctx, 8191) +
    serializer.svarint(ctx, -8192) +
    serializer.svarint(ctx, 8192) +
    serializer.svarint(ctx, -8193) +
    serializer.svarint(ctx, -Math.pow(2,31)) +
    serializer.svarint(ctx, Math.pow(2,31)) + 
    serializer.svarint(ctx, Math.floor(Number.MIN_SAFE_INTEGER/2)) + 
    serializer.svarint(ctx, Number.MAX_SAFE_INTEGER);

  t.equal(len, 47, 'the provided values should sum to 47 total bytes written');

  result = new Uint8Array(ctx.finalize());
  t.equal(result.length, 47, 'the values should be 47 bytes long');
  t.deepEqual(result, new Uint8Array([
    0x00,
    0x02,
    0x01,
    0x04,
    0x03,
    0x7e,
    0x7f,
    0x80, 0x01,
    0x81, 0x01,
    0xfe, 0x7f,
    0xff, 0x7f,
    0x80, 0x80, 0x01,
    0x81, 0x80, 0x01,
    0xff, 0xff, 0xff, 0xff, 0x0f,
    0x80, 0x80, 0x80, 0x80, 0x10,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f,
    0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f
  ]), 'data should be written correctly');
  t.end();   
});

test('toString', function(t) {
  ctx = new serializer.Context();
  serializer.uint8(ctx, 0);
  serializer.uint16(ctx, 0x0102);
  serializer.uint32(ctx, 0x03040506);

  t.equal(ctx.toString(), '00010203040506', 'serializer contents can be converted to a hex string for easy viewing');

  t.end();
});

test('buffer', function(t) {
  ctx = new serializer.Context();
  
  var len = serializer.buffer(ctx, new Uint8Array([1,2,3,4,5]).buffer);
  t.equal(len, 5, '5 bytes appended from buffer');
  t.equal(ctx.toString(), '0102030405');    

  t.throws(function() { serializer.buffer(new Uint8Array(16385)); }, 'buffers too large will throw')

  t.end();
});

test('rawString', function(t) {
  var fails = [];
  for (var i = 0; i < EVIL_STRINGS.length; i++) {
    var ex = EVIL_STRINGS[i];
    ctx = new serializer.Context();
    var len = serializer.rawString(ctx, ex.input);
    var hex = ctx.toString();
    if (len != ex.utf8Length || hex != ex.utf8Hex) {
      fails.push({
        input: ex.input,
        wantedLength: ex.utf8Length,
        wantedHex: ex.utf8Hex,
        gotLength: len,
        gotHex: hex
      });
    }
  }

  t.equal(fails.length, 0, 'evil unicode test suite of death passed');
  for (var i = 0; i < fails.length; i++) {
    var f = fails[i];
    console.error('string "' + f.input + '": wanted hex ' + f.wantedHex + ', but got ' + f.gotHex);
  }
  t.end();
}); 

test('string', function(t) {
 
  ctx = new serializer.Context(); 
  var len =
    serializer.string(ctx, '') +
    serializer.string(ctx, 'wat');

  t.equal(len, 5, 'three characters and two one-byte varints');

  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x00,
    0x03,
    0x77,
    0x61,
    0x74
  ]), 'varint strings');

  t.end();
});

test('boolean', function(t) {
  
  ctx = new serializer.Context();
  var len = 
    serializer.boolean(ctx, true) +
    serializer.boolean(ctx, false) +
    serializer.boolean(ctx, true);

  t.equal(len, 3, 'booleans get one byte apiece, how wasteful');
  
  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x01,
    0x00,
    0x01
  ]), 'bools are set to either 1 or 0 (not both)');

  t.end();
});

test('date', function(t) {
  ctx = new serializer.Context();
  var year2038 = new Date('2038-01-19T03:14:08z');
  var len = 
    serializer.date(ctx, new Date(0)) +
    serializer.date(ctx, year2038);
  
  t.equal(len, 8, 'dates are encoded as uint32 epochs (we\'re all doomed in 2106)');

  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x00, 0x00, 0x00, 0x00,
    0x80, 0x00, 0x00, 0x00
  ]), 'dates are naive 4-byte sequences');

  t.end(); 
});

test('map', function(t) {
  ctx = new serializer.Context();
  
  var mapSerializer = serializer.map(serializer.uint8, serializer.boolean);

  var len = mapSerializer(ctx, [
    [9, false],
    [15, true],
    [127, false]
  ]);

  t.equal(len, 7, '7 bytes in this map');

  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x03,
    0x09, 0x00,
    0x0f, 0x01,
    0x7f, 0x00
  ]), 'map serializes ok');

  t.end();
});

test('array', function(t) {
  ctx = new serializer.Context();
  var arraySerializer = serializer.array(serializer.string);
  var len = arraySerializer(ctx, [
    '',
    'hello',
    'world'
  ]);

  t.equal(len, 14, '14 bytes in this array total');

  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x03,
    0x00,
    0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
    0x05, 0x77, 0x6f, 0x72, 0x6c, 0x64
   ]), 'array of values serialized sequentially');

  t.end();
});

test('optional', function(t) {
  ctx = new serializer.Context();
  var optionalString = serializer.optional(serializer.string);
  var len =
    optionalString(ctx, 'hello') +
    optionalString(ctx, null) +
    optionalString(ctx, '');

  t.equal(len, 10, '10 bytes in this set of optional values');

  var data = new Uint8Array(ctx.finalize());

  t.deepEqual(data, new Uint8Array([
    0x01, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
    0x00,
    0x01, 0x00
   ]), 'optional values are prefaced with a 1 or 0');
  
  t.end();
});

test('object', function(t) {
  ctx = new serializer.Context();

  var objectSerializer = serializer.object([
    ["foo", serializer.boolean],
    ["bar", serializer.optional(serializer.boolean)],
    ["baz", serializer.uint8]
  ]);

  t.throws(function() { objectSerializer(s, null); }, 'null objects not serializable');
  t.throws(function() { objectSerializer(s, undefined); }, 'undefined objects not serializable');
  t.throws(function() { objectSerializer(s, true); }, 'builtin types not serializable');

  var len = objectSerializer(ctx, {
    foo: true,
    baz: 255
  });

  t.equal(len, 3, 'object wrote 3 uint8s');
  t.deepEqual(new Uint8Array(ctx.finalize()), new Uint8Array([
    0x01, 0x00, 0xff
  ]), 'got the three bytes');

  t.end();
});
