/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
 
 wrapper.js--utility functions for wrapping module.exports and other 
*/

var wrap = require('concurix-wrap');
var util = require('./util');

// just require the aggregate system, it will setup a global variable to handle versioning
// and multiple instances
require('./aggregate');

function generateHooks(options){
  var hooks = {
    beforeHook: function beforeHook(trace, clientState){
      if(options && options.beforeHook){
        options.beforeHook(trace, clientState.clientState);
      }
      wrapArguments(trace, clientState, hooks);
      global.concurix.traceAggregate.handleBeforeTrace(trace, clientState);
    },
    afterHook: function afterHook(trace, clientState){
      if(options && options.afterHook){
        options.afterHook(trace, clientState.clientState);
      }
      updateArguments(trace, clientState);
      global.concurix.traceAggregate.handleAfterTrace(trace, clientState);
    }
  }
  return hooks;
}
module.exports.wrapExports = function wrapExports(name, obj, options){
  var ret = obj;
  var hooks = generateHooks(options);
  var state = {
    modInfo: {
      top: (options && options.moduleTop) || name,
      requireId: name,
      id: (options && options.moduleId) || name
    }
  };
  if( options && options.state){
    state.clientState = options.state;
  }
  //wrap the functions first
  module.exports.wrapFunctions(name, obj, -1, hooks, state);
  //check to see if the  object itself is a function, if so, wrap it
  if( util.isFunction(obj) && !wrap.isWrapper(obj)){
    ret = wrap(obj)
          .before(hooks.beforeHook)
          .after(hooks.afterHook)
          .state(state)
          .module(name)
          .getProxy();
  }
  return ret;
}


// iterate through all configurable properties and hook into each function
module.exports.wrapFunctions = function wrapFunctions(name, obj, protoLevel, hooks, state){
  if (!(obj && (util.isObject(obj) || util.isFunction(obj)))){
    return;
  }
  
  if( !Object.isExtensible(obj)){
    return;
  }

  protoLevel = protoLevel ? protoLevel : 0;
  var self = this;
  
  util.iterateOwnProperties(obj, function(key){
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set) return;
    
    // don't double wrap anyting we have already seen.
    if (util.isFunction(desc.value) && !wrap.isWrapper(obj[key])) {
      obj[key] = wrap(obj[key])
                  .before(hooks.beforeHook)
                  .after(hooks.afterHook)
                  .module(name)
                  .state(state)
                  .getProxy();
    } else if (util.isObject(desc.value)) {
      // to save cycles do not go up through the prototype chain for object-type properties
      self.wrapFunctions(name, desc.value, 0, hooks, state);
    }
  });
  
  // protoLevel is how deep you want to traverse the prototype chain. 
  // protoLevel = -1 - this will go all the way up excluding Object.prototype 
  if (protoLevel != 0){
    protoLevel--;
    var proto = Object.getPrototypeOf(obj);
    self.wrapFunctions(name, proto, protoLevel, hooks, state);
  }
}

// iterate through arguments and wrap functions as callbacks
function wrapArguments(trace, clientState, hooks){
  //wrap any callbacks found in the arguments
  var args = trace.args;
  for(var i = args.length - 1; i >= 0; i--){
    var a = args[i];
    if (util.isFunction(a) && !wrap.isWrapper(a)){
      var callbackState = {
        module: clientState.modInfo,
        callbackOf: trace
      };
      // trace.hasCallbacks = trace.hasCallbacks || [];
      // trace.hasCallbacks.push(callbackTrace);
      clientState.callbackState = callbackState;
      args[i] = wrap(a)
                  .before(hooks.beforeHook)
                  .after(hooks.afterHook)
                  .module(trace.moduleName)
                  .state(clientState)
                  .getProxy();
      trace.origFunctionArguments = trace.origFunctionArguments || [];
      trace.origFunctionArguments.push(a);
    }
  }
}

function updateArguments(trace){
  if (trace.origFunctionArguments){
    var args = trace.args;
    var j = 0;
    for(var i = args.length - 1; i >= 0; i--){
      var a = args[i];
      if (util.isFunction(a) && wrap.isWrapper(a)){
        wrap.extendWrapperToOriginal(a);
      }
    }
  }
}