class Controller {
    constructor () {
        this.pressed_keys = {};
        this.mouse = {};
        this.last_key_code = null;
        this.alias = {
            'Shift':16,
            'Control':17,
            'Alt':18,

            'ArrowLeft':37,
            'ArrowUp':38,
            'ArrowRight':39,
            'ArrowDown':40,

            'MouseLeft':1,
            'MouseMiddle':2,
            'MouseRight':3
        }
    }

    onKeyDown (event) {
        if (this.last_key_code !== event.keyCode) {
            this.pressed_keys[event.keyCode] = true;
            this.last_key_code = event.keyCode;
        }
    }

    onKeyUp (event) {
        delete this.pressed_keys[event.keyCode];
        this.last_key_code = null;
    }

    keyPressed (key,...modifiers) {
        if (this.alias[key])
            key = this.alias[key];
        else
            key = key.toUpperCase().charCodeAt(0);
        
        if (this.pressed_keys[key] === true) {
            for (let i = 0; i < modifiers.length; i++) {
                if (this.pressed_keys[this.alias[modifiers[i]]] === undefined)
                    return false;
            }
            return true;
        }
        return false;
    }
    
    onMouseDown (event) {
        this.mouse[event.which] = true;
    }

    onMouseUp (event) {
        delete this.mouse[event.which];
    }

    mousePressed (mouse_button,...modifiers) {
        if (this.alias[mouse_button])
            mouse_button = this.alias[mouse_button];

        if (this.mouse[mouse_button]) {
            for (let i = 0; i < modifiers.length; i++) {
                if (this.pressed_keys[this.alias[modifiers[i]]] === undefined)
                    return false;
            }
            return true;
        }
        return false;
    }
}