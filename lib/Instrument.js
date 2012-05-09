'use strict';

var esprima = require('esprima');
var escodegen = require('escodegen');

function createIncrementAST(filename, line, varname) {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'UpdateExpression',
      operator: '++',
      argument: {
        type: 'MemberExpression',
        computed: false,
        object: {
          type: 'MemberExpression',
          computed: true,
          object: {
            type: 'MemberExpression',
            computed: true,
            object: {
              type: 'Identifier',
              name: '__$coberturajs'
            },
            property: {
              type: 'Literal',
              value: filename
            }
          },
          property: {
            type: 'Literal',
            value: line
          }
        },
        property: {
          type: 'Identifier',
          name: varname
        }
      },
      prefix: false
    }
  };
}

var Instrument = function (code, name) {

  this.code = code;
  this.name = name;
  this.conditionalId = 0;
  this.lastLine = 0;

  this.lines = [];

  this.headCode =
    'var __$coberturajs = global.__$coberturajs;\n' +
      'if (typeof __$coberturajs === \'undefined\') {\n' +
      '  __$coberturajs = global.__$coberturajs = {};\n' +
      '}\n' +
      '__$coberturajs[\'' + this.name + '\'] = [];\n';

  this.linesCode = '';
  this.conditionalsCode = '';
};

Instrument.prototype = {

  // Short method to instrument the code

  instrument: function () {
    this.parse();
    this.walk();
    return this.generate();
  },

  // generate AST with esprima

  parse: function () {
    return (this.ast = esprima.parse(this.code, {
      loc: true,
      range: true
    }));
  },

  // generate new instrumented code from AST

  generate: function () {
    this._generateInitialRanges();
    return this.headCode + this.linesCode + this.conditionalsCode + escodegen.generate(this.ast);
  },

  _generateInitialRanges: function () {
    var i, l;
    for (i = 0, l = this.lines.length; i < l; i++) {
      this.linesCode += '__$coberturajs[\'' + this.name + '\'][' + this.lines[i].number + '] = {hits: 0, branch: ' + this.lines[i].branch + ', true: 0, false: 0};\n';
    }
  },

  // Modify AST by injecting extra instrumenting code

  walk: function () {
    this._walk(this.ast);
    return this.ast;
  },

  _walk: function (ast, index, parent) {

    // iterator variables
    var i, l, k;

    switch (index) {
      case 'body':
      case 'consequent':
        if (Array.isArray(ast)) {

          for (i = 0, l = ast.length; i < l; i++) {
            var node = ast[i * 2];

            if (node.loc === undefined) {
              continue;
            }

            var line = ast[i * 2].loc.start.line;

            var coberturaLine = {
              number: line,
              branch: false
            };

            if (node.type === 'IfStatement') {
              coberturaLine.branch = true;
              // add extra if for counters

              // tree is build bottom up
              this.conditionalId++;
              var test = ast[i * 2].test;

              // TODO: parse the test and add a check for each var in the test

              // add control if
              ast.splice(i * 2, 0, this._insertConditionalIf(line));
              // add control var
              ast.splice(i * 2, 0, this._insertConditionalVar(test));
              // replace test with var
              node.test = {
                type: 'Identifier',
                name: '__$coberturajsConditional_' + this.conditionalId
              };
              // we expanded the tree, so we need to increase the number of iterations
              l++;
            }

            // TODO: add check for switch statements

            ast.splice(i * 2, 0, this._insertLineCount(line));

            if (line > this.lastLine) {
              this.lines.push(coberturaLine);
            }
          }
        }
        break;
    }

    // recurse through the AST
    if (Array.isArray(ast)) {
      for (i = 0, l = ast.length; i < l; i++) {
        this._walk(ast[i], i, parent);
      }
    } else if (typeof ast === 'object') {
      for (k in ast) {
        if (ast.hasOwnProperty(k)) {
          this._walk(ast[k], k, parent);
        }
      }
    }
  },

  _insertLineCount: function (line) {
    return createIncrementAST(this.name, line, 'hits');
  },

  _insertConditionalVar: function (test) {
    return {
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: '__$coberturajsConditional_' + this.conditionalId
          },
          init: test
        }
      ],
      kind: 'var'
    };
  },

  _insertConditionalIf: function (line) {
    return {
      type: 'IfStatement',
      test: {
        type: 'Identifier',
        name: '__$coberturajsConditional_' + this.conditionalId
      },
      consequent: {
        type: 'BlockStatement',
        body: [
          createIncrementAST(this.name, line, 'true')
        ]
      },
      alternate: {
        type: 'BlockStatement',
        body: [
          createIncrementAST(this.name, line, 'false')
        ]
      }
    };
  }
};

module.exports = Instrument;
