
const Engine = function(time_step,client) {
    this.time_step = time_step;
    this.tick = 0;

    this.run = function(time_stamp){
        this.tick++;
        this.animation_frame_request = window.requestAnimationFrame(this.handleRun);

        this.accumulated_time += time_stamp - this.time;
        this.time = time_stamp;

        // Hande user input
        client.processInput();

        // Update game state
        if (this.accumulated_time >= this.time_step * 3) {
            this.accumulated_time = this.time_step;
        }
        while (this.accumulated_time >= this.time_step) {
            this.accumulated_time -= this.time_step;
            client.update(time_stamp);
            this.updated = true;
        }

        // Render
        if (this.updated === true) {
            this.updated = false;
            client.render(time_stamp);
        }
    }

    this.handleRun = (time_step) => {this.run(time_step);};
};

Engine.prototype = {
    constructor : Engine,
    start : function() {
        this.accumulated_time = this.time_step;
        this.time = window.performance.now();
        this.animation_frame_request = window.requestAnimationFrame(this.handleRun);
    },
    stop : function() {
        window.cancelAnimationFrame(this.animation_frame_request);
    }
}