let client = {};
window.addEventListener("load", function(event) {
    client = new Client();
    client.loadAssets('level000');
});

const Client = function() {
    this.controller = new Controller();
    this.game = new Game();
    this.engine = new Engine(1000/30,this);
    this.pixi = new Pixi();;

    this.mouse_game_pos;
    this.mouse_pressed;

    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('contextmenu', event => event.preventDefault());

    window.addEventListener('keydown', this.keyDown.bind(this));
    window.addEventListener('keyup', this.keyUp.bind(this));
    window.addEventListener('mousedown', this.mouseDown.bind(this));
    window.addEventListener('mouseup', this.mouseUp.bind(this));

    // Hacky, Change later 
    window.addEventListener("paste", function() {
        document.querySelector('canvas').requestFullscreen();
    });
    window.addEventListener("copy",this.toggleAspectRatio.bind(this));
    
    this.showDevInfo();
};

Client.prototype = {
    loadAssets:function(level){
        this.pixi.loadLevelData(level,()=>{
            this.initializeGameState();
            this.startEngine();
        });
    },
    initializeGameState:function(){
        this.game.loadLevelData(this.pixi);
    },
    showDevInfo:function(){
        this.dev_info = document.createElement("p");
        this.dev_info.innerHTML = '{0,0}';
        document.body.appendChild(this.dev_info);

        document.querySelector('canvas').addEventListener('mousemove', (event)=> {
            this.mouse_game_pos = this.getMouseGamePosition(event);
            this.dev_info.innerHTML = `{${this.mouse_game_pos.x},${this.mouse_game_pos.y}}`;
        });
    },
    toggleAspectRatio:function(){
        if (this.pixi.aspect_ratio === 4/3)
            this.pixi.aspect_ratio = 16/9;
        else
            this.pixi.aspect_ratio = 4/3;
        this.resize();
    },
    keyDown:function(event) {
        this.controller.onKeyDown(event);
    },
    keyUp:function(event) {
        this.controller.onKeyUp(event);
    },
    mouseDown:function(event) {
        this.controller.onMouseDown(event);
        this.mouse_pressed = this.mouseMove.bind(this);
        window.addEventListener('mousemove', this.mouse_pressed);
    },
    mouseMove:function(event){
        this.mouse_game_pos = this.getMouseGamePosition(event);
    },
    mouseUp:function(event) {
        this.controller.onMouseUp(event);
        window.removeEventListener("mousemove", this.mouse_pressed);
        this.mouse_pressed = undefined;
    },
    getMouseGamePosition:function(event){
        let canvas = this.pixi.renderer.gl.canvas;
        let ratio_x = (canvas.clientWidth / this.pixi.view.width),
            ratio_y = (canvas.clientHeight / this.pixi.view.height);
        // Position of mouse in game world
        let game_x = Math.floor((event.pageX - canvas.offsetLeft) / ratio_x + this.pixi.view.x),
            game_y = Math.floor((event.pageY - canvas.offsetTop) / ratio_y + this.pixi.view.y);

        return {x:game_x,y:game_y};
    },
    processInput:function(){
        // Package this.controller.pressed_keys
        let package = {
            tick:this.engine.tick
        };
        if (this.controller.keyPressed('ArrowLeft') === true || 
            this.controller.keyPressed('a') === true)
            package.left = true;
        if (this.controller.keyPressed('ArrowRight') === true ||
            this.controller.keyPressed('d') === true)
            package.right = true;
        if (this.controller.keyPressed('ArrowUp') === true ||
            this.controller.keyPressed('w') === true)
            package.up = true;
        if (this.controller.keyPressed('ArrowDown') === true ||
            this.controller.keyPressed('s') === true)
            package.down = true;
        if (this.controller.keyPressed('e') === true)
            package.e = true;

        if (this.controller.mousePressed('MouseLeft')) 
            package.mouseLeft = true;
        if (this.controller.mousePressed('MouseRight'))
            package.mouseRight = true;
        
        if (this.mouse_pressed !== undefined)
            package.mouse_game_pos = this.mouse_game_pos;
        
        // Ship package to server
        // Send package to client's game
        if (Object.keys(package).length > 1)
            this.game.input_queue.push(package);
    },
    render:function() {
        this.pixi.updateCameraPosition(this.game.player.box.getCenter());

        for (let i = this.pixi.current_level.layers.length - 1; i >= 0; i--) {
            this.pixi.updateLayerPosition(this.pixi.current_level.layers[i]);
        }

        if (this.game.update_ui === true)
            this.updateUI();
    },
    resize:function(){
        this.pixi.resize(document.documentElement.clientWidth,document.documentElement.clientHeight);
    },
    startEngine:function(){
        this.resize();
        this.engine.start();
    },
    update:function(){
        this.game.update();
    },

    // Recreates entire UI in current iteration
    updateUI:function(){
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
}