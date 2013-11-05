var should = require('should');
var mstats = require('../index.js');
var wrap = require('concurix-wrap');


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
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b();
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(1);      
    });
  });  
  
  describe('link count test', function(){
    // simple test objects
    var exportTest = {
      a: function a(arg1, arg2){ return arg1 + arg2;},
      b: function b(arg1, arg2){ return this.a(arg1, arg2);},
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
      exportTest.b();
      exportTest.b();
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b();
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(3); 
      
      //now test the link cache
      var linkCache = global.concurix.traceAggregate.linkCache;
      var keys = Object.keys(linkCache);
      keys.length.should.equal(1);
      linkCache[keys[0]].num_calls.should.equal(3);
      linkCache[keys[0]].total_delay.should.not.be.NaN;  
    });
  }); 
  
  describe('callback test', function(){
    // simple test objects
    function callback(arg){ return arg;}
    
    var exportTest = {
      a: function a(arg1, cb ){ return cb(arg1 + arg1);},
      b: function b(arg1){ return this.a(arg1, callback);},
      c: "hello"
    };
    exportTest.b(1);
    var id = null;
    function beforeHook(trace, clientState){
      id = trace.funInfo.id;
    }
    it('count for a should be 3', function(){
      mstats.reset();
      mstats.wrap("test", exportTest, {beforeHook: beforeHook});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      exportTest.b(2);
      //console.log('cache ', global.concurix.traceAggregate.linkCache);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b(3);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(3); 
      
      //now test the link cache
      var linkCache = global.concurix.traceAggregate.linkCache;
      var keys = Object.keys(linkCache);
      keys.length.should.equal(3);
      linkCache[keys[0]].num_calls.should.equal(3);
      linkCache[keys[0]].total_delay.should.not.be.NaN;  
    });
  }); 
  
  describe('start stop test', function(){
    // simple test objects
    function callback(arg){ return arg;}
    
    var exportTest = {
      a: function a(arg1, cb ){ return cb(arg1 + arg1);},
      b: function b(arg1){ return this.a(arg1, callback);},
      c: "hello"
    };
    exportTest.b(1);
    var id = null;
    function beforeHook(trace, clientState){
      id = trace.funInfo.id;
    }
    it('should be started and stopped', function(){
      mstats.reset();
      mstats.stop();
      mstats.wrap("test", exportTest, {beforeHook: beforeHook});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      exportTest.b(2);
      //console.log('cache ', global.concurix.traceAggregate.linkCache);
      global.concurix.traceAggregate.should.have.property('nodeCache', null); 
      exportTest.b(3);
      global.concurix.traceAggregate.should.have.property('nodeCache', null);  
      
      //now test the link cache
      global.concurix.traceAggregate.should.have.property('linkCache', null);


      //don't reset, just start up and make sure everything works ok
      mstats.start();
      //mstats.wrap("test", exportTest, {beforeHook: beforeHook});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      exportTest.b(2);
      //console.log('cache ', global.concurix.traceAggregate.linkCache);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b(3);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(3); 
      
      //now test the link cache
      var linkCache = global.concurix.traceAggregate.linkCache;
      var keys = Object.keys(linkCache);
      keys.length.should.equal(3);
      linkCache[keys[0]].num_calls.should.equal(3);
      linkCache[keys[0]].total_delay.should.not.be.NaN;       
    });
  });        
  
  describe('double wrap test', function(){
    // simple test objects
    function callback(arg){ return arg;}
    
    var exportTest = {
      a: function a(arg1, cb ){ return cb(arg1 + arg1);},
      b: function b(arg1){ return this.a(arg1, callback);},
      c: "hello"
    };
    exportTest.b(1);
    var id = null;
    function beforeHook(trace, clientState){
      id = trace.funInfo.id;
    }
    it('should be started and stopped and not double wrap', function(){
      mstats.reset();
      mstats.stop();
      mstats.wrap("test", exportTest, {beforeHook: beforeHook});
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      exportTest.b(2);
      //console.log('cache ', global.concurix.traceAggregate.linkCache);
      global.concurix.traceAggregate.should.have.property('nodeCache', null); 
      exportTest.b(3);
      global.concurix.traceAggregate.should.have.property('nodeCache', null);  
      
      //now test the link cache
      global.concurix.traceAggregate.should.have.property('linkCache', null);


      //don't reset, just start up and make sure everything works ok
      mstats.start();
      
      // here is the double wrap call!!
      mstats.wrap("test", exportTest, {beforeHook: beforeHook});

      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      exportTest.b(2);
      //console.log('cache ', global.concurix.traceAggregate.linkCache);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(2);
      global.concurix.traceAggregate.nodeCache[id].duration.should.not.be.NaN;
      global.concurix.traceAggregate.nodeCache[id].mem_delta.should.not.be.NaN;
      exportTest.b(3);
      global.concurix.traceAggregate.nodeCache[id].num_calls.should.equal(3); 
      
      //now test the link cache
      var linkCache = global.concurix.traceAggregate.linkCache;
      var keys = Object.keys(linkCache);

      keys.length.should.equal(3);
      linkCache[keys[0]].num_calls.should.equal(3);
      linkCache[keys[0]].total_delay.should.not.be.NaN;       
    });
  });  

  describe('extend function arguments test', function(){
    // simple test objects
    function callback1(arg){ return arg*arg;}
    function callback2(arg){ return arg+arg;}
    
    var exportTest = {
      a: function a(cb1, cb2 ){ cb1(1); cb2(2); cb1.new1 = "hello"; cb2.new2 = "there"; },
      b: function b(){ return this.a(callback1, callback2);},
      c: "hello"
    };
    it('new properties should be reflected through', function(){
      mstats.reset();
      mstats.wrap("test", exportTest, null );
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.b(1);
      callback1.new1.should.equal('hello');
      callback2.new2.should.equal('there');
    });
  });

  describe('extend function arguments test with existing wrapped argument', function(){
    // simple test objects
    function callback1(arg){ return arg*arg;}
    function callback2(arg){ return arg+arg;}
    function callback3(arg){ return arg+arg+arg;}
    
    var checkcb1,
        checkcb2,
        checkcb3;
    var exportTest = {
      a: function a(cb1, cb2, cb3){ checkcb1 = cb1; checkcb2 = cb2; checkcb3 = cb3; cb1(1); cb2(2); cb1.new1 = "hello"; cb2.new2 = "there"; },
      b: function b(cb1, cb2){ return this.a(cb1, cb2, callback3);},
      c: "hello",
      d: function d(){ this.b(callback1, callback2);}
    };
    it('new properties should be reflected through', function(){
      mstats.reset();
      mstats.wrap("test", exportTest, null );
      exportTest.a.__concurix_wrapper_for__.should.equal('a');
      exportTest.b.__concurix_wrapper_for__.should.equal('b');
      exportTest.d(1);
      callback1.new1.should.equal('hello');
      callback2.new2.should.equal('there');
      wrap.isWrapper(checkcb1).should.be.true;
      wrap.isWrapper(checkcb2).should.be.true;
      wrap.isWrapper(checkcb3).should.be.true;
    });
  });                

});
  

