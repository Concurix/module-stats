module.exports = Archiver;

var http = require('http');
var os = require('os');
var xtend = require('xtend');

var util = require('./util');
var version = require("../package.json").version;

var HOSTNAME = os.hostname();
var DEFAULTS = {
  skipArchive: false,
  archiveInterval: 60000,
  proxyHost: "results.concurix.com",
  proxyPort: "9090",
  proxyPath: "/results",
}

// To prevent flood attacks on the proxy when using cluster, fudge interval.
var FUDGE = Math.floor(500 * Math.random())

function Archiver(aggregator, options) {
  if (!(this instanceof Archiver)) return new Archiver(aggregator, options);

  this.aggregator = aggregator;
  this.options = xtend(DEFAULTS, options);
}

Archiver.prototype.start = function start() {
  this.aggregator.reset();
  if (this.interval || this.options.skipArchive) {
    return;
  }
  this.interval = setInterval(this.send.bind(this), this.options.archiveInterval + FUDGE);
}

Archiver.prototype.unref = function unref() {
  if (this.interval && this.interval.unref) {
    this.interval.unref();
  }
}

// This is a stop-gap solution to sending out finalized data.
// At most we will miss the last CLEANUP_INTERVAL millis of data.
Archiver.prototype._checkFinished = function _checkFinished() {
  if (!this.interval) {
    return;
  }
  // If there is more data, don't quit until it is sent.
  if (this.aggregator.windowStart != null && this.interval.ref) {
    this.interval.ref();
  }
}

Archiver.prototype.finish = function finish() {
  this.send();
  this.stop();
}

Archiver.prototype.stop = function stop() {
  clearInterval(this.interval);
  this.aggregator.stop();
}

Archiver.prototype.send = function send() {
  if (this.aggregator.windowStart == null) {
    //console.log("Skipping because tracer has nothing to send.")
    this.unref();
    return;
  }

  if (this.options.skipArchive) {
    //console.log("Skipping due to skipArchive setting")
    // var p = this.computePackage()
    // console.log(p.data.nodes)
    // console.log(p.data.links)
    // this.stop()
    return;
  }

  this.aggregator.stopTracing();
  var body = Buffer(JSON.stringify(this.computePackage()));
  this.aggregator.resetTimes();

  //console.log("Sending packet that is %s bytes.", body.length);
  var options = {
    agent: false,
    host: this.options.proxyHost,
    port: this.options.proxyPort,
    path: this.options.proxyPath,
    method: "POST",
    headers: {
      "Concurix-API-Key": this.options.accountKey,
      "content-type": "application/json",
      "content-length": body.length
    }
  };

  var self = this
  var request = http.request(options, function (res) {
    self.aggregator.stopTracing();
    if (res.statusCode != 202) {
      console.log("Failed to send archive to Concurix: %s", res.statusCode);
    }
    if (res.socket.unref) {
      res.socket.unref();
    }
    self.aggregator.startTracing();
  });
  request.end(body);
  request.on("error", function (err) {
    console.log("Error attempting to send trace file: %s", err);
  })
  this.unref();
  this.aggregator.startTracing();
}

Archiver.prototype.computePackage = function computePackage() {
  //quick validation
  var links = this.aggregator.linkCache;
  var nodes = this.aggregator.nodeCache;
  var linkKeys = Object.keys(links);
  for (var i = 0; i < linkKeys.length; i++) {
    var key = linkKeys[i];
    if( !nodes[links[key].source] || !nodes[links[key].target]){
      console.log('yikes, missing node for link ', links[key]);
    } else {
      //console.log('got it');
    }
  }

  var msg = {
    type: "nodejs",
    version: version,
    tracing_interval: this.options.archiveInterval,
    hostname: HOSTNAME,
    pid: process.pid,
    // run_id: 'to be set',
    // TODO move these two into system_info -- will require aggregation server change.
    load_avg: os.loadavg(), //array of 1, 5, and 15 minute load averages
    cpus: os.cpus(),
    process_info: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      active_requests: process._getActiveRequests().length,
      active_handles: process._getActiveHandles().length,
      versions: process.versions,
      environment: this.options.environment,
    },
    system_info: {
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      arch: process.arch,
      platform: process.platform,
      uptime: os.uptime(),
    },
    timestamp: util.unixTimeSec(),
    data: {
      nodes:   util.values(nodes),
      links:   util.values(links)
    }
  };
  // console.log(msg)
  return msg;
}
