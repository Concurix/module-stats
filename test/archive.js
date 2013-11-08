var should = require('should');
var mstats = require('../index.js');

describe('archive tests', function(){  
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

  describe('listener test', function(){
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

    it('count for a should be 3', function(done){
      function archiveListener(json){
        json.data.nodes.length.should.be.above(1);
        json.data.links.length.should.be.above(1);
        done();
      }
      mstats.reset();
      mstats.wrap("test", exportTest, 
        {
          beforeHook: beforeHook, 
          archiveListener: archiveListener,
          archiveInterval: 50      // mocha will time out after 2000 ms.
        });
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

       
});
  

