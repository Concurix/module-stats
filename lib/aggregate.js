// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// Aggregation of trace data


var version = require('../package.json').version;

var traceHandler = require('./trace');
var archive = require('./archive');
var util = require('./util');
var skipTracing = 0;      
var maxAge = 100;

exports.version = version;

exports.stopTracing = function stopTracing(){
  skipTracing++;
}

exports.startTracing = function startTracing(){
  skipTracing--;
  if( skipTracing < 0 ){
    console.error('unbalanced skip tracing call');
  }
}
exports.stop = function stop(){
  global.concurix.traceAggregate.nodeCache = null;
  global.concurix.traceAggregate.linkCache = null;
  global.concurix.traceAggregate.traceStack = null;
  global.concurix.traceAggregate.ageLinks = null;
  global.concurix.traceAggregate.ageNodes = null;
}

exports.start = function start(){
  var nodeCache = {};
  var linkCache = {};
  var ageLinks = {};
  var ageNodes = {};
  var traceStack = [];
  global.concurix.traceAggregate.nodeCache = nodeCache;
  global.concurix.traceAggregate.linkCache = linkCache;
  global.concurix.traceAggregate.traceStack = traceStack;
  global.concurix.traceAggregate.ageLinks = ageLinks;
  global.concurix.traceAggregate.ageNodes = ageNodes;
}

exports.resetTimes = function resetTimes(){
  var linkCache = global.concurix.traceAggregate.linkCache;
  var nodeCache = global.concurix.traceAggregate.nodeCache;
  var ageLinks = global.concurix.traceAggregate.ageLinks;
  var ageNodes = global.concurix.traceAggregate.ageNodes;
  
  for(var key in linkCache ){
    if( ageLinks[key] > maxAge ){
      delete linkCache[key];
      delete ageLinks[key];
    } else {
      linkCache[key].num_calls = 0;
      linkCache[key].total_delay = 0;
      ageLinks[key]++;
    }
  }
  for(var key in nodeCache ){
    if( ageNodes[key] > maxAge ){
      delete nodeCache[key];
      delete ageNodes[key];
    } else {
      nodeCache[key].mem_delta = 0;
      nodeCache[key].duration = 0;
      nodeCache[key].num_calls = 0;
      nodeCache[key].nest_level = 0;
      nodeCache[key].child_duration = 0;
      ageNodes[key]++;
    }
  }
}

exports.handleBeforeTrace = function handleBeforeTrace(trace, clientState){
  //compute the name first, even if we are paused
  var stack = global.concurix.traceAggregate.traceStack;
  if( stack ){
    stack.push(trace);
    stack.nestLevel = stack.length;    
    trace.calledBy = stack[stack.length - 2];  //undefined in the length =1 case, which is fine for us
    trace.transactionId = trace.calledBy ? trace.calledBy.transactionId : null;
  }
  if(clientState.callbackOf){
    trace.callbackOf = clientState.callbackOf;
    trace.transactionId = clientState.callbackOf.transactionId;
    if( clientState.callbackOf.originCallbackTop ){
      console.log('setting origin top for callback', clientState.callbackOf.originCallbackTop);
      trace.originTop = clientState.callbackOf.originCallbackTop;
    }
  }

  traceHandler.computeName(trace);  

  if( skipTracing ){ 
    return;
  }
  module.exports.stopTracing();


  /*//go ahead and put an entry into the node table so that callees have something to link to
  var nodeCache = global.concurix.traceAggregate.nodeCache;
  if( nodeCache && !nodeCache[trace.name] ){
    nodeCache[trace.name] = traceHandler.store(trace, clientState);
  } */   
  
  module.exports.startTracing();
}

exports.handleAfterTrace = function handleAfterTrace(trace, clientState){
  if( skipTracing ){
    if( global.concurix.traceAggregate.traceStack ){
      global.concurix.traceAggregate.traceStack.pop();
    }    
    return;
  }
  module.exports.stopTracing();

  var stack = global.concurix.traceAggregate.traceStack;
  var nestCount = stack ? stack.length : 0;
  if (nestCount > 1){
    var caller = stack[nestCount-2];
    caller.childExecTime = caller.childExecTime || [0,0];
    caller.childExecTime = util.addHrtTimes(caller.childExecTime, trace.execTime);
  }

  var ageLinks = global.concurix.traceAggregate.ageLinks;
  var ageNodes = global.concurix.traceAggregate.ageNodes;

  var nodeCache = global.concurix.traceAggregate.nodeCache;
  if( nodeCache ){
    if( nodeCache[trace.name]){
      nodeCache[trace.name].merge(trace);
    } else {
      nodeCache[trace.name] = traceHandler.store(trace, clientState);
    }
    // take the ageCounter to zero, the node is 'live' now
    ageNodes[trace.name] = 0;
  }

  var linkCache = global.concurix.traceAggregate.linkCache;
  if( linkCache ){
    var links = traceHandler.handleLink(trace);
    links.forEach(function(link){
      if( linkCache[link.id] ){
        linkCache[link.id].merge(link);
      } else {
        linkCache[link.id] = link;
      }
      // add the callback/calledby node if needed.  this can happen in rare cases w/ excluded modules or skip tracing
      var key = link.type == 'invocation' ? 'calledBy' : 'callbackOf';
      if( !nodeCache[link.source] ){
        nodeCache[link.source] = traceHandler.store(trace[key], clientState);
      }
      if( !nodeCache[link.target] ){
        nodeCache[link.target] = traceHandler.store(trace[key], clientState);
      }
      if( link.type == 'callback'){
        // WARNING: UNUSUAL BEHAVIOR ALERT
        // "properly" the line above is the correct logic, we compute the delay from when the callback is registered to when it is called.
        // however, common usage is for callbacks to be registered and then called mulitple times.  to make the data more useful,
        // reset the 'start' of any callback to the last invocation once we have fired it.  there are corner cases with this logic
        // as well, so it's really a judgement call as to what is the 'right' data to show.  perhaps in the future we will store both 
        trace.callbackOf.startTime = trace.startTime;     
      }
      // take the age counter to zero, the link is 'live' now
      ageLinks[link.id] = 0;
    });

    archive.tickle();
  }

    //console.log('trace', trace);
  if( global.concurix.traceAggregate.traceStack ){
    global.concurix.traceAggregate.traceStack.pop();
  }

  module.exports.startTracing();
}

// this code should be run at initialization time.  it will set the global aggregation utility to be 
// the 'latest' version
if( !global.concurix ){
  global.concurix = {};
}

if (global.concurix.traceAggregate && global.concurix.traceAggregate.version < version ){
  global.concurix.traceAggregate.stop();
  global.concurix.traceAggregate = exports;
} else if (!global.concurix.traceAggregate) {
  global.concurix.traceAggregate = exports;
  global.concurix.traceAggregate.start();
}