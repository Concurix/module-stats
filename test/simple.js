var should = require('should');
var mstats = require('../index.js');


describe('basic wrapping test', function(){
  describe('wrap only', function(){
    // simple test objects
    var exportTest = {
      a: function a(arg1, arg2){ return arg1 + arg2;},
      b: function b(arg1, arg2){ return arg1 + arg2;},
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
    exportFunction["b"] = function b(arg1, arg2){ return arg1 + arg2;};
    
    it('functions a and b and the obj itself should be wrapped', function(){
      var ret = mstats.wrap("test", exportFunction);
      exportFunction.a.__concurix_wrapper_for__.should.equal('a');
      exportFunction.b.__concurix_wrapper_for__.should.equal('b');
      ret.__concurix_wrapper_for__.should.equal('exportFunction');
    });
  });
  
  describe('method invocation', function(){
    var exportFunction = function exportFunction(arg1, arg2){
      return arg1 + arg2;
    }
    exportFunction["a"] = function a(arg1, arg2){ return arg1 + arg2;};
    exportFunction["b"] = function b(arg1, arg2){ return arg1 + arg2;};
    
    it('wrapped methods should be called and return the correct answer', function(){
      var ret = mstats.wrap("test", exportFunction);
      ret.a(1,1).should.equal(2);
      ret.b(1,1).should.equal(2);
    });
  }); 
  
  describe('before hook test', function(){
    // simple test objects
    var exportTest = {
      a: function a(arg1, arg2){ return arg1 + arg2;},
      b: function b(arg2, arg2){ return arg1 + arg2;},
      c: "hello"
    }
    var test = 1;
    clientState = {val: 2};
    function beforeHook(trace, clientState){
      test = clientState.val;
      clientState.val = 3;;
    }
    it('functions a and b should be wrapped', function(){
      mstats.wrap("test", exportTest, {beforeHook: beforeHook, state: clientState});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.a();
      test.should.equal(2);
      clientState.val.should.equal(3);
    });
  });
  
  describe('call count test', function(){
    // simple test objects
    var exportTest = {
      a: function a(arg1, arg2){ return arg1 + arg2;},
      b: function b(arg1, arg2){ return arg1 + arg2;},
      c: "hello"
    };
    var id = null;
    function beforeHook(trace, clientState){
      id = trace.funInfo.id;
    }
    it('count for a should be 2', function(){
      mstats.reset();
      mstats.wrap("test", exportTest, {beforeHook: beforeHook});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.a();
      exportTest.a();
      console.log('cache ', global.concurix.traceAggregate.nodeCache);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b();
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(1);      
    });
  });       
});
  

