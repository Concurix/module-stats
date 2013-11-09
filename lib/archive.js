var aggregate           = require('./aggregate');
var http                = require('http');
var os                  = require('os');
var version             = require('../package.json').version;
var util                = require('./util');
var AWS                 = require('aws-sdk');
var EventEmitter        = require('events').EventEmitter;
var archiveTickled      = false;
var archiveInterval     = 60000;
var archiveTimeoutId    = null;



var s3BucketName        = undefined;
var s3KeyPrefix         = undefined;
var s3Handler           = undefined;

var snsArn              = undefined;
var snsHandler          = undefined;

var snapshotBucket      = undefined;
var snapshotArn         = undefined;


var config              = undefined;

var emitter             = new EventEmitter();

var initAWS             = [];
var gettingCredentials  = false;

function initAwsCredentials(){
  if( gettingCredentials ){
    return;
  } else {
    acquireAwsCredentials();
  }
}

function refreshAwsCredentials() {
  acquireAwsCredentials();
}

// Invoke a Concurix web-api to obtain AWS credentials
function acquireAwsCredentials() {
  gettingCredentials = true;
  function requestCallback(response) {
    var str = '';

    // This is an 'OK' response.  Set up handlers to be informed about the content
    if (response.statusCode === 200) {
      response.on('data',  function(chunk) { str += chunk; });
      response.on('end',   function()      { start(str);   });

      response.on('error', function(err)   { console.log('\n\nErr:  ' + err); });
    } else {
      console.error('Failed to get Trace Session Data');
      console.log(require('util').inspect(response));
    }
  }

  function start(str) {
    var response = JSON.parse(str);
    
    s3BucketName = response.s3Bucket;
    s3KeyPrefix  = response.s3Prefix;
    snsArn       = response.snsArn;
    snapshotArn  = response.snapshotArn;
    snapshotBucket = response.snapshotBucket;

    AWS.config   = new AWS.Config({
                                    accessKeyId:     response.AccessKeyId,
                                    sessionToken:    response.SessionToken,
                                    secretAccessKey: response.SecretAccessKey,
                                    region:          response.Region
                                 });

    s3Handler    = new AWS.S3();
    snsHandler   = new AWS.SNS();

    // Schedule an event to refresh the credentials about 1 minute
    // before the new credentials expire
    setTimeout(refreshAwsCredentials, response.DurationMS - 60 * 1000);

    // we might have queued up a few packages to archive before AWS is initialized.  If so, go ahead and send them...
    if( initAWS.length > 0 ){
      initAWS.forEach(doArchive);
      initAWS = [];
    }

  }

  var options     = {
                      host:   config.archiveHost,
                      port:   config.archivePort,
                      path:   '/v1/' + config.accountKey + '/new_run/' + config.hostname,
                      method: 'POST'
                    };

  initAWS = [];
  require('http').request(options, requestCallback).end();
}

function doArchive(json) {
  if (!s3Handler){
    initAWS.push (json);
    return;
  };
  var unixMsec = (new Date()).getTime();
  var unixSec  = Math.floor(unixMsec / 1000);
  var key      = s3KeyPrefix + '/' + unixSec + '.json';

  // Write the data to S3
  aggregate.stopTracing();

  s3Handler.putObject({Bucket: s3BucketName, Key: key, Body: JSON.stringify(json)}, function(putErr, putData) {
    if (!putErr) {
      var message = JSON.stringify({ type: 'stream', key: key, accountKey: config.accountKey});
      var params  = { TopicArn: snsArn, Message: message };

      // Publish a notification for the new trace
      aggregate.stopTracing();
      snsHandler.client.publish(params, function(err, data) {
        if (err) {
          console.log('concurix.archive: trace notification error ', err, data);
        }
        //once it's done, send the event.
        emitter.emit('sendArchive', json);
      });
      aggregate.startTracing();
    } else {
      console.log('concurix.archive: failed to write trace archive: ' + putErr);
    }
  });
  aggregate.startTracing();
}

function configure(options){
  config = options; 
  if (options.accountKey && options.hostname && options.archiveHost && config.archivePort) {
    initAwsCredentials();
  }
  if( options.archiveListener ){
    emitter.on('sendArchive', options.archiveListener);
  }
}
function sendArchive() {
  var data = computePackage();
  doArchive(data);
  archiveTickled = false;
}


function tickle() {
  if( archiveTickled ){
    return;
  } else {
    archiveTimeoutId = setTimeout(module.exports.sendArchive, config.archiveInterval);
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
  return msg;
}

function mergeConfig(prev){
  if( prev && prev.config && prev.config.archiveListener){
    emmitter.on('sendArchive', prev.config.archiveListener);
  }
}

function reset(){
  if( archiveTimeoutId ){
    clearTimeout(archiveTimeoutId);
  }
  archiveTickled = false;
}

function stop(){
  reset();
}

var archive = {
  configure:  configure,
  sendArchive: sendArchive,
  tickle: tickle,
  config: config,
  version: version,
  mergeConfig: mergeConfig,
  reset: reset,
  stop: stop
}

if( !global.concurix ){
  global.concurix = {};
}

// run this at instantiation time to setup globals properly.  There should only be one instance of the archiveInterval
if( !global.concurix.archive || global.concurix.archive.version < version ){
  var prev = global.concurix.archive;
  global.concurix.archive = archive;
  archive.mergeConfig(prev);
}

module.exports.configure = function configure(options){
  global.concurix.archive.configure(options);
}

module.exports.sendArchive = function sendArchive(){
  global.concurix.archive.sendArchive();
}

module.exports.tickle = function tickle(){
  global.concurix.archive.tickle();
}

module.exports.reset = function reset(){
  global.concurix.archive.reset();
}