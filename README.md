# Online Platformer Demo

This is a demo level for a game that I am making using my own custom engine.  It contains 3 weapons to find of 3 different tiers, each with their own special ability.  There are also 3 boot upgrades and a heart upgrade that provide additional benefits and utilities to the player.


__Live Demo :__ <a href="https://ctf-nfe-demo.herokuapp.com/" target="_blank">https://ctf-nfe-demo.herokuapp.com/</a>


__Controls :__
* Switch Aspect Ratio:  Ctrl+C
* Make Full Screen:     Ctrl+V
* Movement:             W,A,S,D or arrow keys
* Move Spawn Point:     Q
* Interact:             E
* Switch Weapons:       R
* Fire Weapon:          Left Mouse Button
* Weapon Ability:       Right Mouse Button
* Boots_03 Ability:     Shift


__Engine Details :__
* Time Step : Fixed
* Broad Phase Collision : Spatial Grid
* Narrow Phase Collision : Simple AABB, Swept AABB
* Trigger System : Custom Events, Conditions, Actions
* Enemy AI : Finate State Machine
* Server : Authoritative Server or Authoritative Host (Not yet fully implemented)


__Libraries & Technologies Used :__
* Node JS
* Express
* Socket.io
* Pixi JS


__Planned Updates :__
* __v1.0.2 - Creep AI__
  * Features: More creep AI states, Creep AI pathfinding, More visual feedback fx, Level geometry optimization
* __v1.0.3 - AI Party and Inventory Management__
  * Features: AI party members, Switch between party members, Operate party members independently, Inventory for equipping party members 
* __v1.1.0 - Multiplayer__
  * Features: Online multiplayer, Joinable rooms
