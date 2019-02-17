// Wrapper class for PIXI.js
// Loads client assets and renders the camera
class Pixi {
    constructor () {
        this.app = new PIXI.Application({antialias:false});
        document.body.appendChild(this.app.view);

        // Pixi Settings
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
        PIXI.settings.ROUND_PIXELS = true;

        // Aliases
        this.canvas = this.app.renderer.gl.canvas;
        this.loader = this.app.loader;
        this.renderer = this.app.renderer;
        this.resources = this.app.loader.resources;
        this.stage = this.app.stage;

        // Level information
        this.current_level;
        this.current_layer;             // Layer with camera focus
        
        // Camera Objects/Properties
        this.view = null;               // Dimensions in game pixels
        this.bounds = null;             // Dimensions in game pixels
        this.dead_zone = null;          // Dimensions in game pixels
        this.aspect_ratio = 4/3;
        this.x_scale = null;            // Scales stage to display apropriate pixel size
        this.y_scale = null;
        this.lerp_amount = 0.25;

        // Dev Objects/Properties
        this.collider_graphics = null;  // Holds the Collider Game Object Graphics if toggled on
        this.grid_graphics = null;      // Holds the Grid Graphics if toggled on
        this.box_bounds_graphics = false;// If true, graphics will be added around box objects

        this.text_style = {
            fontFamily: 'Arial',
            fontSize: '5px',
            fill: '0xFFFFFF',
        };
    }

    // ------------------------------------------------------------------
    // Core Camera Functions
    // ------------------------------------------------------------------

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
        
        let dead_dim = {w:view_w/4,h:view_h/3.75},
            dead_offset = {x:(view_w-dead_dim.w)/2,y:(view_h-dead_dim.h)/2};

        this.view = new PIXI.Rectangle(0,0,view_w,view_h);
        this.bounds = new PIXI.Rectangle(0,0,this.current_layer.w,this.current_layer.h);
        this.dead_zone = new PIXI.Rectangle(dead_offset.x,dead_offset.y,dead_dim.w,dead_dim.h);

        this.renderer.resize(width,height);
        this.stage.scale.set(this.x_scale,this.y_scale);
    }

    updateCameraPosition (target) {
        // Move camera only within deadzone
        if (target.x - this.view.x > this.dead_zone.right)
            this.view.x = lerp(this.view.x,(target.x - this.dead_zone.right),this.lerp_amount);
        else if(target.x - this.view.x < this.dead_zone.left)
            this.view.x = lerp(this.view.x,(target.x - this.dead_zone.left),this.lerp_amount);
        if (target.y - this.view.y > this.dead_zone.bottom)
            this.view.y = lerp(this.view.y,(target.y - this.dead_zone.bottom),this.lerp_amount);
        else if(target.y - this.view.y <  this.dead_zone.top)
            this.view.y = lerp(this.view.y,(target.y - this.dead_zone.top),this.lerp_amount);
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

        // Apply parallax ratio
        if (layer_data.parallax_speed !== 1) {
            x *= layer_data.parallax_speed_x;
            y *= layer_data.parallax_speed_y;
        }

        stage_layer.position.set(x,y);
    }

    // ------------------------------------------------------------------
    // Asset Manager Functions
    // ------------------------------------------------------------------

    loadLevelData (level,callback) {
        this.loader
            .add(level,`client/assets/levels/${level}.json`)
            .add('settings','client/assets/settings.json')
            .load(()=>this.onLevelDataLoaded(level,callback));
    }

    loadProgressHandler(loader, resource) {
        console.log('Loading:',resource.url);
        console.log('Progress:',loader.progress,"%");
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

    onLevelDataLoaded (level,callback) {
        this.current_level = this.resources[level].data;
        this.current_layer = this.current_level.layers.find(obj => obj.id === 'collision_0');
        this.unpackLevelData();
        this.loadTextureData(callback);
    }

    onTextureDataLoaded (callback) {
        this.unpackAnimationData();
        this.populateStageLayers();
        this.cacheLayers();
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

    // ------------------------------------------------------------------
    // Static Layer Functions
    // ------------------------------------------------------------------

    addProps (layer,container) {
        // Add a dummy to the container to properly space other props
        if (layer.prop_layer) {
            let sprite = new PIXI.Sprite(this.resources['props'].textures['dummy']);
            sprite.position.set(0,0);
            container.addChild(sprite);
        }

        for (let prop_group in layer.props) {
            for (let i = 0; i < layer.props[prop_group].length; i++) {
                let prop = layer.props[prop_group][i];
                let sprite = new PIXI.Sprite(this.resources[prop_group].textures[prop[0]]);
                sprite.position.set(prop[1],prop[2]);
                if (layer.tint !== null)
                    sprite.tint = layer.tint;
                container.addChild(sprite);
            }
        }
    }

    cacheLayers () {
        for (let i = 0; i < this.current_level.layers.length; i++) {
            let layer = this.current_level.layers[i];
            let stage_layer = this.stage.children.find(obj => obj.layer_id === layer.id);
            stage_layer.cacheAsBitmap = layer.cacheAsBitmap;
        }
    }

    constructTileMap (layer,container) {
        for (let i = 0; i < layer.tile_map.length; i++) {
            let val = layer.tile_map[i] - 1;
            if (layer.tile_map_offset)
                val -= layer.tile_map_offset;

            // Source
            let sx = (val % layer.tile_set_col) * layer.tile_size,
                sy = Math.floor(val / layer.tile_set_col) * layer.tile_size;

            // Destination
            let dx = (i % layer.columns) * layer.tile_size,
                dy = Math.floor(i / layer.columns) * layer.tile_size;

            let frame = new PIXI.Texture(this.resources[layer.tile_set].texture,
                new PIXI.Rectangle(sx, sy, layer.tile_size, layer.tile_size));

            let tile = new PIXI.Sprite(frame);
            tile.x = dx;
            tile.y = dy;

            // Apply tint to tile
            if (layer.tint !== null)
                tile.tint = layer.tint;
            
            container.addChild(tile);
        }
    }

    constructTilingSprite (layer,container) {
        let tiling_sprite = new PIXI.TilingSprite(
            this.resources[layer.tiling_sprite].texture,
            layer.w,layer.h
        );
        if (layer.tint !== null)
            tiling_sprite.tint = layer.tint;
        container.addChild(tiling_sprite);
    }

    // Add layers to the stage and populate them with static bg textures, tiles, and props
    populateStageLayers () {
        // Add primary stage layers
        for (let i = this.current_level.layers.length - 1; i >= 0; i--) {
            let layer = this.current_level.layers[i];

            let container = new PIXI.Container();
            container.layer_id = layer.id;
            container.scale.set(layer.scale,layer.scale);
            
            if (layer.tile_map !== null)
                this.constructTileMap(layer,container);
            else if (layer.tiling_sprite !== null)
                this.constructTilingSprite(layer,container);

            if (layer.props)
                this.addProps(layer,container);
            
            this.stage.addChild(container);
        }

        // Add UI layer
        let ui_layer = new PIXI.Container();
        ui_layer.layer_id = 'ui';
        this.stage.addChild(ui_layer);
    }

    // ------------------------------------------------------------------
    // Sprite Creation Functions
    // ------------------------------------------------------------------

    getNewSprite (sprite_data,sprite_box,layer,args={}) {
        let stage_layer = this.stage.children.find(obj => obj.layer_id === layer.id);

        let container = new PIXI.Container();
        container.position.set(sprite_box.x,sprite_box.y);

        // Add sprite to container
        let sprite = new PIXI.Sprite(this.resources[sprite_data.atlas].textures[sprite_data.texture]);
        // If anchor exits, center the sprite within the container
        if (args.anchor !== undefined) {
            sprite.anchor.set(0.5,0.5);
            sprite.position.set(sprite_box.half_w,sprite_box.half_h);
        }
        container.addChild(sprite);
        container.base_sprite = sprite;

        // Add box bounds graphics to container
        if (this.box_bounds_graphics === true)
            container.addChild(this.getSpriteBoxBounds(sprite_box,0,0));

        stage_layer.addChild(container);
        return container;
    }

    getNewAnimatedSprite (game_object,layer,name=null) {
        let stage_layer = this.stage.children.find(obj => obj.layer_id === layer.id);
        
        let container = new PIXI.Container();

        // Add animated sprite to container
        let animated_sprite = this.getSpriteAnimation(game_object);
        container.addChild(animated_sprite);
        container.base_sprite = animated_sprite;
        
        // Add name label to container
        if (name !== null)
            container.addChild(this.getSpriteLabel(name));

        // Add box bounds graphics to container
        if (this.box_bounds_graphics === true)
            container.addChild(this.getSpriteBoxBounds(game_object.box,0.5,-1));

        // Add container to stage
        stage_layer.addChild(container);
        return container;
    }

    getSpriteAnimation (game_object) {
        let anim_name = game_object.sprite_name + game_object.sprite_anim;
        if (this.resources[game_object.sprite_atlas].spritesheet.animations[anim_name] === undefined)
            anim_name = game_object.sprite_name + '_idle';
        let animated_sprite = new PIXI.AnimatedSprite(
            this.resources[game_object.sprite_atlas].spritesheet.animations[anim_name]);
        animated_sprite.animationSpeed = game_object.sprite_anim_speed || 0.2;
        animated_sprite.anchor.x = 0.5;
        animated_sprite.play();

        // Apply offset
        let frame_tags = this.resources[game_object.sprite_atlas].data.meta.frameTags;
        let frame_tag = frame_tags.find(obj => obj.name === anim_name);
        if (frame_tag.offset !== undefined) {
            let offset = frame_tag.offset;
            animated_sprite.position.set(offset.x,offset.y);
        }

        // Apply tint
        if (game_object.tint)
            animated_sprite.tint = game_object.tint;

        return animated_sprite;
    }

    getSpriteLabel (text) {
        let label = new PIXI.Text(text,this.text_style);
        label.resolution = this.x_scale;
        label.anchor.x = 0.5;
        return label;
    }

    getSpriteBoxBounds (box,anchor_x=0,anchor_y=0) {
        let graphics = new PIXI.Graphics();
        graphics.lineStyle(1,'0x0000FF',1,0);
        graphics.drawPolygon([0,0,box.w,0,box.w,box.h,0,box.h,0,0]);
        let sprite = new PIXI.Sprite(this.renderer.generateTexture(graphics));
        sprite.anchor.set(anchor_x,anchor_y);
        return sprite;
    }

    // ------------------------------------------------------------------
    // Dev Functions
    // ------------------------------------------------------------------

    toggleColliderGraphics (colliders,color) {
        if (this.collider_graphics === null) {
            this.collider_graphics = [];
            let stage_layer = this.stage.children.find(obj => obj.layer_id === 'collision_0');
            let use_random_color = (color === undefined) ? true : false;
            for (let i = 0; i < colliders.length; i++) {
                if (colliders[i] !== null) {
                    let collider = colliders[i],
                        box = colliders[i].box;
                    let graphics = new PIXI.Graphics();
                    if (use_random_color === true)
                        color = getRandomColor();
                    // Only draw edges that exist
                    graphics.lineStyle(1.5, color);
                    if (collider.edges[0] === true) {                           // Top
                        graphics.moveTo(box.x,box.y);
                        graphics.lineTo(box.getRight(),box.y);
                    }
                    if (collider.edges[1] === true) {                           // Bottom
                        graphics.moveTo(box.x,box.getBottom());             
                        graphics.lineTo(box.getRight(),box.getBottom());
                    }
                    if (collider.edges[2] === true) {                           // Left
                        graphics.moveTo(box.x,box.y);
                        graphics.lineTo(box.x,box.getBottom());
                    }
                    if (collider.edges[3] === true) {                           // Right
                        graphics.moveTo(box.getRight(),box.y);
                        graphics.lineTo(box.getRight(),box.getBottom());
                    }
                    this.collider_graphics.push(graphics);
                    stage_layer.addChild(graphics);
                }
            }
        } else {
            for (let i = 0; i < this.collider_graphics.length; i++)
                this.collider_graphics[i].destroy();
            this.collider_graphics = null;
        }
    }

    toggleGridGraphics (grid,color) {
        if (this.grid_graphics === null) {
            this.grid_graphics = [];
            let stage_layer = this.stage.children.find(obj => obj.layer_id === 'collision_0');
            if (color === undefined)
                color = getRandomColor();
            for (let i = 0; i < grid.rows; i++) {
                for (let j = 0; j < grid.columns; j++) {
                    let graphics = new PIXI.Graphics();
                    graphics.lineStyle(1,color);
                    graphics.drawRect(i*grid.cell_w,j*grid.cell_h,grid.cell_w,grid.cell_h);
                    this.grid_graphics.push(graphics);
                    stage_layer.addChild(graphics);
                }
            }
        } else {
            for (let i = 0; i < this.grid_graphics.length; i++)
                this.grid_graphics[i].destroy();
            this.grid_graphics = null;
        }
    }
}