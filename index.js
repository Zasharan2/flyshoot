var c = document.getElementById("gameCanvas");
var ctx = c.getContext("2d");

var keys = [];

document.addEventListener("keydown", function (event) {
    keys[event.key] = true;
    if ([" ", "Enter", "Tab", "Control"].indexOf(event.key) > -1) {
        event.preventDefault();
    }
});

document.addEventListener("keyup", function (event) {
    keys[event.key] = false;
});

var mouseX;
var mouseY;

window.addEventListener("mousemove", function(event) {
    mouseX = (event.clientX - c.getBoundingClientRect().left) * scale;
    mouseY = (event.clientY - c.getBoundingClientRect().top) * scale;
});

var mouseDown, mouseButton;

window.addEventListener("mousedown", function(event) {
    mouseDown = true;
    mouseButton = event.buttons;
});

window.addEventListener("mouseup", function(event) {
    mouseDown = false;
});

ctx.imageSmoothingEnabled = false;

const displayWidth = 512;
const displayHeight = 512;
const scale = 4;
c.style.width = displayWidth + 'px';
c.style.height = displayHeight + 'px';
c.width = displayWidth * scale;
c.height = displayHeight * scale;

const GAMESCREEN = {
    GAME: 1,
    END: 2
}

var gameScreen;

var shootAudio = new Audio('sounds/shoot.wav');
var burstAudio = new Audio('sounds/burst.wav');
var hitAudio = new Audio('sounds/hit.wav');
var deathAudio = new Audio('sounds/death.wav');

const playerSideLength = 24;
const playerDirectionIndicatorLength = 4;

class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    scale(factor) {
        return new Vector2(this.x * factor, this.y * factor);
    }
}

const shootDelay = 30;
const burstDelay = 230;

function colorToString(col) {
    return "rgba("+col[0]+","+col[1]+","+col[2]+")";
}

class Player {
    constructor(x, y, angle, col) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.angle = angle;
        this.angleVel = 0;
        this.col = col;
        this.shootTimer = shootDelay;
        this.burstTimer = burstDelay;

        this.health = 100;
    }

    render() {
        ctx.translate(scale * this.pos.x, scale * this.pos.y);
        ctx.rotate(this.angle);
        ctx.translate(-scale * this.pos.x, -scale * this.pos.y);

        // triangle
        ctx.beginPath();
        ctx.moveTo(scale * this.pos.x, scale * (this.pos.y + playerSideLength));
        ctx.lineTo(scale * (this.pos.x - (playerSideLength * (Math.sqrt(3) / 2))), scale * (this.pos.y - (0.5 * playerSideLength)));
        ctx.lineTo(scale * (this.pos.x + (playerSideLength * (Math.sqrt(3) / 2))), scale * (this.pos.y - (0.5 * playerSideLength)));
        ctx.lineTo(scale * this.pos.x, scale * (this.pos.y + playerSideLength));
        ctx.fillStyle = colorToString(this.col);
        ctx.fill();

        // directional indicator
        ctx.beginPath();
        ctx.fillStyle = "#00ff00ff";
        ctx.fillRect(scale * (this.pos.x - playerDirectionIndicatorLength), scale * (this.pos.y + playerSideLength - playerDirectionIndicatorLength), scale * playerDirectionIndicatorLength * 2, scale * playerDirectionIndicatorLength * 2);

        // burst indicator
        if (this.burstTimer > burstDelay) {
            this.col[0] += 120;
            this.col[1] += 120;
            this.col[2] += 120;
    
            ctx.beginPath();
            ctx.fillStyle = colorToString(this.col);
            ctx.arc(scale * this.pos.x, scale * this.pos.y, scale * 5, 0, 2 * Math.PI);
            ctx.fill();
    
            this.col[0] -= 120;
            this.col[1] -= 120;
            this.col[2] -= 120;
        }

        ctx.resetTransform();

        // health
        ctx.beginPath();
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(scale * (this.pos.x - 20), scale * (this.pos.y + 30), 40 * scale, 4 * scale);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(scale * (this.pos.x - 20), scale * (this.pos.y + 30), (40 * (this.health / 100)) * scale, 4 * scale);
    }

    takeDamage() {
        this.health -= 10;
        hitAudio.play();
        if (this.health <= 0) {
            deathAudio.play();
            gameScreen = GAMESCREEN.END;
        }
    }
}

var p1;
var p2;

const playerSpeed = 0.5;
const playerTurnSpeed = 0.01;
const friction = 0.8;

function playerMove(player, keymap) {
    // move
    if (keys[keymap[0]]) {
        dir = new Vector2(Math.cos(player.angle + (Math.PI/2)), Math.sin(player.angle + (Math.PI/2)));
        player.vel = player.vel.add(dir.scale(playerSpeed * deltaTime));
    }
    if (keys[keymap[1]]) {
        dir = new Vector2(Math.cos(player.angle + (Math.PI/2)), Math.sin(player.angle + (Math.PI/2)));
        player.vel = player.vel.add(dir.scale(-playerSpeed * deltaTime));
    }
    // turn
    if (keys[keymap[2]]) {
        player.angleVel += playerTurnSpeed * deltaTime;
    }
    if (keys[keymap[3]]) {
        player.angleVel -= playerTurnSpeed * deltaTime;
    }
    // friction
    player.vel = player.vel.scale(friction);
    player.angleVel *= friction;

    // update pos by vel
    player.pos = player.pos.add(player.vel.scale(deltaTime));
    player.angle += player.angleVel * deltaTime;

    // clamp
    if (player.pos.x > 512) {
        player.pos.x = 512;
        player.vel.x = 0;
    }
    if (player.pos.x < 0) {
        player.pos.x = 0;
        player.vel.x = 0;
    }
    if (player.pos.y > 512) {
        player.pos.y = 512;
        player.vel.y = 0;
    }
    if (player.pos.y < 0) {
        player.pos.y = 0;
        player.vel.y = 0;
    }
}

const bulletDimensions = [3, 10];

class Bullet {
    constructor(pos, angle, col, player) {
        this.pos = new Vector2(pos.x, pos.y);
        this.angle = angle;
        this.col = col;
        this.player = player;
    }

    render() {
        ctx.beginPath();
        ctx.moveTo(scale * this.pos.x, scale * this.pos.y);
        ctx.lineTo(scale * (this.pos.x + (bulletDimensions[0] * Math.cos(this.angle))), scale * (this.pos.y + (bulletDimensions[0] * Math.sin(this.angle))));
        ctx.lineWidth = scale * bulletDimensions[1];
        ctx.strokeStyle = colorToString(this.col);
        ctx.stroke();
    }

    move() {
        var dir = new Vector2(-Math.sin(this.angle), Math.cos(this.angle));
        this.pos = this.pos.add(dir.scale(3 * deltaTime));

        // out of bounds
        if (this.pos.x > 576 || this.pos.x < -64 || this.pos.y > 576 || this.pos.y < -64) {
            bulletList.splice(bulletList.indexOf(this), 1);
        }

        // hit player
        if (p1 != this.player) {
            if (Math.sqrt(Math.pow(this.pos.x - p1.pos.x, 2) + Math.pow(this.pos.y - p1.pos.y, 2)) < 24) {
                bulletList.splice(bulletList.indexOf(this), 1);
                p1.takeDamage();
            }
        }
        if (p2 != this.player) {
            if (Math.sqrt(Math.pow(this.pos.x - p2.pos.x, 2) + Math.pow(this.pos.y - p2.pos.y, 2)) < 24) {
                bulletList.splice(bulletList.indexOf(this), 1);
                p2.takeDamage();
            }
        }
    }
}

var bulletList;

function playerShoot(player, keymap) {
    player.shootTimer += deltaTime;
    player.burstTimer += deltaTime;
    if (keys[keymap[0]] && player.shootTimer > shootDelay) {
        bulletList.push(new Bullet(player.pos, player.angle, player.col, player));
        player.shootTimer = 0;
        shootAudio.play();
    }
    if (keys[keymap[1]] && player.burstTimer > burstDelay) {
        for (var i = -5; i <= 5; i++) {
            bulletList.push(new Bullet(player.pos, player.angle + (i / 5), player.col, player));
        }
        player.burstTimer = -200;
        burstAudio.play();

        dir = new Vector2(Math.cos(player.angle + (Math.PI/2)), Math.sin(player.angle + (Math.PI/2)));
        player.vel = player.vel.add(dir.scale(-5 * playerSpeed * deltaTime));
    }
}

function renderBackground() {
    ctx.beginPath();
    ctx.fillStyle = "#430020ff";
    ctx.fillRect(0, 0, displayWidth * scale, displayHeight * scale);
}

function updatePlayers() {
    playerMove(p1, ["w", "s", "d", "a"]);
    playerMove(p2, ["i", "k", "l", "j"]);

    playerShoot(p1, ["e", "q"]);
    playerShoot(p2, ["o", "u"]);

    p1.render();
    p2.render();
}

function updateBullets() {
    for (var i = 0; i < bulletList.length; i++) {
        bulletList[i].move();
    }
    for (var i = 0; i < bulletList.length; i++) {
        bulletList[i].render();
    }
}

function main() {
    renderBackground();

    switch (gameScreen) {
        case GAMESCREEN.GAME: {
            updatePlayers();
            updateBullets();
            break;
        }
        case GAMESCREEN.END: {
            if (p1.health <= 0) {
                p2.pos = new Vector2(192, 128);
                p2.angle = Math.PI;
                p2.render();
                ctx.fillStyle = "#ffffffff";
                ctx.font = (32 * scale) + "px Comic Sans MS";
                ctx.fillText("WON!", 256 * scale, 136 * scale);
            }
            if (p2.health <= 0) {
                p1.pos = new Vector2(192, 128);
                p1.angle = Math.PI;
                p1.render();
                ctx.fillStyle = "#ffffffff";
                ctx.font = (32 * scale) + "px Comic Sans MS";
                ctx.fillText("WON!", 256 * scale, 136 * scale);
            }
            ctx.fillText("Press Space to play again.", 64 * scale, 256 * scale);
            if (keys[" "]) {
                init();
            }
            break;
        }
        default: {
            break;
        }
    }
}

var deltaTime = 0;
var deltaCorrect = (1 / 8);
var prevTime = Date.now();
function loop() {
    deltaTime = (Date.now() - prevTime) * deltaCorrect;
    prevTime = Date.now();

    main();
    window.requestAnimationFrame(loop);
}

function init() {
    p1 = new Player(32, 32, 0, [255, 0, 0]);
    p2 = new Player(480, 480, Math.PI, [0, 0, 255]);

    bulletList = [];

    gameScreen = GAMESCREEN.GAME;
}
window.requestAnimationFrame(init);
window.requestAnimationFrame(loop);