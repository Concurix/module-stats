// Copyright Concurix Corporation 2012-2014. All Rights Reserved.
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
    id: trace.name,  // TODO, I think we can get rid of this...
    proxyId: trace.funInfo.id,
    // TODO remove pid?
    pid: trace.processId,
    fun_name: trace.origin ? trace.funInfo.name + " for " + trace.origin : trace.funInfo.name,
    line: trace.funInfo.loc.line,
    // TODO remove start?
    start: util.hrtToUs(trace.fnStart),
    // TODO eventually deprecate in favor of just trace.fnTime
    duration: (trace.childFnTime + trace.fnTime) || 0,
    // TODO eventually deprecate with trace.childFnTime
    child_duration: trace.childFnTime || 0,
    nest_level: trace.nestLevel,
    num_calls: (trace.execTime) ? 1 : 0,  // if we are initializing in the before hook, we don't have a call yet.
    module: clientState && clientState.modInfo,
    name: trace.name,

    // New fields
    fnTime: trace.fnTime || 0,
    childFnTime: trace.childFnTime || 0,
    childTotalTime: trace.childTotalTime || 0,
    wrapperCost: trace.wrapperCost || 0,

    fnStartOffset: trace.fnStartOffset || 0,
    fnEndOffset: trace.fnEndOffset || 0,
    wrapperEndOffset: trace.wrapperEndOffset || 0,

    merge: function merge(trace){
      //console.log("merge ", this, trace);
      this.nest_level = Math.floor(((this.nest_level * this.num_calls) + trace.nestLevel) / (this.num_calls + 1));
      this.num_calls += 1;
      this.duration += (trace.childFnTime + trace.fnTime);
      this.child_duration += trace.childFnTime;

      this.fnTime += trace.fnTime;
      this.childFnTime += trace.childFnTime;
      this.childTotalTime += trace.childTotalTime;
      this.wrapperCost += trace.wrapperCost;
      this.fnStartOffset += trace.fnStartOffset;
      this.fnEndOffset += trace.fnEndOffset;
      this.wrapperEndOffset += trace.wrapperEndOffset;
    }
  };

  if( trace.origin ){
    node.origin = {
      origin: trace.origin,
      top: trace.originTop
    };
  }

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

exports.computeName = function computeName(trace) {
  var name;
  if( trace.origin ) {
    name = [trace.funInfo.id, trace.origin].join(':')
  } else {
    name = trace.funInfo.id;
  }
  trace.name = name;
  return name;
}

function createLink(source, type, trace){
  var link = {
    source: source.name,
    target: trace.name,
    type: type,
    num_calls: 1,
    // TODO deprecate (replace with startOffset?)
    total_delay: util.diffUs(trace.wrapperStart, source.wrapperStart),

    merge: function merge(link){
      this.num_calls += link.num_calls;
      this.total_delay += link.total_delay;
    }
  }
  link.id = [link.source, link.target, link.type].join('-');
  return link;
}

// helper functions
