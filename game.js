window.BALL_COUNT = 4;
const BALL_RADIUS = 15;
const BALL_DIAMETER = BALL_RADIUS * 2;
window.HOLE_COUNT = 4;
window.BALLS_PER_HOLE = 1;
window.ballNamesArray = [];

let HOLE_WIDTH = (BALL_DIAMETER + 5 * window.BALLS_PER_HOLE);
const SEPARATOR_WIDTH = 4;
const SEPARATOR_HEIGHT = BALL_DIAMETER;

// Dynamiczne wyliczanie promienia koła oraz bezpiecznej szerokości symulacji
let ringRadius = Math.max(80, window.BALL_COUNT * 2);
let minWorldWidthForRing = (ringRadius * 2) + 100;

let HOLES_TOTAL_WIDTH = (window.HOLE_COUNT * HOLE_WIDTH) + ((window.HOLE_COUNT + 1) * SEPARATOR_WIDTH);
let WORLD_WIDTH = Math.max(minWorldWidthForRing, HOLES_TOTAL_WIDTH);
let HOLES_OFFSET_X = (WORLD_WIDTH - HOLES_TOTAL_WIDTH) / 2;
const WORLD_HEIGHT = 2000;

const config = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    width: window.innerWidth - 350,
    height: window.innerHeight,
    transparent: true,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            positionIterations: 24, // Podwyższona precyzja
            velocityIterations: 24, // Podwyższona precyzja
            debug: false
        }
    },
    scene: {
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let mainCamera;
let centrifugeParts = [];
let balls = [];
let isPhaseOne = true;
let phaseOneStartTime = 0;
let phaseTwoStartTime = 0;
let occupiedHoles = {};
let separatorTips = [];

function create() {
    mainCamera = this.cameras.main;

    const graphics = this.add.graphics();
    
    // Tekstura kulki
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
    graphics.generateTexture('ballBase', BALL_DIAMETER, BALL_DIAMETER);
    graphics.clear();

    // Tekstura separatora dołka
    graphics.fillStyle(0x3FC1C9, 1);
    graphics.fillRect(0, 0, SEPARATOR_WIDTH, SEPARATOR_HEIGHT);
    graphics.fillStyle(0x99FFFF, 1);
    graphics.fillRect(0, 0, SEPARATOR_WIDTH, 2);
    graphics.generateTexture('separatorBase', SEPARATOR_WIDTH, SEPARATOR_HEIGHT);
    graphics.clear();

    // Tekstura widocznego koła pralki
    graphics.lineStyle(20, 0x3FC1C9, 1);
    graphics.strokeCircle(ringRadius + 10, ringRadius + 10, ringRadius);
    graphics.generateTexture('ringDonut', (ringRadius * 2) + 20, (ringRadius * 2) + 20);
    graphics.clear();
    
    // Pogrubiony uszczelniacz ścian wirówki przeciwko tunelowaniu
    graphics.fillStyle(0x3FC1C9, 1);
    graphics.fillRect(0, 0, 120, 40);
    graphics.generateTexture('ringBase', 120, 40);
    graphics.clear();

    // Kontur klatki
    const arenaFrame = this.add.graphics();
    arenaFrame.lineStyle(4, 0x3FC1C9, 1);
    arenaFrame.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Klatka fizyczna świata
    this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 50, true, true, true, true);

    // Obsługa sterowania widokiem
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
        let newZoom = mainCamera.zoom - (deltaY * 0.001);
        mainCamera.zoom = Phaser.Math.Clamp(newZoom, 0.05, 5);
    });
    this.input.on('pointerdown', (pointer) => {
        if (pointer.button === 1) resetCameraView(this);
    });
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown || pointer.button !== 0) return;
        mainCamera.scrollX -= (pointer.x - pointer.prevPosition.x) / mainCamera.zoom;
        mainCamera.scrollY -= (pointer.y - pointer.prevPosition.y) / mainCamera.zoom;
    });
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth - 350, window.innerHeight);
        resetCameraView(this);
    });

    // Generowanie dołków na dole z offsetem centrującym
    for (let i = 0; i <= window.HOLE_COUNT; i++) {
        let x = HOLES_OFFSET_X + (i * HOLE_WIDTH) + (i * SEPARATOR_WIDTH) + (SEPARATOR_WIDTH / 2);
        let y = WORLD_HEIGHT - (SEPARATOR_HEIGHT / 2);
        
        let separator = this.matter.add.image(x, y, 'separatorBase', null, { isStatic: true });
        separatorTips.push({ x: x, y: WORLD_HEIGHT - SEPARATOR_HEIGHT });
    }

    // Konstrukcja uszczelnionej wirówki z mocnym tarciem
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 3;
    let parts = [];
    for (let i = 0; i < 60; i++) {
        let angle = (Math.PI * 2 / 60) * i;
        let x = Math.cos(angle) * ringRadius;
        let y = Math.sin(angle) * ringRadius;
        parts.push(Phaser.Physics.Matter.Matter.Bodies.rectangle(x, y, 120, 40, { angle: angle, friction: 1.0 }));
    }
    
    let ringBody = Phaser.Physics.Matter.Matter.Body.create({
        parts: parts,
        friction: 1.0,
        restitution: 0.1
    });
    
    let centrifugeSprite = this.matter.add.sprite(centerX, centerY, 'ringDonut');
    centrifugeSprite.setExistingBody(ringBody);
    centrifugeSprite.setPosition(centerX, centerY);
    centrifugeSprite.setIgnoreGravity(true);
    
    this.matter.add.worldConstraint(centrifugeSprite, 0, 1, {
        pointA: { x: centerX, y: centerY },
        pointB: { x: 0, y: 0 }
    });

    centrifugeParts.push(centrifugeSprite);

    const namesOverlay = document.getElementById('names-overlay');
    if (namesOverlay) namesOverlay.innerHTML = '';

    // Okrągły, zabezpieczony algorytm spawnu
    let maxOffset = Math.max(0, ringRadius - BALL_RADIUS - 10);
    for(let i = 0; i < window.BALL_COUNT; i++) {
        let spawnAngle = Math.random() * Math.PI * 2;
        let spawnDist = Math.random() * maxOffset;
        let offsetX = Math.cos(spawnAngle) * spawnDist;
        let offsetY = Math.sin(spawnAngle) * spawnDist;
        
        let ball = this.matter.add.image(centerX + offsetX, centerY + offsetY, 'ballBase');
        
        ball.setCircle(BALL_RADIUS);
        ball.setFriction(0.005);
        ball.setFrictionAir(0.015);
        ball.setBounce(0.5);
        
        let ballName = window.ballNamesArray[i] || '';
        let colorHex = Phaser.Display.Color.RandomRGB(100, 255).color;
        
        if (ballName && namesOverlay) {
            let nameTag = document.createElement('div');
            nameTag.innerText = ballName;
            nameTag.style.color = '#' + colorHex.toString(16).padStart(6, '0');
            nameTag.style.fontWeight = 'bold';
            namesOverlay.appendChild(nameTag);
        }

        ball.setTint(colorHex);
        ball.originalColor = '#' + colorHex.toString(16).padStart(6, '0');
        ball.ballName = ballName;
        ball.ballIndex = i;
        
        ball.body.label = 'ball';
        ball.body.isLocked = false;
        ball.claimedHole = null;
        
        balls.push(ball);
    }

    resetCameraView(this);

    // Zniszczenie wirówki po 3 sekundach
    this.time.delayedCall(10000, () => {
        isPhaseOne = false;
        
        if (centrifugeParts.length > 0) {
            centrifugeParts[0].destroy();
        }
        centrifugeParts = [];
        
        balls.forEach(ball => {
            let forceX = Phaser.Math.Between(-3, 3) * 0.003;
            let forceY = Phaser.Math.Between(-3, 3) * 0.003;
            ball.applyForce({ x: forceX, y: forceY });
        });
    });
}

function resetCameraView(scene) {
    const zoomX = game.scale.width / WORLD_WIDTH;
    const zoomY = game.scale.height / WORLD_HEIGHT;
    const optimalZoom = Math.min(zoomX, zoomY) * 0.95;

    mainCamera.pan(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 500, 'Sine.easeInOut');
    mainCamera.zoomTo(optimalZoom, 500, 'Sine.easeInOut');
}

function update(time, delta) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 3;

    if (phaseOneStartTime === 0) {
        phaseOneStartTime = time;
    }

    if (isPhaseOne) {
        if (centrifugeParts.length > 0) {
            let ring = centrifugeParts[0];
            ring.setAngularVelocity(0.20);
        }
        
        balls.forEach(ball => {
            // Chaos w wirówce
            if(Math.random() > 0.8) {
                ball.applyForce({ 
                    x: Phaser.Math.Between(-1, 1) * 0.002, 
                    y: Phaser.Math.Between(-1, 1) * 0.002 
                });
            }
            
            // LIMITER PRĘDKOŚCI - Zapobiega tunelowaniu przez ściany
            let velX = ball.body.velocity.x;
            let velY = ball.body.velocity.y;
            let speed = Math.sqrt(velX * velX + velY * velY);
            if (speed > 15) {
                ball.setVelocity((velX / speed) * 15, (velY / speed) * 15);
            }

            // STRAŻNIK TELEPORTUJĄCY - Przez pierwsze 2 sekundy zawraca wyciekające kulki
            if (time - phaseOneStartTime < 2000) {
                let dx = ball.x - centerX;
                let dy = ball.y - centerY;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > ringRadius - BALL_RADIUS + 10) {
                    ball.setPosition(centerX, centerY);
                    ball.setVelocity(0, 0);
                }
            }
        });

    } else {
        if (phaseTwoStartTime === 0) {
            phaseTwoStartTime = time;
        }

        // ZAAWANSOWANY ELEKTROMAGNES (Piłka vs Piłka)
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                let ballA = balls[i];
                let ballB = balls[j];

                if (ballA.body.isLocked && ballB.body.isLocked) continue;

                let dx = ballA.x - ballB.x;
                let dy = ballA.y - ballB.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 36 && dist > 0) {
                    let nx = dx / dist;
                    let ny = dy / dist;
                    let calculatedForce = (36 - dist) * 0.001;
                    let force = Phaser.Math.Clamp(calculatedForce, 0, 0.015);

                    if (!ballA.body.isLocked) ballA.applyForce({ x: nx * force, y: ny * force });
                    if (!ballB.body.isLocked) ballB.applyForce({ x: -nx * force, y: -ny * force });
                }
            }
        }

        // ODPYCHANIE OD CZUBKÓW SEPARATORÓW
        balls.forEach(ball => {
            if (ball.body.isLocked) return;

            if (ball.y > WORLD_HEIGHT - SEPARATOR_HEIGHT - 30) {
                separatorTips.forEach(tip => {
                    let dx = ball.x - tip.x;
                    let dy = ball.y - tip.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 20 && dist > 0) {
                        if (Math.abs(dx) < 0.5) {
                            dx = Math.random() < 0.5 ? -1 : 1;
                        }

                        let nx = dx / dist;
                        let ny = dy / dist;
                        let force = (30 - dist) * 0.0015;
                        ball.applyForce({ x: nx * force, y: ny * force - 0.002 });
                    }
                });
            }
        });

        const holeTotalWidth = HOLE_WIDTH + SEPARATOR_WIDTH;
        let timeElapsed = time - phaseTwoStartTime;
        let currentActivationDist = 55 + (timeElapsed * 0.315);

        // LOGIKA ZASYSANIA DO DOŁKÓW
        balls.forEach(ball => {
            if (ball.body.isLocked) return;

            ball.setIgnoreGravity(false);
            ball.setBounce(0.5);

            let currentHoleIndex = Math.floor((ball.x - HOLES_OFFSET_X - SEPARATOR_WIDTH) / holeTotalWidth);
            if (currentHoleIndex < 0) currentHoleIndex = 0;
            if (currentHoleIndex >= window.HOLE_COUNT) currentHoleIndex = window.HOLE_COUNT - 1;

            if (ball.y > WORLD_HEIGHT - SEPARATOR_HEIGHT) {
                if (!occupiedHoles[currentHoleIndex]) {
                    occupiedHoles[currentHoleIndex] = true;
                    ball.body.isLocked = true;

                    let targetX = HOLES_OFFSET_X + (currentHoleIndex * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                    let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;

                    ball.setPosition(targetX, targetY);
                    ball.setStatic(true);
                    
                    if(window.reportResult) {
                        window.reportResult(ball.ballIndex, ball.ballName, ball.originalColor, currentHoleIndex + 1);
                    }
                    return;
                } else {
                    let kickForceX = Phaser.Math.Between(-3, 3) * 0.01;
                    let kickForceY = -0.04;
                    ball.applyForce({ x: kickForceX, y: kickForceY });
                    return;
                }
            }

            if (ball.claimedHole !== null) {
                let hIdx = ball.claimedHole;
                if (occupiedHoles[hIdx]) {
                    ball.claimedHole = null;
                } else {
                    let targetX = HOLES_OFFSET_X + (hIdx * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                    let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;
                    let dx = targetX - ball.x;
                    let dy = targetY - ball.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > currentActivationDist) {
                        ball.claimedHole = null;
                    }
                }
            }

            if (ball.claimedHole === null) {
                let closestHole = null;
                let minDistance = currentActivationDist;

                for (let i = 0; i < window.HOLE_COUNT; i++) {
                    if (!occupiedHoles[i]) {
                        let targetX = HOLES_OFFSET_X + (i * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                        let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;
                        let dx = targetX - ball.x;
                        let dy = targetY - ball.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < minDistance && ball.y < targetY) {
                            minDistance = dist;
                            closestHole = i;
                        }
                    }
                }

                if (closestHole !== null) {
                    ball.claimedHole = closestHole;
                }
            }

            if (ball.claimedHole !== null) {
                let hIdx = ball.claimedHole;
                let targetX = HOLES_OFFSET_X + (hIdx * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;
                let dx = targetX - ball.x;
                let dy = targetY - ball.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                let intensity = 1 - (dist / currentActivationDist);
                
                if (dist <= currentActivationDist * 0.25) {
                    ball.setBounce(0);
                } else {
                    ball.setBounce(0.5 * (1 - intensity));
                }

                ball.setIgnoreGravity(true);
                
                let pullForce = 0.002 * intensity;
                ball.applyForce({ x: (dx / dist) * pullForce, y: (dy / dist) * pullForce });
                ball.setVelocityX(ball.body.velocity.x * (1 - (0.15 * intensity)));
            }
        });
    }
}

// Funkcja odpowiedzialna za restart z poziomu ui.js
window.restartSimulation = function() {
    HOLE_WIDTH = (BALL_DIAMETER + 5 * window.BALLS_PER_HOLE);
    
    // Ponowne, poprawne przeliczenie wymiarów pralki
    ringRadius = Math.max(80, window.BALL_COUNT * 2);
    let minWorldWidthForRing = (ringRadius * 2) + 100;
    
    HOLES_TOTAL_WIDTH = (window.HOLE_COUNT * HOLE_WIDTH) + ((window.HOLE_COUNT + 1) * SEPARATOR_WIDTH);
    WORLD_WIDTH = Math.max(minWorldWidthForRing, HOLES_TOTAL_WIDTH);
    HOLES_OFFSET_X = (WORLD_WIDTH - HOLES_TOTAL_WIDTH) / 2;

    isPhaseOne = true;
    phaseOneStartTime = 0; // Zresetowanie licznika teleportera
    phaseTwoStartTime = 0;
    occupiedHoles = {};
    separatorTips = [];
    centrifugeParts = [];
    balls = [];

    game.scene.scenes[0].scene.restart();
};
