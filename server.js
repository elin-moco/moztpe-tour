var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(2013);

app.use(express.static('.'));

io.on('connection', function (socket){

});

