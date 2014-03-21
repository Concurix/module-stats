// Copyright Concurix Corporation 2012-2014. All Rights Reserved.
//
// see LICENSE for licensing details
//
// The Software distributed under the License is distributed on an "AS IS"
// basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
//
// Aggregation of trace data

module.exports = Aggregator

var traceHandler = require('./trace');
var util = require('./util');
var outliers = require('cx-outliers');

function Aggregator(options) {
  if (!(this instanceof Aggregator)) return new Aggregator(options);

  this.skipTracing = 0;
  this.maxAge = 100;
  this.reset();
  this.windowStart = null;
}

Aggregator.prototype.stopTracing = function stopTracing() {
  this.skipTracing++;
}

Aggregator.prototype.startTracing = function startTracing() {
  this.skipTracing--;
  if (this.skipTracing < 0) {
    console.error('unbalanced skip tracing call');
  }
}

Aggregator.prototype.reset = function reset() {
  this.nodeCache = {};
  this.linkCache = {};
  this.ageLinks = {};
  this.ageNodes = {};
  this.traceStack = [];
  this.slowLinks = {};
}

Aggregator.prototype.stop = function stop() {
  this.nodeCache = null;
  this.linkCache = null;
  this.ageLinks = null;
  this.ageNodes = null;
  this.traceStack = null;
  this.slowLinks = null;
}

Aggregator.prototype.resetTimes = function resetTimes() {
  var cacheKeys = Object.keys(this.linkCache);
  for (var i = 0; i < cacheKeys.length; i++) {
    var key = cacheKeys[i];
    if (this.ageLinks[key] > this.maxAge) {
      delete this.linkCache[key];
      delete this.ageLinks[key];
    } else {
      this.linkCache[key].num_calls = 0;
      this.linkCache[key].total_delay = 0;
      this.ageLinks[key]++;
    }
  }

  var nodeKeys = Object.keys(this.nodeCache);
  for (var i = 0; i < nodeKeys.length; i++) {
    var key = nodeKeys[i];
    if (this.ageNodes[key] > this.maxAge) {
      delete this.nodeCache[key];
      delete this.ageNodes[key];
    } else {
      this.nodeCache[key].duration = 0;
      this.nodeCache[key].num_calls = 0;
      this.nodeCache[key].nest_level = 0;
      this.nodeCache[key].child_duration = 0;
      this.ageNodes[key]++;
    }
  }

  this.windowStart = null;
}

Aggregator.prototype.handleBeforeTrace = function handleBeforeTrace(trace, clientState) {
  //compute the name first, even if we are paused
  if (this.traceStack) {
    this.traceStack.push(trace);
    this.traceStack.nestLevel = this.traceStack.length;
    trace.calledBy = this.traceStack[this.traceStack.length - 2];  //undefined in the length =1 case, which is fine for us
    trace.origin = trace.calledBy ? trace.calledBy.origin : null;
  }
  if (clientState.callbackOf) {
    trace.callbackOf = clientState.callbackOf;
    trace.origin = clientState.callbackOf.origin;
    if (clientState.callbackOf.originCallbackTop) {
      trace.originTop = clientState.callbackOf.originCallbackTop;
    }
  }

  traceHandler.computeName(trace);

  if (this.skipTracing) {
    return;
  }
  this.stopTracing();

  //go ahead and put an entry into the node table so that callees have something to link to
  if (this.nodeCache && !this.nodeCache[trace.name]) {
    this.nodeCache[trace.name] = traceHandler.store(trace, clientState);
  }

  this.startTracing();
}

Aggregator.prototype.handleAfterTrace = function handleAfterTrace (trace, clientState) {
  if (this.skipTracing) {
    if (this.traceStack) {
      this.traceStack.pop();
    }
    return;
  }
  this.stopTracing();

  var stack = this.traceStack;
  var nestCount = stack ? stack.length : 0;
  if (nestCount > 1) {
    var caller = stack[nestCount-2];
    caller.childExecTime = caller.childExecTime || [0,0];
    caller.childExecTime = util.addHrtTimes(caller.childExecTime, trace.execTime);
  }

  var ageLinks = this.ageLinks;
  var ageNodes = this.ageNodes;

  var nodeCache = this.nodeCache;
  if (nodeCache) {
    if (nodeCache[trace.name]) {
      nodeCache[trace.name].merge(trace);
    } else {
      nodeCache[trace.name] = traceHandler.store(trace, clientState);
    }
    // TODO possibly look for outliers on trace.execTime?
    // take the ageCounter to zero, the node is 'live' now
    ageNodes[trace.name] = 0;
  }

  var linkCache = this.linkCache;
  if (linkCache) {
    var links = traceHandler.handleLink(trace);
    // TODO swap to faster for() loop?
    links.forEach(function(link){
      if (linkCache[link.id]) {
        linkCache[link.id].merge(link);
      } else {
        linkCache[link.id] = link;
      }
      // add the callback/calledby node if needed.  this can happen in rare cases w/ excluded modules or skip tracing
      var key = link.type == 'invocation' ? 'calledBy' : 'callbackOf';
      if (!nodeCache[link.source]) {
        // WARNING!!: Note that clientState could potentially be *incorrect* here (for example, the module info may be wrong).  However
        // if we get to this spot, it means we found a function we don't know about and we need to make our best guess.
        nodeCache[link.source] = traceHandler.store(trace[key], clientState);
      }
      if (!nodeCache[link.target]) {
        nodeCache[link.target] = traceHandler.store(trace[key], clientState);
      }
      if (link.type == 'callback') {
        // WARNING: UNUSUAL BEHAVIOR ALERT
        // "properly" the line above is the correct logic, we compute the delay from when the callback is registered to when it is called.
        // however, common usage is for callbacks to be registered and then called mulitple times.  to make the data more useful,
        // reset the 'start' of any callback to the last invocation once we have fired it.  there are corner cases with this logic
        // as well, so it's really a judgement call as to what is the 'right' data to show.  perhaps in the future we will store both
        trace.callbackOf.startTime = trace.startTime;
      }
      var slowLink = outliers.update(link.id, link.total_delay)
      if (slowLink) {
        this.slowLinks.push({link: link.id, anomalies: slowLink})
      }
      // take the age counter to zero, the link is 'live' now
      ageLinks[link.id] = 0;
      ageNodes[link.source] = 0;
      ageNodes[link.target] = 0;
    });

    if (this.windowStart == null) {
      this.windowStart = Date.now();
    }
  }

    //console.log('trace', trace);
  if (this.traceStack) {
    this.traceStack.pop();
  }

  this.startTracing();
}
