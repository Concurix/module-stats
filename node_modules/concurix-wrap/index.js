// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// General wrapping functions

// to avoid tracing and wrapping itself 'block_tracing' acts as a semaphore 
// which is set to 'true' when it's in concurixjs code and 'false' when in user's code
var block_tracing = false;
var crypto = require('crypto');
var util = require('./util');
var extend = util.extend;
var log = util.log;

// Main wrap function.  For any future contributors, note that we use a number of locally 
// created objects so that we can have very precise control over instances and where the prototype
// points to.
module.exports = function wrap(wrapFun){
  var wrapperState = {
    
    beforeFun: null,
    before: function before(beforeFun){
      this.beforeFun = beforeFun;
      return this;
    },
  
    afterFun: null,
    after: function after(afterFun){
      this.afterFun = afterFun;
      return this;
    },
    
    moduleName: null,
    module: function module(moduleName){
      this.moduleName = moduleName;
      return this;
    },
  
    computeFunctionInfo: function computeFunctionInfo(){
      var funInfo = this.funInfo = {};
      funInfo.name = this.orgFun.name || 'anonymous';
      funInfo.abortWrap = false;

      //first try to get info from the debug object if it's available, as that will be more accurate
      if( typeof v8debug != "undefined" ){
        var script = v8debug.Debug.findScript(this.orgFun);
        if (!script){
          // do not wrap native code or extensions
          funInfo.abortWrap = true;
        }
        funInfo.file = script.name;
        funInfo.loc = v8debug.Debug.findFunctionSourceLocation(this.orgFun);
        funInfo.id = funInfo.file + ":" + funInfo.loc.position;
      } else {
        // do not wrap native code or extensions
        var funSrc = this.orgFun.toString();
        if (funSrc.match(/\{ \[native code\] \}$/)){
          funInfo.abortWrap = true; 
        }
        // if we don't have the v8debug info, then create a hash from the code to do our best to be able to compare the same function
        funInfo.file = this.moduleName;
        funInfo.loc = {position: 0, line: 0};
        funInfo.id = computeHash(this.moduleName + funSrc);
      }  
    },
    
    clientState: null,
    state: function state(clientState){
      this.clientState = clientState;
      return this;
    },
  
    getProxy: function getProxy(){
      var concurixProxy = function() {
        var self = this;
        var state = arguments.callee.__concurix_proxy_state__;
        if (!state ){
          return null;
        }
        if (block_tracing){
          return state.orgFun.apply(this, arguments);
        }

        block_tracing = true;
        var trace = {};
        var rethrow = null;
        var doRethrow = false;
        //save caller info and call cxBeforeHook
        try {
          //WEIRD BEHAVIOR ALERT:  the nodejs debug module gives us line numbers that are zero index based; add 1
          trace.moduleName = state.moduleName;
          trace.funInfo = state.funInfo;
          trace.processId = process.pid;
          trace.args = arguments;
          // WARNING: start time is not accurate as it includes cxBeforeHook excecution
          // this is done to have approximate start time required in calculating total_delay in bg process
          trace.startTime = process.hrtime();
          // trace.wrappedThis = this;
          if(state.beforeFun){
            state.beforeFun.call(self, trace, state.clientState);
          }
        } catch(e) {
          log('concurix.wrapper beforeFun: error', e);
        }

        // Re-calculate accurate start time so we get accurate execTime
        var startTime = process.hrtime();
        //re-assign any properties back to the original function
        extend(state.orgFun, arguments.callee);
      
        var startMem = process.memoryUsage().heapUsed;
        try{
          block_tracing = false;
          var ret = state.orgFun.apply(self, arguments);
        } catch (e) {
          // it's a bit unfortunate we have to catch and rethrow these, but some nodejs modules like
          // fs use exception handling as flow control for normal cases vs true exceptions.
          rethrow = e;
          doRethrow = true; // Amazon uses null exceptions as part of their normal flow control, handle that case
        }
        block_tracing = true;
        //save return value, exec time and call cxAfterHook
        try {
          trace.memDelta = process.memoryUsage().heapUsed - startMem;
          trace.ret = ret;
          trace.startTime = startTime;
          trace.execTime = process.hrtime(startTime);
          if (state.afterFun){
            state.afterFun.call(self, trace, state.clientState);
          } 
        } catch(e) {
          log('concurix.wrapper afterFun: error', e);
        }
        block_tracing = false;
        if( doRethrow ){
          throw rethrow;
        }
        return trace.ret;      
      }
    
      //now compute various wrapper information
      this.computeFunctionInfo();
    
      // if we've determined a state that we can't wrap, abort and return the original functions
      if( this.funInfo.abortWrap ){
        return this.orgFun;
      }
      // keep the original func name using eval
      var orgFuncName = this.orgFun.name || 'anonymous';
      var proxyStr = concurixProxy.toString().replace(/^function/, 'function ' + orgFuncName);
      eval("var proxy = " + proxyStr);

      // now map any properties over
      extend(proxy, this.orgFun);
      proxy.prototype = this.orgFun.prototype;
      proxy.__concurix_wrapper_for__ = orgFuncName;
      proxy.__concurix_proxy_state__ = this;
      this.orgFun.__concurix_wrapped_by__ = proxy;  
      return proxy;      
    }
  };
    
  wrapperState.orgFun = wrapFun;
  return wrapperState;
}



// helper functions

function computeHash(str){
  return crypto.createHash('md5').update(str).digest('hex');
}


