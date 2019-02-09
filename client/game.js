
const Game = function() {
   
    this.grid;
    this.update_ui = true;

    // Game Objects
    this.player;
    this.entities = [];
    this.bullets = [];
    this.explosions = [];
    this.collectibles = [];
    this.spawns = [];
    

    this.tile_sets = {};

    this.input_queue = [];
    
    this.deactivated_platforms = [];

    this.friction;
    this.gravity;

    this.rows;
    this.columns;
    this.tile_size;
    this.x = 0;
    this.y = 0;
    this.w;
    this.h;

    this.collision_map;
};

Game.prototype = {
    collisionCheck:function(player,type='grid') {
        // Grid 
        if (type === 'grid') {
            let candidates = this.grid.getCandidates(player.box);
            let visited = new Map();
            let collision_count = 0;

            for (var i = 0; i < candidates.length; i++) {
                let obj = candidates[i];
                if (visited.get(obj) === undefined) {
                    // Narrow Phase AABB Collision
                    let collided = player.box.checkCollision(obj);
                    if (collided === true) {
                        collision_count++;
                        if (obj instanceof Collectible) {
                            this.handleCollisionCollectible(player,obj);
                        }
                        else if (obj instanceof Tile) {
                            // Platform response
                            if (obj.edge_type === 15) {
                                if (player.disable_platforms === true) {
                                    obj.collidable = false;
                                    this.deactivated_platforms.push(obj);
                                } 
                            }
                            // Normal tile response
                            let ret_val = player.box.collisionResponseAABB(obj);
                            if (ret_val === true) {
                                player.jumping = false;
                                player.jump_dampened = false;
                            }
                        }
                    }
                } 
                visited.set(candidates[i],true);
            }
        } 
        // Brute Force - O(n^2)
        else if (type === 'brute') {  
            for (let i = 0; i < this.collision_map.length; i++) {
                for (let j = 0; j < this.collision_map[i].length; j++) {
                    if (this.collision_map[i][j] !== null) {
                        // Narrow Phase AABB Collision
                        let collided = player.box.checkCollision(this.collision_map[i][j]);
                        if (collided === true) {
                            player.box.collisionResponseAABB(this.collision_map[i][j]);
                        }
                    }
                }
            }
        }
    },
    giveEntityBoots:function(entity,item_type) {
        if (item_type === 'boots_01') {
            entity.boots.type = 'boots_01';
            entity.boots.bounce = true;
            entity.boots.damage = 0;
        }
        else if (item_type === 'boots_02') {
            entity.boots.type = 'boots_02';
            entity.boots.bounce = true;
            entity.boots.damage = 0.25;
        }
    },
    giveEntityDamage:function(entity,damage){

    },
    giveEntityMaxHealth:function(entity){
        if (entity.current_health < entity.max_health) {
            entity.current_health = entity.max_health;
            if (this.player === entity)
                this.update_ui = true;
        }
    },
    giveEntityWeapon:function(entity,weapon_id,replace_index=null){
        for (let i = 0; i < entity.weapon_slots.length; i++) {
            if (entity.weapon_slots[i].id === weapon_id)
                return;
        }

        // Create weapon
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

        if (entity.weapon_slots[0].type === 'staff')
            entity.ability = 'impulse';

        if (entity === this.player)
            this.update_ui = true;
    },
    handleCollisionCollectible:function(entity,collectible) {

        // Perform collectibles function
        if (collectible.type === 'weapon') {
            this.giveEntityWeapon(entity,collectible.weapon_type);
        }
        else if (collectible.type === 'heart') {
            this.giveEntityMaxHealth(entity);
        } else if (collectible.type === 'boots') {
            this.giveEntityBoots(entity,collectible.item_type);
        }

        // Destroy collectible if necessary
        if (collectible.permanent === false) {
            this.collectibles.splice(this.collectibles.indexOf(collectible),1);
            this.grid.remove(collectible);
        }
    },
    switchEntityWeapon:function(entity){
        if (entity.weapon_slots.length > 1) {
            let tmp = entity.weapon_slots.shift();
            entity.weapon_slots.push(tmp);
            if (entity.weapon_slots[0].type === 'staff')
                entity.ability = 'impulse';
            else
                entity.ability = null;
            this.update_ui = true;
        }
    },
    loadLevelData:function(pixi){
        this.pixi = pixi;

        // Hard coded
        let layer_data = this.pixi.current_level.layers[0];
        this.layer = layer_data;

        // Layer dimensions
        this.rows = layer_data.rows;
        this.columns = layer_data.columns;
        this.w = layer_data.w;
        this.h = layer_data.h;
        this.tile_size = layer_data.tile_size;
        
        // Collision data
        this.loadLevelGeometry(layer_data.collision_map);

        // Create factions
        this.team_1 = new Faction();
        this.creeps = new Faction();
        this.team_1.addHostileFactions(this.creeps);
        this.creeps.addHostileFactions(this.team_1);

        // Create entities
        this.player = new Entity(new PhysBox(20,55,13,15,0,0));
        // Hard coded
        this.player.sprite_atlas = 'sprites';this.player.sprite_name = 'fox';this.player.sprite_anim = '_idle';
        this.player.pixi_sprite = this.pixi.getNewAnimatedSprite(this.player,this.layer);
        this.giveEntityWeapon(this.player,this.pixi.resources['settings'].data.weapon_id);

        this.entities.push(this.player);
        this.team_1.addMembers(this.player);

        // Spawns
        for (let i = 0; i < layer_data.spawns.length; i++) {
            let data = layer_data.spawns[i];
            let spawn = new Spawn(data[0],data[1],data[2],data[3],data[4],data[5],
                this.pixi,this.layer,this.creeps,this.entities);
            spawn.initialize(1,200);
            this.spawns.push(spawn);
        }
        
        // Collectibles
        for (let i = 0; i < layer_data.collectibles.length; i++) {
            let data = layer_data.collectibles[i];
            let collectible = new Collectible(data[0],data[1],data[2],data[3],data[4]);
            collectible.pixi_sprite = this.pixi.getNewSprite(collectible.getSpriteData(),this.layer);
            this.collectibles.push(collectible);
        }

        // Initial insert of static objects into grid
        this.grid = new Grid(this.w,this.h,6,6);
        this.grid.insertTiles(this.collision_map,this.new_tiles);
        for (let i = 0; i < this.collectibles.length; i++) {
            this.grid.insert(this.collectibles[i]);
        }
    },
    loadLevelGeometry:function(collision_map){
        this.collision_map = [];
        while (collision_map.length > 0)
            this.collision_map.push(collision_map.splice(0,this.columns));

        for (let i = 0; i < this.collision_map.length; i++) {
            for (let j = 0; j < this.collision_map[i].length; j++) {
                if (this.collision_map[i][j] === 0)
                    this.collision_map[i][j] = null;
                else {
                    this.collision_map[i][j] = new Tile(j*this.tile_size,i*this.tile_size,
                        this.tile_size,this.tile_size,this.collision_map[i][j]);
                }
            }
        }
        this.optimizeLevelGeometry();
    },
    optimizeLevelGeometry:function(){
        this.new_tiles = [];
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
    },
    buildRightFromHead:function(tile,i,j,new_tile,right,num_1,num_2,num_3,num_4) {
        if (right.edge_type === num_2) {
            if (new_tile === null)
                new_tile = new Tile(tile.x,tile.y,tile.w*2,tile.h,num_1);
             else 
                new_tile.w += right.w;
            this.collision_map[i][j] = null;
            this.checkRight(right,i,j+1,new_tile);
            return new_tile;
        } else if (right.edge_type === num_3) {
            new_tile = new Tile(tile.x,tile.y,tile.w*2,tile.h,num_4);
            this.collision_map[i][j] = null;
            this.checkRight(right,i,j+1,new_tile);
            return new_tile;
        } else if (new_tile !== null) {
            this.new_tiles.push(new_tile);
            this.collision_map[i][j] = null;
            return null;
        }
    },
    buildRightFromMiddle:function(tile,i,j,new_tile,right,num_1,num_2,num_3,num_4) {
        if (right.edge_type === num_2) {
            if (new_tile === null)
                new_tile = new Tile(tile.x,tile.y,tile.w*2,tile.h,num_2);
            else 
                new_tile.w += right.w;
            this.collision_map[i][j] = null;
            this.checkRight(right,i,j+1,new_tile);
            return new_tile;
        } else if (right.edge_type === num_3) {
            if (new_tile === null) {
                new_tile = new Tile(tile.x,tile.y,tile.w*2,tile.h,num_3);
            } else {
                new_tile.w += right.w;
                if (new_tile.edge_type === num_2)
                    new_tile.edge_type = num_3;
                else if (new_tile.edge_type === num_1)
                    new_tile.edge_type = num_4;
                new_tile.initializeEdges();
            }
            this.collision_map[i][j] = null;
            this.checkRight(right,i,j+1,new_tile);
            return new_tile;
        }
        else if (new_tile !== null) {
            this.new_tiles.push(new_tile);
            this.collision_map[i][j] = null;
            return null;
        }
    },
    checkRight:function(tile,i,j,new_tile=null){
        let right = null;
        if (this.collision_map[i].length - 1 > j)
            right = this.collision_map[i][j+1];
        if (right !== null) {
            switch (tile.edge_type) {
                case 3: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right,3,13,11,5);
                    break;
                }
                case 13: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right,3,13,11,5);
                    break;
                }
                case 4: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right,4,14,12,6);
                    break;
                }
                case 14: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right,4,14,12,6);
                    break;
                }
                case 1: {
                    new_tile = this.buildRightFromHead(tile,i,j,new_tile,right,1,15,9,7);
                    break;
                }
                case 15: {
                    new_tile = this.buildRightFromMiddle(tile,i,j,new_tile,right,1,15,9,7);
                    break;
                }
            }
        } else if (new_tile !== null) {
            this.new_tiles.push(new_tile);
            this.collision_map[i][j] = null;
        }
    },
    spawnBullet:function(faction,pos,dir,angle,weapon){
        let bullet = new Bullet(pos,dir,angle,weapon);
        bullet.pixi_sprite = this.pixi.getNewSprite(weapon.getSpriteData(),this.layer)
        this.bullets.push(bullet);
        faction.addBullets(bullet);
    },
    spawnExplosion:function(pos) {
        let box = new Box(pos.x,pos.y,32,32);
        box.setCenterX(pos.x);
        box.setCenterY(pos.y);
        box.force = 15;
        this.explosions = [box];
    },
    processInput:function(){
        if (this.input_queue.length === 0) {
            this.player.released_jump = true;
            this.player.released_attack = true;
            this.player.released_mouse2 = true;
            this.player.dampenJump();
        }

        while (this.input_queue.length > 0) {
            if (this.input_queue[0].left === true)
                this.player.actionMoveLeft();
            if (this.input_queue[0].right === true)
                this.player.actionMoveRight();

            if (this.input_queue[0].up === true) {
                this.player.actionJump(this.input_queue[0].tick);
            } else {
                this.player.dampenJump();
                this.player.released_jump = true;
            }

            if (this.input_queue[0].down === true) {
                this.player.actionDropDown();
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

            if (this.input_queue[0].mouseRight === true) {
                if (this.player.released_mouse2 === true) {
                    if (this.player.ability === 'impulse')
                        this.spawnExplosion(this.input_queue[0].mouse_game_pos);
                    this.player.released_mouse2 = false;
                }
            } else {
                this.player.released_mouse2 = true;
            }

            // Switch weapon
            if (this.input_queue[0].e === true) {
                if (this.player.cd_switch_weapon_count > this.player.cd_switch_weapon) {
                    this.switchEntityWeapon(this.player);
                    this.player.cd_switch_weapon_count = 0;
                }
            }

            this.input_queue.shift();
        }
    },
    resetPlatforms:function(){
        for (let i = 0; i < this.deactivated_platforms.length;i++) {
            let tile = this.deactivated_platforms[i];
            if (this.player.box.checkCollision(tile) === false) {
                tile.collidable = true;
                this.deactivated_platforms.splice(this.deactivated_platforms.indexOf(tile),1);
            }
        }
    },
    destroyBullet:function(bullet) {
        bullet.pixi_sprite.destroy();
        this.bullets.splice(this.bullets.indexOf(bullet),1);
        bullet.faction.bullets.splice(bullet.faction.bullets.indexOf(bullet),1);
    },
    destroyEntity:function(entity) {
        entity.pixi_sprite.destroy();
        this.entities.splice(this.entities.indexOf(entity),1);
        if (entity.faction !== null)
            entity.faction.removeMembers(entity);
        if (entity.spawner !== undefined)
            entity.spawner.object_count--;
    },
    update:function(){
        // Reset platform variables if necessary
        this.resetPlatforms();

        // Update spawns
        for (let i = 0; i < this.spawns.length; i++) {
            this.spawns[i].update();
        }
        
        // Process input
        this.processInput();

        
        // Update enemy AI
        for (let i = 0; i < this.entities.length; i++) {
            if (this.entities[i].ai === true)
                this.entities[i].actionFSM();
        }

        // Update entities' states and weapon cooldowns
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            for (let j = 0; j < entity.weapon_slots.length; j++) {
                entity.weapon_slots[j].cd_attack_count++;
            }
            entity.cd_switch_weapon_count++;
            entity.cd_damage_boost_count++;
        }

        // Update entity x positions
        for (let i = 0; i < this.entities.length; i++) {
            this.entities[i].box.updatePositionX(0.85);
        }
        // Update bullet x positions
        for (let i = 0; i < this.bullets.length; i++) {
            let bullet = this.bullets[i];
            bullet.updatePositionX(1);
            // Destroy bullets that go beyond world bounds
            if (bullet.x > this.w || bullet.x < this.x ||
                bullet.y > this.h || bullet.x < this.y) {
                this.destroyBullet(bullet);
            }
        }

        // Broad phase collision checking of entities with grid objects
        for (let i = 0; i < this.entities.length; i++) {
            this.collisionCheck(this.entities[i],'grid')
        }

        // Update entity y positions
        for (let i = 0; i < this.entities.length; i++) {
            if (this.entities[i].flying === true) {
                this.entities[i].box.updatePositionY(0);
            }
            else
                this.entities[i].box.updatePositionY(2);
        }
        // Update bullet y positions
        for (let i = 0; i < this.bullets.length; i++) {
            let bullet = this.bullets[i];
            bullet.updatePositionY(0);
            // Destroy bullets that go beyond world bounds
            if (bullet.x > this.w || bullet.x < this.x ||
                bullet.y > this.h || bullet.x < this.y) {
                this.destroyBullet(bullet);
            }
        }

        // Broad phase collision checking of entities with grid objects
        for (let i = 0; i < this.entities.length; i++) {
            this.collisionCheck(this.entities[i],'grid')
        }

        // Entity/bullet collision check
        for (let i = 0; i < this.team_1.bullets.length; i++) {
            let bullet = this.team_1.bullets[i];
            for (let j = 0; j < this.team_1.hostiles.length; j++) {
                let faction = this.team_1.hostiles[j];
                for (let k = 0; k < faction.members.length; k++) {
                    let hostile = faction.members[k];
                    let collided = hostile.box.checkCollision(bullet);
                    if (collided === true) {
                        if (hostile.cd_damage_boost_count > hostile.cd_damage_boost) {
                            hostile.current_health -= bullet.damage;
                            console.log('Hostile health:',hostile.current_health);
                            hostile.actionKnockback(bullet);
                            if (hostile.current_health < 1)
                                this.destroyEntity(hostile);
                            if (bullet.pierces === false)
                                this.destroyBullet(bullet);
                            hostile.cd_damage_boost_count = 0;
                            if (hostile === this.player)
                                this.update_ui = true;
                        }
                    }
                }
            }
        }

        // Entity/explosion colision check
        for (let i = 0; i < this.explosions.length;i++) {
            let exp = this.explosions[i];
            for (let j = 0; j < this.entities.length; j++) {
                let ent = this.entities[j];
                let collided = ent.box.checkCollision(exp);
                if (collided === true) {
                    let exp_cent = exp.getCenter();
                    let ent_cent = ent.box.getCenter();
                    let dir = getDirectionVector(exp_cent,ent_cent);

                    // Find ratio of how close the center points are over their distance
                    let combined_width = exp.w / 2 + ent.box.w / 2;
                    let combined_height = exp.h / 2 + ent.box.h / 2;
                    let depth_x, depth_y;
                    if (ent_cent.x < exp_cent.x)
                        depth_x = exp_cent.x - ent_cent.x;
                    else if (ent_cent.x > exp_cent.x)
                        depth_x = ent_cent.x - exp_cent.x;

                    // Grav boost used to overcome gravity. Multipled by non-inverse y_ratio to improve
                    // effectiveness the further away the centers are
                    let grav_boost = 0; 
                    if (ent_cent.y < exp_cent.y) {
                        depth_y = exp_cent.y - ent_cent.y;
                        grav_boost = -7 * (depth_y/combined_height);
                    }
                    else if (ent_cent.y > exp_cent.y)
                        depth_y = ent_cent.y - exp_cent.y;

                    ent.box.vx = dir.x * exp.force * (1-(depth_x/combined_width));
                    ent.box.vy = dir.y * exp.force * (1-(depth_y/combined_height)) + grav_boost;

                    ent.jumping = true;
                    ent.jump_dampened = true;
                }
            }
            this.explosions = [];
        }

        // Entity/creep collision check
        for (let i = 0; i < this.team_1.members.length; i++) {
            let entity = this.team_1.members[i];
            for (let j = 0; j < this.creeps.members.length; j++) {
                let creep = this.creeps.members[j];
                let collided = entity.box.checkCollision(creep.box);
                if (collided === true) {
                    // Check for bouncejump
                    let bounce_jump = false;
                    if (entity.boots.bounce === true) {
                        bounce_jump = entity.actionBounceJump(creep);
                        if (entity.boots.damage > 0) {
                            creep.current_health -= entity.boots.damage;
                            console.log('Hostile health:',creep.current_health);
                            if (creep.current_health < 1)
                                this.destroyEntity(creep);
                        }
                    }
                    // Dont damage/knockback during invicibility frames or a bounce jump
                    if (bounce_jump !== true) {
                        if (entity.cd_damage_boost_count > entity.cd_damage_boost) {
                            entity.actionEntityKnockback(creep);
                            entity.current_health -= creep.contact_damage;
                            entity.cd_damage_boost_count = -5;
                            if (entity === this.player)
                                this.update_ui = true;
                        }
                    }
                }
                
            }
        }

        // Player should be able to collide with platforms after 1 loop
        this.player.disable_platforms = false;

        // Update position and anims of collectibles
        for (let i = 0; i <  this.collectibles.length; i++) {
            let collectible = this.collectibles[i];
            collectible.updateAnimation();
        }

        for (let i = 0; i < this.bullets.length; i++) {
            let bullet = this.bullets[i];
            bullet.updateAnimation();
        }

        // Update animations
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            entity.updateAnimation();
            if (entity.old_sprite_anim !== entity.sprite_anim) {
                entity.pixi_sprite.destroy();
                entity.pixi_sprite = this.pixi.getNewAnimatedSprite(entity,this.layer);
                entity.updateAnimation();
            }
        }
    }
}

class Grid {
    constructor(w,h,rows,columns) {
        this.w = w;
        this.h = h;
        this.rows = rows;
        this.columns = columns;
        this.cell_w = w / rows;
        this.cell_h = h / columns;

        this.cells = new Array(this.columns);
        for (let i = 0; i < this.columns; i++) {
            this.cells[i] = new Array(this.rows);
            for (let j = 0; j < this.rows; j++) {
                this.cells[i][j] = new Cell();
            }
        }
    }

    insert(obj) {
        let left = Math.floor(obj.getLeft() / this.cell_w),
            top = Math.floor(obj.getTop() / this.cell_h),
            right = Math.floor(obj.getRight() / this.cell_w),
            bottom = Math.floor(obj.getBottom() / this.cell_h);

        // Check for out of bounds
        if (right >= this.columns)
            right--;
        if (left < 0)
            left++; 
        if (bottom >= this.rows)
            bottom--;
        if (top < 0)
            top++;

        for (let i = top; i <= bottom; i++) {
            for (let j = left; j <= right; j++) {
                if(this.cells[i][j].objects.indexOf(obj) === -1) {
                    this.cells[i][j].objects.push(obj);
                }
            }
        }
    }

    remove(obj) {
        let left = Math.floor(obj.getLeft() / this.cell_w),
            top = Math.floor(obj.getTop() / this.cell_h),
            right = Math.floor(obj.getRight() / this.cell_w),
            bottom = Math.floor(obj.getBottom() / this.cell_h);

        // Check for out of bounds
        if (right >= this.columns)
            right--;
        if (left < 0)
            left++; 
        if (bottom >= this.rows)
            bottom--;
        if (top < 0)
            top++;         

        let obj_i = this.cells[top][left].objects.indexOf(obj);
        if(obj_i !== -1) {
            this.cells[top][left].objects.splice(obj_i,1);
            console.log('removing from top:',top,"left:",left);
        }
        obj_i = this.cells[top][right].objects.indexOf(obj);
        if(obj_i !== -1) {
            this.cells[top][right].objects.splice(obj_i,1);
            console.log('removing from top:',top,"right:",right);
        }
        obj_i = this.cells[bottom][left].objects.indexOf(obj);
        if(obj_i !== -1) {
            this.cells[bottom][left].objects.splice(obj_i,1);
            console.log('removing from bottom:',bottom,"left:",left);
        }
        obj_i = this.cells[bottom][right].objects.indexOf(obj);
        if(obj_i !== -1) {
            this.cells[bottom][right].objects.splice(obj_i,1);
            console.log(`removing from bottm:`,bottom,"right:",right);
        }
    }

    insertTiles(collision_map,tile_arr) {
        for (let i = 0; i < collision_map.length; i++){
            for (let j = 0; j < collision_map[i].length; j++){
                if (collision_map[i][j] !== null)
                    this.insert(collision_map[i][j]);
            }
        }

        for (let i = 0; i < tile_arr.length; i++){
            this.insert(tile_arr[i]);
            
        }
    }

    getCandidates(box) {
        let left = Math.floor(box.getLeft() / this.cell_w),
            top = Math.floor(box.getTop() / this.cell_h),
            right = Math.floor(box.getRight() / this.cell_w),
            bottom = Math.floor(box.getBottom() / this.cell_h);

        // Check for out of bounds
        if (right >= this.columns)
            right = this.columns - 1;
        else if (right < 0)
            right = 0;
        if (left >= this.columns)
            left = this.columns - 1;
        else if (left < 0)
            left = 0; 
        if (bottom >= this.rows )
            bottom = this.rows - 1;
        else if (bottom < 0)
            bottom = 0;
        if (top >= this.rows)
            top = this.rows - 1;
        else if (top < 0)
            top = 0; 


        let candidates = [];

        //console.log(box,this.cells[top][left])
        candidates = candidates.concat(this.cells[top][left].objects);
        candidates = candidates.concat(this.cells[top][right].objects);
        candidates = candidates.concat(this.cells[bottom][left].objects);
        candidates = candidates.concat(this.cells[bottom][right].objects);

        return candidates;
    }
}

class Cell {
    constructor() {
        this.objects = [];
    }
}

// Extra math functions

const getDirectionVector = function(p1,p2) {
    let dx = p2.x-p1.x;
    let dy = p2.y-p1.y;
    let magnitude = Math.sqrt(dx * dx + dy * dy);
    dx /= magnitude;
    dy /= magnitude;
    return {x:dx,y:dy,mag:magnitude};
}

const getAngle = function(p1,p2) {
    let dx = p2.x-p1.x;
    let dy = p2.y-p1.y;

    var theta = Math.atan2(-dy, -dx);
    theta *= 180 / Math.PI;           
    if (theta < 0) 
        theta += 360;      

    return theta;
}