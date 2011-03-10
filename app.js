//require.paths.unshift(__dirname + '/lib');

var io = require('socket.io'),
  http = require('http');

var fs = require('fs'),
  util = require('util');

var url = require('url'),
  path = require('path'),
  mime = require('mime');

function findType(uri) {
  var ext = uri.match(/\.\w+$/gi);
  if (ext && ext.length > 0) {
    ext = ext[0].split(".")[1].toLowerCase();
    return mime.lookup(ext);
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
  if (uri === '/') {
    uri = '/index.html';
  } else if (uri === '/app.js') {
    sendError(404, response);
    return;
  }
  var _file = path.join(process.cwd(), uri);

  path.exists(_file, function(exists) {
    if (!exists) {
      sendError(404, response);
    } else {
      fs.stat(_file, function(err, stat) {
        var file = __dirname + uri,
            type = findType(uri),
            size = stat.size;
        if (!type) {
          sendError(500, response);
        }
        response.writeHead(200, {'Content-Type':type, 'Content-Length':size});
        var rs = fs.createReadStream(file);
        util.pump(rs, response, function(err) {
          if (err) {
            console.log("ReadStream, WriteStream error for util.pump");
            response.end();
          }
        });
      });
    }
  });

});



var socket = io.listen(app, {transports:['websocket', 'xhr-polling']}),
  buffer = [],
  MAXBUF = 1024,
  json = JSON.stringify;

var clients = [];
clients.usernames = function(client) {
  return client.username;
}

socket.on('connection', function(client) {

  client.on('message', function(data) {
    if ((/^(USERNAME:).*$/ig).test(data)) {
      var parts = data.split(":");
      var username = parts[1];

      if (!username || username == '') {
        client.send(json({announcement:"You must specify a username. Please reload the app."}));
        return;
      }

      var usernames = clients.map(clients.usernames);
      if (usernames.indexOf(username) >= 0) {
        client.send(json({announcement:"Username in use"}));
        return;
      }

      client.username = username;

      client.broadcast(json({announcement:client.username+' joined'}));
      console.log(client.sessionId + " = " + client.username);
      client.send(json({messages:buffer}));
      client.send(json({userlist:usernames}));
      client.send(json({announcement:"Connected! Hello, " + username + "!"}));

      clients.push(client);
      return;
    } 

    if (!client.username) {
      client.send(json({announcement:"You must specify a username. Please reload the app."}));
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
    if (client.username) {
      client.broadcast(json({announcement:(client.username)+' left chat'}));
    }
    var pos = clients.indexOf(client);
    if (pos >= 0) {
      clients.splice(pos, 1);
    }
  });
});


// Only listen on $ node app.js

if (!module.parent) {
  app.listen(9202);
  console.log("Socket-Chat listening on port 9202.. Go to http://<this-host>:9202");
}