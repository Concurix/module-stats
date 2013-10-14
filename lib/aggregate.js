// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// Aggregation of trace data


var version = 1;

var traceHandler = require('./trace');

exports.version = version;

exports.stop = function stop(){
  global.concurix.traceAggregate.nodeCache = null;
  global.concurix.traceAggregate.linkCache = null;
  global.concurix.traceAggregate.traceStack = null;
}

exports.start = function start(){
  var nodeCache = {};
  var linkCache = {};
  var traceStack = [];
  global.concurix.traceAggregate.nodeCache = nodeCache;
  global.concurix.traceAggregate.linkCache = linkCache;
  global.concurix.traceAggregate.traceStack = traceStack;
}


exports.handleBeforeTrace = function handleBeforeTrace(trace){
  var stack = global.concurix.traceAggregate.traceStack;
  if( stack ){
    stack.push(trace);
    trace.nestLevel = stack.length;
    trace.calledBy = stack[stack.length -2];  //undefined in the length =1 case, which is fine for us
  }
}

exports.handleAfterTrace = function handleAfterTrace(trace){
  var nodeCache = global.concurix.traceAggregate.nodeCache;
  if( nodeCache ){
    if( nodeCache[trace.funInfo.id]){
      nodeCache[trace.funInfo.id].merge(trace);
    } else {
      nodeCache[trace.funInfo.id] = traceHandler.store(trace);
    }    
  }
  console.log('trace', trace);
  if( global.concurix.traceAggregate.traceStack ){
    global.concurix.traceAggregate.traceStack.pop();
  }
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