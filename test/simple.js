var should = require('should');
var mstats = require('../index.js');


describe('basic wrapping test', function(){
  describe('wrap only', function(){
    // simple test objects
    var exportTest = {
      a: function a(arg1, arg2){ return arg1 + arg2;},
      b: function b(arg2, arg2){ return arg1 + arg2;},
      c: "hello"
    }
    it('functions a and b should be wrapped', function(){
      mstats.wrap("test", exportTest);
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
    });
  });
  
  describe('function wrapping', function(){
    var exportFunction = function exportFunction(arg1, arg2){
      return arg1 + arg2;
    }
    exportFunction["a"] = function a(arg1, arg2){ return arg1 + arg2;};
    exportFunction["b"] = function b(arg2, arg2){ return arg1 + arg2;};
    
    it('functions a and b and the obj itself should be wrapped', function(){
      var ret = mstats.wrap("test", exportFunction);
      exportFunction.a.__concurix_wrapper_for__.should.equal('a');
      exportFunction.b.__concurix_wrapper_for__.should.equal('b');
      ret.__concurix_wrapper_for__.should.equal('exportFunction');
    });
  });  
});
  

