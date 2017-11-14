/* eslint-env node */

exports.run = dist;

var UglifyJS = require('uglify-js');

var lib = require('./lib');
var file = require('./lib/file');

var sets = [
  {
    out: 'steem-crypto',
    files: ['lib/sjcl.js', 'lib/crypto']
  },
  {
    out: 'steemit.tiny',
    files: [
      'lib/browser/request-json.js',
      'lib/common/sjcl.js',
      'lib/common/api.js'
    ]
  }
];

if (require.main === module) {
  dist().catch(function(error) {
    console.error(error); // eslint-disable-line no-console
    process.exit(1);
  });
}

function dist() {
  return lib
    .run()
    .then(function() {
      return Promise.all(
        sets.map(function(l) {
          return file.concat(l.files);
        })
      );
    })
    .then(function(contents) {
      return Promise.all(
        contents.map(function(content, i) {
          return file
            .output('dist/' + sets[i].out + '.js', content)
            .then(function() {
              return content;
            });
        })
      );
    })
    .then(function(contents) {
      var minifiedContents = contents.map(function(content, i) {
        var obj = {};
        obj[sets[i].out] = content;

        return UglifyJS.minify(obj, {
          sourceMap: {
            filename: sets[i].out + '.min.js',
            url: sets[i].out + '.map'
          }
        });
      });

      return Promise.all(
        minifiedContents.map(function(m, i) {
          return file
            .output('dist/' + sets[i].out + '.min.js', m.code)
            .then(function() {
              return file.output('dist/' + sets[i].out + '.min.js.map', m.map);
            });
        })
      );
    });
}
