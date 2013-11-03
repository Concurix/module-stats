var aggregate = require('./aggregate');
var http = require('http');
var os = require('os');
var version = require('../package.json').version;
var util = require('./util');

var archiveTickled = false;
var archiveInterval = 60000;

module.exports.configure = function configure(options){
  if( options && options.archiveInterval){
    archiveInterval = options.archiveInterval;
  }
}
module.exports.sendArchive = function sendArchive() {
  aggregate.stopTracing();
  var data = computePackage();
  var postData = JSON.stringify(data);

  var postOptions = {
    host: 'localhost',
    port: 3001,
    path: '/submit_data/123',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  var post = http.request(postOptions, function(res) {
    aggregate.stopTracing();
    res.on('data', function(buffer) {
      aggregate.stopTracing();
      var response = buffer.toString();
      console.log('repsonse', response);
      aggregate.startTracing();
    });
    aggregate.startTracing();
  });

  post.write(postData);
  post.end();
  archiveTickled = false;
  aggregate.startTracing();
}

module.exports.tickle = function tickle() {
  if( archiveTickled ){
    return;
  } else {
    setTimeout(module.exports.sendArchive, archiveInterval);
    archiveTickled = true;
  }
}

function computePackage() {
  var msg = {
    type: "nodejs",
    version: version,
    // run_id: 'to be set',
    load_avg: os.loadavg(), //array of 1, 5, and 15 minute load averages
    cpus: os.cpus(),
    timestamp: util.unixTimeSec(),
    data: {
      nodes:   util.values(global.concurix.traceAggregate.nodeCache),
      links:   util.values(concurix.traceAggregate.linkCache)
    }
  };
  console.log('compute package called, link length', msg.data.links.length);
  return msg;
}