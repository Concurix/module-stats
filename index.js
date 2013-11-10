/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
*/

var wrapper = require('./lib/wrapper');
var archive = require('./lib/archive');
var os      = require('os');

exports.wrap = function wrap(name, obj, options){
  options = configureOptions(options);
  if( obj ){
    return wrapper.wrapExports(name, obj, options);
  }
}

exports.reset = function reset(){
  if( global.concurix ){
    if( global.concurix.traceAggregate ){
      global.concurix.traceAggregate.stop();
      global.concurix.traceAggregate.start();
    }
    if( global.concurix.archive ){
      global.concurix.archive.reset();
    }
  } 
}

exports.start = function start(){
  if( global.concurix && global.concurix.traceAggregate ){
    global.concurix.traceAggregate.start();
  }
}

exports.stop = function stop(){
  if( global.concurix ){
    if( global.concurix.traceAggregate ){
      global.concurix.traceAggregate.stop();
    }
    if( global.concurix.archive ){
      global.concurix.archive.stop();
    }
  }
}

function configureOptions(options){
  var defaultOptions = {
    hostname: os.hostname(),
    archiveHost: 'api.concurix.com', 
    archivePort: 80,
    accountKey: '28164101-1362-769775-170247',
    archiveInterval: 2000, 
    logsPath: null,
  };
  
  options = options || {};
  Object.keys(options).forEach(function(name){
    defaultOptions[name] = options[name];
  });

  archive.configure(defaultOptions);
  return defaultOptions;
}