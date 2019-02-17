let client = {};
window.addEventListener("load", function(event) {
    client = new Client();
    client.connectToServer();
});

class Client {
    constructor () {
        // Core Client Objects
        this.controller = new Controller();
        this.game = new Game();
        this.pixi = new Pixi();
        this.engine = new Engine(this,1000/30);
        
        // Client Properties
        this.dev_mode = false;
        this.mouse_game_pos = null;
        this.mouseMoveAlias = null;
        
        // Web Sockets
        this.ready = false;
        this.socket = null;

        this.addEventListeners();
    }

    // ------------------------------------------------------------------
    // Event Handler Functions
    // ------------------------------------------------------------------

    addEventListeners () {
        window.addEventListener('contextmenu',event => event.preventDefault());
        window.addEventListener('copy',this.handleEventCopy.bind(this));
        window.addEventListener('keydown',this.handleEventKeyDown.bind(this));
        window.addEventListener('keyup',this.handleEventKeyUp.bind(this));
        window.addEventListener('mousedown',this.handleEventMouseDown.bind(this));
        window.addEventListener('mouseup',this.handleEventMouseUp.bind(this)); 
        window.addEventListener('paste',this.handleEventPaste.bind(this));
        window.addEventListener('resize',this.handleEventResize.bind(this));
    }

    handleEventCopy (event) {
        this.toggleAspectRatio();
    }

    handleEventKeyDown (event) {
        this.controller.onKeyDown(event);
    }

    handleEventKeyUp (event) {
        this.controller.onKeyUp(event);
    }

    handleEventMouseDown (event) {
        this.mouse_game_pos = this.getMouseGamePosition(event);
        this.mouseMoveAlias = this.handleEventMouseMove.bind(this);
        this.controller.onMouseDown(event);
        window.addEventListener('mousemove',this.mouseMoveAlias);
    }
    
    handleEventMouseMove (event) {
        this.mouse_game_pos = this.getMouseGamePosition(event);
    }

    handleEventMouseUp (event) {
        this.controller.onMouseUp(event);
        if (event.buttons === 0) {
            window.removeEventListener('mousemove',this.mouseMoveAlias);
            this.mouseMoveAlias = null;
        }
    }

    handleEventPaste (event) {
        document.querySelector('canvas').requestFullscreen();
    }

    handleEventResize (event) {
        this.resizeCanvas();
    }

    // ------------------------------------------------------------------
    // Socket Functions
    // ------------------------------------------------------------------

    connectToServer () {
        this.socket = io.connect();

        this.socket.on('connected', this.handleSocketConnected.bind(this));
        this.socket.on('load_level', this.handleSocketLoadLevel.bind(this));
        this.socket.on('new_player',this.handleSocketNewPlayer.bind(this));
        this.socket.on('remove_player',this.handleSocketRemovePlayer.bind(this));
        this.socket.on('start_match',this.handleSocketStartMatch.bind(this));
    }

    handleSocketConnected (data) {
        console.log(data);
    }

    handleSocketLoadLevel (data) {
        this.loadAssets(data.level,data.nickname);
        this.socket.instance_id = data.instance_id;
        this.socket.nickname = data.nickname;
    }

    handleSocketNewPlayer (data) {
        console.log(`Player: ${data} has joined the game.`);
        //this.game.addNewPlayer(this.game.player_spawn,this.game.team_1,'fox',false,data);
    }

    handleSocketRemovePlayer (data) {
        console.log(`Player: ${data} has left the game.`);
        //this.game.destroyPlayer(data);
    }

    handleSocketStartMatch (data) {
        this.startEngine();
    }

    sendSocketReady () {
        this.socket.emit('player_ready');
    }

    // ------------------------------------------------------------------
    // Core Functions
    // ------------------------------------------------------------------

    loadAssets (level_id,nickname) {
        this.pixi.stage.visible = false;
        this.pixi.loadLevelData(level_id,()=>{
            let character = this.parseURL();
            this.loadGameState(character,nickname);
            if (this.dev_mode === true)
                this.turnOnDevMode();
            this.sendSocketReady();
        });
    }

    loadGameState (character,nickname) {
        this.game.loadLevelData(this.pixi,character,nickname);
    }

    // Package local input data and pass it to the Game Object
    processLocalInput () {
        let input_data = {
            tick:this.engine.local_tick
        };

        if (this.controller.keyPressed('ArrowLeft') === true || this.controller.keyPressed('a') === true)
            input_data.left = true;
        if (this.controller.keyPressed('ArrowRight') === true || this.controller.keyPressed('d') === true)
            input_data.right = true;
        if (this.controller.keyPressed('ArrowUp') === true || this.controller.keyPressed('w') === true)
            input_data.up = true;
        if (this.controller.keyPressed('ArrowDown') === true || this.controller.keyPressed('s') === true)
            input_data.down = true;
        if (this.controller.keyPressed('q') === true)
            input_data.q = true;
        if (this.controller.keyPressed('e') === true)
            input_data.e = true;
        if (this.controller.keyPressed('r') === true)
            input_data.r = true;
        if (this.controller.keyPressed('Shift') === true)
            input_data.shift = true;
        if (this.controller.mousePressed('MouseLeft')) 
            input_data.mouseLeft = true;
        if (this.controller.mousePressed('MouseRight'))
            input_data.mouseRight = true;
        if (this.mouseMoveAlias !== null)
            input_data.mouse_game_pos = this.mouse_game_pos;
        
        if (Object.keys(input_data).length > 1)
            this.game.input_queue.push(input_data);
    }

    startEngine () {
        this.resizeCanvas();
        this.pixi.updateCameraPosition(this.game.player_spawn.box);
        this.updateView();
        this.pixi.stage.visible = true;
        this.engine.start();
    }

    updateGameState () {
        this.game.update();
    }

    updateView () {
        // Update camera position in relation to current stage layer
        if (this.game.player !== null)
            this.pixi.updateCameraPosition(this.game.player.box.getCenter());

        // Update each stage layer's position in relation to the camera
        for (let i = this.pixi.current_level.layers.length - 1; i >= 0; i--)
            this.pixi.updateLayerPosition(this.pixi.current_level.layers[i]);

        // Update UI
        if (this.game.update_ui === true) {
            this.updateUI();
            this.game.update_ui = false;
        }
    }

    updateUI () {
        // Completely remake UI layer
        this.pixi.stage.children.pop();

        let ui_layer = new PIXI.Container();
        ui_layer.layer_id = 'ui';

        // Hearts
        for(let i = 0; i < this.game.player.current_health; i++){
            let sprite = new PIXI.Sprite(this.pixi.resources['hearts'].textures['heart_4']);
            sprite.position.x = 10 * i;
            ui_layer.addChild(sprite);
        }

        // Weapons
        for(let i = 0; i < this.game.player.weapon_slots.length; i++){
            let sprite_data = this.game.player.weapon_slots[i].getSpriteData();
            let sprite = new PIXI.Sprite(this.pixi.resources[sprite_data.atlas].textures[sprite_data.texture]);
            sprite.position.x = (this.pixi.view.width / 2 - 8) + 16 * i;
            ui_layer.addChild(sprite);
        }

        this.pixi.stage.addChild(ui_layer);
    }

    // ------------------------------------------------------------------
    // Helper Functions
    // ------------------------------------------------------------------

    toggleAspectRatio () {
        if (this.pixi.aspect_ratio === 4/3)
            this.pixi.aspect_ratio = 16/9;
        else
            this.pixi.aspect_ratio = 4/3;
        this.resizeCanvas();
    }

    // Returns position of mouse in the game world
    getMouseGamePosition (event) {
        let ratio_x = this.pixi.canvas.clientWidth / this.pixi.view.width,
            ratio_y = this.pixi.canvas.clientHeight / this.pixi.view.height;
        return {
            x:Math.floor((event.pageX - this.pixi.canvas.offsetLeft) / ratio_x + this.pixi.view.x),
            y:Math.floor((event.pageY - this.pixi.canvas.offsetTop) / ratio_y + this.pixi.view.y)
        };
    }

    resizeCanvas () {
        this.pixi.resize(document.documentElement.clientWidth,document.documentElement.clientHeight);
        this.updateUI();
    }

    // ------------------------------------------------------------------
    // Dev Functions
    // ------------------------------------------------------------------

    // Loads eagle character for now
    parseURL () {
        let character = window.location.href.split('?');
        return character[1];
    }

    showMouseInfo () {
        window.addEventListener('mousemove',(event)=>{
            this.handleEventMouseMove(event);
            document.getElementById('dev').innerHTML = `Mouse Game Pos: ${this.mouse_game_pos.x},${this.mouse_game_pos.y}`;
        });
    }

    toggleColliderGraphics (color) {
        this.pixi.toggleColliderGraphics(this.game.colliders,color);
    }

    toggleGridGraphics (color) {
        this.pixi.toggleGridGraphics(this.game.grid,color);
    }

    turnOnDevMode () {
        //this.toggleColliderGraphics('0x00FF00');
        //this.toggleGridGraphics('0xFF0000');
        this.showMouseInfo();
    }
}