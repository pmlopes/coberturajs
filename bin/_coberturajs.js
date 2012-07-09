"use strict";

var fs = require('fs');
var path = require('path');
var pack = require('../package.json');
var Instrument = require('../lib/Instrument');

// options
var files = [];
var dir;
var recursive = false;
var excludes = [];
var cwd = path.normalize(process.cwd());

var args = process.argv.slice(2);
if (!args.length) {
  args.push('--help');
}

for (var i = 0; i < args.length; i++) {
  var arg = args[i];

  if (arg === '--version' || arg === '-v') {
    console.log(pack.version);
    process.exit(0);
    break;
  }

  if (arg === '--output' || arg === '-o') {
    dir = args[++i];
    continue;
  }

  if (arg === '--recursive' || arg === '-r') {
    recursive = true;
    continue;
  }

  if (arg === '--exclude' || arg === '-e') {
    excludes.push(args[++i]);
    continue;
  }

  if (arg === '--help' || arg === '-h') {

    var help = '\n\n' +
      '  Usage: coverjs [options] <files>\n\n' +
      '  Options:\n\n' +
      '    -h, --help                   output usage information\n' +
      '    -v, --version                output version information\n' +
      '    -o, --output <directory>     directory to output the instrumented files\n' +
      '    -r, --recursive              recurse in subdirectories\n' +
      '    -e, --exclude <directories>  exclude these directories' +
      '\n\n';

    console.log(help);
    process.exit(0);
    break;

  }

  files.push(arg);
}

// normalize dir
if (!dir) {
  console.warn('the --output option is required');
  process.exit(1);
} else {
  dir = path.normalize(dir);
}

// normalize exclude files/directories
excludes.map(function (dir) {
  return path.normalize(dir);
});

function mkdir(p, mode, cb) {
  if (p.charAt(0) !== '/') {
    cb('Relative path: ' + p);
  } else {
    var ps = path.normalize(p).split('/');

    fs.exists(p, function (exists) {
      if (exists) {
        return cb(null);
      }

      var newdir = ps.slice(0, -1).join('/');

      mkdir(newdir, mode, function (err) {
        if (err) {
          // not really an error
          if (err.code === 'EEXIST') {
            return cb(null);
          }
          return cb(err);
        }

        fs.mkdir(p, mode, function (err) {
          if (err) {
            // not really an error
            if (err.code === 'EEXIST') {
              return cb(null);
            }
          }
          return cb(err);
        });
      });
    });
  }
}

function processFile(f, cb) {
  if (f.indexOf(cwd) === 0) {
    // remove the first slash
    f = f.substr(cwd.length + 1);
  }
  var file = path.normalize(f);

  fs.stat(file, function (err, stat) {
    if (err) {
      return cb(err);
    }

    if (stat.isFile()) {
      var ext = path.extname(file);
      if (ext !== '.js') {
        console.log(file + ' is not a JavaScript file');
        return cb(null);
      }

      fs.readFile(file, function (err, data) {
        if (err) {
          return cb(err);
        } else {

          var newFile = path.resolve(dir, file);
          var newDir = path.dirname(newFile);

          mkdir(newDir, 511 /* 0777 */, function (err) {
            if (err) {
              return cb(err);
            }

            var instrument = new Instrument(data.toString(), file);
            var instrumented = instrument.instrument();

            fs.writeFile(newFile, instrumented, cb);
          });
        }
      });
    } else if (recursive && stat.isDirectory()) {

      console.log('Recursing into ' + file);

      fs.readdir(file, function (err, files) {
        if (err) {
          return cb(err);
        }

        files.forEach(function (_file) {
          var basename = path.basename(_file);
          if (_file !== '..' && _file !== '.' && excludes.indexOf(basename) === -1) {
            processFile(file + '/' + _file, cb);
          }
        });

        cb(null);
      });
    } else if (stat.isDirectory()) {
      console.log(file + ' is a directory, maybe use the --recursive option');
      cb(null);
    } else {
      console.log(file + ' is not a file nor a directory');
      cb(null);
    }
  });
}

files.forEach(function (file) {
  processFile(file, function (err) {
    if (err) {
      console.error('ERROR: ', err);
      process.exit(1);
    }
  });
});
