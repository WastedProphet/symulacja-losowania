window.BALL_COUNT = 4;                
window.HOLE_COUNT = 4;         
const BALL_RADIUS = 15;
const BALL_DIAMETER = BALL_RADIUS * 2; 
window.BALLS_PER_HOLE = 1;              
window.BALL_NAMES = []; 
window.highlightedBallName = null; 

// POJEMNOŚĆ: Dołek rośnie w górę, nie w szerz. Zawsze 1 piłeczka szerokości.
const HOLE_WIDTH = BALL_DIAMETER + 10;  
const SEPARATOR_WIDTH = 4;             
let SEPARATOR_HEIGHT = (BALL_DIAMETER * window.BALLS_PER_HOLE) + 20; 

let HOLES_TOTAL_WIDTH = (window.HOLE_COUNT * HOLE_WIDTH) + ((window.HOLE_COUNT + 1) * SEPARATOR_WIDTH);

let calculatedRadius = Math.sqrt((window.BALL_COUNT + 10) / 0.8) * BALL_RADIUS;
let ringRadius = Math.max(80, calculatedRadius);
let minWorldWidthForRing = (ringRadius * 2) + 100;

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
            positionIterations: 24, 
            velocityIterations: 24, 
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
let occupiedHoles = {}; // Rejestr ILOŚCI piłek w dołku
let separatorTips = []; 

window.onresize = () => {
    if(game && game.scale) {
        let newWidth = window.innerWidth - 350;
        game.scale.resize(newWidth, window.innerHeight);
        let scene = game.scene.scenes[0];
        if(scene) {
            resetCameraView(scene);
        }
    }
};

function create() {
    mainCamera = this.cameras.main;
    
    // CZYSZCZENIE CACHE TEKSTUR (Rozwiązuje błąd nachodzenia koła)
    if (this.textures.exists('ballBase')) this.textures.remove('ballBase');
    if (this.textures.exists('separatorBase')) this.textures.remove('separatorBase');
    if (this.textures.exists('ringDonut')) this.textures.remove('ringDonut');
    if (this.textures.exists('ringBase')) this.textures.remove('ringBase');

    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
    graphics.generateTexture('ballBase', BALL_DIAMETER, BALL_DIAMETER);
    graphics.clear();
    
    graphics.fillStyle(0x3FC1C9, 1);
    graphics.fillRect(0, 0, SEPARATOR_WIDTH, SEPARATOR_HEIGHT);
    graphics.fillStyle(0x99FFFF, 1); 
    graphics.fillRect(0, 0, SEPARATOR_WIDTH, 2);
    graphics.generateTexture('separatorBase', SEPARATOR_WIDTH, SEPARATOR_HEIGHT);
    graphics.clear();

    graphics.lineStyle(20, 0x3FC1C9, 1);
    graphics.strokeCircle(ringRadius + 20, ringRadius + 20, ringRadius); 
    graphics.generateTexture('ringDonut', (ringRadius * 2) + 40, (ringRadius * 2) + 40);
    graphics.clear();

    const arenaFrame = this.add.graphics();
    arenaFrame.lineStyle(4, 0x3FC1C9, 1);
    arenaFrame.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 50, true, true, true, true);

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
        let newZoom = mainCamera.zoom - (deltaY * 0.001);
        mainCamera.zoom = Phaser.Math.Clamp(newZoom, 0.05, 5); 
    });
    
    this.input.on('pointerdown', (pointer) => {
        if (pointer.button === 1) resetCameraView(this);
        
        if (pointer.button === 0 && window.highlightedBallName !== null) {
            window.highlightedBallName = null;
            balls.forEach(b => b.setAlpha(1));
            if (window.updateHighlightUI) window.updateHighlightUI(null);
        }
    });
    
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown || pointer.button !== 0) return;
        mainCamera.scrollX -= (pointer.x - pointer.prevPosition.x) / mainCamera.zoom;
        mainCamera.scrollY -= (pointer.y - pointer.prevPosition.y) / mainCamera.zoom;
    });

    // GENEROWANIE DOŁKÓW WRAZ Z NUMERACJĄ (PUNKT 3)
    for (let i = 0; i <= window.HOLE_COUNT; i++) {
        let x = HOLES_OFFSET_X + (i * HOLE_WIDTH) + (i * SEPARATOR_WIDTH) + (SEPARATOR_WIDTH / 2);
        let y = WORLD_HEIGHT - (SEPARATOR_HEIGHT / 2);
        
        let separator = this.matter.add.image(x, y, 'separatorBase', null, { isStatic: true });
        separatorTips.push({ x: x, y: WORLD_HEIGHT - SEPARATOR_HEIGHT });

        // Dodawanie białych cyfr pod dołkami
        if (i < window.HOLE_COUNT) {
            let textX = x + (HOLE_WIDTH / 2) + (SEPARATOR_WIDTH / 2);
            let textY = WORLD_HEIGHT + 15; 
            this.add.text(textX, textY, (i + 1).toString(), { 
                fontSize: '20px', 
                fill: '#ffffff', 
                fontStyle: 'bold' 
            }).setOrigin(0.5, 0);
        }
    }

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

    let maxOffset = Math.max(0, ringRadius - BALL_RADIUS - 10);

    for(let i = 0; i < window.BALL_COUNT; i++) {
        let randomAngle = Math.random() * Math.PI * 2;
        let randomDist = Math.sqrt(Math.random()) * maxOffset;
        let offsetX = Math.cos(randomAngle) * randomDist;
        let offsetY = Math.sin(randomAngle) * randomDist;

        let ball = this.matter.add.image(centerX + offsetX, centerY + offsetY, 'ballBase');
        
        ball.setCircle(BALL_RADIUS);
        ball.setFriction(0.005);
        ball.setFrictionAir(0.015); 
        ball.setBounce(0.5); 
        ball.setTint(Math.random() * 0xffffff);
        
        ball.body.label = 'ball'; 
        ball.body.isLocked = false; 
        ball.claimedHole = null; 
        
        ball.ballName = window.BALL_NAMES[i] || ''; 
        ball.isReported = false; 
        
        balls.push(ball);
    }

    resetCameraView(this);

    this.time.delayedCall(3000, () => {
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
    const topOfRing = (WORLD_HEIGHT / 3) - ringRadius - 50;
    const bottomOfHoles = WORLD_HEIGHT + 60; 
    const actionHeight = bottomOfHoles - topOfRing;
    
    const zoomY = game.scale.height / actionHeight;
    const optimalZoom = Math.min(zoomX, zoomY) * 0.95; 
    const centerY = topOfRing + (actionHeight / 2);

    scene.cameras.main.pan(WORLD_WIDTH / 2, centerY, 500, 'Sine.easeInOut');
    scene.cameras.main.zoomTo(optimalZoom, 500, 'Sine.easeInOut');
}

// Globalna funkcja odpowiedzialna za zaciemnianie z poziomu HTML (PUNKT 2)
window.toggleHighlight = function(name) {
    if (window.highlightedBallName === name) {
        window.highlightedBallName = null;
    } else {
        window.highlightedBallName = name;
    }
    
    balls.forEach(b => {
        if (window.highlightedBallName === null) {
            b.setAlpha(1);
        } else {
            b.setAlpha(b.ballName === window.highlightedBallName ? 1 : 0.08);
        }
    });

    if (window.updateHighlightUI) {
        window.updateHighlightUI(window.highlightedBallName);
    }
};

function update(time, delta) {
    if (isPhaseOne) {
        if (phaseOneStartTime === 0) phaseOneStartTime = time;

        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 3;

        if (centrifugeParts.length > 0) {
            let ring = centrifugeParts[0];
            ring.setAngularVelocity(0.20); 
        }

        balls.forEach(ball => {
            if(Math.random() > 0.8) {
                ball.applyForce({ 
                    x: Phaser.Math.Between(-1, 1) * 0.002, 
                    y: Phaser.Math.Between(-1, 1) * 0.002 
                });
            }
            
            let velX = ball.body.velocity.x;
            let velY = ball.body.velocity.y;
            let speed = Math.sqrt(velX * velX + velY * velY);
            if (speed > 15) {
                ball.setVelocity((velX / speed) * 15, (velY / speed) * 15);
            }

            if (time - phaseOneStartTime < 2000) {
                let dx = ball.x - centerX;
                let dy = ball.y - centerY;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > ringRadius - BALL_RADIUS + 20) {
                    ball.setPosition(centerX, centerY);
                    ball.setVelocity(0, 0);
                }
            }
        });
    } else {
        if (phaseTwoStartTime === 0) phaseTwoStartTime = time;

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
        
        let targetedCounts = {}; 

        // PRZELOT 1: Kolizje, pojemność (PUNKT 5) oraz absolutna korekta (PUNKT 4)
        balls.forEach(ball => {
            // BEZWZGLĘDNA KOREKTA
            if (ball.body.isLocked) {
                if (ball.lockedTargetX !== undefined && ball.lockedTargetY !== undefined) {
                    ball.setPosition(ball.lockedTargetX, ball.lockedTargetY);
                }
                return;
            }

            ball.setIgnoreGravity(false);
            ball.setBounce(0.5);

            let currentHoleIndex = Math.floor((ball.x - HOLES_OFFSET_X - SEPARATOR_WIDTH) / holeTotalWidth);
            if (currentHoleIndex < 0) currentHoleIndex = 0;
            if (currentHoleIndex >= window.HOLE_COUNT) currentHoleIndex = window.HOLE_COUNT - 1;

            let currentOccupiedCount = occupiedHoles[currentHoleIndex] || 0;

            if (ball.y > WORLD_HEIGHT - SEPARATOR_HEIGHT) {
                if (currentOccupiedCount < window.BALLS_PER_HOLE) {
                    
                    occupiedHoles[currentHoleIndex] = currentOccupiedCount + 1;
                    ball.body.isLocked = true; 
                    ball.claimedHole = null; 

                    let targetX = HOLES_OFFSET_X + (currentHoleIndex * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                    // Stackowanie pionowe piłek z dołu do góry
                    let targetY = WORLD_HEIGHT - BALL_RADIUS - (currentOccupiedCount * BALL_DIAMETER) - 1; 

                    ball.lockedTargetX = targetX;
                    ball.lockedTargetY = targetY;

                    ball.setPosition(targetX, targetY);
                    ball.setStatic(true); 

                    if (!ball.isReported) {
                        ball.isReported = true;
                        if (window.reportResult) window.reportResult(currentHoleIndex, ball.ballName);
                    }
                    return; 
                } else {
                    // Odbicie tylko jeśli przepełniony
                    let kickForceX = Phaser.Math.Between(-3, 3) * 0.01;
                    let kickForceY = -0.04; 
                    ball.applyForce({ x: kickForceX, y: kickForceY });
                    ball.claimedHole = null; 
                    return; 
                }
            }

            if (ball.claimedHole !== null) {
                let hIdx = ball.claimedHole;
                let occ = occupiedHoles[hIdx] || 0;
                
                if (occ >= window.BALLS_PER_HOLE) {
                    ball.claimedHole = null; 
                } else {
                    let targetX = HOLES_OFFSET_X + (hIdx * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                    let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;
                    let dx = targetX - ball.x;
                    let dy = targetY - ball.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > currentActivationDist) {
                        ball.claimedHole = null; 
                    } else {
                        targetedCounts[hIdx] = (targetedCounts[hIdx] || 0) + 1; 
                    }
                }
            }
        });

        // PRZELOT 2: Szukanie celów
        balls.forEach(ball => {
            if (ball.body.isLocked) return;
            if (ball.y > WORLD_HEIGHT - SEPARATOR_HEIGHT) return; 

            if (ball.claimedHole === null) {
                let closestHole = null;
                let minDistance = currentActivationDist;

                for (let i = 0; i < window.HOLE_COUNT; i++) {
                    let occ = occupiedHoles[i] || 0;
                    let tgt = targetedCounts[i] || 0;

                    if (occ + tgt < window.BALLS_PER_HOLE) {
                        let targetX = HOLES_OFFSET_X + (i * holeTotalWidth) + SEPARATOR_WIDTH + (HOLE_WIDTH / 2);
                        let targetY = WORLD_HEIGHT - BALL_RADIUS - 1;
                        let dx = targetX - ball.x;
                        let dy = targetY - ball.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < minDistance && ball.y < WORLD_HEIGHT) {
                            minDistance = dist;
                            closestHole = i;
                        }
                    }
                }

                if (closestHole !== null) {
                    ball.claimedHole = closestHole;
                    targetedCounts[closestHole] = (targetedCounts[closestHole] || 0) + 1; 
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

window.restartSimulation = function() {
    SEPARATOR_HEIGHT = (BALL_DIAMETER * window.BALLS_PER_HOLE) + 20; 
    HOLES_TOTAL_WIDTH = (window.HOLE_COUNT * HOLE_WIDTH) + ((window.HOLE_COUNT + 1) * SEPARATOR_WIDTH);
    
    calculatedRadius = Math.sqrt((window.BALL_COUNT + 10) / 0.8) * BALL_RADIUS;
    ringRadius = Math.max(80, calculatedRadius);
    minWorldWidthForRing = (ringRadius * 2) + 100;

    WORLD_WIDTH = Math.max(minWorldWidthForRing, HOLES_TOTAL_WIDTH);
    HOLES_OFFSET_X = (WORLD_WIDTH - HOLES_TOTAL_WIDTH) / 2;

    isPhaseOne = true;
    phaseOneStartTime = 0;
    phaseTwoStartTime = 0;
    occupiedHoles = {};
    separatorTips = [];
    centrifugeParts = [];
    balls = [];
    window.highlightedBallName = null; 

    game.scene.scenes[0].scene.restart();
};
