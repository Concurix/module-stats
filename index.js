/* module-stats
 
 A utility for collecting usage information on a per module basis

 Copyright 2013 Concurix Corporation
*/

var wrapper = require('./lib/wrapper');
var hooks   = require('./lib/hooks');

exports.wrap = function wrap(name, obj, options){
  if( obj ){
    wrapper.wrapExport(obj);
  }
}