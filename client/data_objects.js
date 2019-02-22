// ------------------------------------------------------------------
// Data Objects are components of Game Objects
// ------------------------------------------------------------------

class Boots {
    constructor (id) {
        this.id = id;

        // Boots properties
        this.type = null;
        this.bounce = false;
        this.damage = 0;

        this.initialize();
    }

    initialize () {
        switch (this.id) {
            case 'boots_01' : {
                this.bounce = true;
                break;
            }
            case 'boots_02' : {
                this.bounce = true;
                this.damage = 0.25;
                break;
            }
            case 'boots_03' : {
                this.bounce = true;
                this.damage = 0.50;
                break;
            }
        }
    }
}

// Used in collision checks
class Box {
    constructor (x,y,w,h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.half_w = w / 2;
        this.half_h = h / 2;
    }

    getLeft () {return this.x;}
    getRight () {return this.x + this.w;}
    getTop () {return this.y;}
    getBottom () {return this.y + this.h;}
    getPosition () {return {x:this.x,y:this.y};}

    getCenterX () {return this.x + this.half_w;}
    getCenterY () {return this.y + this.half_h;}
    getCenter () {return {x:this.getCenterX(),y:this.getCenterY()};}

    setLeft (val) {this.x = val;}
    setRight (val) {this.x = val - this.w;}
    setTop (val) {this.y = val;}
    setBottom (val) {this.y = val - this.h;}
    setPosition (x,y) {this.setLeft(x);this.setTop(y);}

    setCenterX (val) {this.x = val - this.half_w;}
    setCenterY (val) {this.y = val - this.half_h;}
    setCenter (x,y) {this.setCenterX(x);this.setCenterY(y);}
}

class Faction {
    constructor (args_obj={}) {
        this.allies = [];
        this.hostiles = [];
        this.members = [];
        this.bullets = [];

        if (args_obj.allies !== undefined)
            this.addAlliedFactions(args_obj.allies);
        if (args_obj.hostiles !== undefined)
            this.addHostileFactions(args_obj.hostiles);
    }

    addAlliedFactions (factions_arr) {
        for (let i = 0; i < factions_arr.length; i++) {
            this.allies.push(factions_arr[i]);
            factions_arr[i].allies.push(this);
        }
    }

    addMembers (entities_arr) {
        for (let i = 0; i < entities_arr.length; i++) {
            this.members.push(entities_arr[i]);
            entities_arr[i].faction = this;
        }
    }

    addHostileFactions (factions_arr) {
        for (let i = 0; i < factions_arr.length; i++) {
            this.hostiles.push(factions_arr[i]);
            factions_arr[i].hostiles.push(this);
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

class PhysBox extends Box {
    constructor (x,y,w,h,vx,vy) {
        super(x,y,w,h);

        this.vx = vx || 0;
        this.vy = vy || 0;
        this.max_vx = 10;
        this.max_vy = 10;
        this.old_x = x;
        this.old_y = y;
    }

    // ------------------------------------------------------------------
    // Getter / Setter Functions
    // ------------------------------------------------------------------
    
    getOldLeft () {return this.old_x;}
    getOldRight () {return this.old_x + this.w;}
    getOldTop () {return this.old_y;}
    getOldBottom () {return this.old_y + this.h;}
    getOldPosition () {return {x:getOldLeft(),y:getOldTop()};}
    getVelocity () {return {x:this.vx,y:this.vy};}

    setVelocity(vx,vy) {this.vx = vx;this.vy = vy;}

    // ------------------------------------------------------------------
    // Collision Functions
    // ------------------------------------------------------------------

    checkCollision(game_object,type='AABB') {
        if (type==='AABB')
            return this.collisionAABB(game_object);
    }

    collisionAABB(game_object) {
        if (this.getLeft() > game_object.box.getRight() || this.getRight() < game_object.box.getLeft() ||
            this.getTop() > game_object.box.getBottom() || this.getBottom() < game_object.box.getTop())
            return false;
        return true;
    }

    collisionResponseAABB(game_object) {
        return this.resolvePenetration(game_object);
    }

    // Unfinished
    /*collisionSweptAABB (obj,normalx,normaly) {
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
    }*/

    // Seperate the colliding boxes
    resolvePenetration (collider) {
        if (collider.edges[0] === true) {
            let tile_top = collider.box.getTop();
            if (this.getBottom() > tile_top && 
                this.getOldBottom() <= tile_top) {
                this.setBottom(tile_top - 0.01);
                this.vy = 0;
                return true; // Return true to signal that game object landed
            }
        }   
        if (collider.edges[1] === true) {
            let tile_bottom = collider.box.getBottom();
            if (this.getTop() < tile_bottom &&
                this.getOldTop() >= tile_bottom) {
                this.setTop(tile_bottom + 0.1);
                this.vy = 0;
                return;
            } 
        }
        if (collider.edges[2] === true) {
            let tile_left = collider.box.getLeft();
            if (this.getRight() > tile_left && 
                this.getOldRight() <= tile_left) {
                this.setRight(tile_left - 0.01);
                this.vx = 0;
                return;
            } 
        }
        if (collider.edges[3] === true) {
            let tile_right = collider.box.getRight();
            if (this.getLeft() < tile_right &&
                this.getOldLeft() >= tile_right) {
                this.setLeft(tile_right + 0.1);
                this.vx = 0;
                return;
            } 
        }
    }

    resolvePlatformCollision (platform) {
        if (this.getBottom() > platform.box.y && 
            this.getOldBottom() <= platform.box.y ) {
            this.setBottom(platform.box.y  - 0.01);
            this.vy = 0;
            return true; // Return true to signal that game object landed
        }
    }

    // ------------------------------------------------------------------
    // Update Functions
    // ------------------------------------------------------------------

    updatePosition (friction,gravity) {
        this.old_x = this.x;
        this.old_y = this.y;

        this.vx *= friction;
        this.vy += gravity;

        if (this.vy > this.max_vy)
            this.vy = this.max_vy;
        else if (this.vy < -this.max_vy)
            this.vy = -this.max_vy;
    
        this.x += this.vx;
        this.y += this.vy;
    }

    updateXPosition (friction) {
        this.old_x = this.x;

        this.vx *= friction;

        // Apply vx limit
        if (this.vx > this.max_vx)
            this.vx = this.max_vx;
        else if (this.vx < -this.max_vx)
            this.vx = -this.max_vx;

        this.x += this.vx;

        // Round down to 0 when under 0.05
        if (Math.round(this.vx * 10) / 10 === 0)
            this.vx = 0;
    }

    updateYPosition (gravity,friction=null) {
        this.old_y = this.y;

        // Apply friction to flying units
        if (friction === null)
            this.vy += gravity;
        else
            this.vy *= friction;

        // Apply vy limit
        if (this.vy > this.max_vy)
            this.vy = this.max_vy;
        else if (this.vy < -this.max_vy)
            this.vy = -this.max_vy;

        this.y += this.vy;

        // Round down to 0 when under 0.05
        if (Math.round(this.vy * 10) / 10 === 0)
            this.vy = 0;
    }
}

class SpriteInfo {
    constructor () {
        this.atlas = null;
        this.name = null;
        this.anim = '_idle';
        this.speed = 0.1;
        this.offset = {x:0,y:0};
        this.scale = {x:1,y:1};
        this.tint = null;
    }
}

class Weapon {
    constructor (id) {
        this.id = id;

        // Weapon properties
        this.auto_fire = false;
        this.cd_attack = 20;
        this.cd_attack_count = 0;
        this.type = null;

        // Bullet info
        this.bullet_damage = 1;
        this.bullet_knockback = 0;
        this.bullet_pierces = false;
        this.bullet_rotates = false;
        this.bullet_speed = 1;
        this.bullet_w = 5;
        this.bullet_h = 5;

        this.initialize();
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