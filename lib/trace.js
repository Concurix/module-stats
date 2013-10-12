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
    num_calls: 0,
    module: modInfo,
    name: [trace.pid, trace.id].join(':'),
  
    merge: function merge(trace){
      console.log('do merge now');
    }
  };
  
  return node;
}
