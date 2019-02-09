/*
Box:
Switches
Chests
Collectible
Zone,Door

PhysBox:
Boulders/Boxes
Platforms
Bullet

Entities


*/

class Entity {
    constructor(phys_box) {
        this.box = phys_box;
        this.pixi_sprite;
        this.sprite_atlas;  // Ex: 'sprites'
        this.sprite_name;   // Ex: 'fox'
        this.sprite_anim;   // Ex: '_idle'

        this.weapon_slots = [];
        this.max_weapon_slots = 2;

        this.current_health = 3;
        this.max_health = 5;

        // Cooldown Trackers
        this.cd_switch_weapon_count = 0;
        this.cd_switch_weapon = 20;
        this.cd_damage_boost_count = 0;
        this.cd_damage_boost = 20;

        // Prevent autofire of keyboard and mouse presses
        this.released_attack = true;
        this.released_jump = true;

        this.boots = {
            type:null,
            bounce:false,
            damage:0
        }
        this.ability = null;

        this.ai = false;
        this.disable_platforms = false;
        this.facing = 'right';
        this.faction = null;
        this.flying = false;
        this.friction = 0.85;
        this.jumping = true;
        this.jump_dampened = false;
        this.jump_window = Infinity;
        this.contact_knockback = 2;
        this.contact_damage = 1;
    }

    actionAttack(p2,callback) {
        let weapon = this.weapon_slots[0];
        if (this.released_attack === true || weapon.auto_fire === true) {
            if (weapon.cd_attack_count > weapon.cd_attack) {
                let pos = {x:this.box.x,y:this.box.y},
                    dir = getDirectionVector(this.box.getCenter(),p2),
                    angle = getAngle(this.box.getCenter(),p2);
                    weapon = this.weapon_slots[0];
                // Spawn a bullet at entity's position in game callback function
                callback(this.faction,pos,dir,angle,weapon);
                this.released_attack = false;
                weapon.cd_attack_count = 0;
            }
        }
    }

    actionJump(tick) {
        if (this.released_jump === true) {
            // Give player leeway in when they can repress jump input
            if (this.jump_window === Infinity)
                this.jump_window = tick + 2;

            if (this.jumping === false) {
                this.jumping = true;
                this.jump_dampened = false;
                this.jump_window = Infinity;
                this.box.vy = -13;
            } else if (tick < this.jump_window) {
                return;
            }
            this.released_jump = false;
        } 
    }

    actionKnockback (obj) {
        let this_center = this.box.getCenter(),
            obj_center = obj.getCenter();

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

    actionBounceJump (entity) {
        if (this.box.vy !== 0) {
            if (this.box.getCenterY() < entity.box.getCenterY()) {
                if (this.box.getOldBottom() < entity.box.getOldTop())
                    this.box.setBottom(entity.box.getTop());
                this.jump_dampened = false;
                this.box.vy = -13;
                return true;
            }
        }
    }

    actionEntityKnockback (entity) {
        let this_center = this.box.getCenter(),
            entity_center = entity.box.getCenter(),
            knockback = entity.contact_knockback;

        if (this_center.x < entity_center.x) {
            if (this.box.vx <= 0)
                this.box.vx = -knockback;
            else if (this.box.vx > 0)
                this.box.vx = -knockback - Math.abs(this.box.vx);
        }
        else if (this_center.x > entity_center.x) {
            if (this.box.vx >= 0)
                this.box.vx = knockback;
            else if (this.box.vx < 0)
                this.box.vx = knockback - this.box.vx;
        }
        
        if (this.box.vy !== 0) {
            if (this_center.y < entity_center.y) {
                if (this.box.getOldBottom() < this.box.getBottom())
                    this.box.setBottom(entity.box.getTop());
                this.box.vy = -knockback * 3;
            }
            else if (this_center.y > entity_center.y) {
                this.box.setTop(entity.box.getBottom());
                this.box.vy = 0;
            }
        }
    }

    actionMoveUp (vy) {
        if (vy)
            this.box.vy = -vy;
        else
            this.box.vy -= 0.225;
    }

    actionMoveDown (vy) {
        if (vy)
            this.box.vy = vy;
        else
            this.box.vy += 0.225;
    }

    actionMoveLeft (vx) {
        this.facing = 'left';
        if (vx)
            this.box.vx = -vx;
        else
            this.box.vx -= 0.225;
    }

    actionMoveRight (vx) {
        this.facing = 'right';
        if (vx)
            this.box.vx = vx;
        else
            this.box.vx += 0.225;
    }

    dampenJump () {
        if (this.jump_dampened === false && this.box.vy < 0) {
            this.box.vy *= 0.5;
            this.jump_dampened = true;
        }
    }

    setState (state,...args) {
        switch (state) {
            case 'patrol': {
                this.state = 'patrol';
                this.patrol_p1 = args[0] || {x:this.box.x-32,y:null};
                this.patrol_p2 = args[1] || {x:this.box.x+32,y:null};
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
                if (this.patrol_p1.x && this.patrol_p1.y) {
                    let x_dist = Math.abs(this.patrol_p2.x - this.patrol_p1.x),
                        y_dist = Math.abs(this.patrol_p2.y - this.patrol_p1.y);
                    if (x_dist > y_dist) {
                        this.patrol_dampen_y = x_dist / y_dist;
                    } else {
                        this.patrol_dampen_x = y_dist / x_dist;
                    }
                }
            }
        }
    }

    actionFSM () {
        switch (this.state) {
            case 'patrol': {
                /*if (this.box.vx === 0) {
                    console.log('buh')
                    if (this.patrol_action_x === this.actionMoveLeft)
                        this.patrol_action_x = this.actionMoveRight;
                    else
                        this.patrol_action_x = this.actionMoveLeft;
                } else*/ if (this.patrol_dir_x === 'right') {
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
                if (this.patrol_dampen_x !== undefined)
                    this.patrol_action_x(Math.abs(this.box.vy) / this.patrol_dampen_x);
                else
                    this.patrol_action_x();

                if (this.box.vy === 0) {
                    if (this.patrol_action_y === this.actionMoveUp)
                        this.patrol_action_y = this.actionMoveDown;
                    else
                        this.patrol_action_y = this.actionMoveUp;
                } else if (this.patrol_dir_y === 'down') {
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
                if (this.patrol_dampen_y !== undefined)
                    this.patrol_action_y(Math.abs(this.box.vx * this.friction) / this.patrol_dampen_y);
                else
                    this.patrol_action_y();
                break;
            }
        }
    }

    actionDropDown () {
        if (this.jumping === false) {
            this.jumping = true;
            this.jump_dampened = false;
            this.disable_platforms = true;
            this.box.vy = 1;
        }
    }

    updateAnimation() {
        this.pixi_sprite.position.x = this.box.x +6;
        this.pixi_sprite.position.y = this.box.y - 16;

        let scale = 1;
        if (this.facing === 'left')
            this.pixi_sprite.scale.x = -1 * scale;
        else
            this.pixi_sprite.scale.x = scale;

        
        this.old_sprite_anim = this.sprite_anim;
        if (this.box.vy !== 0) {
            if (this.box.vy < 0)
                this.sprite_anim = '_jump';
            else
                this.sprite_anim = '_fall';
        } else if (this.box.vx !== 0) {
            this.sprite_anim = '_run';
        } else {
            this.sprite_anim = '_idle';
        }
    }
}

class Faction {
    constructor() {
        this.allies = [];
        this.hostiles = [];
        this.members = [];
        this.bullets = [];
    }

    addMembers (...entities) {
        for (let i = 0; i < entities.length; i++) {
            this.members.push(entities[i]);
            entities[i].faction = this;
        }
    }

    addHostileFactions (...factions) {
        for (let i = 0; i < factions.length; i++) {
            this.hostiles.push(factions[i]);
        }
    }

    addBullets (...bullets) {
        for (let i = 0; i < bullets.length; i++) {
            this.bullets.push(bullets[i]);
            bullets[i].faction = this;
        }
    }

    removeMembers (...entities) {
        for (let i = 0; i < entities.length; i++) {
            this.members.splice(this.members.indexOf(entities[i]),1);
            entities[i].faction = null;
        }
    }
}

class Box {
    constructor (x,y,w,h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    getLeft() {return this.x;}
    getRight() {return this.x + this.w;}
    getTop() {return this.y;}
    getBottom() {return this.y + this.h;}
    getCenterX() {return this.x + this.w / 2;}
    getCenterY() {return this.y + this.h / 2;}
    getCenter() {return {x:this.getCenterX(),y:this.getCenterY()};}

    setLeft(val) {this.x = val;}
    setRight(val) {this.x = val - this.w;}
    setTop(val) {this.y = val;}
    setBottom(val) {this.y = val - this.h;}
    setCenterX(val) {this.x = val - this.w / 2;}
    setCenterY(val) {this.y = val - this.h / 2;}
    setCenter(obj) {this.setCenterX(obj.x);this.setCenterY(obj.y);}
}

class PhysBox extends Box {
    constructor (x,y,w,h,vx,vy) {
        super(x,y,w,h);

        this.vx = vx;
        this.vy = vy;
        this.old_x = x;
        this.old_y = y;
    }

    getOldLeft() {return this.old_x;}
    getOldRight() {return this.old_x + this.w;}
    getOldTop() {return this.old_y;}
    getOldBottom() {return this.old_y + this.h;}

    updatePosition (friction,gravity) {
        this.old_x = this.x;
        this.old_y = this.y;

        this.vx *= friction;
        this.vy += gravity;
    
        this.x += this.vx;
        this.y += this.vy;
    }

    updatePositionX (friction) {
        this.old_x = this.x;
        this.vx *= friction;
        this.x += this.vx;
        // Round down to 0 when under 0.05
        if (Math.round(this.vx * 10) / 10 === 0)
            this.vx = 0;
    }

    updatePositionY (gravity) {
        this.old_y = this.y;
        this.vy += gravity;
        this.y += this.vy;
    }

    checkCollision(object,type='AABB') {
        if (type==='AABB')
            return this.collisionAABB(object);
        //return this.collisionSweptAABB(object);
    }

    collisionAABB(object) {
        if (this.getLeft() > object.getRight() || this.getRight() < object.getLeft() ||
            this.getTop() > object.getBottom() || this.getBottom() < object.getTop())
            return false;
        return true;
    }

    // this PhysBox colliding with a static Object
    collisionSweptAABB(obj,normalx,normaly) {
        let xInvEntry, yInvEntry;
        let xInvExit, yInvExit;

        if (this.vx > 0) {
            xInvEntry = obj.getLeft() - this.getRight();
            xInvExit = obj.getRight() - this.getLeft();
        } else {
            xInvEntry = obj.getRight() - this.getLeft();
            xInvExit = obj.getLeft() - this.getRight();
        }

        if (this.vy > 0) {
            yInvEntry = obj.getTop() - this.getBottom();
            yInvExit = obj.getBottom() - this.getTop();
        } else {
            yInvEntry = obj.getBottom() - this.getTop();
            yInvExit = obj.getTop() - this.getBottom();
        }

        let xEntry, yEntry;
        let xExit, yExit;

        if (this.vx === 0) {
            xEntry = Number.NEGATIVE_INFINITY;
            xExit = Number.POSITIVE_INFINITY;
        } else {
            xEntry = xInvEntry / this.vx;
            xExit = xInvExit / this.vx;
        }

        if (this.vy === 0) {
            yEntry = Number.NEGATIVE_INFINITY;
            yExit = Number.POSITIVE_INFINITY;
        } else {
            yEntry = yInvEntry / this.vy;
            yExit = yInvExit / this.vy;
        }

        //console.log(xEntry, yEntry);

        let entryTime = Math.max(xEntry, yEntry);
        let exitTime = Math.min(xExit, yExit);

        // if there was no collision
        if (entryTime > exitTime || 
            xEntry > 1 || yEntry > 1|| 
            (xEntry < 0 && yEntry < 0)) {
            normalx = 0;
            normaly = 0;
            return 1;
        } else { // if there was a collision        		
            // calculate normal of collided surface
            if (xEntry > yEntry) {
                if (xInvEntry < 0) {
                    normalx = 1;
                    normaly = 0;
                } else {
                    normalx = -1;
                    normaly = 0;
                }
            } else {
                if (yInvEntry < 0) {
                    normalx = 0;
                    normaly = 1;
                } else {
                    normalx = 0;
                    normaly = -1;
                }
            }
            // return the time of collision
            return entryTime;
        }
    }

    collisionResponseSweptAABB(collision_time) {
	    this.x += this.vx * collision_time;
        this.y += this.vy * collision_time;

        this.vx = 0;
        this.vy = 0;
    }

    collisionResponseAABB(tile) {
        return this.resolvePenetration(tile);
    }

    resolvePenetration(tile) {
        if (tile.collidable === false) {
            return;
        }

        if (tile.edges[0] === true) {
            let tile_top = tile.getTop();
            if (this.getBottom() > tile_top && 
                this.getOldBottom() <= tile_top) {
                this.setBottom(tile_top - 0.01);
                this.vy = 0;
                return true; // Return true to signal collisionCheck() to set entity.jumping to false
            }
        }   
        if (tile.edges[1] === true) {
            let tile_bottom = tile.getBottom();
            if (this.getTop() < tile_bottom &&
                this.getOldTop() >= tile_bottom) {
                this.setTop(tile_bottom + 0.1);
                this.vy = 0;
                return;
            } 
        }
        if (tile.edges[2] === true) {
            let tile_left = tile.getLeft();
            if (this.getRight() > tile_left && 
                this.getOldRight() <= tile_left) {
                this.setRight(tile_left - 0.01);
                this.vx = 0;
                return;
            } 
        }
        if (tile.edges[3] === true) {
            let tile_right = tile.getRight();
            if (this.getLeft() < tile_right &&
                this.getOldLeft() >= tile_right) {
                this.setLeft(tile_right + 0.1);
                this.vx = 0;
                return;
            } 
        }
    }
}

class Weapon {
    constructor(id) {
        this.id = id;
        this.type;

        // Bullet info
        this.bullet_speed = 1;
        this.bullet_damage = 1;
        this.bullet_knockback = 0;
        this.bullet_w = 10;
        this.bullet_h = 10;

        this.auto_fire = false;
        this.bullet_rotates = false;
        this.bullet_pierces = false;

        this.initialize();

        this.cd_attack;
        this.cd_attack_count = this.cd_attack;
    }

    getSpriteData () {
        let atlas = 'items';
        let texture = this.id;
        return {atlas:atlas,texture:texture};
    }

    initialize () {
        let id_arr = this.id.split('_');

        if (id_arr[0] === 'star') {
            this.type = 'star';
            this.bullet_rotates = true;
            
            switch (id_arr[1]) {
                case '01' :
                    this.bullet_speed = 3;
                    this.cd_attack = 16;
                    break;
                case '02' :
                    this.bullet_speed = 3.5;
                    this.cd_attack = 14;
                    break;
                case '03' :
                    this.bullet_speed = 4;
                    this.cd_attack = 12;
                    this.auto_fire = true;
                    this.bullet_knockback = .65;
                    break;
            }
        } else if (id_arr[0] === 'sword') {
            this.type = 'sword';
            this.bullet_pierces = true;
            this.bullet_damage = 0.25;
            
            switch (id_arr[1]) {
                case '01' :
                    this.bullet_speed = 2.5;
                    this.cd_attack = 22;
                    break;
                case '02' :
                    this.bullet_speed = 2.25;
                    this.cd_attack = 20;
                    break;
                case '03' :
                    this.bullet_speed = 2;
                    this.cd_attack = 18;
                    this.auto_fire = true;
                    break;
            }
        } else if (id_arr[0] === 'staff') {
            this.type = 'staff';
            
            switch (id_arr[1]) {
                case '01' :
                    this.bullet_speed = 1.75;
                    this.cd_attack = 24;
                    this.bullet_knockback = 2.5;
                    break;
                case '02' :
                    this.bullet_speed = 2;
                    this.cd_attack = 22;
                    this.bullet_knockback = 2.75;
                    break;
                case '03' :
                    this.bullet_speed = 2.25;
                    this.cd_attack = 20;
                    this.auto_fire = true;
                    this.bullet_knockback = 3;
                    break;
            }
        }
    }
}