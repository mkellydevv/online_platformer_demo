
// Wrapper class for pixi js
class Pixi {
    constructor () {
        // Pixi stuff
        this.app = new PIXI.Application({});
        document.body.appendChild(this.app.view);

        PIXI.settings.MIPMAP_TEXTURES = false;
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        // Aliases
        this.loader = this.app.loader;
        this.renderer = this.app.renderer;
        this.resources = this.app.loader.resources;
        this.stage = this.app.stage;

        // Level information
        this.current_level;
        this.current_layer;
        
        // Camera stuff
        this.aspect_ratio = 4/3;
        this.view;
        this.bounds;
        this.dead_zone;

        //this.loader.onProgress.add(this.loadProgressHandler);
       
    }

    resize (width,height) {
        if (width / height > this.aspect_ratio) {
            width = height * this.aspect_ratio;
            height = height;
        } else {
            width = width;
            height = width / this.aspect_ratio;
        }
        width = Math.round(width);
        height = Math.round(height);

        let view_w = 192,
            view_h = 144;
        if (this.aspect_ratio === 4/3) {
            this.x_scale = width / 192;
            this.y_scale = height / 144;
        } else if (this.aspect_ratio === 16/9) {
            this.x_scale = width / 256;
            this.y_scale = height / 144;
            view_w = 256;
        }

        this.view = new PIXI.Rectangle(0,0,view_w,view_h);
        this.bounds = new PIXI.Rectangle(0,0,this.current_layer.w,this.current_layer.h);
        this.dead_zone = new PIXI.Rectangle(view_w/3,view_h/3,view_w/3,view_h/3);

        this.renderer.resize(width,height);
        this.stage.scale.set(this.x_scale,this.y_scale);
    }

    updateCameraPosition (target) {
        
        // Move camera only within deadzone
        if (target.x - this.view.x > this.dead_zone.right)
            this.view.x = target.x - this.dead_zone.right;
        else if(target.x - this.view.x < this.dead_zone.left)
            this.view.x = target.x - this.dead_zone.left;
        if (target.y - this.view.y > this.dead_zone.bottom)
            this.view.y = target.y - this.dead_zone.bottom;
        else if(target.y - this.view.y <  this.dead_zone.top)
            this.view.y = target.y - this.dead_zone.top;
        // Prevent camera from going out of bounds
        if (this.view.x < this.bounds.left)
            this.view.x = this.bounds.left;
        else if (this.view.x + this.view.width > this.bounds.right)
            this.view.x = this.bounds.right - this.view.width;
        if (this.view.y < this.bounds.top)
            this.view.y = this.bounds.top;
        else if (this.view.y + this.view.height > this.bounds.bottom)
            this.view.y = this.bounds.bottom - this.view.height;
    }

    updateLayerPosition (layer_data) {
        let stage_layer = this.stage.children.find(obj => obj.layer_id === layer_data.id);
        let x = Math.round(-this.view.x),
            y = Math.round(-this.view.y);

        // Apply offsets
        x += layer_data.offset_x;
        y += layer_data.offset_y;

        // Apply parallax_speeds
        if (layer_data.parallax_speed !== 1) {
            x *= layer_data.parallax_speed_x;
            y *= layer_data.parallax_speed_y;
        }

        stage_layer.position.x = x;
        stage_layer.position.y = y;
    }

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    getNewSprite (sprite_data,layer) {
        let sprite = new PIXI.Sprite(this.resources[sprite_data.atlas].textures[sprite_data.texture]);
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        let stage_layer = this.stage.children.find(obj => obj.layer_id === layer.id);
        stage_layer.addChild(sprite);
        return sprite;
    }

    getNewAnimatedSprite (obj,layer) {
        let anim = obj.sprite_name + obj.sprite_anim;
        let animated_sprite = new PIXI.AnimatedSprite(
            this.resources[obj.sprite_atlas].spritesheet.animations[anim]);
        animated_sprite.animationSpeed = .2;
        animated_sprite.anchor.x = 0.5;
        animated_sprite.play();
        let stage_layer = this.stage.children.find(obj => obj.layer_id === layer.id);
        stage_layer.addChild(animated_sprite);
        return animated_sprite;
    }


    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------

    loadProgressHandler(loader, resource) {
        console.log('Loading:',resource.url);
        console.log('Progress:',loader.progress,"%");
    }

    loadLevelData (level,callback) {
        this.loader
            .add(level,`client/assets/levels/${level}.json`)
            .add('settings','client/assets/settings.json')
            .load(()=>this.onLevelDataLoaded(level,callback));
    }

    onLevelDataLoaded (level,callback) {
        this.current_level = this.resources[level].data;
        this.current_layer = this.current_level.layers[0];
        this.unpackLevelData();
        this.loadTextureData(callback);
    }

    loadTextureData (callback) {
        // Load textures
        for (let t in this.current_level.textures)
            this.loader.add(t,this.current_level.textures[t])
        // Load texture atlases
        for (let t_atlas in this.current_level.texture_atlases)
            this.loader.add(t_atlas,this.current_level.texture_atlases[t_atlas])
        this.loader.load(()=>this.onTextureDataLoaded(callback));
    }

    onTextureDataLoaded (callback) {
        console.log('All assets loaded.')
        this.unpackAnimationData();
        this.populateStageLayers();
        callback();
    }

    unpackLevelData () {
        for (let i = 0; i < this.current_level.layers.length; i++) {
            this.current_level.layers[i].w = this.current_level.layers[i].tile_size * this.current_level.layers[i].columns;
            this.current_level.layers[i].h = this.current_level.layers[i].tile_size * this.current_level.layers[i].rows;
        }
    }

    unpackAnimationData() {
        for (let i = 0; i < this.resources.sprites.data.meta.frameTags.length; i++) {
            let prop = this.resources.sprites.data.meta.frameTags[i];
            let animation_frames = [];
            for (let j = prop.from; j <= prop.to; j++)
                animation_frames.push(this.resources.sprites.textures[j]);
            this.resources.sprites.spritesheet.animations[prop.name] = animation_frames;
        }
    }

    // Add layers to the stage and populate them with static bg textures, tiles, and props
    populateStageLayers () {
        for (let i = this.current_level.layers.length - 1; i >= 0; i--) {
            let layer = this.current_level.layers[i];

            let container = new PIXI.Container();
            container.layer_id = layer.id;

            if (layer.tile_map !== null)
                this.constructTileMap(layer,container);
            
            this.stage.addChild(container);
        }

        // Add UI layer
        let ui_layer = new PIXI.Container();
        ui_layer.layer_id = 'ui';
        this.stage.addChild(ui_layer);
    }

    constructTileMap (layer,container) {
        for (let i = 0; i < layer.tile_map.length; i++) {
            let val = layer.tile_map[i] - 1;

            // Source
            let sx = (val % layer.tile_set_col) * layer.tile_size,
                sy = Math.floor(val / layer.tile_set_col) * layer.tile_size;

            // Destination
            let dx = (i % layer.columns) * layer.tile_size,
                dy = Math.floor(i / layer.columns) * layer.tile_size;

            let frame = new PIXI.Texture(this.resources[layer.tile_set2].texture,
                new PIXI.Rectangle(sx, sy, layer.tile_size, layer.tile_size));

            let tile = new PIXI.Sprite(frame);
            tile.x = dx;
            tile.y = dy;
            if (layer.tint !== null)
                tile.tint = layer.tint;
            
            container.addChild(tile);
        }
    }
}