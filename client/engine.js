// Fixed Time Step Game Engine
class Engine {
    constructor (client,time_step) {
        this.client = client;
        
        // Engine Properties
        this.animation_frame_request = null;
        this.delta_time = 0;
        this.local_tick = 0;
        this.previous_time = 0;
        this.time_step = time_step || 1000/30;
        this.update_view = false;
    }

    run (time_stamp) {
        this.delta_time += time_stamp - this.previous_time;
        this.previous_time = time_stamp;

        // Update Game State
        let num_updates = 0;
        while (this.delta_time >= this.time_step) {
            this.num_updates++;
            if (num_updates >= 5) {
                this.delta_time = this.time_step;
                break;
            }
            
            this.client.processLocalInput();
            this.client.updateGameState();
            this.delta_time -= this.time_step;
            this.update_view = true;
            this.local_tick++;
        }

        // Update view
        if (this.update_view === true) {
            this.client.updateView();
            this.update_view = false;
        }

        this.animation_frame_request = window.requestAnimationFrame(this.run.bind(this));
    }

    start () {
        this.animation_frame_request = window.requestAnimationFrame(this.run.bind(this));
    }

    pause () {
        window.cancelAnimationFrame(this.animation_frame_request);
    }
}

if ('undefined' !== typeof global) {
    module.exports = {
        Engine
    }
}