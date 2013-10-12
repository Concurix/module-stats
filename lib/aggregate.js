// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// Aggregation of trace data


var version = 1;
var nodeCache = {};
var linkCache = {};
var traceHandler = require('./trace');

exports.version = version;

exports.stop = function stop(){
  global.concurix.traceAggregate.nodeCache = null;
  global.concurix.traceAggregate.linkCache = null;
}

exports.start = function start(){
  global.concurix.traceAggregate.nodeCache = nodeCache;
  global.concurix.traceAggregate.linkCache = linkCache;
}


exports.handleBeforeTrace = function handleBeforeTrace(trace){
  console.log('before trace');
}

exports.handleAfterTrace = function handleAfterTrace(trace){
  if( nodeCache[trace.funInfo.id]){
    nodeCache[trace.funInfo.id].merge(trace);
  } else {
    nodeCache[trace.funInfo.id] = traceHandler.store(trace);
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