var test = require("tape").test;

var ModuleStats = require('../index.js');
var wrap = require('concurix-wrap');

var mstats;

test("setup", function (t) {
  mstats = ModuleStats({accountKey: "module-stats-test-harness", skipArchive: true});
  t.ok(mstats instanceof ModuleStats);
  t.end();
})

test("globally unique", function (t) {
  t.equals(mstats, ModuleStats({}), "Only one module-stats instance allowed.");
  t.end();
})

test("basic: wrap only", function (t) {
  var exportTest = {
    a: function a(arg1, arg2){ return arg1 + arg2;},
    b: function b(arg1, arg2){ return arg1 + arg2;},
    c: "hello"
  }

  mstats.wrap("test", exportTest);
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  t.end();
})

test("basic: function wrapping", function (t) {
  var exportFunction = function exportFunction(arg1, arg2){
    return arg1 + arg2;
  }
  exportFunction["a"] = function a(arg1, arg2){ return arg1 + arg2;};
  exportFunction["b"] = function b(arg1, arg2){ return arg1 + arg2;};

  var ret = mstats.wrap("test", exportFunction);
  t.equals(exportFunction.a.__concurix_wrapper_for__, "a");
  t.equals(exportFunction.b.__concurix_wrapper_for__, "b");
  t.equals(ret.__concurix_wrapper_for__, 'exportFunction');
  t.end();
})

test("basic: method invocation", function (t) {
  t.plan(2);
  var exportFunction = function exportFunction(arg1, arg2){
    return arg1 + arg2;
  }
  exportFunction["a"] = function a(arg1, arg2){ return arg1 + arg2;};
  exportFunction["b"] = function b(arg1, arg2){ return arg1 + arg2;};

  var ret = mstats.wrap("test", exportFunction);
  t.equals(exportFunction.a(1, 1), 2);
  t.equals(exportFunction.b(1, 1), 2);
})

test("basic: before hook", function (t) {
  t.plan(4);
  var exportTest = {
    a: function a(arg1, arg2){ return arg1 + arg2;},
    b: function b(arg2, arg2){ return arg1 + arg2;},
    c: "hello"
  }

  var test = 1;
  clientState = {val: 2};
  function beforeHook(trace, clientState) {
    test = clientState.val;
    clientState.val = 3;
  }

  mstats.wrap("test", exportTest, {beforeHook: beforeHook, state: clientState});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.a();
  t.equals(test, 2);
  t.equals(clientState.val, 3);
})

test("wrap a constructor", function (t) {
  function Cat() {
    if (!(this instanceof Cat)) return new Cat();
  }
  var C = mstats.wrap("Cat", Cat);
  var c = C();
  t.ok(c instanceof Cat);
  t.ok(C.__concurix_wrapper_for__ === "Cat");
  t.end();
})

test("abort wraping a non-exensible Obj", function (t) {
  function Cat() {
    if (!(this instanceof Cat)) return new Cat();
  }
  Object.preventExtensions(Cat);
  var C = mstats.wrap("Cat", Cat);
  var c = C();
  t.ok(c instanceof Cat);
  t.notOk(C.__concurix_wrapper_for__ === "Cat");
  t.end();
})

test("basic: call count test", function (t) {
  t.plan(5);
  var exportTest = {
    a: function a(arg1, arg2){ return arg1 + arg2;},
    b: function b(arg1, arg2){ return arg1 + arg2;},
    c: "hello"
  };
  var id = null;
  function afterHook(trace, clientState){
    id = trace.name;
  }
  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.a();
  exportTest.a();
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 2);
  t.ok(mstats.aggregator.nodeCache[id].duration >= 0, "duration should be a number");
  exportTest.b();
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 1);
})

test("basic: link count test", function (t) {
  t.plan(8);
  var exportTest = {
    a: function a(arg1, arg2){ return arg1 + arg2;},
    b: function b(arg1, arg2){ return this.a(arg1, arg2);},
    c: "hello"
  };
  var id = null;
  function afterHook(trace, clientState){
    id = trace.name;
  }
  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b();
  exportTest.b();
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 2);
  t.ok(mstats.aggregator.nodeCache[id].duration > 0, "duration > 0");
  exportTest.b();
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 3);

  var linkCache = mstats.aggregator.linkCache;
  var keys = Object.keys(linkCache);
  t.equals(keys.length, 1);
  t.equals(linkCache[keys[0]].num_calls, 3);
  t.ok(linkCache[keys[0]].total_delay >= 0, "total_delay should be a number");
})

test("basic: callback test", function (t) {
  t.plan(8);
  function callback(arg){ return arg;}
  var exportTest = {
    a: function a(arg1, cb ){ return cb(arg1 + arg1);},
    b: function b(arg1){ return this.a(arg1, callback);},
    c: "hello"
  };
  exportTest.b(1);
  var id = null;
  function afterHook(trace, clientState){
    id = trace.name;
  }

  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b(1);
  exportTest.b(2);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 2);
  t.ok(mstats.aggregator.nodeCache[id].duration > 0, "duration > 0");
  exportTest.b(3);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 3);

  var linkCache = mstats.aggregator.linkCache;
  var keys = Object.keys(linkCache);
  t.equals(keys.length, 3);
  t.equals(linkCache[keys[0]].num_calls, 3);
  t.ok(linkCache[keys[0]].total_delay >= 0, "total_delay should be a number");
})

test("basic: start stop test", function (t) {
  t.plan(13);
  function callback(arg){ return arg;}
  var exportTest = {
    a: function a(arg1, cb){ return cb(arg1 + arg1);},
    b: function b(arg1){ return this.a(arg1, callback);},
    c: "hello"
  };
  exportTest.b(1);
  var id = null;
  function afterHook(trace, clientState){
    id = trace.name;
  }

  mstats.aggregator.reset();
  mstats.stop();
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b(1);
  exportTest.b(2);
  t.equals(mstats.aggregator.nodeCache, null);
  exportTest.b(3);
  t.equals(mstats.aggregator.nodeCache, null);
  t.equals(mstats.aggregator.linkCache, null);

  mstats.start();
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b(1);
  exportTest.b(2);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 2);
  t.ok(mstats.aggregator.nodeCache[id].duration > 0, "duration > 0");
  exportTest.b(3);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 3);

  var linkCache = mstats.aggregator.linkCache;
  var keys = Object.keys(linkCache);
  t.equals(keys.length, 3);
  t.equals(linkCache[keys[0]].num_calls, 3);
  t.ok(linkCache[keys[0]].total_delay >= 0, "total_delay should be a number");
})

test("simple: double wrap", function (t) {
  t.plan(8);
  function callback(arg){ return arg;}

  var exportTest = {
    a: function a(arg1, cb ){ return cb(arg1 + arg1);},
    b: function b(arg1){ return this.a(arg1, callback);},
    c: "hello"
  };
  exportTest.b(1);
  var id = null;
  function afterHook(trace, clientState){
    id = trace.name;
  }

  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  mstats.wrap("test", exportTest, {afterHook: afterHook});
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b(1);
  exportTest.b(2);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 2);
  t.ok(mstats.aggregator.nodeCache[id].duration > 0, "duration > 0");
  exportTest.b(3);
  t.equals(mstats.aggregator.nodeCache[id].num_calls, 3);

  var linkCache = mstats.aggregator.linkCache;
  var keys = Object.keys(linkCache);
  t.equals(keys.length, 3);
  t.equals(linkCache[keys[0]].num_calls, 3);
  t.ok(linkCache[keys[0]].total_delay >= 0, "total_delay should be a number");
})

test("simple: extend function arguments", function (t) {
  t.plan(4);
  function callback1(arg){ return arg*arg;}
  function callback2(arg){ return arg+arg;}

  var exportTest = {
    a: function a(cb1, cb2 ){ cb1(1); cb2(2); cb1.new1 = "hello"; cb2.new2 = "there"; },
    b: function b(){ return this.a(callback1, callback2);},
    c: "hello"
  };
  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, null);
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.b(1);
  t.equals(callback1.new1, "hello");
  t.equals(callback2.new2, "there");
})

test("simple: extend function args w/ existing wrapped arg", function (t) {
  t.plan(7);
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
  mstats.aggregator.reset();
  mstats.wrap("test", exportTest, null);
  t.equals(exportTest.a.__concurix_wrapper_for__, "a");
  t.equals(exportTest.b.__concurix_wrapper_for__, "b");
  exportTest.d();
  t.equals(callback1.new1, "hello");
  t.equals(callback2.new2, "there");
  t.ok(wrap.isWrapper(checkcb1), "checkcb1 is a wrapper");
  t.ok(wrap.isWrapper(checkcb2), "checkcb2 is a wrapper");
  t.ok(wrap.isWrapper(checkcb3), "checkcb3 is a wrapper");
})
