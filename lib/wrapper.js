/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
 
 wrapper.js--utility functions for wrapping module.exports and other 
*/

var wrap = require('concurix-wrap');
var util = require('./util');
var Rules = require('./rules');

// just require the aggregate system, it will setup a global variable to handle versioning
// and multiple instances
require('./aggregate');

function tagObject(obj, tag) {
  if (obj == null) {
    return;
  }
  if (util.isObject(obj) || util.isFunction(obj)) {
    Object.defineProperty(obj, tag, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: true
    });
  }
}

module.exports.blacklist = function blacklist(obj) {
  tagObject(obj, '__concurix_blacklisted');
  util.iterateOwnProperties(obj, function (key) {
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set) {
      return;
    }
    tagObject(desc.value, '__concurix_blacklisted');
  })
}

function generateHooks(options, rules){
  var hooks = {
    beforeHook: function beforeHook(trace, clientState){
      if(options && options.beforeHook){
        options.beforeHook(trace, clientState.clientState);
      }
      global.concurix.traceAggregate.handleBeforeTrace(trace, clientState);
      wrapArguments(trace, clientState, hooks);  // important, wrap arguments after computing the beforeState so that we can figure out callees
    },
    afterHook: function afterHook(trace, clientState){
      if(options && options.afterHook){
        options.afterHook(trace, clientState.clientState);
      }
      updateArguments(trace, clientState);
      wrapReturn(trace, clientState, hooks, rules);
      global.concurix.traceAggregate.handleAfterTrace(trace, clientState);
    }
  }
  return hooks;
}
module.exports.wrapExports = function wrapExports(name, obj, options){
  if (obj.__concurix_blacklisted) {
    return obj;
  }

  var ret = obj;
  var rules = new Rules(options.rules);
  var hooks = generateHooks(options, rules);
  var state = {
    modInfo: {
      top: (options && options.moduleTop) || name,
      requireId: name,
      id: (options && options.moduleId) || name
    },
    rules: rules
  };


  if( options && options.state){
    state.clientState = options.state;
  }
  //wrap the functions first
  module.exports.wrapFunctions(name, obj, -1, hooks, state, rules);
  //check to see if the  object itself is a function, if so, wrap it
  if( util.isFunction(obj) && !wrap.isWrapper(obj) && rules.wrapRequireReturn() ){
    ret = wrap(obj)
          .before(hooks.beforeHook)
          .after(hooks.afterHook)
          .state(state)
          .nameIfNeeded(name)
          .module(name)
          .getProxy();
  }
  return ret;
}

// iterate through all configurable properties and hook into each function
module.exports.wrapFunctions = function wrapFunctions(name, obj, protoLevel, hooks, state, rules){
  if (!(obj && (util.isObject(obj) || util.isFunction(obj)))){
    return;
  }

  if (obj.__concurix_blacklisted || obj.constructor.__concurix_blacklisted) {
    return;
  }

  if (obj.__concurix_wrapped_obj__ || !Object.isExtensible(obj)){
    return;
  }

  tagObject(obj, '__concurix_wrapped_obj__');


  protoLevel = protoLevel ? protoLevel : 0;
  util.iterateOwnProperties(obj, function(key){
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set){
      return;
    }

    // ignore blacklisted properties
    if (obj[key].__concurix_blacklisted) {
      return;
    }

    // if we are supposed to skip a function, blacklist it so we don't wrap it.
    if( !rules.wrapKey(key) ){
      module.exports.blacklist(obj[key]);
      return;
    }
    
    if ( util.isFunction(desc.value) && !wrap.isWrapper(obj[key]) && rules.wrapKey(key) ) {
      //console.log('wrapping ', key, ' for ', name, state.modInfo.top);
      obj[key] = wrap(obj[key])
                  .before(hooks.beforeHook)
                  .after(hooks.afterHook)
                  .module(name)
                  .state(state)
                  .nameIfNeeded(key)
                  .getProxy();
    } else if (util.isObject(desc.value) && !wrap.isWrapper(obj[key]) && rules.wrapKey(key)) {
      // to save cycles do not go up through the prototype chain for object-type properties
      module.exports.wrapFunctions(name, desc.value, 0, hooks, state, rules);
    }
  });
  // protoLevel is how deep you want to traverse the prototype chain. 
  // protoLevel = -1 - this will go all the way up excluding Object.prototype 
  if (protoLevel != 0){
    protoLevel--;
    var proto = Object.getPrototypeOf(obj);
    module.exports.wrapFunctions(name, proto, protoLevel, hooks, state, rules);
  }
}

// iterate through arguments and wrap functions as callbacks
function wrapArguments(trace, clientState, hooks){
  //wrap any callbacks found in the arguments
  var args = trace.args;
  var handler = clientState.rules.handleArgs(trace.funInfo.name);
  if( handler ){
    handler(trace, clientState);
  }
  for(var i = args.length - 1; i >= 0; i--){
    var a = args[i];
    if (util.isFunction(a) && !a.__concurix_blacklisted ){
      var callbackState = {
        modInfo: clientState.modInfo,
        rules: clientState.rules,
        callbackOf: trace
      };

      args[i] = wrap(a)
                  .before(hooks.beforeHook)
                  .after(hooks.afterHook)
                  .module((trace.calledBy && trace.calledBy.moduleName) || 'root')
                  .state(callbackState)
                  .nameIfNeeded(trace.funInfo.name + ' callback')
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

// TODO this may need to know about blacklists, e.g. module A returns an object instance from blacklisted module B
function wrapReturn(trace, clientState, hooks, rules){
  if (util.isFunction(trace.ret) && !trace.ret.__concurix_blacklisted) {
    module.exports.wrapFunctions(trace.moduleName, trace.ret, -1, hooks, clientState, rules );
    trace.ret = wrap(trace.ret)
          .before(hooks.beforeHook)
          .after(hooks.afterHook)
          .state(clientState)
          .nameIfNeeded(trace.moduleName)
          .module(trace.moduleName)
          .getProxy();
  } else {
    module.exports.wrapFunctions(trace.moduleName, trace.ret, -1, hooks, clientState, rules );
  }
}
