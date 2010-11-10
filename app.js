require.paths.unshift(__dirname + '/lib');
var io = require('socket.io'),
  http = require('http');
var fs = require('fs'),
  util = require('util');
var url = require('url'),
  path = require('path');

function findType(uri) {
  var types = {
    '.js':      'text/javascript',
    '.html':    'text/html',
    '.css':     'text/css',
    '.manifest':'text/cache-manifest',
    '.ico':     'image/x-icon',
    '.jpeg':    'image/jpeg',
    '.jpg':     'image/jpg',
    '.png':     'image/png',
    '.gif':     'image/gif',
    '.svg':     'image/svg+xml'
  };

  var ext = uri.match(/(.js)|(.html)|(.css)|(.manifest)$/gi);
  if (ext && ext.length > 0) {
    ext = ext[0];
    if (ext in types) {
      return types[ext];
    }
  }
  return undefined;
}

function sendError(code, response) {
  response.writeHead(code);
  response.end();
  return;
}

var app = http.createServer(function(request, response) {
  var uri = url.parse(request.url).pathname;
  if (uri === '/') {uri = '/index.html';}
  var _file = path.join(process.cwd(), uri);
  
  path.exists(_file, function(exists) {
    if (!exists) {
      sendError(404, response);
    } else {
      var file = __dirname + uri,
        type   = findType(uri);
      if (!type) {
        sendError(500, response);
      }
      response.writeHead(200, {'Content-Type':type});
      var rs = fs.createReadStream(file);
      util.pump(rs, response);
    }
  });
  
});

var socket = io.listen(app, {transports:['websocket', 'xhr-polling']}),
    buffer = [],
    MAXBUF = 1024,
      json = JSON.stringify;

var clients = [];

socket.on('connection', function(client) {

    client.send(json({messages:buffer}));
    
    client.on('message', function(data) {
        if (/^(USERNAME:).*$/ig.test(data)) {
            client.username = data.split(":")[1];
            socket.broadcast(json({announcement:client.username+' joined'}));
            return;
        }
        
        var message = {'user':client.sessionId, 'username':client.username, 'message':data};
        buffer.push(message);
        if (buffer.length > MAXBUF) {
            buffer.shift();
        }
        client.broadcast(json(message));
    });
    
    client.on('disconnect', function() {
        client.broadcast(json({announcement:(client.username||client.sessionId)+' left chat'}));
        var pos = clients.indexOf(client);
        if (pos >= 0) {
          clients.splice(pos, 1);
        }
    });
    
    clients.push(client);
});


// Only listen on $ node app.js

if (!module.parent) {
    app.listen(9202);
    console.log("Socket-Chat listening on port 9202.. Go to http://<this-host>:9202");
}