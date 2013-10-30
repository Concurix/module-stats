var aggregate = require('./aggregate');
var http = require('http');
var qs = require('querystring');

module.exports.sendArchive = function sendArchive() {
  aggregate.stopTracing();
  var data = computePackage();
  var postData = qs.stringify(data);

  var postOptions = {
    host: 'localhost',
    port: 3000,
    path: '/submit_data/123',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
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
  aggregate.startTracing();
}

module.exports.tickle = function tickle() {
  module.exports.sendArchive();
}

function computePackage() {
  return {
    'hello': 'there'
  };
}