class Game {
    constructor () {
        // Game Object Containers
        this.bullets = [];                  // Holds all Bullet objects
        this.collectibles = [];             // Holds all Collectible objects
        this.colliders = [];                // Holds all Collider objects
        this.doodads = [];                  // Holds all Doodad objects
        this.dynamic_platforms = [];        // Holds all dynamic Platform objects
        this.entities = [];                 // Holds all Entity objects
        this.explosions = [];               // Holds all Explosion objects
        this.regions = [];                  // Holds all Region objects
        this.spawns = [];                   // Holds all Spawn objects
        this.static_platforms = [];         // Holds all static Platform objects
        this.triggers = [];                 // Holds all Triggers

        this.collision_map = [];            // 2D Array that takes in collision map data from level data
        this.grid = null;                   // Broad Phase Collision Container : Spatial Grid
        this.input_queue = [];              // Queue of updates to process during update loop
        this.pixi = null;                   // Pixi wrapper class used here to manage sprites and layers
        this.player = null;                 // Entity object tracked by camera and updated by local controller
        this.update_ui = true;              // Marker for when camera should update ui layer
        
        // Current Layer Properties
        this.friction = 0.85;
        this.gravity = 1.05;
        this.rows = null;
        this.columns = null;
        this.tile_size = null;
        this.x = 0;
        this.y = 0;
        this.w = null;
        this.h = null;
    }

    // ------------------------------------------------------------------
    // Core Functions
    // ------------------------------------------------------------------

    loadLevelData (pixi,character,nickname) {
        this.pixi = pixi;
        this.layer = this.pixi.current_level.layers.find(obj => obj.id === 'collision_0');
        this.grid = new Grid(this.layer.w,this.layer.h,6,6);

        // Layer dimensions
        this.rows = this.layer.rows;
        this.columns = this.layer.columns;
        this.w = this.layer.w;
        this.h = this.layer.h;
        this.tile_size = this.layer.tile_size;
        
        // Collision data
        this.loadLevelGeometry(this.layer.collision_map);

        // Create factions
        this.creeps = new Faction();
        this.team_1 = new Faction({
            hostiles:[this.creeps]
        });

        // Doodads
        for (let i = 0; i < this.layer.doodads.length; i++) {
            let data = this.layer.doodads[i];
            let doodad = new Doodad(data.type_id,new Box(data.box[0],data.box[1],data.box[2],data.box[3]),data.tags);
            doodad.pixi_sprite = this.pixi.getNewSprite(doodad.getSpriteData(),doodad.box,this.layer);
            this.doodads.push(doodad);
        }

        // Player spawns
        let data = this.layer.player_spawns[0];
        this.player_spawn = new PlayerSpawn(new Box(data[0],data[1],data[2],1),this.team_1,this.entities);
        this.player_spawn.pixi_sprite = this.pixi.getNewSprite(this.player_spawn.getSpriteData(),
            this.player_spawn.box,this.layer,{anchor:0.5});
        this.spawns.push(this.player_spawn);

        // Add Player Character
        if (character !== 'eagle') {
            this.addNewPlayer(this.player_spawn,this.team_1,
                this.pixi.resources['settings'].data['entity_id'],true,nickname);
        } else {
            this.addNewPlayer(this.player_spawn,this.team_1,'eagle',true,nickname);
        }

        // Spawns
        for (let i = 0; i < this.layer.spawns.length; i++) {
            let data = this.layer.spawns[i];
            let facing = data[6] || 'right';
            let spawn = new Spawn(data[0],data[1],facing,new Box(data[2],data[3],data[4],data[5]),
                this.pixi,this.layer,this.creeps,this.entities);
            spawn.initialize(1,200);
            this.spawns.push(spawn);
        }

        // Collectibles
        for (let i = 0; i < this.layer.collectibles.length; i++) {
            let data = this.layer.collectibles[i];
            let collectible = new Collectible(data[0],new Box(data[1],data[2],data[3],data[4]));
            collectible.pixi_sprite = this.pixi.getNewSprite(collectible.getSpriteData(),collectible.box,this.layer);
            this.collectibles.push(collectible);
        }

        // Platforms
        for (let i = 0; i < this.layer.platforms.length; i++) {
            let data = this.layer.platforms[i];
            if (data[1] === 's') {
                let platform = new Platform(data[0],data[1],data[2],data[3]);
                platform.pixi_sprite = this.pixi.getNewSprite(platform.getSpriteData(),platform.box,this.layer);
                this.static_platforms.push(platform);
            } else if (data[1] === 'd') {
                let platform = new Platform(data[0],data[1],data[2],data[3],data[4],data[5]);
                platform.pixi_sprite = this.pixi.getNewSprite(platform.getSpriteData(),platform.box,this.layer);
                this.dynamic_platforms.push(platform);
            }
        }

        // Regions
        for (let i = 0; i < this.layer.regions.length; i++) {
            let data = this.layer.regions[i];
            let region = new Region(new Box(data.box[0],data.box[1],data.box[2],data.box[3]),data.tags);
            if (data.hasOutline !== undefined)
                region.pixi_sprite = this.pixi.getNewBoxGraphics(region.box,this.layer,data.hasOutline);
            this.regions.push(region);
        }

        // Add trigger event listeners
        this.initializeTriggers();

        // Initial insert of static objects into grid
        this.grid.insertGameObjects('static',this.colliders,this.collectibles,this.doodads,
            this.static_platforms,this.regions);
    }

    processInput () {
        if (this.player.dead === true) {
            this.input_queue = [];
            return;
        }

        // Reset player input properties when there is no input
        if (this.input_queue.length === 0) {
            this.player.released_jump = true;
            this.player.released_attack = true;
            this.player.released_mouse2 = true;
            this.player.released_q = true;
            this.player.released_r = true;
            this.player.released_e = true;
            this.player.interacting = false;
            this.player.released_shift = true;
            this.player.disable_platforms = false;
            this.player.dampenJump();
        }

        while (this.input_queue.length > 0) {
            // X axis movement
            if (this.input_queue[0].left === true)
                this.player.actionMoveLeft();
            if (this.input_queue[0].right === true)
                this.player.actionMoveRight();

            // Y axis movement
            if (this.input_queue[0].up === true) {
                if (this.player.flying === false)
                    this.player.actionJump(this.input_queue[0].tick);
                else
                    this.player.actionMoveUp();
            } else {
                this.player.dampenJump();
                this.player.released_jump = true;
            }
            if (this.input_queue[0].down === true) {
                if (this.player.flying === false) {
                    this.player.actionDropDown();
                    this.player.disable_platforms = true;
                }
                else {
                    this.player.disable_playforms = true;
                    this.player.actionMoveDown();
                }
            } else {
                this.player.disable_platforms = false;
            }

            // Fire weapon
            if (this.input_queue[0].mouseLeft === true) {
                this.player.actionAttack(this.input_queue[0].mouse_game_pos,
                    (faction,pos,dir,angle,weapon) => {
                        this.spawnBullet(faction,pos,dir,angle,weapon);
                    }
                );
            } else {
                this.player.released_attack = true;
            }

            // Use weapon special ability
            if (this.input_queue[0].mouseRight === true) {
                if (this.player.released_mouse2 === true) {
                    if (this.player.ability === 'impulse') {
                        this.spawnExplosion(this.input_queue[0].mouse_game_pos,{w:32,h:32},15);
                    } else if (this.player.ability === 'slow_field') {
                        if (this.player.ability_container !== undefined) {
                            this.destroyRegion(this.player.ability_container);
                            this.player.ability_container = undefined;
                        } else {
                            let sprite_info = new SpriteInfo();
                            sprite_info.atlas = 'fx';
                            sprite_info.name = 'fx';
                            sprite_info.anim = '_energy';
                            this.player.ability_container = this.spawnRegion(this.input_queue[0].mouse_game_pos,
                                {w:32,h:32},[client.game.triggers[2],client.game.triggers[5]],
                                {center:true,pixi_sprite:this.pixi.getNewAnimatedSprite(sprite_info,this.layer)}
                            );
                        }
                    } else if (this.player.ability = 'ricochet') {
                        if (this.player.ability_container !== undefined)
                            this.destroyRegion(this.player.ability_container);
                        this.player.ability_container = this.spawnRegion(this.input_queue[0].mouse_game_pos,
                            {w:32,h:3},[client.game.triggers[3]],
                            {center:true,pixi_sprite:'generate'}
                        );
                    }
                    this.player.released_mouse2 = false;
                }
            } else {
                this.player.released_mouse2 = true;
            }

            // Move spawn point
            if (this.input_queue[0].q === true) {
                if (this.player.released_q === true) {
                    this.player.spawn.box.setCenter(this.player.box.getCenterX(),this.player.box.y)
                }
                this.player.released_q = false;
            } else {
                this.player.released_q = true;
            }

            // Switch weapon
            if (this.input_queue[0].r === true) {
                if (this.player.released_r === true) {
                    this.switchEntityWeapon(this.player);
                }
                this.player.released_r = false;
            } else {
                this.player.released_r = true;
            }

            // Interact
            if (this.input_queue[0].e === true) {
                if (this.player.released_e === true) {
                    this.player.interacting = true;
                    if (this.player.text_box !== undefined) {
                        this.player.text_box_closed = true;
                        this.closeTextBox();
                    } else {
                        this.player.text_box_closed = false;
                    }
                }
                this.player.released_e = false;
            } else {
                this.player.interacting = false;
                this.player.released_e = true;
            }

            // Teleport / Drag player
            if (this.input_queue[0].g === true) {
                if (this.input_queue[0].mouse_game_pos !== undefined &&
                    this.input_queue[0].mouseLeft === true) {
                    this.player.box.setCenter(this.input_queue[0].mouse_game_pos.x,
                        this.input_queue[0].mouse_game_pos.y);
                }
            }

            // Spawn platform
            if (this.input_queue[0].shift === true) {
                if (this.player.released_shift === true) {
                    if (this.player.boots.id === 'boots_03') {
                        if (this.player.spawned_platform !== null) 
                            this.destroyPlatform(this.player.spawned_platform);
                        this.player.spawned_platform = this.spawnPlatform(this.player.box.x,this.player.box.getBottom(),this.player.box.vx);
                    }
                }
                this.player.released_shift = false;
            } else {
                this.player.released_shift = true;
            }

            this.input_queue.shift();
        }
    }

    // Main update function
    update () {    
        // Update spawns
        this.updateSpawns();

        // Update dynamic platforms
        this.updateDynamicPlatforms();

        // Set start_collision triggers to false to know if they are no longer occuring
        this.primeTriggerEndCollision(this.entities,this.bullets);

        // Process input
        this.processInput();
        
        // Update enemy AI
        this.updateEntityAI();

        // Reinsert dynamic game objects into grid
        this.grid.clear('dynamic');
        this.grid.insertGameObjects('dynamic',this.entities,this.bullets,this.explosions,this.dynamic_platforms);

        // Update entities' states and weapon cooldowns
        this.updateEntityCooldowns();

        // Update Dynamic Game Object X positions
        this.updateObjectXPositions();

        // Check collision between entities and Game Objects in the static grid
        this.collisionCheckEntities('grid',this.entities,'static');

        // Update Dynamic Game Object Y positions
        this.updateObjectYPositions();

        // Destroy Dynamic Game Objects which have left the game world bounds
        this.destroyOutOfBounds();

        // Check collision between entities and Game Objects in the static grid
        this.collisionCheckEntities('grid',this.entities,'static');

        // Check collision between bullets and colliders in the static grid
        this.collisionCheckBullets('grid');

        // Check collision between entities and Game Objects in the dynamic grid
        this.collisionCheckEntities('grid',this.entities,'dynamic');
        this.explosions = [];   // Clear explosions

        // Check that start_collision triggers are no longer occuring and issue end_collision events
        this.checkTriggerEndCollision(this.entities,this.bullets);

        // Update sprite animations/positions
        this.updateAnimations();
    }

    // ------------------------------------------------------------------
    // Trigger Functions
    // ------------------------------------------------------------------

    addTriggerToGroup (trigger,group) {
        for (let i = 0; i < group.length; i++) {
            let obj = group[i];
            
            if (obj.triggers === undefined)
                obj.triggers = [];

            // Add trigger if it does not already exist
            if (obj.triggers.indexOf(trigger) === -1)
                obj.triggers.push(trigger);
        }
    }

    checkTriggerConditions (trigger,...args) {
        for (let i = 0; i < trigger.conditions.length; i++) {
            let condition = trigger.conditions[i];  
            switch (condition) {
                case 'interact' : {
                    let entity = args[0];
                    if (entity.interacting !== true)
                        return false;
                    break;
                }
            }
        }
        return true;
    }

    checkTriggerEndCollision (...args) {
        for (let i = 0; i < args.length; i++) {
            let group = args[i];
            for (let j = 0; j < group.length; j++) {
                let obj = group[j];
                if (obj.collisions === undefined)
                    continue;

                let map = obj.collisions;
                map.forEach((val,key,map)=>{
                    if (val === false) {
                        // end_collision event occured
                        for (let i = 0; i < key.triggers.length; i ++) {
                            let trigger = key.triggers[i];
                            if (trigger.events.indexOf('end_collision') !== -1) {
                                for (let j = 0; j < trigger.actions.length; j++) {
                                    let action = trigger.actions[j];
                                    this.triggerAction(action,obj,key);
                                }
                            }
                        }
                        map.delete(key);
                    }
                })
                if (map.size === 0)
                    delete obj.collisions;
            }
        }
    }

    getObjectsWithTag (group,tag) {
        let selection = [];
        for (let i = 0; i < group.length; i++) {
            if (group[i].tags.indexOf(tag) !== -1)
                selection.push(group[i]);
        }
        return selection;
    }

    handleTriggers (entity,game_object) {
        if (game_object.triggers !== undefined) {
            for (let i = 0; i < game_object.triggers.length; i++) {
                let trigger = game_object.triggers[i];
                for (let j = 0; j < trigger.events.length; j++) {
                    if (trigger.events[j] === 'start_collision') {
                        // Store collision information to know when collision is no longer occuring
                        this.storeStartCollisionTrigger(entity,game_object);
                        for (let k = 0; k < trigger.actions.length; k++) {
                            let check_conditions = this.checkTriggerConditions(trigger,entity,game_object);
                            if (check_conditions === true)
                                this.triggerAction(trigger.actions[k],entity,game_object);
                        }
                    }
                }
            }
        }
    }

    initializeTriggers () {
        this.triggers = this.layer.triggers;
        for (let i = 0; i < this.triggers.length; i++) {
            let trigger = this.triggers[i];

            let group = null;
            switch (trigger.attach_targets.group) {
                case 'regions' : {
                    group = this.regions;
                    break;
                }
                case 'doodads' : {
                    group = this.doodads;
                    break;
                }
            }

            let selection = this.getObjectsWithTag(group,trigger.attach_targets.tag);

            this.addTriggerToGroup(trigger,selection);
        }
    }

    primeTriggerEndCollision (...args) {
        for (let i = 0; i < args.length; i++) {
            let group = args[i];
            for (let j = 0; j < group.length; j++) {
                let obj = group[j];
                if (obj.collisions !== undefined) {
                    this.setMapAll(obj.collisions,false);
                }
            }
        }
    }

    setMapAll (map,value) {
        map.forEach((val,key,map)=>{
            map.set(key,value);
        })
    }

    storeStartCollisionTrigger (obj_1,obj_2) {
        if (obj_1.collisions === undefined)
            obj_1.collisions = new Map();
        obj_1.collisions.set(obj_2,true);
    }

    triggerAction (action,...args) {
        switch (action) {
            case 'damage' : {
                let entity = args[0],
                    game_object = args[1];

                if (entity.cd_damage_boost_count > entity.cd_damage_boost) {
                    if (entity.box.vy !== 0)
                        entity.actionEntityKnockback(game_object.box,2);
                    entity.current_health -= 2;
                    if (entity.current_health < 1) {
                        let store = (entity.ai === false) ? true : false;
                        this.destroyEntity(entity,store);
                    }
                    entity.cd_damage_boost_count = -5;
                    if (entity === this.player)
                        this.update_ui = true;
                }
                break;
            }
            case 'death' : {
                let store = (entity.ai === false) ? true : false;
                this.destroyEntity(entity,store);
                break;
            }
            case 'spawn_text_box' : {
                let entity = args[0],
                    game_object = args[1];
                entity.interacting = false;
                if (this.player.text_box === undefined && this.player.text_box_closed !== true) {
                    let message = '';
                    for (let i = 0; i < game_object.tags.length; i++) {
                        let tag_arr = game_object.tags[i].split('_');
                        if (tag_arr[0] === 'msg')
                            message = this.layer.messages[game_object.tags[i]];
                    }
                    this.player.text_box = this.pixi.getNewTextBox(message,game_object.box.getCenter());
                } 
                else
                    this.closeTextBox();
                this.player.text_box_closed = false;
                break;
            }
            case 'close_text_box' : {
                this.closeTextBox();
                break;
            }
            case 'reduce_velocity' : {
                let obj_1 = args[0];
                if (obj_1.reduction === undefined) {
                    obj_1.reduction = {
                        accel:{x:obj_1.accel_x,y:obj_1.accel_y,jump:obj_1.accel_jump},
                        velocity:{x:obj_1.box.vx,y:obj_1.box.vy},
                        gravity:this.gravity/3
                    }
                    obj_1.accel_x /= 3;
                    obj_1.accel_y /= 3;
                    obj_1.accel_jump /= 3;
                    obj_1.box.vx /= 3;
                    obj_1.box.vy /= 3;
                }
                break;
            }
            case 'reset_velocity' : {
                let obj_1 = args[0];
                if (obj_1.reduction !== undefined) {
                    obj_1.accel_x = obj_1.reduction.accel.x;
                    obj_1.accel_y = obj_1.reduction.accel.y;
                    obj_1.accel_jump = obj_1.reduction.accel.jump;
                    if (obj_1 instanceof Bullet) {
                        obj_1.box.vx = obj_1.reduction.velocity.x;
                        obj_1.box.vy = obj_1.reduction.velocity.y;
                    }
                    delete obj_1.reduction;
                }
                break;
            }
            case 'ricochet' : {
                let obj_1 = args[0],
                    obj_2 = args[1];
                if (obj_1 instanceof Bullet) {
                    if (obj_1.box.vy > 0)
                        obj_1.box.setBottom(obj_2.box.y);
                    else
                        obj_1.box.setTop(obj_2.box.getBottom());
                    obj_1.box.vy = -obj_1.box.vy;

                }
            }
        }
    }

    // Make a trigger action
    closeTextBox () {
        if (this.player.text_box !== undefined) {
            this.player.text_box.destroy();
            this.player.text_box = undefined;
        }
    }

    // ------------------------------------------------------------------
    // Update Functions
    // ------------------------------------------------------------------

    updateObjectXPositions () {
        for (let i = 0; i < this.entities.length; i++) 
            this.entities[i].box.updateXPosition(this.friction);
        for (let i = 0; i < this.bullets.length; i++) 
            this.bullets[i].box.updateXPosition(1);
        for (let i = 0; i < this.dynamic_platforms.length; i++) 
            this.dynamic_platforms[i].box.updateXPosition(this.friction);
    }

    updateObjectYPositions () {
        for (let i = 0; i < this.entities.length; i++) {
            if (this.entities[i].flying === false) {
                let gravity = this.gravity;
                if (this.entities[i].reduction !== undefined)
                    gravity = this.entities[i].reduction.gravity;
                this.entities[i].box.updateYPosition(gravity);
            }
            else
                this.entities[i].box.updateYPosition(0,this.friction);
        }
        for (let i = 0; i < this.bullets.length; i++)
            this.bullets[i].box.updateYPosition(0);
    }

    updateAnimations () {
        this.player_spawn.updateAnimation();

        for (let i = 0; i < this.bullets.length; i++)
            this.bullets[i].updateAnimation();
        
        for (let i = 0; i <  this.collectibles.length; i++)
            this.collectibles[i].updateAnimation();

        for (let i = 0; i <  this.dynamic_platforms.length; i++)
            this.dynamic_platforms[i].updateAnimation();
        
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            entity.updateAnimation();
            if (entity.sprite_info.prev_anim !== entity.sprite_info.anim) {
                entity.pixi_sprite.destroy();
                entity.pixi_sprite = this.pixi.getNewAnimatedSprite(entity,this.layer,entity.name);
                entity.updateAnimation();
            }
        }
    }

    updateDynamicPlatforms () {
        for (let i = 0; i < this.dynamic_platforms.length; i++) {
            this.dynamic_platforms[i].update();
        }
    }

    updateEntityAI () {
        for (let i = 0; i < this.entities.length; i++) {
            if (this.entities[i].ai === true)
                this.entities[i].updateState();
        }
    }

    updateEntityCooldowns () {
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            this.updateWeaponCooldowns(entity);
            entity.cd_damage_boost_count++;
        }
    }

    updateWeaponCooldowns (entity,cd_count=null) {
        for (let j = 0; j < entity.weapon_slots.length; j++) {
            if (cd_count === null)
                entity.weapon_slots[j].cd_attack_count++;
            else
                entity.weapon_slots[j].cd_attack_count = cd_count;
        }
    }

    updateSpawns () {
        for (let i = 0; i < this.spawns.length; i++) {
            let update_ui = this.spawns[i].update();
            if (update_ui === true)
                this.update_ui = true;
        }
    }

    // ------------------------------------------------------------------
    // Level Geometry Functions
    // ------------------------------------------------------------------

    buildRightFull (tile,i,j,new_tile,right_tile) {
        if (right_tile.edge_type === 5) {
            if (new_tile === null)
                new_tile = new Collider(new Box(tile.box.x,tile.box.y,tile.box.w*2,tile.box.h),5);
            else 
                new_tile.box.w += right_tile.box.w;
            this.collision_map[i][j] = null;
            this.checkRight(right_tile,i,j+1,new_tile);
            return new_tile;
        } else if (new_tile !== null) {
            this.colliders.push(new_tile);
            this.collision_map[i][j] = null;
            return null;
        } else {
            this.colliders.push(this.collision_map[i][j]);
            this.collision_map[i][j] = null;
            return null;
        }
    }

    buildRightFromHead (tile,i,j,new_tile,right_tile,num_1,num_2,num_3,num_4) {
        if (right_tile.edge_type === num_2) {
            if (new_tile === null)
                new_tile = new Collider(new Box(tile.box.x,tile.box.y,tile.box.w*2,tile.box.h),num_1);
             else 
                new_tile.box.w += right_tile.box.w;
            this.collision_map[i][j] = null;
            this.checkRight(right_tile,i,j+1,new_tile);
            return new_tile;
        } else if (right_tile.edge_type === num_3) {
            new_tile = new Collider(new Box(tile.box.x,tile.box.y,tile.box.w*2,tile.box.h),num_4);
            this.collision_map[i][j] = null;
            this.checkRight(right_tile,i,j+1,new_tile);
            return new_tile;
        } else if (new_tile !== null) {
            this.colliders.push(new_tile);
            this.collision_map[i][j] = null;
            return null;
        } else {
            this.colliders.push(this.collision_map[i][j]);
            this.collision_map[i][j] = null;
            return null;
        }
    }

    buildRightFromMiddle (tile,i,j,new_tile,right_tile,num_1,num_2,num_3,num_4) {
        if (right_tile.edge_type === num_2) {
            if (new_tile === null)
                new_tile = new Collider(new Box(tile.box.x,tile.box.y,tile.box.w*2,tile.box.h),num_2);
            else 
                new_tile.box.w += right_tile.box.w;
            this.collision_map[i][j] = null;
            this.checkRight(right_tile,i,j+1,new_tile);
            return new_tile;
        } else if (right_tile.edge_type === num_3) {
            if (new_tile === null) {
                new_tile = new Collider(new Box(tile.box.x,tile.box.y,tile.box.w*2,tile.box.h),num_3);
            } else {
                new_tile.box.w += right_tile.box.w;
                if (new_tile.edge_type === num_2)
                    new_tile.edge_type = num_3;
                else if (new_tile.edge_type === num_1)
                    new_tile.edge_type = num_4;
                new_tile.initializeEdges();
            }
            this.collision_map[i][j] = null;
            this.checkRight(right_tile,i,j+1,new_tile);
            return new_tile;
        }
        else if (new_tile !== null) {
            this.colliders.push(new_tile);
            this.collision_map[i][j] = null;
            return null;
        } else {
            this.colliders.push(this.collision_map[i][j]);
            this.collision_map[i][j] = null;
            return null;
        }
    }

    // Combine tiles left to right
    checkRight (tile,i,j,new_tile=null) {
        let right_tile = (this.collision_map[i].length - 1 > j) ? this.collision_map[i][j+1] : null;
        if (right_tile !== null) {
            switch (tile.edge_type) {
                case 5 : {
                    new_tile = this.buildRightFull(tile,i,j,new_tile,right_tile);
                    break;
                }
                case 3: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right_tile,3,13,11,5);
                    break;
                }
                case 13: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right_tile,3,13,11,5);
                    break;
                }
                case 4: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right_tile,4,14,12,6);
                    break;
                }
                case 14: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right_tile,4,14,12,6);
                    break;
                }
                case 1: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right_tile,1,15,9,7);
                    break;
                }
                case 15: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right_tile,1,15,9,7);
                    break;
                }
                default : {
                    this.colliders.push(this.collision_map[i][j]);
                    this.collision_map[i][j] = null;
                    return null;
                }
            }
        } else if (new_tile !== null) {
            this.colliders.push(new_tile);
            this.collision_map[i][j] = null;
        } else {
            this.colliders.push(this.collision_map[i][j]);
            this.collision_map[i][j] = null;
            return null;
        }
    }

    loadLevelGeometry (collision_map) {
        while (collision_map.length > 0)
            this.collision_map.push(collision_map.splice(0,this.columns));

        // Fill a 2d array with colliders so facilitate level geometry optimization
        for (let i = 0; i < this.collision_map.length; i++) {
            for (let j = 0; j < this.collision_map[i].length; j++) {
                if (this.collision_map[i][j] === 0)
                    this.collision_map[i][j] = null;
                else {
                    this.collision_map[i][j] = new Collider(
                        new Box(j*this.tile_size,i*this.tile_size,this.tile_size,this.tile_size),
                        this.collision_map[i][j]);
                }
            }
        }

        this.optimizeLevelGeometry();
    }

    // Combine colliders to reduce the amount of collision checks
    optimizeLevelGeometry () {
        for (let i = 0; i < this.collision_map.length; i++) {
            for (let j = 0; j < this.collision_map[i].length; j++) {
                let tile = this.collision_map[i][j];
                if (tile === null)
                    continue;
                else {
                    this.checkRight(tile,i,j);
                }
            }
        }
        this.collision_map = null;
    }

    // ------------------------------------------------------------------
    // Collision Check / Handler Functions
    // ------------------------------------------------------------------

    collisionCheckBullets (broad_phase_type) {
        // Broad Phase : Spatial Grid
        if (broad_phase_type === 'grid') {
            for (let i = 0; i < this.bullets.length; i++) {
                let bullet = this.bullets[i];
                let candidates = this.grid.getCollisionCandidates('static',bullet);
                let visited_candidates = new Map();
                for (let j = 0; j < candidates.length; j++) {
                    let candidate = candidates[j];
                    if (visited_candidates.get(candidate) === undefined) {
                        // Narrow Phase : AABB
                        let collided = bullet.box.checkCollision(candidate);
                        if (collided === true) {
                            if (candidate instanceof Collider) {
                                let destroyed = this.handleCollisionCollider(bullet,candidate);
                                if (destroyed === true)
                                    break;
                            }
                            else if (candidate instanceof Region) {
                                this.handleCollisionRegion(bullet,candidate);
                            }
                        }
                    }
                    visited_candidates.set(candidate,true);
                }
            }
        }
    }

    collisionCheckEntities (broad_phase_type,entity_group,...args) {
        // Broad Phase : Spatial Grid
        if (broad_phase_type === 'grid') {
            loop_1:
            for (let i = 0; i < entity_group.length; i++) {
                let ent = entity_group[i];
                let candidates = this.grid.getCollisionCandidates(args[0],ent);
                let visited_candidates = new Map();
                let checked_entities = new Map();
                loop_2:
                for (let j = 0; j < candidates.length; j++) {
                    let candidate = candidates[j];
                    if (visited_candidates.get(candidate) === undefined) {
                        // Narrow Phase : AABB
                        let collided = ent.box.checkCollision(candidate);
                        if (collided === true) {
                            if (args[0] === 'static') {
                                if (candidate instanceof Collider) {
                                    this.handleCollisionCollider(ent,candidate);
                                } else if (candidate instanceof Collectible) {
                                    this.handleCollisionCollectible(ent,candidate);
                                } else if (candidate instanceof Doodad) {
                                    this.handleCollisionDoodad(ent,candidate);
                                } else if (candidate instanceof Platform) {
                                    this.handleCollisionPlatform(ent,candidate);
                                } else if (candidate instanceof Region) {
                                    this.handleCollisionRegion(ent,candidate);
                                }
                            } else if (args[0] === 'dynamic') {
                                if (candidate instanceof Bullet) {
                                    let entity_destroyed = this.handleCollisionBullet(ent,candidate);
                                    if (entity_destroyed === true)
                                        break loop_2;
                                } else if (candidate instanceof Entity) {
                                    if (checked_entities.get(candidate) === undefined) 
                                        this.handleCollisionEntity(ent,candidate);
                                } else if (candidate instanceof Explosion) {
                                    ent.actionRadialKnockback(candidate);
                                } else if (candidate instanceof Platform) {
                                    this.handleCollisionPlatform(ent,candidate);
                                }
                            }
                        }
                    }
                    visited_candidates.set(candidate,true);
                }
                checked_entities.set(ent,true)
            }
        }
    }

    handleCollisionBullet (entity,bullet) {
        if (entity.faction.hostiles.indexOf(bullet.faction) !== -1) {
            if (entity.cd_damage_boost_count > entity.cd_damage_boost) {
                let entity_destroyed = false;

                entity.current_health -= bullet.damage;
                entity.cd_damage_boost_count = 0;
                entity.actionKnockback(bullet);

                if (entity.current_health < 1) {
                    let store = (entity.ai === false) ? true : false;
                    this.destroyEntity(entity,store);
                    entity_destroyed = true;
                }

                if (bullet.pierces === false)
                    this.destroyBullet(bullet);
                
                if (entity === this.player)
                    this.update_ui = true;

                return entity_destroyed;
            }
        }
    }

    handleCollisionCollectible (entity,collectible) {
        switch (collectible.type) {
            case 'boots' : {
                this.giveEntityBoots(entity,collectible.item_type);
                break;
            }
            case 'heart' : {
                this.giveEntityMaxHealth(entity);
                break;
            }
            case 'weapon' : {
                this.giveEntityWeapon(entity,collectible.weapon_type);
                break;
            }
        }
        if (collectible.permanent === false) {
            this.destroyCollectible(collectible);
        }
    }

    handleCollisionCollider (game_object,collider) {
        if (game_object instanceof Entity) {
            let entity = game_object;
            let landed = entity.box.collisionResponseAABB(collider);
            if (landed === true) {
                entity.jumping = false;
                entity.jump_dampened = false;
            }
        } else if (game_object instanceof Bullet) {
            this.destroyBullet(game_object);
            return true;
        }
    }

    handleCollisionDoodad (entity,doodad) {
        this.handleTriggers(entity,doodad);
    }

    handleCollisionEntity (ent_1,ent_2) {
        // Creep collision
        if (ent_1.faction !== this.creeps && ent_2.faction === this.creeps) {
            // Check for bouncejump
            let bounce_jump = false;
            if (ent_1.boots.bounce === true) {
                bounce_jump = ent_1.actionBounceJump(ent_2);
                if (bounce_jump === true) {
                    if (ent_1.boots.damage > 0) {
                        ent_2.current_health -= ent_1.boots.damage;
                        if (ent_2.current_health < 1) {
                            this.destroyEntity(ent_2);
                        }
                    }
                }
            }
            // Dont damage/knockback during invicibility frames or a bounce jump
            if (bounce_jump !== true) {
                if (ent_1.cd_damage_boost_count > ent_1.cd_damage_boost) {
                    ent_1.actionEntityKnockback(ent_2.box,ent_2.contact_knockback);
                    ent_1.current_health -= ent_2.contact_damage;
                    if (ent_1.current_health < 1) {
                        this.destroyEntity(ent_1,true);
                    }
                    ent_1.cd_damage_boost_count = -5;
                    if (ent_1 === this.player)
                        this.update_ui = true;
                }
            }
        }
    }

    handleCollisionPlatform (entity,platform) {
        if (platform.type === 'static') {
            if (entity.disable_platforms === false) {
                let landed = entity.box.resolvePlatformCollision(platform);
                if (landed === true) {
                    entity.jumping = false;
                    entity.jump_dampened = false;
                }
            }
        } else if (platform.type === 'dynamic') {
            if (entity.disable_platforms === false) {
                let landed = entity.box.resolvePlatformCollision(platform);
                entity.box.x += platform.box.vx;
                if (landed === true) {
                    entity.jumping = false;
                    entity.jump_dampened = false;
                }
                this.collisionCheckEntities('grid',[entity],'static');
            }
        }
    }

    handleCollisionRegion (entity,region) {
        this.handleTriggers(entity,region);
    }

    // ------------------------------------------------------------------
    // Give X to Y Functions
    // ------------------------------------------------------------------

    giveEntityBoots (entity,item_type) {
        entity.boots = new Boots(item_type);
    }

    giveEntityMaxHealth (entity) {
        entity.max_health++;
        if (entity.current_health < entity.max_health) {
            entity.current_health = entity.max_health;
            if (this.player === entity)
                this.update_ui = true;
        }
    }

    giveEntityWeapon (entity,weapon_id,replace_index=null) {
        for (let i = 0; i < entity.weapon_slots.length; i++) {
            if (entity.weapon_slots[i].id === weapon_id)
                return;
        }

        let weapon = new Weapon(weapon_id);

        // Replace weapons of same type
        for (let i = 0; i < entity.weapon_slots.length; i++) {
            if (entity.weapon_slots[i].type === weapon.type)
                replace_index = i;
        }

        // Give it to player
        if (entity.max_weapon_slots > entity.weapon_slots.length) {
            if (replace_index === null)
                entity.weapon_slots.push(weapon);
            else
                entity.weapon_slots[replace_index] = weapon;
        } else {
            if (replace_index === null)
                entity.weapon_slots[0] = weapon;
            else
                entity.weapon_slots[replace_index] = weapon;
        }

        // Add weapon's ability to player
        if (entity.weapon_slots[0].type === 'staff')
            entity.ability = 'impulse';
        else if (entity.weapon_slots[0].type === 'sword')
            entity.ability = 'slow_field';
        else if (entity.weapon_slots[0].type === 'star')
            entity.ability = 'ricochet';
        else
            entity.ability = null;

        if (entity === this.player)
            this.update_ui = true;
    }

    switchEntityWeapon (entity) {
        if (entity.weapon_slots.length > 1) {
            let tmp = entity.weapon_slots.shift();
            entity.weapon_slots.push(tmp);

            if (this.player.ability_container !== undefined) {
                this.destroyRegion(this.player.ability_container);
                this.player.ability_container = undefined;
            }

            if (entity.weapon_slots[0].type === 'staff')
                entity.ability = 'impulse';
            else if (entity.weapon_slots[0].type === 'sword')
                entity.ability = 'slow_field';
            else if (entity.weapon_slots[0].type === 'star')
                entity.ability = 'ricochet';
            else
                entity.ability = null;
            this.updateWeaponCooldowns(entity,entity.weapon_slots[0].cd_attack/2);
            this.update_ui = true;
        }
    }

    // ------------------------------------------------------------------
    // Add / Spawn / Destroy Functions
    // ------------------------------------------------------------------
    
    addNewPlayer (player_spawn,faction,entity_type,local_player=false,name) {
        let entity = new Entity(player_spawn.box.x,player_spawn.box.y,'right',name);
        entity.setEntityType(entity_type);
        entity.pixi_sprite = this.pixi.getNewAnimatedSprite(entity,this.layer,name);
        entity.spawn = player_spawn;

        if (local_player === true) {
            this.player = entity;
            this.giveEntityWeapon(entity,this.pixi.resources['settings'].data['weapon_id']);
        }
        
        this.entities.push(entity);
        faction.addMembers([entity]);

        this.storeEntity(entity,player_spawn,0);
    }

    destroyBullet (bullet) {
        if (bullet !== null) {
            if (bullet.pixi_sprite._destroyed === false)
                bullet.pixi_sprite.destroy();
            this.grid.remove('dynamic',bullet);
            this.bullets.splice(this.bullets.indexOf(bullet),1);
            bullet.faction.bullets.splice(bullet.faction.bullets.indexOf(bullet),1);
        }
    }

    destroyCollectible (collectible) {
        if (collectible !== null) {
            if (collectible.pixi_sprite._destroyed === false)
                collectible.pixi_sprite.destroy();
            this.grid.remove('static',collectible);
            this.collectibles.splice(this.collectibles.indexOf(collectible),1);
            this.spawnFX('sprites','fx_item',collectible.box.getCenter());
        }
    }

    destroyEntity (entity,store=false) {
        if (store === true){
            this.storeEntity(entity,entity.spawn);
        } else {
            if (entity.pixi_sprite._destroyed === false)
                entity.pixi_sprite.destroy();
            this.grid.remove('dynamic',entity);
            this.entities.splice(this.entities.indexOf(entity),1);
            if (entity.faction !== null)
                entity.faction.removeMembers(entity);
            if (entity.spawner !== undefined) {
                entity.spawner.object_concurrent_count--;
                entity.spawner.cd_spawn_rate_count = 0;
            }
        }
        this.spawnFX('sprites','fx_death',entity.box.getCenter());
    }

    destroyPlatform (platform) {
        platform.pixi_sprite.destroy();
        this.grid.remove('static',platform);
        this.static_platforms.splice(this.static_platforms.indexOf(platform),1);
    }

    destroyPlayer (entity_name) {
        let entity = this.entities.find(obj => obj.name === entity_name);
        this.destroyEntity(entity,false);
    }

    destroyRegion (region) {
        if (region.pixi_sprite !== undefined && region.pixi_sprite._destroyed === false)
            region.pixi_sprite.destroy();
        this.grid.remove('static',region);
        this.regions.splice(this.regions.indexOf(region),1);
    }

    spawnBullet (faction,pos,dir,angle,weapon) {
        let bullet = new Bullet(pos,dir,angle,weapon);
        bullet.pixi_sprite = this.pixi.getNewSprite(weapon.getSpriteData(),bullet.box,this.layer,{anchor:0.5})
        this.bullets.push(bullet);
        faction.addBullets(bullet);
    }

    spawnExplosion (pos,dim,force) {
        let explosion = new Explosion(new Box(pos.x,pos.y,dim.w,dim.h),force);
        this.spawnFX('fx','fx_impulse',explosion.box.getCenter());
        this.explosions.push(explosion);
    }

    spawnFX (atlas,type_id,pos) {
        let sprite_info = new SpriteInfo();
        let id_arr = type_id.split('_');

        sprite_info.atlas = atlas;
        sprite_info.name = id_arr[0];
        sprite_info.anim = '_' + id_arr[1];

        let fx = this.pixi.getNewAnimatedSprite(sprite_info,this.layer);
        fx.base_sprite.loop = false;
        fx.base_sprite.anchor.set(0.5,0.5);
        fx.position.set(pos.x,pos.y);
       
        fx.base_sprite.onComplete = fx.destroy;
    }

    spawnPlatform (x,y,vx=null) {
        // Shift x value a litle bit so entity doesnt fall off
        if (vx !== null)
            x += 3 * vx;
        let platform = new Platform('aa','s',{x:x,y:y},16);
        platform.pixi_sprite = this.pixi.getNewSprite(platform.getSpriteData(),platform.box,this.layer);
        
        this.static_platforms.push(platform);
        this.grid.insert('static',platform);
        return platform;
    }

    spawnRegion (pos,dim,triggers,options) {
        let region = new Region(new Box(pos.x,pos.y,dim.w,dim.h),[]);

        if (options.center !== undefined && options.center === true)
            region.box.setCenter(pos.x,pos.y);
        if (options.has_outline !== undefined && options.has_outline !== null)
            region.pixi_sprite = this.pixi.getNewBoxGraphics(region.box,this.layer,options.has_outline);
        else if (options.pixi_sprite !== undefined) {
            if (options.pixi_sprite === 'generate')
                region.pixi_sprite = this.pixi.getNewSprite({atlas:'props',texture:'platform_03'},region.box,this.layer);
            else {
                region.pixi_sprite = options.pixi_sprite;
                region.pixi_sprite.position.set(region.box.getCenterX(),region.box.getCenterY());
            }
        }
        this.regions.push(region);
        this.grid.insert('static',region);

        for (let i = 0; i < triggers.length; i++) {
            let trigger = triggers[i];
            this.addTriggerToGroup(trigger,[region]);
        }
        

        return region;
    }
    
    storeEntity (entity,player_spawn,respawn_rate) {
        entity.dead = true;
        entity.pixi_sprite.visible = false;
        player_spawn.storeEntity(entity,respawn_rate);
        this.grid.remove('dynamic',entity);
        this.entities.splice(this.entities.indexOf(entity),1);
    }

    // ------------------------------------------------------------------
    // Other Functions
    // ------------------------------------------------------------------

    checkOutOfBounds (game_object) {
        let buffer = 0;
        if (game_object.box.getRight() < (this.x-buffer) || game_object.box.x > (this.w+buffer) ||
            game_object.box.getBottom() < (this.y-buffer) || game_object.box.y > (this.h+buffer)) {
            return true;
        }
        return false;
    }

    destroyOutOfBounds () {
        for (let i = 0; i < this.entities.length; i++) {
            if (this.checkOutOfBounds(this.entities[i]) === true) {
                let store = (this.entities[i].ai === false) ? true : false;
                this.destroyEntity(this.entities[i],store);
            }
        }
        for (let i = 0; i < this.bullets.length; i++) {
            if (this.checkOutOfBounds(this.bullets[i]) === true)
                this.destroyBullet(this.bullets[i]);
        }
    }
}

// ------------------------------------------------------------------
// Math Functions
// ------------------------------------------------------------------

const getDirectionVector = function(p1,p2) {
    let dx = p2.x-p1.x,
        dy = p2.y-p1.y;
    let magnitude = Math.sqrt(dx * dx + dy * dy);
    dx /= magnitude;
    dy /= magnitude;
    return {x:dx,y:dy,mag:magnitude};
}

const getAngle = function(p1,p2) {
    let dx = p2.x-p1.x,
        dy = p2.y-p1.y;
    let theta = Math.atan2(-dy,-dx);
    theta *= 180 / Math.PI;           
    if (theta < 0) 
        theta += 360;
    return theta;
}

const getRandomColor = function(format='0x') {
    let nums = '0123456789ABCDEF';
    let color = format;
    for (let i = 0; i < 6; i++)
        color += nums[Math.floor(Math.random() * 16)];
    return color;
}

const lerp = function(start,end,percent) {
    return ((1-percent)*start)+(percent*end);
}

if ('undefined' !== typeof global) {
    module.exports = {
        Game
    }
}