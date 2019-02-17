// Spatial grid used for broad phase collision detection
class Grid {
    constructor (w,h,rows,columns) {
        this.w = w;                                 // Dimensions in game pixels
        this.h = h;
        this.rows = rows;
        this.columns = columns;
        this.cell_w = w / rows;
        this.cell_h = h / columns;

        this.dynamic_cells = new Array(columns);    // 2D Array of Dynamic Game Objects
        this.static_cells = new Array(columns);     // 2D Array of Static Game Objects
    
        for (let i = 0; i < columns; i++) {
            this.dynamic_cells[i] = new Array(rows);
            this.static_cells[i] = new Array(rows);
            for (let j = 0; j < rows; j++) {
                this.dynamic_cells[i][j] = new Cell();
                this.static_cells[i][j] = new Cell();
            }
        }
    }

    clear (type) {
        let cells = (type === 'dynamic') ? this.dynamic_cells : this.static_cells;
        for (let i = 0; i < cells.length; i++) {
            for (let j = 0; j < cells[i].length; j++) {
                cells[i][j].clear();
            }
        }
    }

    getCollisionCandidates (type,game_object) {
        let cells = (type === 'dynamic') ? this.dynamic_cells : this.static_cells;
        let sides = this.getSides(game_object.box);
        let candidates = [];

        candidates = candidates.concat(cells[sides.t][sides.l].objects);
        candidates = candidates.concat(cells[sides.t][sides.r].objects);
        candidates = candidates.concat(cells[sides.b][sides.l].objects);
        candidates = candidates.concat(cells[sides.b][sides.r].objects);

        return candidates;
    }

    getSides (box) {
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
        if (bottom >= this.rows)
            bottom = this.rows - 1;
        else if (bottom < 0)
            bottom = 0;
        if (top >= this.rows)
            top = this.rows - 1;
        else if (top < 0)
            top = 0;

        return {t:top,b:bottom,l:left,r:right}
    }

    insert (type,game_object) {
        let cells = (type === 'dynamic') ? this.dynamic_cells : this.static_cells;
        let sides = this.getSides(game_object.box);
        
        for (let i = sides.t; i <= sides.b; i++) {
            for (let j = sides.l; j <= sides.r; j++) {
                if (cells[i][j].objects.indexOf(game_object) === -1)
                    cells[i][j].objects.push(game_object);
            }
        }
    }

    insertGameObjects (type,...args) {
        for (let i = 0; i < args.length; i++) {
            for (let j = 0; j < args[i].length; j++){
                this.insert(type,args[i][j]);
            }
        }
    }

    remove(type,game_object) {
        let cells = (type === 'dynamic') ? this.dynamic_cells : this.static_cells;
        let sides = this.getSides(game_object.box);   

        let obj_i = cells[sides.t][sides.l].objects.indexOf(game_object);
        if(obj_i !== -1)
            cells[sides.t][sides.l].objects.splice(obj_i,1);
        
        obj_i = cells[sides.t][sides.r].objects.indexOf(game_object);
        if(obj_i !== -1)
            cells[sides.t][sides.r].objects.splice(obj_i,1);

        obj_i = cells[sides.b][sides.l].objects.indexOf(game_object);
        if(obj_i !== -1)
            cells[sides.b][sides.l].objects.splice(obj_i,1);
        
        obj_i = cells[sides.b][sides.r].objects.indexOf(game_object);
        if(obj_i !== -1) 
            cells[sides.b][sides.r].objects.splice(obj_i,1);
    }
}

class Cell {
    constructor() {
        this.objects = [];
    }

    clear () {
        this.objects = [];
    }
}