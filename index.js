/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
*/

var wrapper = require('./lib/wrapper');
var archive = require('./lib/archive');

exports.wrap = function wrap(name, obj, options){
  archive.configure(options);
  if( obj ){
    return wrapper.wrapExports(name, obj, options);
  }
}

exports.reset = function reset(){
  if( global.concurix && global.concurix.traceAggregate ){
    global.concurix.traceAggregate.stop();
    global.concurix.traceAggregate.start();
  }
}

exports.start = function start(){
  if( global.concurix && global.concurix.traceAggregate ){
    global.concurix.traceAggregate.start();
  }
}

exports.stop = function stop(){
  if( global.concurix && global.concurix.traceAggregate ){
    global.concurix.traceAggregate.stop();
  }
}