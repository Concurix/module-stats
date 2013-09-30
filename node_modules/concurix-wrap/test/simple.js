var should = require('should');
var wrap = require('../index.js');

function a(arg1, arg2){
  return arg1 + arg2;
}

describe('basic wrapping test', function(){
  describe('wrap only', function(){
    it('should return arg1 + arg2 after wrapping', function(){
      var b = wrap(a).getProxy();
      b(1,2).should.equal(3);
    });
  });
  
  describe('test before', function(){
    it('should get before hook called', function(){
      //do the tests outside of the hook
      var trace, clientState;
      var b = wrap(a)
        .before(function(traceArg, clientStateArg){ 
          trace = traceArg;
          clientState = clientStateArg;})
        .getProxy();
      b(1,2).should.equal(3);
      trace.args['0'].should.equal(1);
      trace.args['1'].should.equal(2);
      trace.funInfo.name.should.equal('a');
    });
  });
  
  describe('test after', function(){
    it('should get before hook called', function(){
      //do the tests outside of the hook
      var trace, clientState;
      var b = wrap(a)
        .after(function(traceArg, clientStateArg){ 
          trace = traceArg;
          clientState = clientStateArg;})
        .getProxy();
      b(1,2).should.equal(3);
      trace.args['0'].should.equal(1);
      trace.args['1'].should.equal(2);
      trace.funInfo.name.should.equal('a');
      trace.ret.should.equal(3);
    });
  }); 
  describe('test client state', function(){
    it('should get before hook called', function(){
      //do the tests outside of the hook
      var trace, clientState;
      var b = wrap(a)
        .after(function(traceArg, clientStateArg){ 
          trace = traceArg;
          clientState = clientStateArg;})
        .state('hello')
        .getProxy();
      b(1,2).should.equal(3);
      trace.args['0'].should.equal(1);
      trace.args['1'].should.equal(2);
      trace.funInfo.name.should.equal('a');
      trace.ret.should.equal(3);
      clientState.should.equal('hello');
    });
  });
  describe('test module name', function(){
    it('should get before hook called', function(){
      //do the tests outside of the hook
      var trace, clientState;
      var b = wrap(a)
        .after(function(traceArg, clientStateArg){ 
          trace = traceArg;
          clientState = clientStateArg;})
        .state('hello')
        .module('test')
        .getProxy();
      b(1,2).should.equal(3);
      trace.args['0'].should.equal(1);
      trace.args['1'].should.equal(2);
      trace.funInfo.name.should.equal('a');
      trace.ret.should.equal(3);
      clientState.should.equal('hello');
      trace.moduleName.should.equal('test');
    });
  });   
});