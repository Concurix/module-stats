# This module has been deprecated and replaced with the [Concurix Node.js tracer module](http://npm.im/concurix)
module-stats
=============

This is a utility library used by [concurix-monitor](http://npm.im/concurix-monitor). We suggest you check out that library as it will automatically apply this wrapper with logic for integration with the Concurix service.

[![NPM](https://nodei.co/npm/module-stats.png)](https://nodei.co/npm/module-stats/)


[![Build Status](https://travis-ci.org/Concurix/module-stats.png?branch=master)](https://travis-ci.org/Concurix/module-stats)

API
===
### wrap(name:String, mod:Object, opts:Object)
Initializes a tracer for an individual module `mod` with `name` (typically the name used in the invocation of require).

The following options are suported:

* ``accountKey`` your account key, data is collected and analyzed per account key
* ``archiveInterval`` time in milliseconds for sending data to the cloud for analysis and visualization.  Defaults to  60000 for `NODE_ENV=production`, 2000 (2 seconds) otherwise.

### blacklist(mod:Object)

Blacklists the given object, so that no tracing is performed.

### reset()

Stops tracing, clears any cached data, and starts again.

### start()

Starts tracing any wrapped objects.

### stop()

Stops tracing.

LICENSE
===

MIT
