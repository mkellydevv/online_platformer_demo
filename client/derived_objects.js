class Bullet extends PhysBox {
    constructor(pos,dir,angle,weapon) {
        super(pos.x,pos.y,
            weapon.bullet_w,weapon.bullet_h,
            dir.x*weapon.bullet_speed,dir.y*weapon.bullet_speed);

        this.pixi_sprite;
        this.sprite_angle = angle;

        this.damage = weapon.bullet_damage;
        this.knockback = weapon.bullet_knockback;
        this.rotates = weapon.bullet_rotates;
        this.pierces = weapon.bullet_pierces;
    }

    updateAnimation () {
        this.pixi_sprite.position.x = this.getCenterX();
        this.pixi_sprite.position.y = this.getCenterY();
        if (this.rotates === true)
            this.pixi_sprite.angle += 5 * (Math.abs(this.vx)+Math.abs(this.vy));
        else {
            // Hard coded, items are all tilted -45
            this.pixi_sprite.angle = this.sprite_angle - 45;
        }
    }
}

class Collectible extends Box {
    constructor(id,x,y,w,h){
        super(x,y,w,h);

        this.id = id;
        this.type;
        this.weapon_type;
        this.pixi_sprite;
        this.permanent;

        this.initialize();

        this.addHover();
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

    initialize() {    
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
                    this.permanent = true;
                    num = '01';
                    break;
                }
                case 'b' : {
                    this.permanent = true;
                    num = '02';
                    break;
                }
                case 'c' : {
                    this.permanent = true;
                    num = '03';
                    break;
                }
            }
            this.weapon_type = `${weapon_type}_${num}`;
            this.item_type = this.weapon_type;
        } else if (this.type === 'heart') {
            this.permanent = true;
        } else if (this.type === 'boots') {
            this.permanent = true;
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
            }
            this.item_type = `${item_type}_${num}`;
        }
    }

    addHover() {
        this.original_x = this.x;
        this.original_y = this.y;
        
        this.position_x = Math.random() * Math.PI * 2;
        this.position_y = this.position_x * 2;
    }

    updateAnimation() {
        this.position_x += 0.1;
        this.position_y += 0.2;

        this.x = this.original_x + Math.cos(this.position_x) * 2;
        this.y = this.original_y + Math.sin(this.position_y);

        this.pixi_sprite.position.x = this.x;
        this.pixi_sprite.position.y = this.y;
    }
}

// Spawn Bullets, collectibles, entities
class Spawn extends Box {
    constructor (object_id,object_state,x,y,w,h,pixi,layer,faction,object_group) {
        super(x,y,w,h);

        this.object_id = object_id;
        this.object_state = object_state;
        this.pixi = pixi;
        this.layer = layer;
        this.object_count = 0;
        this.object_max = 1;

        this.cd_spawn_rate = 100;
        this.cd_spawn_rate_count = 0;

        this.faction = faction;
        this.object_group = object_group;
    }

    initialize (object_max,spawn_rate) {
        this.object_max = object_max;
        this.spawn_rate = spawn_rate;
    }

    spawnObject () {
        switch(this.object_id) {
            case 0 : {
                let en = new Bunny(this.x,this.y,this.object_state);
                // Hard coded
                en.sprite_atlas = 'sprites';en.sprite_name = 'fox';en.sprite_anim = '_idle';
                en.pixi_sprite = this.pixi.getNewAnimatedSprite(en,this.layer);
                en.spawner = this;
                this.faction.addMembers(en);
                this.object_group.push(en);
                break;
            }
        }
    }

    update () {
        if (this.object_count < this.object_max && this.cd_spawn_rate_count > this.cd_spawn_rate) {
            this.spawnObject();
            this.object_count++;
            this.cd_spawn_rate_count = 0;
        }
        this.cd_spawn_rate_count++;
    }
}

class Tile extends Box {
    constructor (x,y,w,h,edge_type) {
        super(x,y,w,h);

        this.collidable = true;
        this.edge_type = edge_type;
        this.edges;
        this.initializeEdges();
    }

    initializeEdges() {
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

class Bunny extends Entity {
    constructor(x,y,state) {
        let phys_box = new PhysBox(x,y,13,15,0,0)
            
        super(phys_box);

        this.ai = true;
        this.current_health = 10;
        this.flying = false;
        this.cd_damage_boost = 1;
        this.setState(state);
    }
}