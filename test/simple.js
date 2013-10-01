var should = require('should');
var mstats = require('../index.js');

// simple test objects
var exportTest = {
  a: function a(arg1, arg2){ return arg1 + arg2;},
  b: function b(arg2, arg2){ return arg1 + arg2;},
  c: "hello"
}

describe('basic wrapping test', function(){
  describe('wrap only', function(){
    it('should return arg1 + arg2 after wrapping', function(){
      mstats.wrap("test", exportTest);
    });
  });
});
  

