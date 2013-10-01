/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
*/

var wrapper = require('./lib/wrapper');

exports.wrap = function wrap(name, obj, options){
  if( obj ){
    wrapper.wrapExports(name, obj);
  }
}