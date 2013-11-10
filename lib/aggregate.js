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
var skipTracing = 0;      

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
}

exports.start = function start(){
  var nodeCache = {};
  var linkCache = {};
  var traceStack = [];
  global.concurix.traceAggregate.nodeCache = nodeCache;
  global.concurix.traceAggregate.linkCache = linkCache;
  global.concurix.traceAggregate.traceStack = traceStack;
}


exports.handleBeforeTrace = function handleBeforeTrace(trace, clientState){
  if( skipTracing ){ 
    return;
  }
  module.exports.stopTracing();
  archive.tickle();
  var stack = global.concurix.traceAggregate.traceStack;
  if( stack ){
    stack.push(trace);
    trace.nestLevel = stack.length;
    trace.calledBy = stack[stack.length -2];  //undefined in the length =1 case, which is fine for us
  }
  if(clientState.callbackOf){
    trace.callbackOf = clientState.callbackOf;
  }
  module.exports.startTracing();
}

exports.handleAfterTrace = function handleAfterTrace(trace, clientState){
  if( skipTracing ){
    return;
  }
  module.exports.stopTracing();

  archive.tickle();
  var nodeCache = global.concurix.traceAggregate.nodeCache;
  if( nodeCache ){
    if( nodeCache[trace.funInfo.id]){
      nodeCache[trace.funInfo.id].merge(trace);
    } else {
      nodeCache[trace.funInfo.id] = traceHandler.store(trace, clientState);
    }    
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
    });
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