const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

http.listen(port, () => {
    console.log(`HTTP Server started: Listening on port ${port}.`);
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

io.on('connection', (socket) => {
    console.log(`User with socket.id: ${socket.id} connected.`);

    socket.on('disconnect', function(){
        console.log(`User with socket.id: ${socket.id} disconnected.`);
    });
});