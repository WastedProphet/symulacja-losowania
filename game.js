window.BALL_COUNT = 100;                
window.HOLE_COUNT = 100;         
const BALL_RADIUS = 15;
const BALL_DIAMETER = BALL_RADIUS * 2; 
window.BALLS_PER_HOLE = 1;              
window.BALL_NAMES = []; 
window.highlightedBallNames = []; // Zmienione na tablicę pod multi-select

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
let occupiedHoles = {}; 
let separatorTips = []; 
let isDraggingZone = false; 

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
    
    if (this.textures.exists('ballBase')) this.textures.remove('ballBase');
    if (this.textures.exists('neonRing')) this.textures.remove('neonRing');
    if (this.textures.exists('separatorBase')) this.textures.remove('separatorBase');
    if (this.textures.exists('ringDonut')) this.textures.remove('ringDonut');
    if (this.textures.exists('ringBase')) this.textures.remove('ringBase');

    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
    graphics.generateTexture('ballBase', BALL_DIAMETER, BALL_DIAMETER);
    graphics.clear();
    
    graphics.lineStyle(4, 0x99FFFF, 1);
    graphics.strokeCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS - 2); 
    graphics.generateTexture('neonRing', BALL_DIAMETER, BALL_DIAMETER);
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
    
    this.input.on('pointerdown', (pointer, gameObjects) => {
        if (pointer.button === 1) resetCameraView(this);
        
        if (pointer.button === 0 && gameObjects.length === 0) {
            if (window.closeZonePopover) window.closeZonePopover(); 

            // Kliknięcie w puste tło - odznaczenie wszystkiego
            if (window.highlightedBallNames.length > 0) {
                window.highlightedBallNames = [];
                if (window.updateHighlightUI) window.updateHighlightUI(window.highlightedBallNames);
            }
        }
    });
    
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown || pointer.button !== 0 || isDraggingZone) return;
        mainCamera.scrollX -= (pointer.x - pointer.prevPosition.x) / mainCamera.zoom;
        mainCamera.scrollY -= (pointer.y - pointer.prevPosition.y) / mainCamera.zoom;
    });

    for (let i = 0; i <= window.HOLE_COUNT; i++) {
        let x = HOLES_OFFSET_X + (i * HOLE_WIDTH) + (i * SEPARATOR_WIDTH) + (SEPARATOR_WIDTH / 2);
        let y = WORLD_HEIGHT - (SEPARATOR_HEIGHT / 2);
        
        let separator = this.matter.add.image(x, y, 'separatorBase', null, { isStatic: true });
        separatorTips.push({ x: x, y: WORLD_HEIGHT - SEPARATOR_HEIGHT });

        if (i < window.HOLE_COUNT) {
            let textX = x + (HOLE_WIDTH / 2) + (SEPARATOR_WIDTH / 2);
            let textY = WORLD_HEIGHT + 15; 
            this.add.text(textX, textY, (i + 1).toString(), { 
                fontSize: '20px', fill: '#ffffff', fontStyle: 'bold' 
            }).setOrigin(0.5, 0);
        }
    }

    this.phaserZonesGroup = this.add.group();
    
    window.drawPhaserZones = () => {
        this.phaserZonesGroup.clear(true, true);
        if (!window.ZONES) window.ZONES = [];
        
        const holeTotalWidth = HOLE_WIDTH + SEPARATOR_WIDTH;
        
        let rowMaxEnds = {};
        window.ZONES.forEach(z => {
            if (z.row === undefined) z.row = 0;
            if (!rowMaxEnds[z.row] || z.end > rowMaxEnds[z.row]) rowMaxEnds[z.row] = z.end;
        });

        let maxRow = -1;
        for (let r in rowMaxEnds) {
            if (parseInt(r) > maxRow) maxRow = parseInt(r);
        }

        window.ZONES.forEach((zone, index) => {
            if(!zone.id) zone.id = Date.now() + index;

            let startIdx = Math.max(0, zone.start - 1);
            let endIdx = Math.min(window.HOLE_COUNT - 1, zone.end - 1);

            let leftX = HOLES_OFFSET_X + (startIdx * holeTotalWidth) + SEPARATOR_WIDTH;
            let rightX = HOLES_OFFSET_X + ((endIdx + 1) * holeTotalWidth);
            let w = rightX - leftX;
            let h = 40;
            let y = WORLD_HEIGHT + 60 + (zone.row * 50); 

            let container = this.add.container(leftX, y);
            
            let bg = this.add.graphics();
            let parsedColor = Phaser.Display.Color.HexStringToColor(zone.color).color;
            
            let drawBg = (width) => {
                bg.clear();
                bg.fillStyle(parsedColor, 0.4); 
                bg.fillRoundedRect(0, 0, width, h, 10);
                bg.lineStyle(2, parsedColor, 1);
                bg.strokeRoundedRect(0, 0, width, h, 10);
            };
            drawBg(w);
            
            let text = this.add.text(w/2, h/2, zone.name, {
                fontSize: '16px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            let handle = this.add.graphics();
            let drawHandle = (width) => {
                handle.clear();
                handle.fillStyle(0xffffff, 0.5);
                handle.fillRoundedRect(width - 15, 10, 5, 20, 2);
            };
            drawHandle(w);

            container.add([bg, text, handle]);

            container.updateVisuals = (newWidth) => {
                drawBg(newWidth);
                drawHandle(newWidth);
                text.setX(newWidth/2);
            };
            zone.phaserContainer = container;

            let hitArea = new Phaser.Geom.Rectangle(0, 0, w, h);
            container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(container);

            let dragMode = null;
            let initialStart = 0;
            let initialEnd = 0;
            let initialPointerX = 0;
            let rowSnapshot = [];
            let targetZoneIdx = -1;
            let downTime = 0;

            container.on('pointermove', (pointer, localX, localY) => {
                if (localX > container.input.hitArea.width - 25) {
                    this.game.canvas.style.cursor = 'ew-resize';
                } else {
                    this.game.canvas.style.cursor = 'grab';
                }
            });

            container.on('pointerout', () => {
                this.game.canvas.style.cursor = 'default';
            });

            container.on('pointerdown', (pointer, localX, localY) => {
                downTime = Date.now(); 
                dragMode = (localX > container.input.hitArea.width - 25) ? 'resize' : 'move';
                initialStart = zone.start;
                initialEnd = zone.end;
                initialPointerX = pointer.worldX;
                
                rowSnapshot = JSON.parse(JSON.stringify(window.ZONES.filter(z => z.row === zone.row)));
                rowSnapshot.sort((a,b) => a.start - b.start);
                targetZoneIdx = rowSnapshot.findIndex(z => z.id === zone.id);
            });

            container.on('dragstart', () => {
                isDraggingZone = true;
                this.game.canvas.style.cursor = dragMode === 'resize' ? 'ew-resize' : 'grabbing';
                
                this.phaserZonesGroup.getChildren().forEach(c => {
                    if (c.isPlusBtn) c.setVisible(false);
                });
            });

            container.on('drag', (pointer) => {
                let dx = pointer.worldX - initialPointerX;
                let shiftHoles = Math.round(dx / holeTotalWidth);

                let validConfig = null;
                let sign = Math.sign(shiftHoles);
                let maxShift = Math.abs(shiftHoles);

                for (let s = maxShift; s >= 0; s--) {
                    let attemptShift = s * sign;
                    let tempZones = JSON.parse(JSON.stringify(rowSnapshot));
                    let W0 = tempZones[targetZoneIdx];

                    if (dragMode === 'move') {
                        W0.start += attemptShift;
                        W0.end += attemptShift;
                    } else if (dragMode === 'resize') {
                        W0.end += attemptShift;
                        if (W0.end < W0.start) W0.end = W0.start;
                    }

                    for (let j = targetZoneIdx + 1; j < tempZones.length; j++) {
                        if (tempZones[j-1].end >= tempZones[j].start) {
                            let push = tempZones[j-1].end - tempZones[j].start + 1;
                            tempZones[j].start += push;
                            tempZones[j].end += push;
                        }
                    }

                    for (let j = targetZoneIdx - 1; j >= 0; j--) {
                        if (tempZones[j+1].start <= tempZones[j].end) {
                            let push = tempZones[j].end - tempZones[j+1].start + 1;
                            tempZones[j].start -= push;
                            tempZones[j].end -= push;
                        }
                    }

                    let outOfBounds = tempZones.some(z => z.start < 1 || z.end > window.HOLE_COUNT);
                    if (!outOfBounds) {
                        validConfig = tempZones;
                        break; 
                    }
                }

                if (validConfig) {
                    validConfig.forEach(vz => {
                        let actualZone = window.ZONES.find(z => z.id === vz.id);
                        if (actualZone && (actualZone.start !== vz.start || actualZone.end !== vz.end)) {
                            actualZone.start = vz.start;
                            actualZone.end = vz.end;

                            let c = actualZone.phaserContainer;
                            if (c) {
                                let newLeftX = HOLES_OFFSET_X + ((actualZone.start - 1) * holeTotalWidth) + SEPARATOR_WIDTH;
                                let newRightX = HOLES_OFFSET_X + (actualZone.end * holeTotalWidth);
                                c.x = newLeftX;
                                let newW = newRightX - newLeftX;
                                
                                c.input.hitArea.setTo(0, 0, newW, 40);
                                if (c.updateVisuals) c.updateVisuals(newW);
                            }
                        }
                    });
                }
            });

            container.on('dragend', () => {
                isDraggingZone = false;
                this.game.canvas.style.cursor = 'grab';
                if (window.saveCurrentSession) window.saveCurrentSession();
                window.drawPhaserZones(); 
            });

            container.on('pointerup', (pointer) => {
                let upTime = Date.now();
                if (upTime - downTime < 350 && zone.start === initialStart && zone.end === initialEnd) {
                    if (window.openZonePopover) window.openZonePopover(zone, pointer.event.clientX, pointer.event.clientY);
                }
            });

            this.phaserZonesGroup.add(container);
        });

        let buttonsToDraw = [];
        
        for (let r = 0; r <= maxRow; r++) {
            let currentEnd = rowMaxEnds[r] || 0;
            if (currentEnd < window.HOLE_COUNT) {
                buttonsToDraw.push({ row: r, start: currentEnd + 1 });
            }
        }
        buttonsToDraw.push({ row: maxRow + 1, start: 1 }); 

        buttonsToDraw.forEach(btn => {
            let leftX = HOLES_OFFSET_X + ((btn.start - 1) * holeTotalWidth) + SEPARATOR_WIDTH;
            let y = WORLD_HEIGHT + 60 + (btn.row * 50);
            
            let plusBtn = this.add.container(leftX, y);
            plusBtn.isPlusBtn = true; 
            
            let bg = this.add.graphics();
            bg.fillStyle(0x3FC1C9, 0.15);
            bg.fillRoundedRect(0, 0, HOLE_WIDTH, 40, 8);
            bg.lineStyle(1, 0x3FC1C9, 0.5);
            bg.strokeRoundedRect(0, 0, HOLE_WIDTH, 40, 8);
            
            let txt = this.add.text(HOLE_WIDTH/2, 20, '+', { fontSize: '26px', fill: '#3FC1C9', fontStyle: 'bold' }).setOrigin(0.5);
            plusBtn.add([bg, txt]);
            
            plusBtn.setInteractive(new Phaser.Geom.Rectangle(0, 0, HOLE_WIDTH, 40), Phaser.Geom.Rectangle.Contains);
            
            plusBtn.on('pointerover', () => { bg.clear(); bg.fillStyle(0x3FC1C9, 0.4); bg.fillRoundedRect(0, 0, HOLE_WIDTH, 40, 8); this.game.canvas.style.cursor = 'pointer'; });
            plusBtn.on('pointerout', () => { bg.clear(); bg.fillStyle(0x3FC1C9, 0.15); bg.fillRoundedRect(0, 0, HOLE_WIDTH, 40, 8); bg.lineStyle(1, 0x3FC1C9, 0.5); bg.strokeRoundedRect(0, 0, HOLE_WIDTH, 40, 8); this.game.canvas.style.cursor = 'default'; });

            plusBtn.on('pointerup', () => {
                let rowZones = window.ZONES.filter(z => z.row === btn.row && z.start >= btn.start);
                let rightObstacle = rowZones.sort((a,b) => a.start - b.start)[0];
                let maxEnd = rightObstacle ? rightObstacle.start - 1 : window.HOLE_COUNT;

                let newZone = {
                    id: Date.now(),
                    row: btn.row,
                    start: btn.start,
                    end: Math.min(btn.start + 2, maxEnd),
                    color: '#3FC1C9',
                    name: 'Strefa'
                };
                window.ZONES.push(newZone);
                if (window.saveCurrentSession) window.saveCurrentSession();
                window.drawPhaserZones(); 
            });
            
            this.phaserZonesGroup.add(plusBtn);
        });
    };

    window.drawPhaserZones();

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
        let startX = centerX + Math.cos(randomAngle) * randomDist;
        let startY = centerY + Math.sin(randomAngle) * randomDist;

        let ballName = window.BALL_NAMES[i] || ''; 
        let ball = this.matter.add.image(startX, startY, 'ballBase');
        
        ball.setCircle(BALL_RADIUS);
        ball.setFriction(0.005);
        ball.setFrictionAir(0.015); 
        ball.setBounce(0.5); 
        
        let randomColor = Phaser.Display.Color.RandomRGB(80, 255).color;
        ball.setTint(randomColor);
        
        ball.body.label = 'ball'; 
        ball.body.isLocked = false; 
        ball.claimedHole = null; 
        ball.ballName = ballName; 
        ball.isReported = false; 
        
        ball.isGuideVisible = window.ALL_GUIDES_ON || false;
        
        if (ballName !== '') {
            let neonRing = this.add.image(startX, startY, 'neonRing');
            neonRing.setDepth(5); 
            ball.neonRing = neonRing;

            ball.guideText = this.add.text(startX, startY - 55, ballName, {
                fontSize: '14px', fill: '#0d131a', fontStyle: 'bold',
                backgroundColor: '#99FFFF', padding: { x: 6, y: 4 }
            }).setOrigin(0.5, 1); 
            
            ball.guideText.setDepth(101);
            ball.guideText.setVisible(ball.isGuideVisible);

            ball.guideLine = this.add.graphics();
            ball.guideLine.setDepth(100);
            ball.guideLine.setVisible(ball.isGuideVisible);
        }
        
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
    
    let maxRow = 0;
    if (window.ZONES) {
        window.ZONES.forEach(z => { if (z.row > maxRow) maxRow = z.row; });
    }
    const bottomOfHoles = WORLD_HEIGHT + 120 + ((maxRow + 1) * 50); 
    
    const actionHeight = bottomOfHoles - topOfRing;
    
    const zoomY = game.scale.height / actionHeight;
    const optimalZoom = Math.min(zoomX, zoomY) * 0.95; 
    const centerY = topOfRing + (actionHeight / 2);

    scene.cameras.main.pan(WORLD_WIDTH / 2, centerY, 500, 'Sine.easeInOut');
    scene.cameras.main.zoomTo(optimalZoom, 500, 'Sine.easeInOut');
}

window.toggleHighlight = function(name) {
    const index = window.highlightedBallNames.indexOf(name);
    if (index > -1) {
        window.highlightedBallNames.splice(index, 1);
    } else {
        window.highlightedBallNames.push(name);
    }
    if (window.updateHighlightUI) window.updateHighlightUI(window.highlightedBallNames);
};

window.toggleGuide = function(name, state) {
    balls.forEach(b => {
        if (b.ballName === name && b.guideText) {
            b.isGuideVisible = state;
            b.guideText.setVisible(state);
            b.guideLine.setVisible(state);
        }
    });
};

window.toggleAllGuides = function(state) {
    balls.forEach(b => {
        if (b.ballName !== '' && b.guideText) {
            b.isGuideVisible = state;
            b.guideText.setVisible(state);
            b.guideLine.setVisible(state);
        }
    });
};

function update(time, delta) {
    
    // SPRZĘŻENIE GRAFIK DO WŁAŚCIWOŚCI PIŁKI I LOGIKA POKAZYWANIA PROWADNIC (Multi-select)
    let anyGuideVisible = balls.some(b => b.isGuideVisible);
    let isAnyHighlighted = window.highlightedBallNames && window.highlightedBallNames.length > 0;

    balls.forEach(ball => {
        if (ball.neonRing) {
            ball.neonRing.setPosition(ball.x, ball.y);
            ball.neonRing.setRotation(ball.rotation);
        }

        let isHighlighted = isAnyHighlighted && window.highlightedBallNames.includes(ball.ballName);

        if (isAnyHighlighted) {
            ball.setAlpha(isHighlighted ? 1 : 0.08);
            if(ball.neonRing) ball.neonRing.setAlpha(isHighlighted ? 1 : 0.08);
        } else {
            if (anyGuideVisible && ball.ballName === '') {
                ball.setAlpha(0.08); 
            } else {
                ball.setAlpha(1);
            }
            if(ball.neonRing) ball.neonRing.setAlpha(1);
        }

        let shouldShowGuide = ball.ballName !== '' && ball.isGuideVisible;
        if (isAnyHighlighted && !isHighlighted) {
            shouldShowGuide = false;
        }
        
        if (shouldShowGuide) {
            ball.guideText.setVisible(true); 
            ball.guideLine.setVisible(true);

            let targetX = ball.x;
            let targetY = ball.y - (55 / mainCamera.zoom); 

            ball.guideText.x += (targetX - ball.guideText.x) * 0.15;
            ball.guideText.y += (targetY - ball.guideText.y) * 0.15;
            ball.guideText.setScale(1 / mainCamera.zoom);
            
        } else if (ball.guideLine) {
            ball.guideLine.clear();
            if (ball.guideText) ball.guideText.setVisible(false); 
        }
    });

    // ROZPYCHANIE PROWADNIC - AABB
    let visibleBalls = balls.filter(b => b.ballName !== '' && b.isGuideVisible && b.guideText.visible);
    
    for(let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < visibleBalls.length; i++) {
            for (let j = i + 1; j < visibleBalls.length; j++) {
                let textA = visibleBalls[i].guideText;
                let textB = visibleBalls[j].guideText;

                let padding = 10 / mainCamera.zoom; 

                let wA = (textA.width * textA.scaleX) + padding;
                let hA = (textA.height * textA.scaleY) + padding;
                let wB = (textB.width * textB.scaleX) + padding;
                let hB = (textB.height * textB.scaleY) + padding;

                let cxA = textA.x;
                let cyA = textA.y - (hA / 2);
                let cxB = textB.x;
                let cyB = textB.y - (hB / 2);

                let dx = cxA - cxB;
                let dy = cyA - cyB;
                let absDx = Math.abs(dx);
                let absDy = Math.abs(dy);

                let minDx = (wA / 2) + (wB / 2);
                let minDy = (hA / 2) + (hB / 2);

                if (absDx < minDx && absDy < minDy) {
                    let overlapX = minDx - absDx;
                    let overlapY = minDy - absDy;

                    if (overlapX < overlapY) {
                        let sign = Math.sign(dx) || 1;
                        let push = (overlapX / 2) * sign;
                        textA.x += push;
                        textB.x -= push;
                    } else {
                        let sign = Math.sign(dy) || 1;
                        let push = (overlapY / 2) * sign;
                        textA.y += push;
                        textB.y -= push;
                    }
                }
            }
        }
    }

    // RYSOWANIE LINII DO ROZCHYLONYCH PROWADNIC
    visibleBalls.forEach(ball => {
        let angle = Phaser.Math.Angle.Between(ball.x, ball.y, ball.guideText.x, ball.guideText.y);
        let edgeX = ball.x + Math.cos(angle) * BALL_RADIUS;
        let edgeY = ball.y + Math.sin(angle) * BALL_RADIUS;

        ball.guideLine.clear();
        ball.guideLine.lineStyle(2 / mainCamera.zoom, 0x99FFFF, 0.8);
        ball.guideLine.beginPath();
        ball.guideLine.moveTo(edgeX, edgeY);
        ball.guideLine.lineTo(ball.guideText.x, ball.guideText.y);
        ball.guideLine.strokePath();

        ball.guideLine.fillStyle(0x99FFFF, 1);
        ball.guideLine.fillCircle(edgeX, edgeY, 3 / mainCamera.zoom);
    });

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

        balls.forEach(ball => {
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
    window.highlightedBallNames = []; 

    game.scene.scenes[0].scene.restart();
};
