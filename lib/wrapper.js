/* module-stats

 A utility for collecting usage information on a per module basis

 Copyright 2013-2014 Concurix Corporation

 wrapper.js--utility functions for wrapping module.exports and other
*/

module.exports = Wrapper;

var wrap = require('concurix-wrap');
var util = require('./util');
var Rules = require('./rules');
var xtend = require('xtend');

function Wrapper(aggregator, options) {
  if (!(this instanceof Wrapper)) return new Wrapper(aggregator, options);

  this.options = options || {};

  this.aggregator = aggregator;
  this.rules = new Rules(this.options.rules);
  this.hooks = this.generateHooks();
}

Wrapper.prototype.optionsOverride = function optionsOverride(override) {
  if (override == null) {
    return this.options;
  }
  return xtend(this.options, override);
}

Wrapper.prototype.generateRules = function generateRules(override) {
  if (override == null || override.rules == null) {
    return this.rules;
  }
  return new Rules(this.optionsOverride(override));
}

Wrapper.prototype.generateHooks = function generateHooks(override) {
  if (override == null && this.hooks) {
    return this.hooks;
  }
  var options = this.optionsOverride(override);
  var rules = this.generateRules(override);

  var self = this
  var hooks = {
    beforeHook: function beforeHook(trace, clientState) {
      if (options && options.beforeHook) {
        options.beforeHook(trace, clientState.clientState);
      }
      self.aggregator.handleBeforeTrace(trace, clientState);
      // important, wrap arguments after computing the beforeState so that we can figure out callees
      wrapArguments(trace, clientState, hooks);
    },
    afterHook: function afterHook(trace, clientState) {
      if (options && options.afterHook) {
        options.afterHook(trace, clientState.clientState);
      }
      updateArguments(trace, clientState);
      wrapReturn(trace, clientState, hooks, rules);
      self.aggregator.handleAfterTrace(trace, clientState);
    }
  }

  return hooks;
}

function blacklist(obj) {
  if (!util.isObject(obj) && !util.isFunction(obj)) {
    // Can only blacklist objects & functions.
    return;
  }
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
Wrapper.prototype.blacklist = blacklist

Wrapper.prototype.wrapExports = function wrapExports(name, obj, override) {
  if (obj.__concurix_blacklisted) {
    return obj;
  }
  var options = this.optionsOverride(override);
  var hooks = this.generateHooks(override);
  var rules = this.generateRules(override);
  var ret = obj;
  var state = {
    modInfo: {
      top: (options.moduleTop) || name,
      requireId: name,
      id: (options.moduleId) || name
    },
    rules: rules
  };

  if (options.state) {
    state.clientState = options.state;
  }
  //wrap the functions first
  wrapFunctions(name, obj, -1, hooks, state, rules);
  //check to see if the  object itself is a function, if so, wrap it
  if (util.isFunction(obj) && !wrap.isWrapper(obj) && rules.wrapRequireReturn()) {
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

function tagObject(obj, tag) {
  if (obj == null ) {
    return;
  }
  if ((util.isObject(obj) || util.isFunction(obj)) && Object.isExtensible(obj)) {
    Object.defineProperty(obj, tag, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: true
    });
  }
}

// iterate through all configurable properties and hook into each function
function wrapFunctions(name, obj, protoLevel, hooks, state, rules){
  if (!(obj && (util.isObject(obj) || util.isFunction(obj)))){
    return;
  }

  if (obj.__concurix_blacklisted || (obj.constructor && obj.constructor.__concurix_blacklisted)) {
    return;
  }

  if (obj.__concurix_wrapped_obj__ || !Object.isExtensible(obj)){
    return;
  }

  tagObject(obj, '__concurix_wrapped_obj__');


  protoLevel = protoLevel ? protoLevel : 0;
  util.iterateOwnProperties(obj, function(key){
    var desc = Object.getOwnPropertyDescriptor(obj, key);

    // We got a property that wasn't a property.
    if (desc == null) {
      return;
    }

    // ignore properties that cannot be set
    if (!desc.configurable || !desc.writable || desc.set){
      return;
    }

    // ignore blacklisted properties
    if (desc.value && desc.value.__concurix_blacklisted) {
      return;
    }

    // if we are supposed to skip a function, blacklist it so we don't wrap it.
    if( !rules.wrapKey(key) ){
      blacklist(obj[key]);
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
      wrapFunctions(name, desc.value, 0, hooks, state, rules);
    }
  });
  // protoLevel is how deep you want to traverse the prototype chain. 
  // protoLevel = -1 - this will go all the way up excluding Object.prototype 
  if (protoLevel != 0){
    protoLevel--;
    var proto = Object.getPrototypeOf(obj);
    wrapFunctions(name, proto, protoLevel, hooks, state, rules);
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
    wrapFunctions(trace.moduleName, trace.ret, -1, hooks, clientState, rules );
    trace.ret = wrap(trace.ret)
          .before(hooks.beforeHook)
          .after(hooks.afterHook)
          .state(clientState)
          .nameIfNeeded(trace.moduleName)
          .module(trace.moduleName)
          .getProxy();
  } else {
    wrapFunctions(trace.moduleName, trace.ret, -1, hooks, clientState, rules );
  }
}
