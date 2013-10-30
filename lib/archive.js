var aggregate = require('./aggregate');
var http = require('http');
var qs = require('querystring');

module.exports.sendArchive = function sendArchive(){
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
        res.on('data', function(buffer){
          var response = buffer.toString();
          console.log('repsonse', response);
        });
      });
      
      post.write(postData);
      post.end();
}

module.exports.tickle = function tickle() {
  module.exports.sendArchive();
}

function computePackage() {
  return {'hello': 'there'};
}