var fs = require('fs');

function packageReport(package_name, package_coverage) {
  var total_lines = 0;
  var total_branches = 0;
  var total_hits = 0;
  var total_branch_hit = 0;
  var class_text = '';

  for (var file in package_coverage) {
    if (package_coverage.hasOwnProperty(file)) {
      var coverage_array = package_coverage[file];

      var reportLines = [];
      // total lines of real code
      var code_lines = 0;
      // total lines touched
      var hit_lines = 0;
      // code branches
      var code_branches = 0;
      // branch hit (1 => 100%)
      var hit_branches = 0;

      for (var i = 0; i < coverage_array.length; i++) {
        var coberturaLine = coverage_array[i];
        if (coberturaLine !== undefined && coberturaLine !== null) {
          var condition_coverage;
          if (coberturaLine.branch) {
            code_branches++;
            if (coberturaLine.true > 0 && coberturaLine.false > 0) {
              condition_coverage = '100%';
              hit_branches += 1;
            }
            else if (coberturaLine.true === 0 && coberturaLine.false === 0) {
              condition_coverage = '0%';
            }
            else {
              condition_coverage = '50%';
              hit_branches += 0.5;
            }

            reportLines.push('<line branch="' + coberturaLine.branch + '" hits="' + coberturaLine.hits + '" number="' + i + '" condition-coverage="' + condition_coverage + '"><condition type="jump" number="' + i + '" coverage="' + condition_coverage + '"/></line>');
          } else {
            reportLines.push('<line branch="' + coberturaLine.branch + '" hits="' + coberturaLine.hits + '" number="' + i + '"/>');
          }

          if (coberturaLine.hits > 0) {
            hit_lines++;
          }
          code_lines++;
        }
      }

      // increment totals for package report
      total_lines += code_lines;
      total_hits += hit_lines;
      total_branches += code_branches;
      total_branch_hit += hit_branches;
      class_text += '<class branch-rate="' + (hit_branches / code_branches) + '" complexity="0.0" filename="' + file + '" line-rate="' + (hit_lines / code_lines) + '" name="' + file + '">\n<lines>\n';
      class_text += reportLines.join('\n');
      class_text += '</lines>\n</class>\n';
    }
  }

  return '<package branch-rate="' + (total_branch_hit / total_branches) + '" complexity="0.0" line-rate="' + (total_hits / total_lines) + '" name="' + package_name + '">\n<classes>\n' + class_text + '</classes>\n</package>\n';
}


function Reporter(srcdir) {
  if (global.__$coberturajs !== undefined && global.__$coberturajs !== null) {
    try {
      var __$coberturajs = global.__$coberturajs;
      var packages = {};
      var cobertura_report = '<?xml version="1.0" ?><!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-03.dtd">\n<coverage>\n<sources>\n<source>' + srcdir + '</source>\n</sources>\n<packages>\n';

      // get files organized in packages
      for (var file in __$coberturajs) {
        if (__$coberturajs.hasOwnProperty(file)) {
          var path = file.substr(0, file.lastIndexOf('/'));
          if (Array.isArray(packages[path])) {
            packages[path].push(file);
          } else {
            packages[path] = [file];
          }
        }
      }

      // filter a single package
      for (var singlePackage in packages) {
        if (packages.hasOwnProperty(singlePackage)) {
          // package is an array of filenames
          var package_coverage = {};
          for (var i = 0; i < packages[singlePackage].length; i++) {
            package_coverage[packages[singlePackage][i]] = __$coberturajs[packages[singlePackage][i]];
          }

          cobertura_report += packageReport(singlePackage, package_coverage);
        }
      }

      cobertura_report += '</packages>\n</coverage>\n';
      fs.writeFileSync('cobertura.xml', cobertura_report, 'utf8');
    } catch (ex) {
      console.error(ex);
    }
  }
}

module.exports = Reporter;