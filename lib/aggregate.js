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
  trace.name = trace.name || [trace.processId, trace.funInfo.id].join(':');
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
  //go ahead and put an entry into the node table so that callees have something to link to
  var nodeCache = global.concurix.traceAggregate.nodeCache;
  if( nodeCache && !nodeCache[trace.name] ){
    nodeCache[trace.name] = traceHandler.store(trace, clientState);
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
    if( nodeCache[trace.name]){
      nodeCache[trace.name].merge(trace);
    } else {
      nodeCache[trace.name] = traceHandler.store(trace, clientState);
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
      // add the callback/calledby node if needed.  this can happen in rare cases w/ excluded modules or skip tracing
      var key = link.type == 'invocation' ? 'calledBy' : 'callbackOf';
      if( !nodeCache[link.source] ){
        nodeCache[link.source] = traceHandler.store(trace[key], clientState);
      }
      if( !nodeCache[link.target] ){
        nodeCache[link.target] = traceHandler.store(trace[key], clientState);
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