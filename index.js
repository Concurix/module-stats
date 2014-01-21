/* module-stats

 A utility for collecting usage information on a per module basis

 Copyright 2013-2014 Concurix Corporation
*/

// TODO !!!!! Enforce uniqueness

module.exports = ModuleStats

var xtend = require('xtend');
var Wrapper = require('./lib/wrapper');
var Archiver = require('./lib/archive');
var Aggregator = require('./lib/aggregate')

function ModuleStats(options) {
  if (!(this instanceof ModuleStats)) return new ModuleStats(options);

  var defaults = {
    // TODO select appropriate module-stats only accountKey
    accountKey: '28164101-1362-769775-170247',
    archiveInterval: process.env.NODE_ENV == 'production' ? 60000 : 2000,
  };

  this.options = xtend(defaults, options);
  this.aggregator = Aggregator(this.options);
  this.archiver = Archiver(this.aggregator, this.options);
  this.wrapper = Wrapper(this.aggregator, this.options);
}
ModuleStats.prototype.wrap = function wrap(name, obj) {
  if (obj != null) {
    return this.wrapper.wrapExports(name, obj);
  }
}
ModuleStats.prototype.blacklist = function blacklist(obj) {
  if (obj != null) {
    this.wrapper.blacklist(obj);
  }
}
ModuleStats.prototype.start = function start() {
  this.archiver.start();
}
ModuleStats.prototype.stop = function stop() {
  this.archiver.finish();
}