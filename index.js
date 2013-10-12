/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
*/

var wrapper = require('./lib/wrapper');

exports.wrap = function wrap(name, obj, options){
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