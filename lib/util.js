// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// General utility functions

'use strict';

module.exports = Util;

function Util(options){}

Util.extend = function extend(dst, src){
  Util.iterateOwnProperties(src, function iterator(key){
    var dstPropDesc = Object.getOwnPropertyDescriptor(dst, key);
    if (dstPropDesc && (!dstPropDesc.configurable )) {
      return;
    }
    
    var srcPropDesc = Object.getOwnPropertyDescriptor(src, key);
    dstPropDesc = {};
    dstPropDesc[key] = srcPropDesc;
    Object.defineProperties(dst, dstPropDesc);
  });
}

Util.iterateOwnProperties = function iterateOwnProperties(obj, iterator){
  Object.getOwnPropertyNames(obj || {}).forEach(function(key) {
    var protectedKeys = key === 'prototype' || key === 'caller' || key === 'length' || key === 'constructor';
    if (protectedKeys || key.indexOf('__concurix') >= 0) {
      return;
    }
    iterator(key);
  });
}

//Util.log = function(){};
Util.log = (function(){
  var log;
  if (Function.prototype.bind) {
    log = Function.prototype.bind.call(console.log, console);
  } else {
    log = function log() { 
      Function.prototype.apply.call(console.log, console, arguments);
    };
  }
  return log;
})();

Util.isPrimitiveType = function isPrimitiveType(obj){
  return  obj instanceof Array ||
          obj instanceof String ||
          obj instanceof Boolean ||
          obj instanceof Number ||
          obj instanceof Error ||
          obj instanceof Date ||
          obj instanceof RegExp ||
          obj instanceof Buffer;
}

Util.isObject = function isObject(obj){
  return  obj && 
          (typeof obj === 'object') && 
          !('length' in obj) &&     //ignore all array-like objects
          !Util.isPrimitiveType(obj) &&
          obj !== Object.prototype;
}

Util.isFunction = function isFunction(obj) {
  var funcCheck = obj && obj.constructor && obj.call && obj.apply;
  var primitiveConstructor = !funcCheck ||
    obj === Array || 
    obj === Object || 
    obj === String || 
    obj === Boolean || 
    obj === Number || 
    obj === Error ||
    obj === Date ||
    obj === RegExp ||
    obj === Buffer;
  
  //TODO: do we need to avoid wrapping some native functions?
  // var isNative = !funcCheck || obj === JSON.stringify;
  
  return funcCheck && !primitiveConstructor;
};

Util.values = function(obj){
  var values = [];
  Object.keys(obj || {}).forEach(function(key) {
    values.push(obj[key]);
  })
  return values;
}

Util.printStack = function printStack(stack){
  stack.forEach(function(site){
    Util.log(' %s in %s:%d'
      , site.getFunctionName() || 'anonymous'
      , site.getFileName()
      , site.getLineNumber());
    });
}

Util.addHrtTimes = function addHrtTimes(t1, t2){
  return [ t1[0] + t2[0], t1[1] + t2[1] ];
}

Util.subHrtTime = function subHrtTimes(t1, t2){
  return [t1[0] - t2[0], t1[1] - t2[1]];
}


Util.hrtToUs = function hrtToUs(hrt){
  if (!hrt) return;
  var secs = hrt[0];
  var ns = hrt[1];
  return Math.floor((secs * 1e6) + (ns / 1000));
}

Util.sleep = function sleep(msec){
  var t = Util.unixTimeMs() + msec;
  while (Util.unixTimeMs() <= t) { ; }
}

Util.unixTimeSec = function(){
  return Math.floor(Util.unixTimeMs()/1000);
}

Util.unixTimeMs = function(){
  var d = new Date();
  return d.getTime();
}