require.paths.unshift(__dirname + '/lib');
var express = require('express'),
    connect = require('connect'),
         io = require('socket.io');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.use(connect.bodyDecoder());
    app.use(connect.methodOverride());
    app.use(connect.compiler({ src: __dirname + '/public', enable: ['less'] }));
    app.use(app.router);
    app.use(connect.staticProvider(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(connect.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
   app.use(connect.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
    res.render('./public/');
});

var socket = io.listen(app, {transports:['websocket', 'xhr-polling']}),
    buffer = [],
    MAXBUF = 32,
      json = JSON.stringify;

var clients = [];

socket.on('connection', function(client) {

    client.send(json({messages:buffer}));
    
    client.on('message', function(data) {
        if (/^(USERNAME:).*$/ig.test(data)) {
            client.username = data.split(":")[1];
            client.broadcast(json({announcement:client.username+' joined'}));
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
    });
    
    clients.push(client);
});


// Only listen on $ node app.js

if (!module.parent) {
    app.listen(9202);
    console.log("Socket-Chat listening on port 9202.. Go to http://<this-host>:9202");
}

