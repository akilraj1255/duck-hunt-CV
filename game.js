/**
 * ============================================================================
 * DUCK HUNT CV - LOGIC EXPLANATION (V3 - FULL DOCUMENTATION)
 * ============================================================================
 * 
 * 1. COMPUTER VISION MAPPING:
 *    - Sensitivity: 1.4x amplification of hand movement to reach screen edges easily.
 *    - Smoothing (LERP): 0.7 interpolation to prevent jittery crosshair movement.
 * 
 * 2. GESTURE DETECTION:
 *    - Pinch Shoot: Detects distance between Thumb and Index finger tips.
 *    - Trigger Threshold: Distance < 0.09 normalized units creates a 'Click'.
 * 
 * 3. LEVEL & STRIKE SYSTEM:
 *    - Strikes: Every escape duck = 1 strike. 3 strikes and game ends.
 *    - Progression: Every 5 kills = Level Up (Higher speed, more ducks).
 * 
 * 4. DUCK TIMER:
 *    - Ducks are rendered with a life-bar. If the bar empties, the duck flees.
 * ============================================================================
 */

// Import MediaPipe Computer Vision libraries directly from a reliable CDN
import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

class DuckHuntGame {
    /**
     * INITIALIZATION: Setup all the starting variables and UI references
     */
    constructor() {
        // Core Rendering Elements
        this.canvas = document.getElementById('gameCanvas'); // Main background/duck canvas
        this.ctx = this.canvas.getContext('2d');           // Drawing tools for the canvas
        this.cvOverlay = document.getElementById('cv-overlay'); // UI Overlay for hand skeleon
        this.cvCtx = this.cvOverlay.getContext('2d');      // Drawing tools for CV points
        this.video = document.getElementById('webcam');    // The camera feed element
        this.crosshair = document.getElementById('crosshair'); // The red targeting reticle

        // Heads-Up Display (HUD) References
        this.scoreElement = document.getElementById('score'); // Score number text
        this.roundElement = document.getElementById('round'); // Level/Round counter
        this.ammoDisplay = document.getElementById('ammo-display'); // Bullet icons
        this.strikeDisplay = document.getElementById('strike-display'); // X X X counter
        this.timerElement = document.getElementById('round-timer'); // Round clock (60s)

        // Menu & Overlay UI References
        this.menuOverlay = document.getElementById('menu-overlay'); // Fullscreen Start/Gameover screen
        this.menuTitle = document.getElementById('menu-title');   // Logic text for game state
        this.menuSubtitle = document.getElementById('menu-subtitle'); // Score readout
        this.menuInstructions = document.getElementById('menu-instructions'); // How to play
        this.startBtn = document.getElementById('start-btn'); // Main interaction button

        // Game Tracking Variables (Starting State)
        this.score = 0;                     // Current player score
        this.round = 1;                     // Difficulty level
        this.ammo = 3;                      // Remaining bullets
        this.strikes = 0;                   // Number of ducks missed
        this.ducksShotThisRound = 0;        // Used to track Level Up progression
        this.gameState = 'menu';            // Current phase (menu vs playing)
        this.roundStartTime = null;         // Timestamp for the 60s level clock

        // Configuration Settings
        this.ducks = [];                    // Array to hold all active duck objects
        this.maxDucksInScene = 1;           // How many ducks can move at once (increases per level)
        this.baseLifeTime = 10000;          // Base time a duck stays on screen (10 seconds)

        // Computer Vision Control State
        this.handLandmarker = null;         // Holds the AI hand-tracking model
        this.handPos = { x: 0, y: 0 };      // Smooth X/Y coordinates of the crosshair
        this.isPinching = false;           // Tracks if user is actually pinching right now
        this.lastPinchTime = 0;             // Used for a "cooldown" between shots (debounce)

        // Image Asset Containers
        this.assets = {
            bg: new Image(),               // Custom pixel background
            duck: new Image(),             // Raw duck sprite sheet (with green bg)
            processedDuck: null            // Will hold the transparent version
        };

        // Start the engine
        this.init();
    }

    /**
     * INIT: Loads images and prepares the AI model
     */
    async init() {
        // Ensure game fits the screen correctly
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Source URLs for game images
        this.assets.bg.src = 'assets/background.png';
        this.assets.duck.src = 'assets/duck.png';

        // Initialize MediaPipe AI first
        // When duck image loads, process it to remove transparency
        this.assets.duck.onload = () => {
            this.assets.processedDuck = this.makeTransparent(this.assets.duck, [0, 255, 0]); // Chroma key GREEN
        };

        await this.setupCV();

        // Start Interaction Logic
        this.startBtn.addEventListener('click', () => {
            if (this.handLandmarker) {
                // If game is over or at menu, reset and go
                if (this.gameState === 'game-over' || this.gameState === 'menu') {
                    this.resetGame();
                    this.startGame();
                }
            }
        });

        // Begin the infinite drawing loop
        this.gameLoop();
    }

    /**
     * RESET: Hard reset of all counters for a new run
     */
    resetGame() {
        this.score = 0;
        this.round = 1;
        this.strikes = 0;
        this.ducksShotThisRound = 0;
        this.maxDucksInScene = 1;
        this.ducks = [];
        this.ammo = 3;
        this.roundStartTime = null;
        if (this.timerElement) this.timerElement.innerText = "60"; // Visual reset
        this.updateHUD(); // Clear all boards
    }

    /**
     * SETUP CV: Loads the vision AI from Google MediaPipe
     */
    async setupCV() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU" // Use computer hardware for faster tracking
            },
            runningMode: "VIDEO", // Optimized for real-time cameras
            numHands: 1          // Only track the shooter's hand
        });

        // Update UI when AI is ready
        document.getElementById('status-msg').innerText = "AI Ready! Ready to Hunt.";
        this.startBtn.innerText = "START HUNT";
    }

    /**
     * START GAME: Activates the webcam and begins play
     */
    async startGame() {
        try {
            // Request webcam permissions and stream to video element
            if (!this.video.srcObject) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                this.video.srcObject = stream;
            }

            // Wait for video pixels to actually be readable (avoid black frame init)
            this.video.addEventListener('loadeddata', () => {
                console.log("Webcam Loaded - Starting Game");
                this.gameState = 'playing';
                this.roundStartTime = performance.now(); // Start the 60s countdown
                this.menuOverlay.style.display = 'none'; // Clear the menu
                this.crosshair.style.display = 'block';  // Show the crosshair
                this.spawnIfNeeded();                   // Spawn first duck
            });

            // Backup check if event already fired
            if (this.video.readyState >= 2) {
                console.log("Webcam Ready - Starting Game");
                this.gameState = 'playing';
                this.roundStartTime = performance.now();
                this.menuOverlay.style.display = 'none';
                this.crosshair.style.display = 'block';
                this.spawnIfNeeded();
            }
        } catch (err) {
            console.error("Webcam blocked", err);
            document.getElementById('status-msg').innerText = "Error: Webcam access denied!";
        }
    }

    /**
     * RESIZE: Syncs the game container size with the canvas pixels
     */
    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        // Internal AI overlay is kept small (200x150) for performance
        this.cvOverlay.width = 200;
        this.cvOverlay.height = 150;
    }

    /**
     * SPAWN LOGIC: Ensures there are always enough ducks in the level
     */
    spawnIfNeeded() {
        while (this.ducks.length < this.maxDucksInScene) {
            this.spawnDuck();
        }
    }

    /**
     * SPAWN DUCK: Creates a new duck object with randomized behavior and speed
     */
    spawnDuck() {
        const side = Math.random() > 0.5 ? 1 : -1; // Randomly start on Left or Right
        // Calculate Reaction Time: Level 1 = 10s, Level 5 = 6s, Level 10 = 4s (Harder!)
        const currentLifeTime = Math.max(3000, this.baseLifeTime - (this.round * 800));

        this.ducks.push({
            id: Date.now() + Math.random(), // Unique ID for object tracking
            x: side === 1 ? -100 : this.canvas.width + 100, // Position off-screen
            y: this.canvas.height * 0.7 - Math.random() * (this.canvas.height * 0.4), // Low to medium height
            targetX: Math.random() * this.canvas.width, // Where it wants to fly next
            targetY: Math.random() * (this.canvas.height / 2),
            speed: 2 + (Math.random() * 2) + (this.round * 0.6), // Faster every level
            status: 'flying', // Possible: flying, hit, falling, fleeing
            frame: 0,         // Animation frame index
            direction: side,  // -1 for Left, 1 for Right
            timer: 0,         // Internal tick counter
            spawnTime: performance.now(), // For the kill-bar countdown
            lifeTime: currentLifeTime,    // How long it stays before escaping
            fleeing: false
        });
    }

    /**
     * GAME OVER: Show visual stats and stop movement
     */
    gameOver() {
        this.gameState = 'game-over';
        this.menuOverlay.style.display = 'flex';
        this.menuTitle.innerHTML = "GAME OVER";
        this.menuSubtitle.innerText = `Final Score: ${this.score}`;
        this.menuInstructions.innerHTML = `You missed too many ducks!<br>Level Reached: ${this.round}`;
        this.startBtn.innerText = "TRY AGAIN";
        this.crosshair.style.display = 'none';
    }

    /**
     * LEVEL UP: Increase difficulty and show feedback message
     */
    levelUp() {
        this.round++;                   // Higher level
        this.ducksShotThisRound = 0;   // Reset kill streak
        this.roundStartTime = performance.now(); // Reset 60s clock

        // Every 2 levels, add an extra duck simultaneously on screen
        if (this.round % 2 === 0 && this.maxDucksInScene < 4) {
            this.maxDucksInScene++;
        }

        this.updateHUD(); // Refresh text on level up

        // Show big message in middle of screen
        const levelMsg = document.createElement('div');
        levelMsg.style.position = 'absolute';
        levelMsg.style.top = '50%';
        levelMsg.style.left = '50%';
        levelMsg.style.transform = 'translate(-50%, -50%)';
        levelMsg.style.fontFamily = "'Press Start 2P'";
        levelMsg.style.color = '#55e6ff';
        levelMsg.style.fontSize = '3rem';
        levelMsg.style.zIndex = '1000';
        levelMsg.innerText = `LEVEL ${this.round}`;
        document.getElementById('game-container').appendChild(levelMsg);

        // Remove message after 2 seconds
        setTimeout(() => levelMsg.remove(), 2000);
    }

    /**
     * UPDATE: Calculations for duck movements and physics
     */
    update() {
        if (this.gameState !== 'playing') return; // Skip if not active

        const now = performance.now();

        this.ducks.forEach((duck, index) => {
            if (duck.status === 'flying') {
                // TIMER CHECK: Escape if time is up
                const elapsed = now - duck.spawnTime;
                if (elapsed > duck.lifeTime) {
                    duck.status = 'fleeing';
                    this.addStrike(); // Missing a duck counts as a strike
                }

                // AI FLIGHT PATH: Move toward current target coordinates
                duck.x += (duck.targetX - duck.x) * (0.01 * duck.speed);
                duck.y += (duck.targetY - duck.y) * (0.01 * duck.speed);

                // PICK NEW TARGET: If we reached the goal, pick a new random spot
                if (Math.abs(duck.x - duck.targetX) < 20) {
                    duck.targetX = Math.random() * this.canvas.width;
                    duck.targetY = Math.random() * (this.canvas.height / 2);
                }

                // ANIMATE: Swap wing animation frame every few ticks
                duck.timer++;
                if (duck.timer % 10 === 0) duck.frame = (duck.frame + 1) % 3;
            }
            else if (duck.status === 'hit') {
                // HIT STATE: Pause briefly in the air when shot
                duck.timer++;
                if (duck.timer > 20) {
                    duck.status = 'falling';
                }
            }
            else if (duck.status === 'falling') {
                // FALL STATE: Move straight down off screen
                duck.y += 25;
                if (duck.y > this.canvas.height) {
                    this.ducks.splice(index, 1);
                    this.spawnIfNeeded();
                }
            }
            else if (duck.status === 'fleeing') {
                // ESCAPE STATE: Fly vertically up very fast
                duck.y -= 15;
                duck.timer++;
                if (duck.timer % 5 === 0) duck.frame = (duck.frame + 1) % 3;

                if (duck.y < -100) {
                    this.ducks.splice(index, 1);
                    this.spawnIfNeeded();
                }
            }
        });

        // Run the Hand Tracking calculations
        this.processCV();
    }

    /**
     * STRIKES: Handle missing a duck
     */
    addStrike() {
        this.strikes++;
        this.updateHUD(); // Light up a red X
        if (this.strikes >= 3) {
            this.gameOver(); // 3 strikes = Loss
        }
    }

    /**
     * PROCESS CV: The "Brain" of the Hand-Control System
     */
    async processCV() {
        // Ensure webcam is on and model is ready
        if (this.video.readyState === 4 && this.handLandmarker) {
            // Ask MediaPipe to find the hand current position
            const results = this.handLandmarker.detectForVideo(this.video, performance.now());
            this.cvCtx.clearRect(0, 0, 200, 150); // Clear the tiny skeletal view

            if (results.landmarks && results.landmarks.length > 0) {
                const hand = results.landmarks[0]; // Take the first detected hand
                // Use Point 9 (the base of middle finger) as the 'Aim' point
                const palmX = hand[9].x;
                const palmY = hand[9].y;

                // MAPPING MATH: Multipliers make small hand moves cover the big screen
                const sensitivity = 1.4;
                const smoothing = 0.7; // 0.7 LERP = very smooth, minimal lag

                // Calculate where the hand 'wants' to go
                let targetX = (0.5 + (0.5 - palmX) * sensitivity) * this.canvas.width;
                let targetY = (0.5 + (palmY - 0.5) * sensitivity) * this.canvas.height;

                // Ensure crosshair doesn't fly off-screen
                targetX = Math.max(0, Math.min(this.canvas.width, targetX));
                targetY = Math.max(0, Math.min(this.canvas.height, targetY));

                // Interpolate current crosshair to target (Smooth Transition)
                this.handPos.x += (targetX - this.handPos.x) * smoothing;
                this.handPos.y += (targetY - this.handPos.y) * smoothing;

                // Move the Crosshair element to match hand location
                this.crosshair.style.left = `${this.handPos.x}px`;
                this.crosshair.style.top = `${this.handPos.y}px`;

                // GESTURE: Detect 'Pinch' (Thumb tip vs Index tip proximity)
                const thumbTip = hand[4];
                const indexTip = hand[8];
                const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));

                // If fingers are touching (Distance < 0.09)
                if (dist < 0.09) {
                    // Start firing logic if not already firing (debounce logic)
                    if (!this.isPinching && performance.now() - this.lastPinchTime > 200) {
                        this.shoot();
                        this.isPinching = true;
                        this.lastPinchTime = performance.now();
                    }
                } else {
                    this.isPinching = false; // Reset trigger when fingers release
                }

                // DRAW SKELETON: Show tiny red dots in the bottom-right corner for feedback
                this.cvCtx.fillStyle = '#ff0000';
                hand.forEach(point => {
                    this.cvCtx.beginPath();
                    this.cvCtx.arc(point.x * 200, point.y * 150, 2, 0, Math.PI * 2);
                    this.cvCtx.fill();
                });
            }
        }
    }

    /**
     * SHOOT: Checks for collision between Crosshair and Ducks
     */
    shoot() {
        if (this.ammo <= 0) return; // Can't fire if out of bullets

        this.ammo--; // Use 1 bullet
        this.updateHUD(); // Update bullet icons

        // Add visual shooting effect in CSS
        this.crosshair.classList.add('shooting');
        setTimeout(() => this.crosshair.classList.remove('shooting'), 100);

        // CREATE FLASH: Brief white screen flash on fire
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        let hitMade = false;
        this.ducks.forEach(duck => {
            if (duck.status === 'flying') {
                // PYTHAGORAS: Check distance between shots and duck center
                const dX = this.handPos.x - duck.x;
                const dY = this.handPos.y - duck.y;
                const dist = Math.sqrt(dX * dX + dY * dY);

                // Forgiving Hitbox: 8% of screen width (Large enough for kids!)
                const hitRadius = this.canvas.width * 0.08;
                if (dist < hitRadius) {
                    duck.status = 'hit'; // Trigger death sequence
                    duck.timer = 0;
                    this.score += 500 + (this.round * 100); // Higher level = More points
                    hitMade = true;
                    this.ducksShotThisRound++;

                    // LEVEL PROGRESSION: Shot 5 ducks? Move to next difficulty level
                    if (this.ducksShotThisRound >= 5) {
                        this.levelUp();
                    }
                }
            }
        });

        // AUTO-RELOAD: Get 3 new bullets after a hit or after finishing shots
        if (this.ammo === 0 && !hitMade) {
            setTimeout(() => { this.ammo = 3; this.updateHUD(); }, 1500);
        } else if (hitMade) {
            this.ammo = 3;
            this.updateHUD();
        }
    }

    /**
     * UPDATE HUD: Synchronizes JS variables with the HTML display
     */
    updateHUD() {
        // Score formatting (leading zeroes e.g. 000500)
        this.scoreElement.innerText = this.score.toString().padStart(6, '0');
        this.roundElement.innerText = this.round; // Level display

        // Round Countdown Timer: 60s limit
        const timeLimit = 60;

        // Auto-initialize roundStartTime if it's missing while playing
        if (this.gameState === 'playing' && !this.roundStartTime) {
            console.log("Timer Force-Started");
            this.roundStartTime = performance.now();
        }

        let remaining = timeLimit;
        if (this.roundStartTime && this.gameState === 'playing') {
            const elapsed = (performance.now() - this.roundStartTime) / 1000;
            remaining = Math.max(0, Math.ceil(timeLimit - elapsed));

            // Update the display using the cached timer element
            if (this.timerElement) {
                this.timerElement.innerText = remaining.toString().padStart(2, '0');
            }

            // Move to next level if time runs out
            if (remaining <= 0) {
                console.log("Time's up! Leveling up...");
                this.levelUp();
            }
        }

        // Bullet icons display
        const bullets = this.ammoDisplay.querySelectorAll('.bullet');
        bullets.forEach((b, i) => {
            if (i < this.ammo) b.classList.remove('spent');
            else b.classList.add('spent');
        });

        // Red X Strike display
        const strikesArr = this.strikeDisplay.querySelectorAll('span');
        strikesArr.forEach((s, i) => {
            if (i < this.strikes) {
                s.className = 'strike-on';
            } else {
                s.className = 'strike-off';
            }
        });
    }

    /**
     * DRAW: The master painter function run every frame
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. DRAW BACKGROUND
        if (this.assets.bg.complete) {
            this.ctx.drawImage(this.assets.bg, 0, 0, this.canvas.width, this.canvas.height);
        }

        // 2. DRAW ACTIVE DUCKS
        this.ducks.forEach(duck => this.drawDuck(duck));
    }

    /**
     * DRAW DUCK: Slices the 5x5 sprite sheet to draw the correct animation pose
     */
    /**
     * CHROMA KEY: Removes a specific color from an image and returns a transparent canvas
     */
    makeTransparent(img, targetRGB) {
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        offCanvas.width = img.width;
        offCanvas.height = img.height;

        offCtx.drawImage(img, 0, 0);
        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;

        // Loop through every pixel (4 values per pixel: R, G, B, A)
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // If the pixel is close to our target "Neon Green" (#00FF00)
            // We use a small threshold to catch slightly off-greens
            if (g > 200 && r < 100 && b < 100) {
                data[i + 3] = 0; // Set Alpha to 0 (Transparent)
            }
        }

        offCtx.putImageData(imageData, 0, 0);
        return offCanvas;
    }

    drawDuck(duck) {
        // Only draw if the processed image is ready
        const spriteSource = this.assets.processedDuck || this.assets.duck;

        const frameWidth = this.assets.duck.width / 5; // Width of 1 sprite pose
        const frameHeight = this.assets.duck.height / 5; // Height of 1 sprite pose
        let sx = 0, sy = 0; // Where to slice the sheet from

        // Determine sprite coordinates based on duck behavior
        if (duck.status === 'flying' || duck.status === 'fleeing') {
            sy = duck.direction === 1 ? 0 : frameHeight; // Row depends on L/R move
            sx = duck.frame * frameWidth; // Column depends on wing animation
        } else if (duck.status === 'hit') {
            sy = frameHeight * 4; // Row for 'Shot/Surprised' pose
            sx = 0;
        } else if (duck.status === 'falling') {
            sy = frameHeight * 3; // Row for 'Spinning fall' pose
            sx = (Math.floor(Date.now() / 100) % 2) * frameWidth; // Alternate between 2 sprites
        }

        const duckSize = this.canvas.width * 0.08; // Sprite size on screen
        const halfSize = duckSize / 2;

        this.ctx.save();
        this.ctx.translate(duck.x, duck.y); // Position the duck graphics

        // DRAW LIFE-BAR (TIMER)
        if (duck.status === 'flying') {
            const elapsed = performance.now() - duck.spawnTime;
            const remaining = Math.max(0, 1 - (elapsed / duck.lifeTime));

            const barWidth = duckSize;
            const barHeight = 10;
            const barY = -halfSize - 20;

            // Background and White Border for the bar
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-halfSize, barY, barWidth, barHeight);
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(-halfSize, barY, barWidth, barHeight);

            // Dynamic Fill (Green -> Yellow -> Red based on 'remaining' %)
            const r = Math.floor(255 * (1 - remaining));
            const g = Math.floor(255 * remaining);
            this.ctx.fillStyle = `rgb(${r},${g},0)`;
            this.ctx.fillRect(-halfSize, barY, barWidth * remaining, barHeight);
        }

        // DRAW SPIRTE: Actual pixel art of the duck
        this.ctx.drawImage(spriteSource, sx, sy, frameWidth, frameHeight, -halfSize, -halfSize, duckSize, duckSize);
        this.ctx.restore();
    }

    /**
     * GAME LOOP: Runs 60 times a second to keep game running
     */
    gameLoop() {
        if (this.gameState === 'playing') {
            this.update();     // Run calculations
            this.updateHUD();  // Update text elements
        }
        this.draw();           // Draw final results
        requestAnimationFrame(() => this.gameLoop()); // Schedule next frame
    }
}

// Fire up the Game Object
new DuckHuntGame();
