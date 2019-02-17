const {Engine} = require('../client/engine.js');
const {Game} = require('../client/game.js');
const uuid = require('uuid');

class Server {
    constructor(io) {
        this.io = io;

        this.game_instances = {};
        this.levels = {};

        this.loadAssets();
    }

    // Level data from json files
    loadAssets () {
        let num = 0;
        let loop = true;
        while (loop === true) {
            let data;
            try {data = require(`../client/assets/levels/level${num}.json`);}
            catch (error) {}
            
            if (data !== undefined)
                this.levels[`level${num}`] = data;
            else
                loop = false;

            num++;
        }
    }

    // ------------------------------------------------------------------
    // Message Handler Functions
    // ------------------------------------------------------------------

    // Remove player from their game instance and instance room
    handlePlayerDisconnect (socket) {
        if (socket.instance_id !== undefined) {
            let instance = this.game_instances[socket.instance_id];
            instance.players.splice(instance.players.indexOf(socket),1);
            socket.leave(instance.id);
            socket.to(instance.id).emit('remove_player',socket.nickname);

            // End game instance when player count is 0
            if (instance.players.length === 0)
                delete this.game_instances[socket.instance_id];
        } 
    }

    handlePlayerReady (socket) {
        let instance = this.game_instances[socket.instance_id];
        socket.ready = true;

        // Start match when all players are ready
        if (instance.match_started === false) {
            let start_match = true;
            for (let i = 0; i < instance.players.length; i++) {
                if (instance.players[i].ready !== true)
                    start_match = false;
            }
            if (start_match === true) 
                this.io.in(socket.instance_id).emit('start_match');
        }
    }

    // ------------------------------------------------------------------
    // Game Instance Functions
    // ------------------------------------------------------------------

    addGameInstance (socket) {
        let instance = new GameInstance(socket);

        this.game_instances[instance.id] = instance;

        return instance;
    }

    addPlayerToGameInstance (socket,instance) {
        socket.instance_id = instance.id;
        socket.nickname = `P${++instance.player_nickname_num}`;

        // Tell socket to start loading a level
        socket.emit('load_level',{level:instance.level,instance_id:socket.instance_id,nickname:socket.nickname});

        // Add player to game instance and instance room
        instance.players.push(socket);
        socket.join(instance.id);

        // Notify other instance members of the new player
        socket.to(instance.id).emit('new_player',socket.nickname);
    }

    joinGameInstance (socket) {
        let instance_joined = false;

        // Try to join an existing game instance
        for (let i in this.game_instances) {
            let instance = this.game_instances[i];
            if (instance.players.length <= 10) {
                this.addPlayerToGameInstance(socket,instance)
                instance_joined = true;
            }
        }
        // Create a new instance otherwise
        if (instance_joined === false) {
            let instance = this.addGameInstance(socket);
            this.addPlayerToGameInstance(socket,instance);
        }
    }
}

class GameInstance {
    constructor (socket) {
        this.id = uuid();
        this.level = 'level1';
        this.match_started = false;
        this.player_nickname_num = 0;
        this.players = [];
       
        // Core Game Objects
        this.engine = new Engine(this,1000/30);
        this.game = new Game();
    }
}

module.exports = {
    Server
}