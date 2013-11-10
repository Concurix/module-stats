// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// functions to handle trace data from before and after hooks

var util = require('./util');

exports.store = function store(trace, clientState) {
  var node = {
    id: trace.funInfo.id,
    pid: trace.processId,
    fun_name: trace.funInfo.name,
    line: trace.funInfo.loc.line,
    start: util.hrtToUs(trace.startTime),
    duration: util.hrtToUs(trace.execTime || 0),
    child_duration: 0,  //do not compute it here, it will be computed during aggregation
    mem_delta: trace.memDelta || 0,
    nest_level: trace.nestLevel,
    num_calls: (trace.execTime) ? 1 : 0,  // if we are initializing in the before hook, we don't have a call yet.
    module: clientState && clientState.modInfo,
    name: traceName(trace),
  
    merge: function merge(trace){
      //console.log("merge ", this, trace);
      this.nest_level = Math.floor(((this.nest_level * this.num_calls) + trace.nestLevel) / (this.num_calls + 1));
      this.num_calls += 1;
      this.duration += util.hrtToUs(trace.execTime);
      this.mem_delta += trace.memDelta;
    }
  };
  
  return node;
}

// we can return up to two links here, in the case where we are called by somebody && that call results in a callback.
exports.handleLink = function handleLink(trace) {
  var source;
  var links = [];
  if( trace.calledBy ){
    links.push(createLink(trace.calledBy, 'invocation', trace));
  }
  if( trace.callbackOf ){
    links.push(createLink(trace.callbackOf, 'callback', trace));
  } 
  return links;
}

function createLink(source, type, trace){
  var link = {
    source: traceName(source),
    target: traceName(trace),
    type: type,
    num_calls: 1,
    total_delay: util.hrtToUs(util.subHrtTimes(trace.startTime, source.startTime)),
    merge: function merge(link){
      this.num_calls += link.num_calls;
      this.total_delay += link.total_delay;
    }
  }
  link.id = [link.source, link.target, link.type].join('-');
  return link; 
}

// helper functions
function traceName(trace){
  return [trace.processId, trace.funInfo.id].join(':');
}

