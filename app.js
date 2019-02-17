const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const {Server} = require('./server/server.js');

const server = new Server(io);
const port = process.env.PORT || 3000;

http.listen(port, () => {
    console.log(`HTTP Server started: Listening on port ${port}.`);
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

io.on('connection', (socket) => {
    console.log(`User with socket.id: ${socket.id} connected.`);
    server.joinGameInstance(socket);
    socket.emit('connected', 'Server connection established.');

    socket.on('disconnect', function(){
        console.log(`User with socket.id: ${socket.id} disconnected.`);
        server.handlePlayerDisconnect(socket);
    });

    socket.on('player_ready',(data)=>{
        server.handlePlayerReady(socket);
    });    
});