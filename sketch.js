/*
  Week 9 — Example 3: Adding Sound & Music

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Mar. 19, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
      = empty (no sprite)
*/

let player;
let playerImg, bgImg;
let jumpSfx, musicSfx;
let musicStarted = false;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep;
let groundImg, groundDeepImg;

let attacking = false; // track if the player is attacking
let attackFrameCounter = 0; // tracking attack animation

// Debug variables
let debugMode = false;
let moonGravityActive = false;
let hitboxesVisible = false;
const NORMAL_GRAVITY = 10;
const MOON_GRAVITY = 1.67;
let showInstructions = true;
let instructionTimer = 0;
let instructionDuration = 600; // 10 seconds at 60fps

// --- TILE MAP ---
// an array that uses the tile key to create the level
let level = [
  "              ",
  "              ",
  "              ",
  "              ",
  "              ",
  "       ggg    ",
  "gggggggggggggg", // surface ground
  "dddddddddddddd", // deep ground
];

// --- LEVEL CONSTANTS ---
// camera view size
const VIEWW = 320,
  VIEWH = 180;

// tile width & height
const TILE_W = 24,
  TILE_H = 24;

// size of individual animation frames
const FRAME_W = 32,
  FRAME_H = 32;

// Y-coordinate of player start (4 tiles above the bottom)
const MAP_START_Y = VIEWH - TILE_H * 4;

// gravity
const GRAVITY = 10;

function preload() {
  // --- IMAGES ---
  playerImg = loadImage("assets/foxSpriteSheet.png");
  bgImg = loadImage("assets/combinedBackground.png");
  groundImg = loadImage("assets/groundTile.png");
  groundDeepImg = loadImage("assets/groundTileDeep.png");

  // --- SOUND ---
  if (typeof loadSound === "function") {
    jumpSfx = loadSound("assets/sfx/jump.wav");
    musicSfx = loadSound("assets/sfx/music.wav");
  }
}

function setup() {
  // pixelated rendering with autoscaling
  new Canvas(VIEWW, VIEWH, "pixelated");

  // needed to correct an visual artifacts from attempted antialiasing
  allSprites.pixelPerfect = true;

  world.gravity.y = GRAVITY;

  // Try to start background music immediately.
  if (musicSfx) musicSfx.setLoop(true);
  startMusicIfNeeded();

  // --- TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundImg;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundDeepImg;
  groundDeep.tile = "d";

  // a Tiles object creates a level based on the level map array (defined at the beginning)
  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, MAP_START_Y, FRAME_W, FRAME_H); // create the player
  player.spriteSheet = playerImg; // use the sprite sheet
  player.rotationLock = true; // turn off rotations (player shouldn't rotate)

  // player animation parameters
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -4; // offset the collision box up
  player.addAnis(playerAnis); // add the player animations defined earlier
  player.ani = "idle"; // default to the idle animation
  player.w = 18; // set the width of the collsion box
  player.h = 20; // set the height of the collsion box
  player.friction = 0; // set the friciton to 0 so we don't stick to walls
  player.bounciness = 0; // set the bounciness to 0 so the player doesn't bounce

  // --- GROUND SENSOR --- for use when detecting if the player is standing on the ground
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;
}

function startMusicIfNeeded() {
  if (musicStarted || !musicSfx) return;

  const startLoop = () => {
    if (!musicSfx.isPlaying()) musicSfx.play();
    musicStarted = musicSfx.isPlaying();
  };

  // Some browsers require a user gesture before audio can start.
  const maybePromise = userStartAudio();
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.then(startLoop).catch(() => {});
  } else {
    startLoop();
  }
}

function keyPressed() {
  startMusicIfNeeded();

  // Hide instructions on any key press
  showInstructions = false;

  // Debug controls
  if (key === "m" || key === "M") {
    debugMode = !debugMode;
  }
  if (key === "o" || key === "O") {
    moonGravityActive = !moonGravityActive;
    world.gravity.y = moonGravityActive ? MOON_GRAVITY : NORMAL_GRAVITY;
  }
  if (key === "h" || key === "H") {
    hitboxesVisible = !hitboxesVisible;
    toggleHitboxes();
  }
}

function mousePressed() {
  startMusicIfNeeded();
}

function touchStarted() {
  startMusicIfNeeded();
  return false;
}

function draw() {
  // --- BACKGROUND ---
  camera.off();
  if (bgImg) {
    imageMode(CORNER);
    image(bgImg, 0, 0, bgImg.width, bgImg.height);
  } else {
    background(50);
  }
  camera.on();

  // --- PLAYER CONTROLS ---
  // first check to see if the player is on the ground
  let grounded = sensor.overlapping(ground);

  // -- ATTACK INPUT --
  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play(); // plays once to end
  }

  // -- JUMP --
  if (grounded && kb.presses("up")) {
    player.vel.y = -4;
    if (jumpSfx) jumpSfx.play();
  }

  // --- STATE MACHINE ---
  if (attacking) {
    attackFrameCounter++;
    // Attack lasts ~6 frames * frameDelay 2 = 12 cycles (adjust if needed)
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- MOVEMENT ---
  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  // --- KEEP IN VIEW ---
  player.pos.x = constrain(player.pos.x, FRAME_W / 2, VIEWW - FRAME_W / 2);

  // --- DEBUG SCREEN ---
  displayDebugScreen();
  displayInstructions();
  camera.on();
}

function displayDebugScreen() {
  if (!debugMode) return;

  camera.off();
  push();

  // Black background rectangle - centered
  fill(0, 0, 0, 180);
  stroke(100, 100, 100);
  strokeWeight(2);
  rect(width / 2 - 150, height / 2 - 80, 300, 160);

  // Instructions at top
  fill(150, 200, 255);
  textSize(8);
  textAlign(CENTER);
  text(
    "Press O - Moon Gravity | Press H - Hitboxes",
    width / 2,
    height / 2 - 65,
  );

  // Title
  fill(255);
  textSize(12);
  textAlign(CENTER);
  text("DEBUG SCREEN", width / 2, height / 2 - 45);

  // Moon Gravity status
  fill(255);
  textSize(9);
  textAlign(CENTER);
  text(
    "Moon Gravity: " + (moonGravityActive ? "ON" : "OFF"),
    width / 2,
    height / 2 - 20,
  );

  // Hitbox status
  textSize(9);
  text(
    "Hitboxes: " + (hitboxesVisible ? "ON" : "OFF"),
    width / 2,
    height / 2 + 4,
  );

  // Current gravity value
  textSize(8);
  text("Current Gravity: " + GRAVITY.toFixed(2), width / 2, height / 2 - 8);

  pop();
}

function toggleHitboxes() {
  allSprites.forEach((sprite) => {
    sprite.debug = hitboxesVisible;
  });
}

function displayInstructions() {
  if (!showInstructions) return;

  camera.off();
  push();

  // Black background rectangle at bottom - full width
  fill(0, 0, 0, 220);
  noStroke();
  rect(0, height - 40, width, 40);

  // Instructions text
  fill(255);
  textSize(12);
  textAlign(CENTER);
  textStyle(NORMAL);
  text("Press M to toggle the Debug Screen", width / 2, height - 18);

  pop();
}
