(function () {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    const maxLives = 3;

    const stars = [];
    const bullets = [];
    const enemies = [];
    const enemyBullets = [];
    const powerUps = [];
    const particles = [];
    const keys = {};

    const gameOverBanner = document.getElementById('gameOver');
    const scoreSpan = document.getElementById('score');
    const livesSpan = document.getElementById('lives');
    const shieldSpan = document.getElementById('shield');
    const finalScoreSpan = document.getElementById('finalScore');
    const buffsSpan = document.getElementById('buffs');

    const player = {
        x: width / 2,
        y: height - 80,
        w: 40,
        h: 40,
        speed: 260,
        cooldown: 0,
        baseCooldown: 0.22,
        fireCooldown: 0.22,
        bulletCount: 1,
        invulnTimer: 0
    };

    let score = 0;
    let lives = maxLives;
    let shieldCharges = 0;

    let enemyTimer = 0;
    let lastTime = 0;
    let isGameOver = false;
    let hitFlashTimer = 0;

    const timers = {
        rapid: 0,
        spread: 0
    };

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function initStars() {
        stars.length = 0;
        const count = 90;
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 40 + 20,
                alpha: Math.random() * 0.7 + 0.3
            });
        }
    }

    function resetGame() {
        score = 0;
        lives = maxLives;
        shieldCharges = 0;
        bullets.length = 0;
        enemies.length = 0;
        enemyBullets.length = 0;
        powerUps.length = 0;
        particles.length = 0;

        player.x = width / 2;
        player.y = height - 80;
        player.cooldown = 0;
        player.invulnTimer = 0;
        player.fireCooldown = player.baseCooldown;
        player.bulletCount = 1;

        timers.rapid = 0;
        timers.spread = 0;

        enemyTimer = 0;
        isGameOver = false;
        hitFlashTimer = 0;

        gameOverBanner.classList.remove('visible');
        updateHud();
        updateBuffsLabel();
    }

    function updateHud() {
        scoreSpan.textContent = score;
        livesSpan.textContent = lives;
        shieldSpan.textContent = shieldCharges;
    }

    function updateBuffsLabel() {
        const active = [];

        if (timers.rapid > 0) active.push('Скорострельность');
        if (timers.spread > 0) active.push('Тройной выстрел');

        if (!active.length && shieldCharges === 0) {
            buffsSpan.textContent =
                'Собирай бонусы: R — скорострельность, S — тройной выстрел, щит — доп. защита.';
        } else {
            let text = '';
            if (active.length) {
                text += 'Активно: ' + active.join(', ');
            }
            if (shieldCharges > 0) {
                if (text) text += ' · ';
                text += 'Щит x' + shieldCharges;
            }
            buffsSpan.textContent = text;
        }
    }

    function addScore(amount) {
        score += amount;
        updateHud();
    }

    function spawnEnemy() {
        const difficulty = Math.min(score / 400, 1.8);
        const roll = Math.random();
        let type;

        if (score < 80) {
            type = 'basic';
        } else if (score < 250) {
            if (roll < 0.7) type = 'basic';
            else if (roll < 0.92) type = 'fast';
            else type = 'tank';
        } else {
            if (roll < 0.5) type = 'basic';
            else if (roll < 0.8) type = 'fast';
            else type = 'tank';
        }

        let size, speedY, drift, hp, points, shootTimer;

        if (type === 'basic') {
            size = rand(26, 40);
            speedY = rand(90, 150) + score * 0.18;
            drift = rand(-38, 38);
            hp = 1;
            points = 10;
            shootTimer = null;
        } else if (type === 'fast') {
            size = rand(20, 28);
            speedY = rand(180, 260) + score * 0.25;
            drift = rand(-18, 18);
            hp = 1;
            points = 15;
            shootTimer = null;
        } else { // tank
            size = rand(42, 54);
            speedY = rand(55, 85) + score * 0.12;
            drift = rand(-24, 24);
            hp = 3;
            points = 25;
            shootTimer = rand(1.4, 2.7); // время до первого выстрела
        }

        const x = rand(size, width - size);

        enemies.push({
            x: x,
            y: -size,
            w: size,
            h: size,
            speedY: speedY,
            drift: drift,
            phase: Math.random() * Math.PI * 2,
            type: type,
            hp: hp,
            maxHp: hp,
            points: points,
            shootTimer: shootTimer
        });
    }

    function spawnExplosion(x, y, type) {
        const count = 12;
        let colors;
        if (type === 'fast') {
            colors = ['#b6f3ff', '#4fb7ff'];
        } else if (type === 'tank') {
            colors = ['#ffe8b0', '#ff9b3a'];
        } else {
            colors = ['#ffd0e4', '#ff5177'];
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = rand(40, 160);
            const life = rand(0.4, 0.9);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                initialLife: life,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    function spawnHitSpark(x, y) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = rand(50, 120);
            const life = rand(0.2, 0.45);
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                initialLife: life,
                color: '#ffffff'
            });
        }
    }

    function spawnEnemyBullet(e) {
        enemyBullets.push({
            x: e.x,
            y: e.y + e.h * 0.3,
            r: 4,
            speed: 240
        });
    }

    function maybeSpawnPowerUp(x, y) {
        const chance = 0.16;
        if (Math.random() > chance) return;

        const roll = Math.random();
        let type;
        if (roll < 0.4) type = 'rapid';       // 40%
        else if (roll < 0.8) type = 'spread'; // 40%
        else type = 'shield';                 // 20%

        powerUps.push({
            x: x,
            y: y,
            vy: 70,
            radius: 12,
            type: type
        });
    }

    function applyPowerUp(type) {
        if (type === 'rapid') {
            timers.rapid = 7; // секунд
        } else if (type === 'spread') {
            timers.spread = 8;
        } else if (type === 'shield') {
            shieldCharges++;
        }
        updateHud();
        updateBuffsLabel();
    }

    function updatePowerUpEffects(dt) {
        if (timers.rapid > 0) {
            timers.rapid -= dt;
            if (timers.rapid < 0) timers.rapid = 0;
        }
        if (timers.spread > 0) {
            timers.spread -= dt;
            if (timers.spread < 0) timers.spread = 0;
        }

        // Применение эффектов к игроку
        player.fireCooldown = player.baseCooldown * (timers.rapid > 0 ? 0.4 : 1.0);
        player.bulletCount = timers.spread > 0 ? 3 : 1;
    }

    function loseLife() {
        if (player.invulnTimer > 0) return;

        hitFlashTimer = 0.35;

        // Сначала тратим заряд щита
        if (shieldCharges > 0) {
            shieldCharges--;
            player.invulnTimer = 1.0;
            updateHud();
            updateBuffsLabel();
            return;
        }

        lives--;
        if (lives < 0) lives = 0;
        player.invulnTimer = 1.2;
        updateHud();

        if (lives <= 0) {
            gameOver();
        }
    }

    function gameOver() {
        isGameOver = true;
        finalScoreSpan.textContent = score;
        gameOverBanner.classList.add('visible');
    }

    function rectsIntersect(a, b) {
        return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
        );
    }

    function circleIntersectsRect(cx, cy, r, rect) {
        const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
        const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return dx * dx + dy * dy < r * r;
    }

    function update(dt) {
        // Звёзды — всегда
        for (const s of stars) {
            s.y += s.speed * dt;
            if (s.y > height) {
                s.y = -4;
                s.x = Math.random() * width;
            }
        }

        // Частицы (взрывы, искры) — всегда
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 30 * dt;
        }

        if (hitFlashTimer > 0) {
            hitFlashTimer -= dt;
            if (hitFlashTimer < 0) hitFlashTimer = 0;
        }

        if (isGameOver) return;

        if (player.invulnTimer > 0) {
            player.invulnTimer -= dt;
            if (player.invulnTimer < 0) player.invulnTimer = 0;
        }

        updatePowerUpEffects(dt);

        // Движение игрока
        let move = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) move -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) move += 1;
        player.x += move * player.speed * dt;

        const margin = 30;
        if (player.x < margin) player.x = margin;
        if (player.x > width - margin) player.x = width - margin;

        // Кулдаун выстрела
        if (player.cooldown > 0) {
            player.cooldown -= dt;
            if (player.cooldown < 0) player.cooldown = 0;
        }

        // Стрельба
        const fireKey =
            keys['Space'] || keys['KeyW'] || keys['ArrowUp'];
        if (fireKey && player.cooldown === 0) {
            const count = player.bulletCount;
            if (count === 1) {
                bullets.push({
                    x: player.x,
                    y: player.y - player.h / 2,
                    w: 4,
                    h: 14,
                    speed: 460
                });
            } else if (count === 3) {
                const offsets = [-12, 0, 12];
                for (let i = 0; i < offsets.length; i++) {
                    bullets.push({
                        x: player.x + offsets[i],
                        y: player.y - player.h / 2,
                        w: 4,
                        h: 14,
                        speed: 460
                    });
                }
            }
            player.cooldown = player.fireCooldown;
        }

        // Пули игрока
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y -= b.speed * dt;
            if (b.y + b.h < 0) {
                bullets.splice(i, 1);
            }
        }

        // Спавн врагов
        const spawnInterval = Math.max(0.25, 1.0 - score / 1000);
        enemyTimer -= dt;
        if (enemyTimer <= 0) {
            spawnEnemy();
            enemyTimer = spawnInterval;
        }

        const playerRect = {
            x: player.x - player.w / 2,
            y: player.y - player.h / 2,
            w: player.w,
            h: player.h
        };

        // Враги
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.phase += dt * 2;
            e.x += Math.sin(e.phase) * e.drift * dt;
            e.y += e.speedY * dt;

            // Ограничение по горизонтали
            if (e.x < e.w / 2) e.x = e.w / 2;
            if (e.x > width - e.w / 2) e.x = width - e.w / 2;

            // Враг ушёл за нижний край — игрок теряет жизнь
            if (e.y - e.h / 2 > height) {
                enemies.splice(i, 1);
                loseLife();
                continue;
            }

            // Стреляющие враги (танки)
            if (e.shootTimer != null) {
                e.shootTimer -= dt;
                if (e.shootTimer <= 0) {
                    spawnEnemyBullet(e);
                    e.shootTimer = rand(2.4, 4.0);
                }
            }

            // Столкновение с игроком
            const enemyRect = {
                x: e.x - e.w / 2,
                y: e.y - e.h / 2,
                w: e.w,
                h: e.h
            };

            if (rectsIntersect(playerRect, enemyRect)) {
                enemies.splice(i, 1);
                loseLife();
            }
        }

        // Вражеские пули
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i];
            b.y += b.speed * dt;

            if (b.y - b.r > height) {
                enemyBullets.splice(i, 1);
                continue;
            }

            if (circleIntersectsRect(b.x, b.y, b.r, playerRect)) {
                enemyBullets.splice(i, 1);
                loseLife();
            }
        }

        // Бонусы
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.y += p.vy * dt;

            if (p.y - p.radius > height + 10) {
                powerUps.splice(i, 1);
                continue;
            }

            if (circleIntersectsRect(
                p.x,
                p.y,
                p.radius,
                playerRect
            )) {
                applyPowerUp(p.type);
                powerUps.splice(i, 1);
            }
        }

        // Столкновения пуль игрока и врагов
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            const br = {
                x: b.x - b.w / 2,
                y: b.y - b.h / 2,
                w: b.w,
                h: b.h
            };
            let hit = false;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const er = {
                    x: e.x - e.w / 2,
                    y: e.y - e.h / 2,
                    w: e.w,
                    h: e.h
                };

                if (rectsIntersect(br, er)) {
                    // Пуля удаляется в любом случае
                    bullets.splice(i, 1);
                    hit = true;

                    if (e.hp > 1) {
                        e.hp--;
                        spawnHitSpark(b.x, b.y);
                    } else {
                        spawnExplosion(e.x, e.y, e.type);
                        addScore(e.points);
                        maybeSpawnPowerUp(e.x, e.y);
                        enemies.splice(j, 1);
                    }
                    break;
                }
            }

            if (hit) continue;
        }

        updateBuffsLabel();
    }

    function drawPlayer() {
        const p = player;
        ctx.save();
        ctx.translate(p.x, p.y);

        let alpha = 1;
        if (p.invulnTimer > 0) {
            // Мигание при неуязвимости
            const t = Math.floor(p.invulnTimer * 10);
            alpha = (t % 2 === 0) ? 0.3 : 1;
        }
        ctx.globalAlpha = alpha;

        // Корпус корабля (треугольник)
        const grad = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
        grad.addColorStop(0, '#b6f3ff');
        grad.addColorStop(0.4, '#4fb7ff');
        grad.addColorStop(1, '#1741ff');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -p.h / 2);
        ctx.lineTo(-p.w / 2, p.h / 2);
        ctx.lineTo(p.w / 2, p.h / 2);
        ctx.closePath();
        ctx.fill();

        // Кабина
        ctx.fillStyle = 'rgba(10,220,255,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, -p.h * 0.1, p.w * 0.18, p.h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Пламя двигателя
        const flameGrad = ctx.createLinearGradient(0, p.h / 2, 0, p.h / 2 + 14);
        flameGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        flameGrad.addColorStop(0.4, 'rgba(255,200,80,0.9)');
        flameGrad.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-p.w * 0.22, p.h / 2);
        ctx.lineTo(p.w * 0.22, p.h / 2);
        ctx.lineTo(0, p.h / 2 + 14);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawEnemies() {
        for (const e of enemies) {
            const x = e.x - e.w / 2;
            const y = e.y - e.h / 2;
            const r = e.w / 2;

            let gradE;
            if (e.type === 'fast') {
                gradE = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, r);
                gradE.addColorStop(0, '#e0fbff');
                gradE.addColorStop(0.5, '#4fd3ff');
                gradE.addColorStop(1, '#004056');
            } else if (e.type === 'tank') {
                gradE = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, r);
                gradE.addColorStop(0, '#fff5d2');
                gradE.addColorStop(0.5, '#ffb347');
                gradE.addColorStop(1, '#5a2800');
            } else { // basic
                gradE = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, r);
                gradE.addColorStop(0, '#ffecf0');
                gradE.addColorStop(0.5, '#ff5177');
                gradE.addColorStop(1, '#550016');
            }

            ctx.fillStyle = gradE;
            ctx.beginPath();
            ctx.moveTo(e.x, y);
            ctx.lineTo(x + e.w, y + e.h * 0.35);
            ctx.lineTo(e.x + e.w * 0.6, y + e.h);
            ctx.lineTo(e.x - e.w * 0.6, y + e.h);
            ctx.lineTo(x, y + e.h * 0.35);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle =
                e.type === 'tank'
                    ? 'rgba(255,210,160,0.9)'
                    : (e.type === 'fast'
                        ? 'rgba(180,240,255,0.9)'
                        : 'rgba(255,160,190,0.9)');
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // Полоска HP для "танка"
            if (e.maxHp > 1) {
                const barWidth = e.w * 0.6;
                const barHeight = 3;
                const hpRatio = e.hp / e.maxHp;
                const bx = e.x - barWidth / 2;
                const by = y - 6;

                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(bx, by, barWidth, barHeight);
                ctx.fillStyle = '#ffdd66';
                ctx.fillRect(bx, by, barWidth * hpRatio, barHeight);
            }
        }
    }

    function draw() {
        // Фон
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, '#050a1a');
        g.addColorStop(0.5, '#02030a');
        g.addColorStop(1, '#000000');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // Звёзды
        for (const s of stars) {
            ctx.fillStyle = 'rgba(255,255,255,' + s.alpha + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Частицы (взрывы и искры)
        for (const p of particles) {
            const alpha = Math.max(p.life / p.initialLife, 0);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Корабль
        drawPlayer();

        // Пули игрока
        for (const b of bullets) {
            const grad = ctx.createLinearGradient(0, b.y - b.h, 0, b.y + b.h);
            grad.addColorStop(0, '#9be7ff');
            grad.addColorStop(1, '#35a0ff');
            ctx.fillStyle = grad;
            ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        }

        // Враги
        drawEnemies();

        // Вражеские пули
        for (const b of enemyBullets) {
            const grad = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 3);
            grad.addColorStop(0, '#ffe3e3');
            grad.addColorStop(0.5, '#ff7373');
            grad.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Бонусы
        for (const p of powerUps) {
            let color;
            if (p.type === 'rapid') color = '#5fd9ff';
            else if (p.type === 'spread') color = '#7dff9f';
            else color = '#ffd966';

            const grad = ctx.createRadialGradient(
                p.x, p.y, 4,
                p.x, p.y, p.radius + 6
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Буква
            ctx.fillStyle = '#00101a';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let label = 'R';
            if (p.type === 'spread') label = 'S';
            else if (p.type === 'shield') label = '⚡';
            ctx.fillText(label, p.x, p.y + 0.5);
        }

        // Вспышка экрана при получении урона
        if (hitFlashTimer > 0) {
            const alpha = Math.min(hitFlashTimer / 0.35, 1) * 0.45;
            ctx.fillStyle = 'rgba(255,60,80,' + alpha + ')';
            ctx.fillRect(0, 0, width, height);
        }
    }

    function loop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        update(dt);
        draw();

        requestAnimationFrame(loop);
    }

    // Управление с клавиатуры
    window.addEventListener('keydown', function (e) {
        keys[e.code] = true;

        if (isGameOver && (e.code === 'Space' || e.code === 'Enter')) {
            resetGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        keys[e.code] = false;
    });

    // Перезапуск по клику / тапу по баннеру
    gameOverBanner.addEventListener('click', function () {
        if (isGameOver) resetGame();
    });

    // Старт
    initStars();
    updateHud();
    updateBuffsLabel();
    requestAnimationFrame(loop);
})();