// Copyright Concurix Corporation 2012-2013. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// functions to handle trace data from before and after hooks

var util = require('./util');

exports.store = function store(trace, modInfo) {
  var node = {
    id: trace.funInfo.id,
    pid: trace.processId,
    fun_name: trace.funInfo.name,
    line: trace.funInfo.loc.line,
    start: util.hrtToUs(trace.startTime),
    duration: util.hrtToUs(trace.execTime),
    child_duration: 0,  //do not compute it here, it will be computed during aggregation
    mem_delta: trace.memDelta,
    nest_level: trace.nestLevel,
    num_calls: 1,
    module: modInfo,
    name: traceName(trace),
  
    merge: function merge(trace){
      console.log("merge ", this, trace);
      this.nest_level = Math.floor(((this.nest_level * this.num_calls) + trace.nestLevel) / (this.num_calls + 1));
      this.num_calls += 1;
      this.duration += util.hrtToUs(trace.execTime);
      this.mem_delta += trace.memDelta;
    }
  };
  
  return node;
}

exports.handleLink = function handleLink(trace) {
  var source;
  if( trace.calledBy ){
    source = trace.calledBy;
  } else if( trace.callbackOf ){
    source = trace.callbackOf
  } else {
    return null;
  }

  var link = {
    source: traceName(source),
    target: traceName(trace),
    type: linkType(trace),
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

function linkType(trace){
  return trace.callbackOf ? 'callback' : 'invocation';
}
