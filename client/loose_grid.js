const LGridElt = function(next,id,mx,my,hx,hy) {
    // Stores the index to the next element in the cell using an indexed SLL.
    this.next = next;
    // Stores the ID of the element. This can be used to associate external data to the element.
    this.id = id;
    // Stores the center of the element.
    this.mx = mx, 
    this.my = my;
    // Stores the half-size of the element relative to the upper-left corner of the grid.
    this.hx = hx, 
    this.hy = hy;
}

const LGridLooseCell = function(head,l,t,r,b) {
    // Stores the index to the first element using an indexed SLL.
    this.head = head;
    // Stores the extents of the grid cell relative to the upper-left corner
    // of the grid which expands and shrinks with the elements inserted and removed.
    this.l = l;
    this.t = t;
    this.r = r;
    this.b = b;
}

const LGridTightCell = function(next,loose_x,loose_y) {
    // Stores the index to the next loose cell in the grid cell.
    this.next = next;
    // Stores the position of the loose cell in the grid.
    this.loose_x = loose_x;
    this.loose_y = loose_y;
}

const LGridRow = function(num_elts,lcells) {
    // Stores all the LGridElt elements in the row.
    this.elts = new Array();
    // Stores all the loose cells in the row.
    this.lcells = lcells;
    // Stores the number of elements in the row.
    this.num_elts = num_elts;
}

class LGrid {
    // Creates a loose grid encompassing the specified extents using the specified cell
    // size. Elements inserted to the loose grid are only inserted in one cell, but the
    // extents of each cell are allowed to expand and shrink. To avoid requiring every
    // loose cell to be checked during a search, a second grid of tight cells referencing
    // the loose cells is stored.
    constructor (cell_w,cell_h,l,t,r,b) {

        this.cell_w = cell_w;           // Stores the size of a cell.
        this.cell_h = cell_h;
        this.inv_cell_w = 1 / cell_w;   // Stores the inverse size of a cell.
        this.inv_cell_h = 1 / cell_h;
        this.x = l;                     // Stores the upper-left corner of the grid.
        this.y = t;
        this.w = r - l;                 // Stores the size of the grid.
        this.h = b - t;
        
        // Store the number of rows and columns in the grid.
        this.num_cols = Math.ceil(w / cell_w);
        this.num_rows = Math.ceil(h / cell_h);
        this.num_cells = num_cols * num_rows;
        
        this.tcells = new Array();                   // Stores all the tight cell nodes in the grid.
        this.tcell_heads = new Array(this.num_cells);   // Stores the tight cell heads.
        this.rows = new Array(this.num_rows);           // Stores all the rows in the grid.

        // Initialize tight cell heads with -1 to indicate empty indexed SLLs.
        for (let j = 0; j < this.num_cells; ++j)
            this.tcell_heads[j] = -1;

         // Initialize all the rows.
        for (let ly = 0; ly < this.num_rows; ++ly) {
            // Initialize the cells for the row.
            let loose_cells = new Array(this.num_cols);
            for (let lx = 0; lx < this.num_cols; ++lx) {
                let max = Number.MAX_VALUE;
                let loose_cell = new LGridLooseCell(-1,max,max,-max,-max);
                loose_cells[lx] = loose_cell;
            }
            let row = new LGridRow(0,loose_cells);
            this.rows[ly] = row;
        }
    }

    // Destroys the grid.
    lgrid_destroy() {
        for (let y = 0; y < this.num_rows; ++y)
            delete this.rows[y].lcells;
        delete this.rows;
        delete this.tcell_heads;
        delete this;
    }

    // Returns the grid X position for the specified free X position.
    getCellX(x) {
        return to_cell_idx(x - this.x, this.inv_cell_w, this.num_cols);
    }

    // Returns the grid Y position for the specified free Y position.
    getCellY(y) {
        return to_cell_idx(y - this.y, this.inv_cell_h, this.num_rows);
    }

    // Inserts an element to the grid.
    insertElement(id,mx,my,hx,hy) {
        mx -= this.x;
        my -= this.y;
        const cell_x = to_cell_idx(mx, this.inv_cell_w, this.num_cols);
        const cell_y = to_cell_idx(my, this.inv_cell_h, this.num_rows);
        let row = this.rows[cell_y];
        let lcell = row.lcells[cell_x];
    
        // Insert the element to the appropriate loose cell and row.
        const new_elt = new LGridElt(lcell.head,id,mx,my,hx,hy);
        lcell.head = row.elts.insert(new_elt);
        ++row.num_elts;
    
        // Expand the loose cell's bounding box to fit the new element.
        this.expandAABB(this, cell_x, cell_y, mx, my, hx, hy);
    }

    // Removes an element from the grid.
    removeElement(id,mx,my) {
        mx -= this.x;
        my -= this.y;
        const cell_x = to_cell_idx(mx, this.inv_cell_w, this.num_cols);
        const cell_y = to_cell_idx(my, this.inv_cell_h, this.num_rows);
        let row = this.rows[cell_y];
        let lcell = row.lcells[cell_x];
    
        // Find the element in the loose cell.
        let link = lcell.head;
        while (row.elts[link].id !== id)
            link = row.elts[++link];
    
        // Remove the element from the loose cell and row.
        const elt_idx = link;
        link = row.elts[++elt_idx];
        row.elts.splice(elt_idx,1);
        --row.num_elts;
    }
    
    // Moves an element in the grid from the former position to the new one.
    moveElement(id,prev_mx,prev_my,mx,my) {
        const prev_cell_x = this.getCellX(prev_mx);
        const prev_cell_y = this.getCellY(prev_my);
        const new_cell_x = this.getCellX(mx);
        const new_cell_y = this.getCellY(my);
    
        if (prev_cell_x === new_cell_x && prev_cell_y === new_cell_y)
            this.moveElementWithinCell(id, prev_cell_x, prev_cell_y, mx, my);
        else {
            let row = this.rows[prev_cell_y];
            let lcell = row.lcells[prev_cell_x];
    
            // Find the element in the loose cell.
            let link = lcell.head;
            while (row.elts[link].id !== id)
                link = row.elts[++link];
    
            const elt_idx = link;
            const hx = row.elts[elt_idx].hx;
            const hy = row.elts[elt_idx].hy;
    
            // If the element has moved into a different loose cell, remove
            // remove the element from the previous loose cell and row.
            link = row.elts[++elt_idx];
            row.elts.splice(elt_idx,1);
            --row.num_elts;
    
            // Now insert the element to its new position.
            this.insertElement(id, mx, my, hx, hy);
        }
    }

    // Moves an element in the grid from the former position to the new one in the
    // same cell. Note that the new element position should belong in the same cell
    // as the former one.
    moveElementWithinCell(id,cell_x,cell_y,mx,my) {
        let row = this.rows[cell_y];
        let lcell = row.lcells[cell_x];
    
        // Find the element in the loose cell.
        let link = lcell.head;
        while (row.elts[link].id !== id)
            link = row.elts[++link];
    
        // Since the element is still inside the same cell, we can simply overwrite
        // its position and expand the loose cell's AABB.
        if (this.getCellX(mx) === cell_x && this.getCellY(my) === cell_y) {
            mx -= this.x;
            my -= this.y;
            row.elts[elt_idx].mx = mx;
            row.elts[elt_idx].my = my;
            this.expandAABB(cell_x, cell_y, mx, my, row.elts[elt_idx].hx, row.elts[elt_idx].hy);
        }
        
    }

    // Returns all the elements that intersect the specified rectangle excluding elements
    // with the specified ID to omit.
    query(mx,my,hx,hy,omit_id) {
        mx -= this.x;
        my -= this.y;
        const q_l = mx-hx, 
            q_t = my-hy,
            q_r = mx+hx, 
            q_b = my+hy;
    
        const tmin_x = to_cell_idx(q_l, this.inv_cell_w, this.num_cols);
        const tmax_x = to_cell_idx(q_r, this.inv_cell_w, this.num_cols);
        const tmin_y = to_cell_idx(q_t, this.inv_cell_h, this.num_rows);
        const tmax_y = to_cell_idx(q_b, this.inv_cell_h, this.num_rows);
    
        let res = new Array();
        for (ty = tmin_y; ty <= tmax_y; ++ty) {
            let tight_row = this.tcell_heads + (ty*this.num_cols);
            for (let tx = tmin_x; tx <= tmax_x; ++tx) {
                // Iterate through the loose cells that intersect the tight cells.
                let tcell_idx = tight_row[tx];
                while (tcell_idx !== -1) {
                    const tcell = this.tcells[tcell_idx];
                    const lcell = this.rows[tcell.loose_y].lcells[tcell.loose_x];
    
                    // If the search rectangle intersects the loose cell's AABB, search the
                    // elements in the loose cell.
                    if (q_l <= lcell.r && q_r >= lcell.l && q_t <= lcell.b && q_b >= lcell.t) {
                        const row = this.rows[tcell.loose_y];
                        let elt_idx = lcell.head;
                        while (elt_idx !== -1) {
                            const elt = row.elts[elt_idx];
                            const e_l = elt.mx-elt.hx, e_t = elt.my-elt.hy;
                            const e_r = elt.mx+elt.hx, e_b = elt.my+elt.hy;
    
                            // If the element intersects the search rectangle, add it to the
                            // resulting elements unless it has an ID that should be omitted.
                            if (q_l <= e_r && q_r >= e_l && q_t <= e_b && q_b >= e_t && elt.id !== omit_id)
                                res.push(elt.id);
                            elt_idx = elt.next;
                        }
                    }
                    tcell_idx = tcell.next;
                }
            }
        }
        return res;
    }

    // Returns true if the specified rectangle is inside the grid boundaries.
    inBounds(mx,my,hx,hy) {
        mx -= this.x;
        my -= this.y;
        const x1 = mx-hx, 
            y1 = my-hy, 
            x2 = mx+hx, 
            y2 = my+hy;
        return x1 >= 0 && x2 < this.w && y1 >= 0 && y2 < this.h;
    }

    expandAABB(cell_x,cell_y,mx,my,hx,hy) {
        let row = this.rows[cell_y];
        let lcell = row.lcells[cell_x];
        const prev_l = lcell.l, prev_t = lcell.t;
        const prev_r = lcell.r, prev_b = lcell.b;
        lcell.l = Math.min(lcell.l, mx - hx);
        lcell.t = Math.min(lcell.t, my - hx);
        lcell.r = Math.max(lcell.r, mx + hx);
        lcell.b = Math.max(lcell.b, my + hy);
    
        // Determine the cells occupied by the loose cell in the tight grid.
        const tmin_x = to_cell_idx(lcell.l, this.inv_cell_w, this.num_cols);
        const tmax_x = to_cell_idx(lcell.r, this.inv_cell_w, this.num_cols);
        const tmin_y = to_cell_idx(lcell.t, this.inv_cell_h, this.num_rows);
        const tmax_y = to_cell_idx(lcell.b, this.inv_cell_h, this.num_rows);
    
        if (prev_l > prev_r) {
            // If the loose cell was empty, simply insert the loose cell
            // to all the tight cells it occupies. We don't need to check
            // to see if it was already inserted.
            for (let ty = tmin_y; ty <= tmax_y; ++ty) {
                let tight_row = this.tcell_heads + ty*this.num_cols;
                for (let tx = tmin_x; tx <= tmax_x; ++tx) {
                    const new_tcell = new LGridTightCell(tight_row[tx], cell_x, cell_y);
                    tight_row[tx] = this.tcells.insert(new_tcell);
                }
            }
        } else {
            const prev_tmin_x = to_cell_idx(prev_l, this.inv_cell_w, this.num_cols);
            const prev_tmax_x = to_cell_idx(prev_r, this.inv_cell_w, this.num_cols);
            const prev_tmin_y = to_cell_idx(prev_t, this.inv_cell_h, this.num_rows);
            const prev_tmax_y = to_cell_idx(prev_b, this.inv_cell_h, this.num_rows);
    
            // Only perform the insertion if the loose cell overlaps new tight cells.
            if (tmin_x != prev_tmin_x || tmin_y != prev_tmin_y ||
                tmax_x != prev_tmax_x || tmax_y != prev_tmax_y) {
                for (let ty = tmin_y; ty <= tmax_y; ++ty) {
                    let tight_row = this.tcell_heads + ty*this.num_cols;
                    for (let tx = tmin_x; tx <= tmax_x; ++tx) {
                        if (tx < prev_tmin_x || tx > prev_tmax_x ||
                            ty < prev_tmin_y || ty > prev_tmax_y) {
                            const new_tcell = new LGridTightCell(tight_row[tx], cell_x, cell_y);
                            if(!tcell_contains(this, tight_row[tx], cell_x, cell_y))
                                tight_row[tx] = this.tcells.insert(new_tcell);
                        }
                    }
                }
            }
        }
    }
}
 
//////////////////////////////////////////////////////////////////////////////////
// FUNCTIONS

var clamp_int = function(val,low,high) {
    return Math.min(Math.max(val, low), high);
}
 
var to_cell_idx = function(val,inv_cell_size,num_cells) {
    return clamp_int(Math.floor(val * inv_cell_size), 0, num_cells - 1);
}
/*
var tcell_contains = function(grid,tight_head,loose_x,loose_y) {
    // Returns true if the tight cell contains the specified loose cell.
    let tcell_idx = tight_head;
    while (tcell_idx != -1) {
        const LGridTightCell* tcell = &grid->tcells[tcell_idx];
        if (tcell->loose_x == loose_x && tcell->loose_y == loose_y)
            return true;
        tcell_idx = tcell->next;
    }
    return false;
}

var row_optimize = function(LGridRow* row, int num_cols)
{
    FreeList<LGridElt> new_elts;
    new_elts.reserve(row->num_elts);
    for (let j = 0; j < num_cols; ++j)
    {
        LGridLooseCell* lcell = &row->lcells[j];
 
        // Replace links to the old elements list to links in the new
        // cache-friendly element list.
        SmallList<int> new_elt_idxs;
        while (lcell->head != -1)
        {
            const LGridElt* elt = &row->elts[lcell->head];
            new_elt_idxs.push_back(new_elts.insert(*elt));
            lcell->head = elt->next;
        }
 
        for (int j=0; j < new_elt_idxs.size(); ++j)
        {
            const int new_elt_idx = new_elt_idxs[j];
            new_elts[new_elt_idx].next = lcell->head;
            lcell->head = new_elt_idx;
        }
    }
    // Swap the new element list with the old one.
    row->elts.swap(new_elts);
}



/* Unused

// Optimizes the grid, shrinking bounding boxes in response to removed elements and
// rearranging the memory of the grid to allow cache-friendly cell access.
void lgrid_optimize(LGrid* grid) {
    // Clear all the tight cell data.
    const int num_cells = grid->num_rows * grid->num_cols;
    for (int j=0; j < num_cells; ++j)
        grid->tcell_heads[j] = -1;
    grid->tcells.clear();
 
    #pragma omp parallel for
    for (int ly=0; ly < grid->num_rows; ++ly)
    {
        // Optimize the memory layout of the row.
        LGridRow* row = &grid->rows[ly];
        row_optimize(row, grid->num_cols);
 
        // Recalculate the bounding boxes for all the loose cells.
        for (int lx=0; lx < grid->num_cols; ++lx)
        {
            // Empty the loose cell's bounding box.
            LGridLooseCell* lcell = &row->lcells[lx];
            lcell->l = FLT_MAX;
            lcell->t = FLT_MAX;
            lcell->r = -FLT_MAX;
            lcell->b = -FLT_MAX;
 
            // Expand the bounding box by each element's extents in
            // the loose cell.
            int elt_idx = lcell->head;
            while (elt_idx != -1)
            {
                const LGridElt* elt = &row->elts[elt_idx];
                lcell->l = min_flt(lcell->l, elt->mx - elt->hx);
                lcell->t = min_flt(lcell->t, elt->my - elt->hy);
                lcell->r = max_flt(lcell->r, elt->mx + elt->hx);
                lcell->b = max_flt(lcell->b, elt->my + elt->hy);
                elt_idx = elt->next;
            }
        }
    }
 
    for (int ly=0; ly < grid->num_rows; ++ly)
    {
        LGridRow* row = &grid->rows[ly];
        for (int lx=0; lx < grid->num_cols; ++lx)
        {
            // Insert the loose cell to all the tight cells in which
            // it now belongs.
            LGridLooseCell* lcell = &row->lcells[lx];
            const int tmin_x = to_cell_idx(lcell->l, grid->inv_cell_w, grid->num_cols);
            const int tmax_x = to_cell_idx(lcell->r, grid->inv_cell_w, grid->num_cols);
            const int tmin_y = to_cell_idx(lcell->t, grid->inv_cell_h, grid->num_rows);
            const int tmax_y = to_cell_idx(lcell->b, grid->inv_cell_h, grid->num_rows);
            for (int ty = tmin_y; ty <= tmax_y; ++ty)
            {
                int* tight_row = grid->tcell_heads + ty*grid->num_cols;
                for (int tx = tmin_x; tx <= tmax_x; ++tx)
                {
                    const LGridTightCell new_tcell = {tight_row[tx], lx, ly};
                    tight_row[tx] = grid->tcells.insert(new_tcell);
                }
            }
        }
    }
}
*/