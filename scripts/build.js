/* eslint-env node */

exports.run = buildSjcl;

var config = require('./config');
var file = require('./lib/file');

if (require.main === module) {
  buildSjcl().catch(function(error) {
    console.error(error); // eslint-disable-line no-console
    process.exit(1);
  });
}

function buildSjcl() {
  return file
    .mkdirP('lib')
    .then(function() {
      return file.concat(config.sjclFileList);
    })
    .then(function(contents) {
      return file.read(config.wrapperPath).then(function(wrapper) {
        var wrappedContents = wrapper
          .toString()
          .replace(/\/\/ SJCL_INSERT_POINT/, contents);
        return file.output(config.outFile, wrappedContents);
      });
    });
}
