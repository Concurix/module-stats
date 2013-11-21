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

function tagObjectAsWrapped(obj) {
  Object.defineProperty(obj, '__concurix_wrapped_obj__', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true
  });
}

// Don't wrap this!
tagObjectAsWrapped(module.exports);
tagObjectAsWrapped(require('util'))

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
      console.log("I RAN SOMETHIN")
      if (trace.ret == "meowzers") console.log("I meowed")
      if (trace.ret == "jumped") console.log("I jumped")
    }
  }
  return hooks;
}
module.exports.wrapExports = function wrapExports(name, obj, options){
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
  console.log("name: %s type: %s level: %s", name, typeof obj, protoLevel)
  if (obj && obj.constructor) console.log("type: ", obj.constructor.name)
  if (obj && obj.send_command) console.log("FOO 1")

  if (!(obj && (util.isObject(obj) || util.isFunction(obj)))){
    console.log("Bail out 1")
    return;
  }
  if (obj && obj.send_command) console.log("FOO 2")

  if (obj && obj.send_command) {
    console.log("wrapped", obj.__concurix_wrapped_obj__)
    console.log("extensible", Object.isExtensible(obj))
  }

  if (obj.__concurix_wrapped_obj__ || !Object.isExtensible(obj)){
    console.log("Bail out 2")
    return;
  }
  if (obj && obj.send_command) console.log("FOO 3")
  console.log("Going to wrap--")

  tagObjectAsWrapped(obj);

  protoLevel = protoLevel ? protoLevel : 0;
  util.iterateOwnProperties(obj, function(key){
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set){
      return;
    }
    
    if ( util.isFunction(desc.value) && !wrap.isWrapper(obj[key]) && rules.wrapKey(key) ) {
      var fnName = desc.value.toString().match(/(.*?)\(/)
      fnName = fnName ? fnName[1] : desc.value
      console.log("Wrapping %s %s %s", name, key, fnName)
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
      console.log("recurive wrapping")
      module.exports.wrapFunctions(name, desc.value, 0, hooks, state, rules);
    }
  });


  // if (util.isFunction(obj)) {
  //     var fnName = obj.toString().match(/(.*?)\(/)
  //     fnName = fnName ? fnName[1] : obj
  //     console.log("Wrapping %s %s", name, fnName)
  //     //console.log('wrapping ', key, ' for ', name, state.modInfo.top);
  //     obj = wrap(obj)
  //                 .before(hooks.beforeHook)
  //                 .after(hooks.afterHook)
  //                 .module(name)
  //                 .state(state)
  //                 .nameIfNeeded(fnName)
  //                 .getProxy();
  // }

  // protoLevel is how deep you want to traverse the prototype chain. 
  // protoLevel = -1 - this will go all the way up excluding Object.prototype 
  if (protoLevel != 0){
    protoLevel--;
    var proto = Object.getPrototypeOf(obj);
    console.log("recursive wrapping by protoLevel")
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
    if (util.isFunction(a) /*&& !wrap.isWrapper(a)*/){
      var callbackState = {
        modInfo: clientState.modInfo,
        rules: clientState.rules,
        callbackOf: trace
      };

      console.log("Wrapping arguments")
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

function wrapReturn(trace, clientState, hooks, rules){
  if( util.isFunction(trace.ret) ){
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
