// ------------------------------------------------------------------
// Game Objects all have physical locations in the game world
// ------------------------------------------------------------------

class Bullet {
    constructor (pos,dir,angle,weapon) {
        this.box = new PhysBox(pos.x,pos.y,
            weapon.bullet_w,weapon.bullet_h,
            dir.x*weapon.bullet_speed,dir.y*weapon.bullet_speed);

        this.pixi_sprite;
        this.sprite_angle = angle;
        this.sprite_rotates = weapon.bullet_rotates;

        // Bullet properties
        this.damage = weapon.bullet_damage;
        this.knockback = weapon.bullet_knockback;
        this.pierces = weapon.bullet_pierces;
    }

    updateAnimation () {
        // Update position
        this.pixi_sprite.position.set(this.box.x,this.box.y);

        // Update transform
        let sprite = this.pixi_sprite.base_sprite;
        if (this.sprite_rotates === true)
            sprite.angle += 5 * (Math.abs(this.box.vx)+Math.abs(this.box.vy));
        else {
            // Hard coded, items are all tilted -45
            sprite.angle = this.sprite_angle - 45;
        }
    }
}

class Collectible {
    constructor (id,box) {
        this.box = box;
        this.pixi_sprite;
        this.offset = null;         // Used in hover effect

        // Collectible properties
        this.id = id;
        this.type;
        this.weapon_type;
        this.permanent = false;

        this.initialize();
        this.addHover();
    }

    addHover () {
        let off_x = Math.random()*Math.PI*2;
        this.offset = {
            x:off_x,
            y:off_x*2
        };
    }

    getSpriteData () {
        let atlas,texture;
        switch (this.id[0]) {
            case 'a' :
                atlas = 'items';
                break;
            case 'b' :
                atlas = 'hearts';
                break;
        }
        if (this.type === 'weapon')
            texture = this.weapon_type;
        else if (this.type === 'heart')
            texture = 'heart_4';
        else if (this.type === 'boots')
            texture = this.item_type;
        return {atlas:atlas,texture:texture};
    }

    initialize () {    
        switch (this.id[1]) {
            case 'a' :
                this.type = 'weapon';
                break;
            case 'b' :
                this.type = 'heart';
                break;
            case 'c' :
                this.type = 'boots';
        }
        if (this.type === 'weapon') {
            let weapon_type, num;
            switch (this.id[2]) {
                case 'a' :
                    weapon_type = 'star';
                    break;
                case 'b' :
                    weapon_type = 'sword';
                    break;
                case 'c' :
                    weapon_type = 'staff';
                    break;
            }
            switch(this.id[3]) {
                case 'a' : {
                    num = '01';
                    break;
                }
                case 'b' : {
                    num = '02';
                    break;
                }
                case 'c' : {
                    num = '03';
                    break;
                }
            }
            this.weapon_type = `${weapon_type}_${num}`;
            this.item_type = this.weapon_type;
        } else if (this.type === 'heart') {
            // Add amount of health to heal
        } else if (this.type === 'boots') {
            let item_type, num;
            switch (this.id[2]) {
                case 'd' :
                    item_type = 'boots';
                    break;
            }
            switch(this.id[3]) {
                case 'a' : {
                    num = '01';
                    break;
                }
                case 'b' : {
                    num = '02';
                    break;
                }
                case 'c' : {
                    num = '03';
                    break;
                }
            }
            this.item_type = `${item_type}_${num}`;
        }
    }

    updateAnimation () {
        if (this.offset !== null) {
            this.offset.x += 0.1;
            this.offset.y += 0.2;

            this.pixi_sprite.position.set(
                this.box.x + Math.cos(this.offset.x) * 2,
                this.box.y + Math.sin(this.offset.y)
            );
        }
    }
}

class Collider {
    constructor (box,edge_type) {
        this.box = box;

        // Collider properties
        this.edge_type = edge_type;
        this.edges = null;
        this.initializeEdges();
    }

    initializeEdges () {
        // top, bottom, left, right
        this.edges = [false,false,false,false]; 

        // 15 Tile Edge Types
        // Rules: top:isOdd, bottom:3-6||11-14, left:1-8, right:5-12
        if (this.edge_type % 2 === 1)
            this.edges[0] = true;
        if ((this.edge_type >= 3 && this.edge_type <= 6) ||
            (this.edge_type >= 11 && this.edge_type <= 14))
            this.edges[1] = true;
        if (this.edge_type <= 8)
            this.edges[2] = true;
        if (this.edge_type >= 5 && this.edge_type <= 12)
            this.edges[3] = true;
    }
}

class Doodad {
    constructor (type_id,box,tags) {
        this.type_id = type_id;
        this.box = box;
        this.pixi_sprite = null;
        this.tags = tags;
    }

    getSpriteData () {
        let atlas = 'props',
            texture;
        switch (this.type_id) {
            case 'sign' : {
                texture = 'sign';
                break;
            }
        }
        return {atlas:atlas,texture:texture};
    }
}

class Entity {
    constructor (x,y,facing='right',name=null) {
        this.box = null;
        this.x = x;         // Temporary x,y until this.box is initialized
        this.y = y;

        this.name = name;
        
        // Sprite properties
        this.pixi_sprite;
        this.facing = facing;
        this.sprite_info = null;

        // Character properties
        this.max_health = 5;
        this.current_health = this.max_health;
        this.accel_x = 0.45;
        this.accel_y = 0.45;
        this.accel_jump = -9;
        this.faction = null;

        // Respawn Properties
        this.dead = false;
        this.spawn = null;

        // Equipment properties
        this.weapon_slots = [];
        this.max_weapon_slots = 3;
        this.boots = new Boots();

        // Abilitie properties
        this.ability = null;
        this.spawned_platform = null;        

        // Cooldown Trackers
        this.cd_switch_weapon_count = 0;
        this.cd_switch_weapon = 20;
        this.cd_damage_boost_count = 0;
        this.cd_damage_boost = 20;

        // Player state properties
        this.disable_platforms = false;
        this.jump_dampened = false;
        this.jump_window = Infinity;
        this.jumping = true;
        this.released_attack = true;
        this.released_jump = true;

        // Creep properties
        this.ai = false;
        this.contact_damage = 1;
        this.contact_knockback = 2;
        this.flying = false;
    }

    setEntityType (type_id) {
        let type_arr = type_id.split('_');

        this.sprite_info = new SpriteInfo();
        this.sprite_info.atlas = 'sprites';
        this.sprite_info.name = type_arr[0];

        switch (type_arr[0]) {
            case 'fox' : {
                this.box = new PhysBox(this.x,this.y,13,15);
                break;
            }
            case 'eagle' : {
                this.box = new PhysBox(this.x,this.y,15,15);
                this.sprite_info.scale.x = -1;
                this.accel_x = 0.5;
                this.accel_y = 0.5;
                this.flying = true;
                break;
            }
            case 'frog' : {
                this.box = new PhysBox(this.x,this.y,15,15);
                this.sprite_info.scale.x = -1;
                break
            }
        }
        switch (type_arr[1]) {
            case 'ai' : {
                this.ai = true;
                this.accel_x /= 2;
                this.accel_y /= 2;
                this.current_health = 5;
                this.cd_damage_boost = 1;
            }
        }
        delete this.x,this.y;
    }

    // ------------------------------------------------------------------
    // Action Functions
    // ------------------------------------------------------------------

    actionAttack (p2,callback) {
        let weapon = this.weapon_slots[0];
        if (this.released_attack === true || weapon.auto_fire === true) {
            if (weapon.cd_attack_count > weapon.cd_attack) {
                let p1 = this.box.getCenter();
                p1.y -= 4;
                let dir = getDirectionVector(p1,p2),
                    angle = getAngle(p1,p2);
                    weapon = this.weapon_slots[0];
                // Spawn a bullet at position p1 in game callback function
                callback(this.faction,p1,dir,angle,weapon);
                this.released_attack = false;
                weapon.cd_attack_count = 0;
            }
        }
    }

    actionBounceJump (entity) {
        if (this.box.vy !== 0) {
            if (this.box.getCenterY() < entity.box.getCenterY()) {
                if (this.box.getOldBottom() < entity.box.getOldTop())
                    this.box.setBottom(entity.box.getTop());
                this.jump_dampened = false;
                this.box.vy = this.accel_jump;
                return true;
            }
        }
    }

    actionDropDown () {
        if (this.jumping === false) {
            this.jumping = true;
            this.jump_dampened = false;
            this.disable_platforms = true;
            this.box.y += 1;
        }
    }  

    actionEntityKnockback (box,contact_knockback) {
        let this_center = this.box.getCenter(),
            box_center = box.getCenter();

        if (this.box.getOldBottom() < box.y || this.box.getOldTop() > box.getBottom()) {
            if (this_center.y < box_center.y) {
                if (this.box.getOldBottom() < this.box.getBottom())
                    this.box.setBottom(box.getTop());
                this.box.vy = -contact_knockback * 3;
            }
            else if (this_center.y > box_center.y) {
                this.box.setTop(box.getBottom());
                if (this.flying === true)
                    this.box.vy = contact_knockback - this.box.vy;
                else
                    this.box.vy = 0;
            }
        }
        else if (this.box.getOldRight() < box.x || this.box.getOldLeft() > box.getRight()) {
            if (this_center.x < box_center.x) {
                if (this.box.vx <= 0)
                    this.box.vx = -contact_knockback;
                else if (this.box.vx > 0)
                    this.box.vx = -contact_knockback - this.box.vx;
            }
            else if (this_center.x > box_center.x) {
                if (this.box.vx >= 0)
                    this.box.vx = contact_knockback;
                else if (this.box.vx < 0)
                    this.box.vx = contact_knockback - this.box.vx;
            }
        }
    }

    actionJump (tick) {
        if (this.released_jump === true) {
            // Give player leeway in when they can repress jump input
            if (this.jump_window === Infinity)
                this.jump_window = tick + 2;

            if (this.jumping === false) {
                this.jumping = true;
                this.jump_dampened = false;
                this.jump_window = Infinity;
                this.box.vy = this.accel_jump;
            } else if (tick < this.jump_window) {
                return;
            }

            this.released_jump = false;
        } 
    }

    actionKnockback (obj) {
        let this_center = this.box.getCenter(),
            obj_center = obj.box.getCenter();

        if (this_center.x < obj_center.x && this.box.vx > 0 )
            this.box.vx -= obj.knockback;
        else if (this_center.x > obj_center.x && this.box.vx < 0)
            this.box.vx += obj.knockback;
        else if (this.box.vx === 0) {
            if (this_center.x < obj_center.x)
                this.box.vx -= obj.knockback;
            else if (this_center.x > obj_center.x)
                this.box.vx += obj.knockback;
        }

        if (this.box.vy !== 0) {
            if (this_center.y < obj_center.y)
                this.box.vy -= obj.knockback;
            else if (this_center.y > obj_center.y)
                this.box.vy += obj.knockback;
        }
    }

    actionMoveDown (vy) {
        if (vy)
            this.box.vy = vy;
        else
            this.box.vy += this.accel_y;
        this.disable_platforms = true;
    }

    actionMoveLeft (vx) {
        this.facing = 'left';
        if (vx)
            this.box.vx = -vx;
        else
            this.box.vx -= this.accel_x;
    }

    actionMoveRight (vx) {
        this.facing = 'right';
        if (vx)
            this.box.vx = vx;
        else
            this.box.vx += this.accel_x;
    }

    actionMoveUp (vy) {
        if (vy)
            this.box.vy = -vy;
        else
            this.box.vy -= this.accel_y;
    }

    actionRadialKnockback (explosion) {
        let combined_width = (this.box.w / 2) + (explosion.box.w / 2),
            combined_height = (this.box.h / 2) + (explosion.box.h / 2);
        let exp_cent = explosion.box.getCenter(),
            ent_cent = this.box.getCenter();
        let dir = getDirectionVector(exp_cent,ent_cent);
        let penetration_x,          // Penetration percent
            penetration_y;

        if (ent_cent.x < exp_cent.x)
            penetration_x = exp_cent.x - ent_cent.x;
        else if (ent_cent.x > exp_cent.x)
            penetration_x = ent_cent.x - exp_cent.x;

        if (ent_cent.y < exp_cent.y)
            penetration_y = exp_cent.y - ent_cent.y;
        else if (ent_cent.y > exp_cent.y)
            penetration_y = ent_cent.y - exp_cent.y;

        // Velocity = dir * force * penetration ratio
        this.box.vx = dir.x * explosion.force * (1-(penetration_x/combined_width));
        this.box.vy = dir.y * explosion.force * (1-(penetration_y/combined_height));

        this.jumping = true;
        this.jump_dampened = true;
    }

    // ------------------------------------------------------------------
    // Finate State Machine Functions
    // ------------------------------------------------------------------

    setState (state,...args) {
        switch (state) {
            case 'patrol': {
                this.state = 'patrol';
                this.patrol_p1 = args[0];
                this.patrol_p2 = args[1];

                if (this.patrol_p1.x !== null)
                    this.box.setCenterX(this.patrol_p1.x);
                if (this.patrol_p1.y !== null)
                    this.box.setCenterY(this.patrol_p1.y);

                if (this.patrol_p1.x !== null) {
                    if (this.patrol_p2.x > this.patrol_p1.x) {
                        this.patrol_dir_x = 'right';
                        this.patrol_action_x = this.actionMoveRight;
                    } else {
                        this.patrol_dir_x = 'left';
                        this.patrol_action_x = this.actionMoveLeft;
                    }
                }

                if (this.patrol_p1.y !== null) {
                    if (this.patrol_p2.y > this.patrol_p1.y) {
                        this.patrol_dir_y = 'down';
                        this.patrol_action_y = this.actionMoveDown;
                    } else {
                        this.patrol_dir_y = 'up';
                        this.patrol_action_y = this.actionMoveUp;
                    }
                }


                if (this.patrol_p1.x !== null && this.patrol_p1.y !== null) {
                    let x_dist = Math.abs(this.patrol_p2.x - this.patrol_p1.x),
                        y_dist = Math.abs(this.patrol_p2.y - this.patrol_p1.y);
                    if (x_dist > y_dist) {
                        this.patrol_dampen_y = x_dist / y_dist;
                    } else {
                        this.patrol_dampen_x = y_dist / x_dist;
                    }
                }
                break;
            }
            case 'jump': {
                this.state = 'jump';
                this.cd_jump = 100;
                this.cd_jump_count = 0;
                break;
            }
        }
    }

    updateState () {
        if (this.state === undefined)
            return;

        switch (this.state) {
            case 'patrol': {
                if (this.patrol_dir_x === 'right') {
                    if (this.box.getCenterX() < this.patrol_p1.x) {
                        this.patrol_action_x = this.actionMoveRight;
                    } else if (this.box.getCenterX() > this.patrol_p2.x) {
                        this.patrol_action_x = this.actionMoveLeft;
                    }
                } else if (this.patrol_dir_x === 'left') {
                    if (this.box.getCenterX() > this.patrol_p1.x) {
                        this.patrol_action_x = this.actionMoveLeft;
                    } else if (this.box.getCenterX() < this.patrol_p2.x) {
                        this.patrol_action_x = this.actionMoveRight;
                    }
                }
                if (this.patrol_action_x !== undefined) {
                    if (this.patrol_dampen_x !== undefined)
                        this.patrol_action_x(Math.abs(this.box.vy) / this.patrol_dampen_x);
                    else
                        this.patrol_action_x();
                }

                if (this.patrol_dir_y === 'down') {
                    if (this.box.getCenterY() < this.patrol_p1.y) {
                        this.patrol_action_y = this.actionMoveDown;
                        this.box.vy = 0;
                    } else if (this.box.getCenterY() > this.patrol_p2.y) {
                        this.patrol_action_y = this.actionMoveUp;
                        this.box.vy = 0;
                    }
                } else if (this.patrol_dir_y === 'up') {
                    if (this.box.getCenterY() > this.patrol_p1.y) {
                        this.patrol_action_y = this.actionMoveUp;
                        this.box.vy = 0;
                    } else if (this.box.getCenterY() < this.patrol_p2.y) {
                        this.patrol_action_y = this.actionMoveDown;
                        this.box.vy = 0;
                    }
                }
                if (this.patrol_action_y !== undefined) {
                    if (this.patrol_dampen_y !== undefined)
                        this.patrol_action_y(Math.abs(this.box.vx) / this.patrol_dampen_y);
                    else
                        this.patrol_action_y();
                }
                break;
            }
            case 'jump' : {
                if (this.cd_jump_count > this.cd_jump) {
                    this.actionJump();
                    this.cd_jump_count = 0;
                    this.released_jump = true;
                }
                this.cd_jump_count++;
                break;
            }
        }
    }
  
    // ------------------------------------------------------------------
    // Other Functions
    // ------------------------------------------------------------------

    dampenJump () {
        if (this.jump_dampened === false && this.box.vy < 0) {
            this.box.vy *= 0.5;
            this.jump_dampened = true;
        }
    }

    updateAnimation () {
        this.pixi_sprite.position.set(this.box.x,this.box.y);
        
        if (this.facing === 'left')
            this.pixi_sprite.base_sprite.scale.x = -1 * this.sprite_info.scale.x;
        else
            this.pixi_sprite.base_sprite.scale.x = this.sprite_info.scale.x;

        this.sprite_info.prev_anim = this.sprite_info.anim;
        if (this.box.vy !== 0) {
            if (this.box.vy < 0)
                this.sprite_info.anim = '_jump';
            else
                this.sprite_info.anim = '_fall';
        } else if (this.box.vx !== 0) {
            this.sprite_info.anim = '_run';
        } else {
            this.sprite_info.anim = '_idle';
        }
    }
}

class Explosion {
    constructor (box,force) {
        this.box = box;
        this.box.setCenterX(box.x);
        this.box.setCenterY(box.y);

        // Explosion properties
        this.force = force;
    }
}

class Platform {
    constructor (id,type,pos,width,p1=null,p2=null) {
        this.id = id;
        this.pixi_sprite = null;

        if (type === 's') {
            this.type = 'static';
            this.box = new Box(pos.x,pos.y,width,1);
        } else if (type === 'd') {
            this.type = 'dynamic';
            this.box = new PhysBox(pos.x,pos.y,width,1,0,0);

            this.accel_x = 0.15;
            this.dir_function = this.moveRight;
            this.start = p1;
            this.end = p2;
        }
    }

    getSpriteData () {
        let atlas,texture;
        switch (this.id[0]) {
            case 'a' : {
                atlas = 'props';
                break;
            }
        }
        switch (this.id[1]) {
            case 'a' : {
                texture = 'platform_01';
                break;
            }
            case 'b' : {
                texture = 'platform_02';
                break;
            }
        }
        return {atlas:atlas,texture:texture};
    }

    moveLeft () {
        this.box.vx -= this.accel_x;
    }

    moveRight () {
        this.box.vx += this.accel_x;
    }

    update () {
        if (this.box.getLeft() < this.start.x)
            this.dir_function = this.moveRight;
        else if (this.box.getLeft() > this.end.x) 
            this.dir_function = this.moveLeft;
        this.dir_function();
    }

    updateAnimation () {
        this.pixi_sprite.position.set(this.box.x,this.box.y);
    }
}

class PlayerSpawn {
    constructor (box,faction,game_object_container) {
        this.box = box;
        this.pixi_sprite = null;

        // PlayerSpawn properties
        this.entity_store = new Map();          // Entity -> respawn time
        this.faction = faction;
        this.game_object_container = game_object_container;
        this.respawn_rate = 50;

        this.addHover();
    }

    addHover () {
        let off_x = Math.random()*Math.PI*2;
        this.offset = {
            x:off_x,
            y:off_x*3
        };
    }

    getSpriteData () {
        let atlas = 'items',
            texture = 'spawn';
        return {atlas:atlas,texture:texture};
    }

    reviveEntity (entity) {
        entity.dead = false;
        entity.pixi_sprite.visible = true;
        entity.current_health = entity.max_health;
        entity.box.setCenter(this.box.getCenterX(),this.box.y);
        entity.box.setVelocity(0,0);
        this.game_object_container.push(entity);
        this.entity_store.delete(entity);
    }

    storeEntity (entity,respawn_rate=this.respawn_rate) {
        this.entity_store.set(entity,respawn_rate);
    }

    update () {
        let update_ui = false;
        this.entity_store.forEach((value,key,map)=>{
            value--;
            if (value <= 0) {
                this.reviveEntity(key);
                update_ui = true;
            } else {
                map.set(key,value);
            }
        });
        return update_ui;
    }

    updateAnimation () {
        // Update position
        this.pixi_sprite.position.set(this.box.x,this.box.y);

        // Update transform
        let sprite = this.pixi_sprite.base_sprite;
        sprite.angle += 3;

        if (this.offset !== null) {
            this.offset.x += 0.1;
            this.offset.y += 0.2;

            this.pixi_sprite.position.set(
                this.box.x + Math.cos(this.offset.x),
                this.box.y + Math.sin(this.offset.y)
            );
        }
    }
}

class Region {
    constructor (box,tags) {
        this.box = box;
        this.tags = tags;
    }
}

// Spawner for Bullets, collectibles, entities
class Spawn {
    constructor (object_id,object_state,object_facing,box,pixi,layer,faction,game_object_container) {
        this.box = box;

        this.object_id = object_id;
        this.object_state = object_state;
        this.object_facing = object_facing;
        this.pixi = pixi;
        this.layer = layer;

        // Spawn Object Properties
        this.object_concurrent_count = 0;
        this.object_concurrent_max = 1;
        this.object_total_count = 0;
        this.object_total_max = Infinity;
        

        this.cd_spawn_rate = 0;
        this.cd_spawn_rate_count = 0;

        this.faction = faction;
        this.game_object_container = game_object_container;
    }

    initialize (object_concurrent_max,spawn_rate) {
        this.object_concurrent_max = object_concurrent_max;
        this.cd_spawn_rate = spawn_rate;
        this.cd_spawn_rate_count = spawn_rate;
    }

    spawnObject () {
        let ent = new Entity(this.box.x,this.box.y,this.object_facing);
        ent.setEntityType(this.object_id);
        ent.pixi_sprite = this.pixi.getNewAnimatedSprite(ent,this.layer);
        ent.spawner = this;
        this.faction.addMembers([ent]);

        let object_id_arr = this.object_id.split('_');
        switch(object_id_arr[2]) {
            case '0' : {
                ent.setState(this.object_state,{x:ent.box.x-32,y:null},{x:ent.box.x+32,y:null});
                break;
            }
            case '1' : {
                ent.setState(this.object_state,{x:null,y:ent.box.y-16},{x:null,y:ent.box.y+16});
                break;
            }
            case '2' : {
                ent.setState(this.object_state,{x:ent.box.x-16,y:null},{x:ent.box.x+16,y:null});
                break;
            }
            case '3' : {
                ent.setState(this.object_state);
                break;
            }
        }

        this.game_object_container.push(ent);
    }

    update () {
        // Spawn
        if (this.object_concurrent_count < this.object_concurrent_max && 
            this.object_total_count < this.object_total_max &&
            this.cd_spawn_rate_count > this.cd_spawn_rate) {
            this.spawnObject();
            this.object_concurrent_count++;
            this.object_total_count++;
            this.cd_spawn_rate_count = 0;
        }
        this.cd_spawn_rate_count++;
    }
}

if ('undefined' !== typeof global) {
    module.exports = {
        Bullet,
        Collider,
        Entity,
        Explosion,
        Platform,
        PlayerSpawn,
        Spawn,
        Trigger
    }
}