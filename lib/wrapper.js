/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
 
 wrapper.js--utility functions for wrapping module.exports and other 
*/

var wrap = require('concurix-wrap');
var util = require('./util');


function beforeHook(trace, clientState){
  console.log("before ", trace, clientState);
}

function afterHook(trace, clientState){
  console.log('after', trace, clientState);
}

module.exports.wrapExports = function wrapExports(name, obj, rules){
  var ret = obj;
  //wrap the functions first
  module.exports.wrapFunctions(name, obj, -1);
  //check to see if the  object itself is a function, if so, wrap it
  if( util.isFunction(obj) ){
    ret = wrap(obj)
          .before(beforeHook)
          .after(afterHook)
          .module(name)
          .getProxy();
  }
  return ret;
}


// iterate through all configurable properties and hook into each function
module.exports.wrapFunctions = function wrapFunctions(name, obj, protoLevel){
  if (!(obj && (util.isObject(obj) || util.isFunction(obj)))){
    return;
  }
  
  if (obj.__concurix_wrapper_for__ || !Object.isExtensible(obj)){
    return;
  }

  protoLevel = protoLevel ? protoLevel : 0;
  var self = this;
  
  util.iterateOwnProperties(obj, function(key){
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set) return;
    
    if (util.isFunction(desc.value)) {
      obj[key] = wrap(obj[key])
                  .before(beforeHook)
                  .after(afterHook)
                  .module(name)
                  .getProxy();
    } else if (util.isObject(desc.value)) {
      // to save cycles do not go up through the prototype chain for object-type properties
      self.wrapFunctions(name, desc.value, 0);
    }
  });
  
  // protoLevel is how deep you want to traverse the prototype chain. 
  // protoLevel = -1 - this will go all the way up excluding Object.prototype 
  if (protoLevel != 0){
    protoLevel--;
    var proto = Object.getPrototypeOf(obj);
    self.wrapFunctions(name, proto, protoLevel);
  }
}