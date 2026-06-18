(function() {
    'use strict';

    // ==================== CONFIG ====================
    const CONFIG = {
        GRAVITY: 15,
        BULLET_SPEED: 680,
        MISSILE_SPEED: 400,
        MISSILE_TURN_RATE: 5,
        PLAYER_FIRE_INTERVAL: 0.12,
        STAR_COUNT: 100,
    };

    // ==================== OBJECT POOL ====================
    class ObjectPool {
        constructor(factory, reset, initialSize = 40) {
            this.factory = factory;
            this.reset = reset;
            this.available = [];
            this.active = new Set();
            for (let i = 0; i < initialSize; i++) this.available.push(factory());
        }
        acquire() {
            let obj = this.available.pop();
            if (!obj) obj = this.factory();
            this.active.add(obj);
            return obj;
        }
        release(obj) {
            if (this.active.has(obj)) {
                this.active.delete(obj);
                this.reset(obj);
                this.available.push(obj);
            }
        }
        releaseAll() {
            this.active.forEach(obj => { this.reset(obj); this.available.push(obj); });
            this.active.clear();
        }
        get activeCount() { return this.active.size; }
        forEach(fn) { this.active.forEach(fn); }
    }

    // ==================== AUDIO ENGINE ====================
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.initialized = false;
            this.masterGain = null;
            this.musicGain = null;
            this.sfxGain = null;
        }
        init() {
            if (this.initialized) return;
            try {
                this.ctx = new(window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.7;
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = 0.8;
                this.sfxGain.connect(this.masterGain);
                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.3;
                this.musicGain.connect(this.masterGain);
                this.masterGain.connect(this.ctx.destination);
                this.initialized = true;
            } catch (e) {}
        }
        play(type, vol = 1, data = 0) {
            if (!this.initialized) return;
            const now = this.ctx.currentTime;
            const gain = this.ctx.createGain();
            gain.connect(this.sfxGain);
            gain.gain.setValueAtTime(Math.min(vol * 0.7, 0.85), now);
            switch (type) {
                case 'gunfire':
                    this._gunfire(gain, now, data);
                    break;
                case 'missile':
                    this._missile(gain, now);
                    break;
                case 'explosion':
                    this._explosion(gain, now, vol);
                    break;
                case 'megaExplosion':
                    this._megaExplosion(gain, now);
                    break;
                case 'hit':
                    this._hit(gain, now);
                    break;
                case 'powerup':
                    this._powerup(gain, now, data);
                    break;
                case 'stageClear':
                    this._stageClear(gain, now);
                    break;
                case 'playerHit':
                    this._playerHit(gain, now);
                    break;
                case 'combo':
                    this._combo(gain, now);
                    break;
                case 'enemyFire1':
                    this._enemyFire1(gain, now);
                    break;
                case 'enemyFire2':
                    this._enemyFire2(gain, now);
                    break;
                case 'enemyFire3':
                    this._enemyFire3(gain, now);
                    break;
                case 'achievement':
                    this._achievement(gain, now);
                    break;
                case 'countdown':
                    this._countdown(gain, now);
                    break;
            }
        }
        _gunfire(g, n, t) {
            const o = this.ctx.createOscillator(),
                gg = this.ctx.createGain(),
                b = this.ctx.createBiquadFilter();
            b.type = 'lowshelf';
            b.frequency.value = 180;
            b.gain.value = t * 10;
            o.type = t >= 3 ? 'sawtooth' : 'square';
            o.frequency.setValueAtTime(110 + t * 35, n);
            o.frequency.exponentialRampToValueAtTime(25 + t * 12, n + 0.07 + t * 0.02);
            gg.gain.setValueAtTime(0.3 + t * 0.1, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.09 + t * 0.03);
            o.connect(b);
            b.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.11 + t * 0.03);
            if (t >= 4) {
                const o2 = this.ctx.createOscillator();
                o2.type = 'triangle';
                o2.frequency.setValueAtTime(55, n);
                o2.frequency.exponentialRampToValueAtTime(18, n + 0.14);
                const g2 = this.ctx.createGain();
                g2.gain.setValueAtTime(0.28, n);
                g2.gain.exponentialRampToValueAtTime(0.001, n + 0.16);
                o2.connect(g2);
                g2.connect(g);
                o2.start(n);
                o2.stop(n + 0.16);
            }
        }
        _missile(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(240, n);
            o.frequency.exponentialRampToValueAtTime(45, n + 0.45);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.35, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.5);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.5);
        }
        _explosion(g, n, v) {
            const b = 4096;
            const ns = this.ctx.createBufferSource();
            const bf = this.ctx.createBuffer(1, b, this.ctx.sampleRate);
            const d = bf.getChannelData(0);
            for (let i = 0; i < b; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (b * 0.12));
            ns.buffer = bf;
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(1100, n);
            f.frequency.exponentialRampToValueAtTime(35, n + 0.65);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(v * 0.65, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.9);
            ns.connect(f);
            f.connect(gg);
            gg.connect(g);
            ns.start(n);
            ns.stop(n + 0.9);
        }
        _megaExplosion(g, n) {
            const b = 8192;
            const ns = this.ctx.createBufferSource();
            const bf = this.ctx.createBuffer(1, b, this.ctx.sampleRate);
            const d = bf.getChannelData(0);
            for (let i = 0; i < b; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (b * 0.08));
            ns.buffer = bf;
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(2000, n);
            f.frequency.exponentialRampToValueAtTime(20, n + 1.5);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.8, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 2);
            ns.connect(f);
            f.connect(gg);
            gg.connect(g);
            ns.start(n);
            ns.stop(n + 2);
            const o = this.ctx.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(30, n);
            o.frequency.exponentialRampToValueAtTime(5, n + 1.8);
            const g2 = this.ctx.createGain();
            g2.gain.setValueAtTime(0.5, n);
            g2.gain.exponentialRampToValueAtTime(0.001, n + 2);
            o.connect(g2);
            g2.connect(g);
            o.start(n);
            o.stop(n + 2);
        }
        _hit(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(650, n);
            o.frequency.exponentialRampToValueAtTime(140, n + 0.04);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.3, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.06);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.06);
        }
        _powerup(g, n, t) {
            [400, 600, 900, 1200].slice(0, 2 + t).forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = f;
                const gg = this.ctx.createGain();
                gg.gain.setValueAtTime(0, n + i * 0.1);
                gg.gain.linearRampToValueAtTime(0.22, n + i * 0.1 + 0.04);
                gg.gain.exponentialRampToValueAtTime(0.001, n + i * 0.1 + 0.22);
                o.connect(gg);
                gg.connect(g);
                o.start(n + i * 0.1);
                o.stop(n + i * 0.1 + 0.22);
            });
        }
        _stageClear(g, n) {
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = f;
                const gg = this.ctx.createGain();
                gg.gain.setValueAtTime(0, n + i * 0.14);
                gg.gain.linearRampToValueAtTime(0.28, n + i * 0.14 + 0.04);
                gg.gain.exponentialRampToValueAtTime(0.001, n + i * 0.14 + 0.32);
                o.connect(gg);
                gg.connect(g);
                o.start(n + i * 0.14);
                o.stop(n + i * 0.14 + 0.32);
            });
        }
        _playerHit(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(320, n);
            o.frequency.exponentialRampToValueAtTime(22, n + 0.32);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.45, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.36);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.36);
        }
        _combo(g, n) {
            [660, 880, 1100].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.type = 'square';
                o.frequency.value = f;
                const gg = this.ctx.createGain();
                gg.gain.setValueAtTime(0, n + i * 0.05);
                gg.gain.linearRampToValueAtTime(0.18, n + i * 0.05 + 0.03);
                gg.gain.exponentialRampToValueAtTime(0.001, n + i * 0.05 + 0.16);
                o.connect(gg);
                gg.connect(g);
                o.start(n + i * 0.05);
                o.stop(n + i * 0.05 + 0.16);
            });
        }
        _enemyFire1(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'square';
            o.frequency.setValueAtTime(500, n);
            o.frequency.exponentialRampToValueAtTime(200, n + 0.05);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.2, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.06);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.06);
        }
        _enemyFire2(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(800, n);
            o.frequency.exponentialRampToValueAtTime(100, n + 0.08);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.25, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.1);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.1);
        }
        _enemyFire3(g, n) {
            const o = this.ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(300, n);
            o.frequency.exponentialRampToValueAtTime(50, n + 0.12);
            const gg = this.ctx.createGain();
            gg.gain.setValueAtTime(0.3, n);
            gg.gain.exponentialRampToValueAtTime(0.001, n + 0.15);
            o.connect(gg);
            gg.connect(g);
            o.start(n);
            o.stop(n + 0.15);
        }
        _achievement(g, n) {
            [880, 1100, 1320].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = f;
                const gg = this.ctx.createGain();
                gg.gain.setValueAtTime(0, n + i * 0.12);
                gg.gain.linearRampToValueAtTime(0.25, n + i * 0.12 + 0.04);
                gg.gain.exponentialRampToValueAtTime(0.001, n + i * 0.12 + 0.3);
                o.connect(gg);
                gg.connect(g);
                o.start(n + i * 0.12);
                o.stop(n + i * 0.12 + 0.3);
            });
        }
        _countdown(g, n) {
            [440, 554, 659].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.type = 'square';
                o.frequency.value = f;
                const gg = this.ctx.createGain();
                gg.gain.setValueAtTime(0.15, n + i * 0.2);
                gg.gain.exponentialRampToValueAtTime(0.001, n + i * 0.2 + 0.18);
                o.connect(gg);
                gg.connect(g);
                o.start(n + i * 0.2);
                o.stop(n + i * 0.2 + 0.18);
            });
        }
    }

    // ==================== GLOBALS ====================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const container = document.getElementById('gameContainer');
    let gameWidth, gameHeight;
    let deltaTime = 1;
    let lastTime = performance.now();
    let frameCount = 0;

    function resizeCanvas() {
        const r = container.getBoundingClientRect();
        gameWidth = r.width;
        gameHeight = r.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = gameWidth * dpr;
        canvas.height = gameHeight * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));

    const audio = new AudioEngine();

    // ==================== DOM REFS ====================
    const $ = id => document.getElementById(id);
    const sideNotification = $('sideNotification');
    const sideStageName = $('sideStageName');
    const sideStageSub = $('sideStageSub');
    const victoryQuote = $('victoryQuote');
    const quoteText = $('quoteText');
    const gameOverScreen = $('gameOverScreen');
    const scoreDisplay = $('scoreDisplay');
    const healthFill = $('healthFill');
    const healthPercent = $('healthPercent');
    const stageDisplay = $('stageDisplay');
    const squadronCounter = $('squadronCounter');
    const missileCountDisplay = $('missileCount');
    const finalScoreEl = $('finalScore');
    const finalKillsEl = $('finalKills');
    const finalStageEl = $('finalStage');
    const comboDisplay = $('comboDisplay');
    const damageVignette = $('damageVignette');
    const achievementToast = $('achievementToast');
    const wDot1 = $('wDot1'),
        wDot2 = $('wDot2'),
        wDot3 = $('wDot3'),
        wDot4 = $('wDot4');

    // Multiplayer UI refs
    const mpPanel = $('multiplayerPanel');
    const mpStatus = $('mpStatus');
    const btnHost = $('btnHostGame');
    const btnScan = $('btnScanDevices');
    const deviceList = $('deviceList');
    const mpScore1 = $('mpScore1');
    const mpScore2 = $('mpScore2');
    const mpHealth1 = $('mpHealth1');
    const mpHealth2 = $('mpHealth2');
    const mpName1 = $('mpName1');
    const mpName2 = $('mpName2');

    // ==================== AIRCRAFT ====================
    const allAircraft = [
        { id: 0, name: 'الصقر 1', icon: '🎯', color1: '#8899aa', color2: '#556677', width: 40, height: 48, speed: 250, maxHealth: 100, desc: 'طائرة تدريب أساسية', unlockStage: 0 },
        { id: 1, name: 'الصقر 2', icon: '🎯', color1: '#7799bb', color2: '#4477aa', width: 42, height: 50, speed: 265, maxHealth: 105, desc: 'طائرة قتال خفيفة', unlockStage: 0 },
        { id: 2, name: 'النسر', icon: '🦅', color1: '#889977', color2: '#556644', width: 44, height: 52, speed: 280, maxHealth: 110, desc: 'طائرة متوسطة', unlockStage: 0 },
        { id: 3, name: 'أبابيل M1', icon: '✈️', color1: '#6677aa', color2: '#334477', width: 46, height: 54, speed: 295, maxHealth: 115, desc: 'طائرة متطورة', unlockStage: 5 },
        { id: 4, name: 'أبابيل M2', icon: '✈️', color1: '#5566aa', color2: '#223366', width: 48, height: 56, speed: 310, maxHealth: 120, desc: 'طائرة هجومية', unlockStage: 5 },
        { id: 5, name: 'البراق', icon: '⚡', color1: '#aa8844', color2: '#775522', width: 50, height: 58, speed: 325, maxHealth: 125, desc: 'طائرة خاطفة', unlockStage: 10 },
        { id: 6, name: 'الرعد', icon: '⚡', color1: '#44aabb', color2: '#227788', width: 52, height: 60, speed: 340, maxHealth: 130, desc: 'طائرة مدمرة', unlockStage: 10 },
        { id: 7, name: 'العقاب', icon: '🦅', color1: '#aa4444', color2: '#771111', width: 54, height: 62, speed: 355, maxHealth: 140, desc: 'طائرة أسطورية', unlockStage: 15 },
        { id: 8, name: 'أبابيل MX', icon: '✈️', color1: '#44aa44', color2: '#227722', width: 56, height: 64, speed: 370, maxHealth: 150, desc: 'طائرة النخبة', unlockStage: 15 },
        { id: 9, name: 'طوفان', icon: '🌊', color1: '#ffd700', color2: '#ff8800', width: 58, height: 66, speed: 400, maxHealth: 170, desc: 'طائرة الطوفان الأعظم', unlockStage: 20 },
    ];
    let selectedAircraftIndex = 0;
    let unlockedStages = 0;
    try { unlockedStages = parseInt(localStorage.getItem('ababil_unlockedStages') || '0'); } catch (e) {}
    let playerConfig = allAircraft[0];

    // ==================== ACHIEVEMENTS ====================
    const achievements = [
        { id: 'first_kill', name: 'أول إصابة', desc: 'أسقط أول طائرة معادية', icon: '🎯', check: (s) => s.kills >= 1 },
        { id: 'ten_kills', name: 'قناص', desc: 'أسقط 10 طائرات', icon: '🔫', check: (s) => s.kills >= 10 },
        { id: 'fifty_kills', name: 'طيار بارع', desc: 'أسقط 50 طائرة', icon: '✈️', check: (s) => s.kills >= 50 },
        { id: 'hundred_kills', name: 'أسطورة', desc: 'أسقط 100 طائرة', icon: '👑', check: (s) => s.kills >= 100 },
        { id: 'stage5', name: 'المحارب', desc: 'وصل للمرحلة 5', icon: '⚔️', check: (s) => s.currentStage >= 5 },
        { id: 'stage10', name: 'البطل', desc: 'وصل للمرحلة 10', icon: '🛡️', check: (s) => s.currentStage >= 10 },
        { id: 'combo10', name: 'كومبو مدمر', desc: 'وصل لكومبو ×10', icon: '🔥', check: (s) => s.maxCombo >= 10 },
        { id: 'score10k', name: 'ثري', desc: 'اجمع 10,000 نقطة', icon: '💰', check: (s) => s.score >= 10000 },
    ];
    let unlockedAchievements = {};
    try { unlockedAchievements = JSON.parse(localStorage.getItem('ababil_achievements') || '{}'); } catch (e) {}

    function checkAchievements(state) {
        let newUnlock = false;
        achievements.forEach(a => {
            if (!unlockedAchievements[a.id] && a.check(state)) {
                unlockedAchievements[a.id] = true;
                newUnlock = true;
                showAchievementToast(a);
                audio.play('achievement', 0.5);
            }
        });
        if (newUnlock) {
            try { localStorage.setItem('ababil_achievements', JSON.stringify(unlockedAchievements)); } catch (e) {}
        }
    }

    function showAchievementToast(a) {
        achievementToast.textContent = a.icon + ' ' + a.name + ': ' + a.desc;
        achievementToast.classList.add('show');
        setTimeout(() => achievementToast.classList.remove('show'), 2500);
    }

    // ==================== STAGE DEFS ====================
    const victoryQuotes = [
        'النصر قادم يا غزة', 'إن مع العسر يسراً.. قادمون يا غزة', 'فإن حزب الله هم الغالبون',
        'وما النصر إلا من عند الله.. صبراً غزة', 'كتب الله لأغلبن أنا ورسلي', 'إن ينصركم الله فلا غالب لكم',
        'ولينصرن الله من ينصره', 'اصبروا وصابروا.. النصر آت'
    ];

    function getVictoryQuote(s) { return victoryQuotes[(s - 1) % victoryQuotes.length]; }

    const stages = [
        { id: 1, name: 'غزة الصمود', sub: 'معركة الفجر الأولى', enemies: ['mig29'], squadrons: 5, bg1: '#1a1508', bg2: '#0a0803', starColor: '#ffddbb', diff: 1.0 },
        { id: 2, name: 'طوفان الأقصى', sub: 'عملية السهم الثاقب', enemies: ['mig29', 'su35'], squadrons: 6, bg1: '#080a1a', bg2: '#040510', starColor: '#bbccff', diff: 1.15 },
        { id: 3, name: 'سيف القدس', sub: 'عملية الرعد المدمر', enemies: ['su35', 'j20'], squadrons: 7, bg1: '#0a0820', bg2: '#000012', starColor: '#aaaaff', diff: 1.3 },
        { id: 4, name: 'وعد الآخرة', sub: 'عملية العقاب الحديدي', enemies: ['j20', 'bomber'], squadrons: 8, bg1: '#180505', bg2: '#080000', starColor: '#ffaaaa', diff: 1.5 },
        { id: 5, name: 'نصر الله', sub: 'عملية أبابيل الكبرى', enemies: ['mig29', 'su35', 'j20', 'bomber'], squadrons: 9, bg1: '#050510', bg2: '#000005', starColor: '#ffffff', diff: 1.8 },
    ];

    function getStageDef(num) {
        if (num <= 5) return stages[num - 1];
        return { ...stages[4], id: num, squadrons: 9 + (num - 5), diff: 1.8 + (num - 5) * 0.25, name: 'الموجة ' + num, sub: 'معركة مستمرة', bg1: '#050510', bg2: '#000005', starColor: '#ffffff' };
    }

    const enemyDefs = {
        mig29: { name: 'ميغ-29', color: '#dd3333', sc: '#ff5555', hp: 2, spd: 150, size: 38, pts: 200, shootChance: 0.008, agility: 1.0, bulletType: 'energyOrb', bulletColor: '#ff4444', bulletSpeed: 260, fireSound: 'enemyFire1' },
        su35: { name: 'سو-35', color: '#3366dd', sc: '#5588ff', hp: 3, spd: 190, size: 42, pts: 350, shootChance: 0.012, agility: 1.3, bulletType: 'plasmaDart', bulletColor: '#66aaff', bulletSpeed: 350, fireSound: 'enemyFire2' },
        j20: { name: 'جيه-20', color: '#555566', sc: '#888899', hp: 4, spd: 210, size: 46, pts: 500, shootChance: 0.016, agility: 1.5, bulletType: 'trackingPulse', bulletColor: '#cccccc', bulletSpeed: 220, fireSound: 'enemyFire3' },
        bomber: { name: 'قاذفة', color: '#884400', sc: '#cc6600', hp: 7, spd: 70, size: 56, pts: 800, shootChance: 0.005, agility: 0.4, bulletType: 'energyOrb', bulletColor: '#ff8844', bulletSpeed: 200, fireSound: 'enemyFire1' },
    };
    const formationTypes = ['vshape', 'diagonal', 'row', 'grid'];

    // ==================== POOLS ====================
    const bulletPool = new ObjectPool(
        () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 1, trail: [], life: 0, tier: 1, active: false }),
        (b) => { b.active = false; b.trail.length = 0; b.life = 0; }, 80);
    const particlePool = new ObjectPool(
        () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, color: '#fff', size: 1, gravity: 0, active: false }),
        (p) => { p.active = false; p.life = 0; }, 300);
    const explosionPool = new ObjectPool(
        () => ({ x: 0, y: 0, radius: 0, maxR: 1, life: 0, color: '#fff', rings: [], active: false }),
        (e) => { e.active = false; e.rings.length = 0; e.life = 0; }, 20);
    const enemyBulletPool = new ObjectPool(
        () => ({ x: 0, y: 0, vx: 0, vy: 0, color: '#fff', life: 0, type: 'energyOrb', size: 3, active: false }),
        (eb) => { eb.active = false; eb.life = 0; }, 60);

    let activeBullets = [];
    let activeParticles = [];
    let activeExplosions = [];
    let activeEnemyBullets = [];
    let missiles = [],
        enemies = [],
        powerUps = [],
        floatingTexts = [],
        starfield = [];

    // Pool acquire overrides
    const origBulletAcquire = bulletPool.acquire.bind(bulletPool);
    bulletPool.acquire = function() { const b = origBulletAcquire(); activeBullets.push(b); return b; };
    const origParticleAcquire = particlePool.acquire.bind(particlePool);
    particlePool.acquire = function() { const p = origParticleAcquire(); activeParticles.push(p); return p; };
    const origExplosionAcquire = explosionPool.acquire.bind(explosionPool);
    explosionPool.acquire = function() { const e = origExplosionAcquire(); activeExplosions.push(e); return e; };
    const origEnemyBulletAcquire = enemyBulletPool.acquire.bind(enemyBulletPool);
    enemyBulletPool.acquire = function() { const eb = origEnemyBulletAcquire(); activeEnemyBullets.push(eb); return eb; };

    // ==================== GAME STATE ====================
    let gameState = 'menu';
    let score = 0,
        kills = 0,
        currentStage = 1,
        missileCount = 3,
        weaponTier = 1,
        squadronsCleared = 0,
        squadronsRequired = 5,
        maxCombo = 0;
    let currentSquadron = null,
        stageActive = false,
        stageDelay = 0,
        comboCount = 0,
        comboTimer = 0,
        screenShake = 0;
    let cinematicState = null,
        cinematicTimer = 0,
        cinematicDuration = 0,
        cinematicTargetY = 0,
        cinematicStartY = 0,
        userControlEnabled = true;
    let megaExplosion = null;

    const player = { x: 0, y: 0, width: 44, height: 52, health: 100, maxHealth: 100, speed: 280, invincible: 0, roll: -Math.PI / 2, targetRoll: -Math.PI / 2, afterburner: 0, fireTimer: 0, fireInterval: 0.12, missileTimer: 0, vx: 0, vy: 0, banking: 0 };

    // ==================== MULTIPLAYER STATE ====================
    let mpMode = false;
    let mpRole = null; // 'host' | 'client'
    let mpConnected = false;
    let mpConnection = null;
    let mpDataBuffer = '';
    let mpPlayer2 = null; // { x, y, roll, banking, health, score, firing, missile }

    // ==================== SPAWNERS ====================
    function spawnSquadron() {
        const sd = getStageDef(currentStage);
        const et = sd.enemies[Math.floor(Math.random() * sd.enemies.length)];
        const fm = formationTypes[Math.floor(Math.random() * formationTypes.length)];
        const cnt = 3 + Math.floor(Math.random() * Math.min(4, 2 + currentStage));
        const sp = 50 + Math.random() * 20;
        const sx = gameWidth * 0.2 + Math.random() * gameWidth * 0.4;
        const sy = -60 - Math.random() * 40;
        const def = enemyDefs[et];
        currentSquadron = { type: et, count: cnt, alive: cnt };
        for (let i = 0; i < cnt; i++) {
            let ox = 0,
                oy = 0;
            switch (fm) {
                case 'vshape':
                    ox = (i - Math.floor(cnt / 2)) * sp;
                    oy = Math.abs(i - Math.floor(cnt / 2)) * sp * 0.7;
                    break;
                case 'diagonal':
                    ox = i * sp * 0.8;
                    oy = i * sp * 0.6;
                    break;
                case 'row':
                    ox = (i - Math.floor(cnt / 2)) * sp;
                    oy = 0;
                    break;
                case 'grid':
                    ox = (i % 2 - 0.5) * sp;
                    oy = Math.floor(i / 2) * sp * 0.7;
                    break;
            }
            enemies.push({
                x: sx + ox, y: sy + oy, w: def.size, h: def.size * 1.1,
                hp: Math.ceil(def.hp * sd.diff), maxHp: Math.ceil(def.hp * sd.diff),
                spd: def.spd * sd.diff, color: def.color, sc: def.sc, pts: def.pts, type: et,
                shootChance: def.shootChance, agility: def.agility, bulletType: def.bulletType,
                bulletColor: def.bulletColor, bulletSpeed: def.bulletSpeed, fireSound: def.fireSound,
                shootCD: 30 + Math.random() * 60, angle: Math.PI / 2, targetAngle: Math.PI / 2,
                flash: 0, alive: true, evadeTimer: 0, evadeDir: 0, squadronMember: true, groupAttackTimer: 0,
            });
        }
    }

    function spawnPowerUp(x, y) {
        if (Math.random() < 0.45) powerUps.push({ x, y, type: 'weapon', vy: 45, life: 280, size: 14, glow: 0, icon: '🔫', color: '#ffd700' });
        else if (Math.random() < 0.25) powerUps.push({ x, y, type: 'health', vy: 45, life: 280, size: 14, glow: 0, icon: '❤️', color: '#ff4444' });
        else if (Math.random() < 0.3) powerUps.push({ x, y, type: 'missile', vy: 45, life: 280, size: 14, glow: 0, icon: '🚀', color: '#ff8800' });
    }

    function acquireBullet() { const b = bulletPool.acquire(); b.active = true; b.trail = []; b.life = 0.9; return b; }

    function acquireParticle() { const p = particlePool.acquire(); p.active = true; p.life = 1; return p; }

    function acquireExplosion() { const e = explosionPool.acquire(); e.active = true; e.rings = []; e.life = 1; return e; }

    function acquireEnemyBullet() { const eb = enemyBulletPool.acquire(); eb.active = true; eb.life = 2.5; return eb; }

    function createExplosion(x, y, sz, color) {
        const exp = acquireExplosion();
        exp.x = x;
        exp.y = y;
        exp.radius = sz * 0.2;
        exp.maxR = sz;
        exp.color = color;
        for (let i = 0; i < 4; i++) exp.rings.push({ r: 0, maxR: sz * (0.4 + i * 0.3), alpha: 0.8 - i * 0.15, delay: i * 0.04 });
        addScreenShake(sz * 0.6);
        createParticles(x, y, color, Math.floor(sz * 0.6));
        createParticles(x, y, '#ffaa00', Math.floor(sz * 0.25));
        audio.play('explosion', Math.min(1, sz / 45));
    }

    function createMegaExplosion() {
        megaExplosion = { radius: 0, maxRadius: Math.max(gameWidth, gameHeight) * 0.7, life: 1.5, shockwaves: [], centerX: gameWidth / 2, centerY: gameHeight / 2 };
        for (let i = 0; i < 8; i++) megaExplosion.shockwaves.push({ r: 0, maxR: megaExplosion.maxRadius * (0.3 + i * 0.1), alpha: 0.95 - i * 0.1, delay: i * 0.06 });
        for (let i = 0; i < 250; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 600 + 250;
            const p = acquireParticle();
            p.x = gameWidth / 2;
            p.y = gameHeight / 2;
            p.vx = Math.cos(a) * s;
            p.vy = Math.sin(a) * s;
            p.decay = Math.random() * 0.6 + 0.3;
            p.color = ['#ffdd00', '#ff8800', '#ff4400', '#ffffff'][Math.floor(Math.random() * 4)];
            p.size = Math.random() * 6 + 2;
            p.gravity = 5;
        }
        addScreenShake(30);
        audio.play('megaExplosion', 1);
    }

    function createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 250 + 100;
            const p = acquireParticle();
            p.x = x;
            p.y = y;
            p.vx = Math.cos(a) * s;
            p.vy = Math.sin(a) * s;
            p.decay = Math.random() * 1.5 + 1;
            p.color = color;
            p.size = Math.random() * 3 + 1;
            p.gravity = 15;
        }
    }

    function addScreenShake(a) { screenShake = Math.max(screenShake, Math.min(a, 32)); }

    function addFloatingText(x, y, text, color) { floatingTexts.push({ x, y, text, color, life: 1, vy: -70 }); }

    function updateWeaponUI() { [wDot1, wDot2, wDot3, wDot4].forEach(d => d.classList.remove('active')); for (let i = 1; i <= weaponTier; i++) { const dot = document.getElementById('wDot' + i); if (dot) dot.classList.add('active'); } }

    function updateSquadronUI() { squadronCounter.textContent = squadronsCleared + '/' + squadronsRequired; }

    function applyPlayerConfig(cfg) {
        playerConfig = cfg;
        player.width = cfg.width;
        player.height = cfg.height;
        player.speed = cfg.speed;
        player.maxHealth = cfg.maxHealth;
        player.health = cfg.maxHealth;
    }

    function buildAircraftGrid() {
        const grid = document.getElementById('aircraftGrid');
        grid.innerHTML = '';
        const best = unlockedStages;
        allAircraft.forEach((ac, i) => {
            const card = document.createElement('div');
            card.className = 'aircraft-card';
            const locked = ac.unlockStage > best;
            if (locked) card.classList.add('locked');
            if (i === selectedAircraftIndex && !locked) card.classList.add('selected');
            card.innerHTML =
                `<div class="aircraft-icon">${ac.icon}</div><div class="aircraft-name">${ac.name}</div><div class="aircraft-stats">❤️${ac.maxHealth} ⚡${ac.speed}</div>${locked ? `<div class="aircraft-lock">🔒</div><div class="aircraft-unlock-text">يفتح بعد ${ac.unlockStage} مرحلة</div>` : '<div style="color:#00ff88;font-size:8px;">✅ متاحة</div>'}`;
            if (!locked) card.addEventListener('click', () => { selectedAircraftIndex = i;
                playerConfig = allAircraft[i];
                buildAircraftGrid(); });
            grid.appendChild(card);
        });
    }

    // ==================== COMBAT ====================
    function fireBullets() {
        if (!userControlEnabled || cinematicState) return;
        const angle = player.roll - Math.PI / 2;
        const md = player.height / 2 + 8;
        const mx = player.x + Math.cos(angle) * md;
        const my = player.y + Math.sin(angle) * md;
        let patterns = [];
        const spread = 0.08;
        switch (weaponTier) {
            case 1:
                patterns = [{ ox: 0, oy: 0, ang: angle }];
                break;
            case 2:
                patterns = [{ ox: -6, oy: 0, ang: angle - spread }, { ox: 6, oy: 0, ang: angle + spread }];
                break;
            case 3:
                patterns = [{ ox: 0, oy: 0, ang: angle }, { ox: -8, oy: 0, ang: angle - spread * 1.5 }, { ox: 8, oy: 0, ang: angle + spread * 1.5 }];
                break;
            case 4:
                patterns = [{ ox: 0, oy: 0, ang: angle }, { ox: -7, oy: 0, ang: angle - spread }, { ox: 7, oy: 0, ang: angle + spread }, { ox: -3, oy: 0, ang: angle - spread * 0.5 }, { ox: 3, oy: 0, ang: angle + spread * 0.5 }];
                break;
        }
        patterns.forEach(p => {
            const b = acquireBullet();
            b.x = mx + Math.cos(angle + Math.PI / 2) * p.ox;
            b.y = my + Math.sin(angle + Math.PI / 2) * p.oy;
            b.vx = Math.cos(p.ang) * CONFIG.BULLET_SPEED;
            b.vy = Math.sin(p.ang) * CONFIG.BULLET_SPEED;
            b.dmg = 1 + Math.floor(weaponTier / 3);
            b.tier = weaponTier;
        });
        createParticles(mx, my, '#ffdd00', weaponTier * 2);
        player.x -= Math.cos(angle) * (2 + weaponTier);
        player.y -= Math.sin(angle) * (2 + weaponTier);
        audio.play('gunfire', 0.5, weaponTier);
    }

    function fireMissile() {
        if (!userControlEnabled || cinematicState || missileCount <= 0) return;
        missileCount--;
        let best = null;
        let bestScore = -Infinity;
        enemies.forEach(e => { const d = Math.hypot(e.x - player.x, e.y - player.y); const s = e.pts - d * 0.3; if (s > bestScore) { bestScore = s;
                best = e; } });
        const angle = player.roll - Math.PI / 2;
        missiles.push({
            x: player.x + Math.cos(angle) * player.height / 2,
            y: player.y + Math.sin(angle) * player.height / 2,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200,
            target: best,
            spd: CONFIG.MISSILE_SPEED,
            turnRate: CONFIG.MISSILE_TURN_RATE,
            life: 3.5,
            trail: [],
            color: '#ff8800',
            wobble: 0,
        });
        createParticles(player.x, player.y, '#ff6600', 14);
        missileCountDisplay.textContent = '🚀 ' + missileCount;
        addScreenShake(5);
        audio.play('missile', 0.55);
    }

    function killEnemy(idx) {
        const e = enemies[idx];
        if (!e.alive) return;
        e.alive = false;
        score += e.pts;
        kills++;
        comboCount++;
        if (comboCount > maxCombo) maxCombo = comboCount;
        comboTimer = 2.5;
        createExplosion(e.x, e.y, e.w * 0.6, e.color);
        addFloatingText(e.x, e.y - 8, '+' + e.pts, '#ffd700');
        if (comboCount >= 5 && comboCount % 5 === 0) {
            audio.play('combo', 0.45);
            score += 250 * Math.floor(comboCount / 5);
            addFloatingText(e.x, e.y - 24, 'COMBO x' + comboCount + '!', '#ff8800');
        }
        if (e.squadronMember && currentSquadron) {
            currentSquadron.alive--;
            if (currentSquadron.alive <= 0) {
                squadronsCleared++;
                updateSquadronUI();
                currentSquadron = null;
            }
        }
        spawnPowerUp(e.x, e.y);
        enemies.splice(idx, 1);
        checkAchievements({ kills, score, currentStage, maxCombo });
    }

    function startStage(num) {
        currentStage = num;
        const def = getStageDef(num);
        stageActive = true;
        stageDelay = 1.2;
        squadronsCleared = 0;
        squadronsRequired = def.squadrons;
        currentSquadron = null;
        enemies = [];
        activeEnemyBullets.forEach(eb => enemyBulletPool.release(eb));
        activeEnemyBullets = [];
        activeBullets.forEach(b => bulletPool.release(b));
        activeBullets = [];
        missiles = [];
        powerUps = [];
        megaExplosion = null;
        updateSquadronUI();
        sideStageName.textContent = '📡 ' + def.name;
        sideStageSub.textContent = def.sub;
        sideNotification.classList.add('show');
        setTimeout(() => sideNotification.classList.remove('show'), 2500);
        stageDisplay.textContent = num;
        generateStarfield(def.starColor);
        player.x = gameWidth / 2;
        player.y = gameHeight + 80;
        player.roll = -Math.PI / 2;
        player.targetRoll = -Math.PI / 2;
        player.afterburner = 1;
        userControlEnabled = false;
        cinematicState = 'entering';
        cinematicStartY = player.y;
        cinematicTargetY = gameHeight * 0.7;
        cinematicDuration = 1.2;
        cinematicTimer = 0;
        audio.play('stageClear', 0.4);
        checkAchievements({ kills, score, currentStage, maxCombo });
    }

    function completeStage() {
        stageActive = false;
        const def = getStageDef(currentStage);
        const bonus = def.squadrons * 120 + currentStage * 200;
        score += bonus;
        missileCount = Math.min(6, missileCount + 2);
        missileCountDisplay.textContent = '🚀 ' + missileCount;
        player.health = Math.min(player.maxHealth, player.health + 35);
        unlockedStages = Math.max(unlockedStages, currentStage);
        try { localStorage.setItem('ababil_unlockedStages', unlockedStages); } catch (e) {}
        createMegaExplosion();
        const quote = getVictoryQuote(currentStage);
        quoteText.textContent = quote;
        victoryQuote.classList.add('show');
        setTimeout(() => victoryQuote.classList.remove('show'), 3000);
        audio.play('stageClear', 0.6);
        setTimeout(() => {
            if (gameState === 'playing') {
                userControlEnabled = false;
                cinematicState = 'exiting';
                cinematicStartY = player.y;
                cinematicTargetY = -120;
                cinematicDuration = 1.0;
                cinematicTimer = 0;
                player.afterburner = 1;
                player.targetRoll = -Math.PI / 2;
            }
        }, 2000);
        checkAchievements({ kills, score, currentStage, maxCombo });
    }

    function resetGame() {
        isPaused = false;
        document.getElementById('pauseOverlay').classList.remove('visible');
        applyPlayerConfig(playerConfig);
        player.x = gameWidth / 2;
        player.y = gameHeight + 80;
        player.health = player.maxHealth;
        player.invincible = 0;
        player.roll = -Math.PI / 2;
        player.targetRoll = -Math.PI / 2;
        player.fireTimer = 0;
        player.missileTimer = 0;
        player.afterburner = 1;
        player.banking = 0;
        player.vx = 0;
        player.vy = 0;
        score = 0;
        kills = 0;
        missileCount = 3;
        weaponTier = 1;
        comboCount = 0;
        maxCombo = 0;
        comboTimer = 0;
        screenShake = 0;
        megaExplosion = null;
        bulletPool.releaseAll();
        activeBullets = [];
        particlePool.releaseAll();
        activeParticles = [];
        explosionPool.releaseAll();
        activeExplosions = [];
        enemyBulletPool.releaseAll();
        activeEnemyBullets = [];
        missiles = [];
        enemies = [];
        powerUps = [];
        floatingTexts = [];
        mpMode = false;
        gameState = 'playing';
        cinematicState = 'entering';
        cinematicStartY = player.y;
        cinematicTargetY = gameHeight * 0.7;
        cinematicDuration = 1.2;
        cinematicTimer = 0;
        userControlEnabled = false;
        scoreDisplay.textContent = '0';
        healthFill.style.width = '100%';
        healthFill.className = 'hud-health-fill';
        healthPercent.textContent = '100%';
        missileCountDisplay.textContent = '🚀 3';
        updateWeaponUI();
        comboDisplay.classList.remove('active');
        damageVignette.classList.remove('active');
        gameOverScreen.classList.remove('visible');
        victoryQuote.classList.remove('show');
        sideNotification.classList.remove('show');
        $('mainMenu').classList.remove('visible');
        $('aircraftScreen').classList.remove('visible');
        $('creditsScreen').classList.remove('visible');
        $('multiplayerPanel').classList.remove('visible');
        $('gameHUD').classList.add('visible');
        generateStarfield('#ffddbb');
        startStage(1);
    }

    function gameOver() {
        gameState = 'gameOver';
        userControlEnabled = false;
        cinematicState = null;
        finalScoreEl.textContent = score;
        finalKillsEl.textContent = kills;
        finalStageEl.textContent = currentStage;
        gameOverScreen.classList.add('visible');
        createExplosion(player.x, player.y, 50, '#ff4400');
        addScreenShake(22);
        audio.play('playerHit', 0.9);
        setTimeout(() => audio.play('explosion', 1), 150);
        checkAchievements({ kills, score, currentStage, maxCombo });
    }

    function backToMenu() {
        isPaused = false;
        document.getElementById('pauseOverlay').classList.remove('visible');
        gameState = 'menu';
        userControlEnabled = false;
        cinematicState = null;
        $('gameOverScreen').classList.remove('visible');
        $('gameHUD').classList.remove('visible');
        $('mainMenu').classList.add('visible');
        bulletPool.releaseAll();
        particlePool.releaseAll();
        explosionPool.releaseAll();
        enemyBulletPool.releaseAll();
        activeBullets = [];
        activeParticles = [];
        activeExplosions = [];
        activeEnemyBullets = [];
        missiles = [];
        enemies = [];
        powerUps = [];
        floatingTexts = [];
        if (mpConnected) disconnectBluetooth();
    }

    function generateStarfield(color) {
        starfield = [];
        for (let i = 0; i < CONFIG.STAR_COUNT; i++)
            starfield.push({ x: Math.random() * gameWidth, y: Math.random() * gameHeight, size: Math.random() * 1.8 + 0.2, b: Math.random(), spd: Math.random() * 25 + 4, tw: Math.random() * Math.PI * 2, color });
    }

    // ==================== MULTIPLAYER BLUETOOTH ====================
    function initBluetoothSerial() {
        if (!window.bluetoothSerial) {
            mpStatus.textContent = '❌ Bluetooth غير متوفر';
            return false;
        }
        return true;
    }

    function showMpStatus(msg, isError) {
        mpStatus.textContent = msg;
        mpStatus.style.color = isError ? '#ff4444' : '#00ff88';
    }

    function hostGame() {
        if (!initBluetoothSerial()) return;
        if (mpConnected) { disconnectBluetooth(); return; }
        showMpStatus('🔄 فتح الخادم البلوتوث...');
        btnHost.disabled = true;
        // Cordova bluetoothSerial accepts connections via listen
        window.bluetoothSerial.listen(function() {
            showMpStatus('✅ متصل! بدء المباراة...');
            mpConnected = true;
            mpRole = 'host';
            mpMode = true;
            startMultiplayerGame();
        }, function(err) {
            showMpStatus('❌ خطأ: ' + err, true);
            btnHost.disabled = false;
        });
    }

    function scanDevices() {
        if (!initBluetoothSerial()) return;
        showMpStatus('🔄 فحص الأجهزة...');
        deviceList.innerHTML = '';
        btnScan.disabled = true;
        window.bluetoothSerial.list(function(devices) {
            btnScan.disabled = false;
            if (devices.length === 0) {
                showMpStatus('❌ لا توجد أجهزة قريبة', true);
                return;
            }
            showMpStatus('اختر جهازاً للاتصال:');
            deviceList.innerHTML = '';
            devices.forEach(function(d) {
                const btn = document.createElement('button');
                btn.className = 'device-btn';
                btn.textContent = d.name || d.address;
                btn.addEventListener('click', function() { connectToDevice(d.address); });
                deviceList.appendChild(btn);
            });
        }, function(err) {
            btnScan.disabled = false;
            showMpStatus('❌ فشل الفحص: ' + err, true);
        });
    }

    function connectToDevice(address) {
        showMpStatus('🔄 جاري الاتصال بـ ' + address + '...');
        window.bluetoothSerial.connect(address, function() {
            showMpStatus('✅ متصل! بدء المباراة...');
            mpConnected = true;
            mpRole = 'client';
            mpMode = true;
            deviceList.innerHTML = '';
            startMultiplayerGame();
        }, function(err) {
            showMpStatus('❌ فشل الاتصال: ' + err, true);
        });
    }

    function disconnectBluetooth() {
        if (window.bluetoothSerial) {
            try { window.bluetoothSerial.disconnect(function() {}, function() {}); } catch (e) {}
        }
        mpConnected = false;
        mpRole = null;
        mpMode = false;
        mpPlayer2 = null;
        btnHost.disabled = false;
        btnScan.disabled = false;
        showMpStatus('🔴 غير متصل');
    }

    function sendBTData(data) {
        if (!mpConnected || !window.bluetoothSerial) return;
        try { window.bluetoothSerial.write(data + '\n'); } catch (e) { disconnectBluetooth(); }
    }

    function processBTData(line) {
        if (!line || line.length < 3) return;
        const parts = line.split(':');
        if (parts.length < 2) return;
        const prefix = parts[0];
        const vals = parts[1].split(',');
        if (prefix === 'p2' && vals.length >= 7) {
            if (!mpPlayer2) mpPlayer2 = {};
            mpPlayer2.x = parseFloat(vals[0]) || gameWidth / 2;
            mpPlayer2.y = parseFloat(vals[1]) || gameHeight / 2;
            mpPlayer2.roll = parseFloat(vals[2]) || -Math.PI / 2;
            mpPlayer2.banking = parseFloat(vals[3]) || 0;
            mpPlayer2.firing = vals[4] === '1';
            mpPlayer2.missile = vals[5] === '1';
            mpPlayer2.health = parseFloat(vals[6]) || 100;
            mpPlayer2.score = parseInt(vals[7]) || 0;
            mpPlayer2.afterburner = parseFloat(vals[8]) || 0;
        } else if (prefix === 'b' && vals.length >= 4) {
            // Incoming bullet from opponent - create enemy bullet
            const eb = acquireEnemyBullet();
            eb.x = parseFloat(vals[0]);
            eb.y = parseFloat(vals[1]);
            eb.vx = parseFloat(vals[2]);
            eb.vy = parseFloat(vals[3]);
            eb.color = '#ff4444';
            eb.type = 'energyOrb';
            eb.size = 3;
            eb.life = 1.5;
        } else if (prefix === 'dmg' && vals.length >= 1) {
            // Opponent confirms hit on us - reduce local player's health
            player.health = Math.max(0, player.health - (parseFloat(vals[0]) || 10));
            addScreenShake(6);
            createParticles(player.x, player.y, '#ff4444', 6);
            audio.play('playerHit', 0.45);
            if (player.health <= 0) {
                player.health = 0;
                gameOver();
            }
        }
    }

    function startMultiplayerGame() {
        $('multiplayerPanel').classList.remove('visible');
        $('mainMenu').classList.remove('visible');
        $('gameHUD').classList.add('visible');
        $('mpHUD').classList.add('visible');
        gameState = 'mpBattle';
        userControlEnabled = true;

        // Position players
        player.x = gameWidth * 0.25;
        player.y = gameHeight / 2;
        player.health = player.maxHealth;
        player.roll = -Math.PI / 2;
        player.targetRoll = -Math.PI / 2;

        mpPlayer2 = {
            x: gameWidth * 0.75,
            y: gameHeight / 2,
            roll: -Math.PI / 2,
            banking: 0,
            health: playerConfig.maxHealth,
            score: 0,
            firing: false,
            missile: false,
            afterburner: 0
        };

        mpScore1.textContent = '0';
        mpScore2.textContent = '0';
        mpName1.textContent = '🎮 أنت';
        mpName2.textContent = '🎮 الخصم';
        updateMPHealthBars();

        // Start BT read loop
        if (mpConnected && window.bluetoothSerial) {
            window.bluetoothSerial.subscribe('\n', function(data) {
                mpDataBuffer += data;
                const lines = mpDataBuffer.split('\n');
                mpDataBuffer = lines.pop();
                lines.forEach(function(l) { processBTData(l.trim()); });
            }, function(err) {
                showMpStatus('❌ فقد الاتصال: ' + err, true);
                disconnectBluetooth();
            });
        }

        generateStarfield('#ffffff');
        audio.play('countdown', 0.3);
    }

    function sendPlayerState() {
        if (!mpConnected || mpRole !== 'client' && mpRole !== 'host') return;
        const data = 'p1:' + [
            Math.round(player.x),
            Math.round(player.y),
            player.roll.toFixed(3),
            player.banking.toFixed(2),
            firePressed || keys[' '] || keys['Space'] ? '1' : '0',
            missilePressed ? '1' : '0',
            Math.round(player.health),
            score,
            player.afterburner.toFixed(2)
        ].join(',');
        sendBTData(data);
    }

    function updateMPHealthBars() {
        if (!mpMode) return;
        const h1 = player.health / player.maxHealth * 100;
        const h2 = mpPlayer2 ? (mpPlayer2.health / playerConfig.maxHealth * 100) : 100;
        mpHealth1.style.width = Math.max(0, h1) + '%';
        mpHealth2.style.width = Math.max(0, h2) + '%';
    }

    // ==================== PAUSE ====================
    let isPaused = false;

    function togglePause() {
        if (gameState === 'playing' || gameState === 'mpBattle') {
            isPaused = !isPaused;
            document.getElementById('pauseOverlay').classList.toggle('visible', isPaused);
        }
    }

    // ==================== UPDATE ====================
    function update(dt) {
        if (isPaused) return;

        // Cinematic
        if (cinematicState) {
            cinematicTimer += dt;
            const progress = Math.min(1, cinematicTimer / cinematicDuration);
            const eased = 1 - Math.pow(1 - progress, 3);
            if (cinematicState === 'entering') {
                player.y = cinematicStartY + (cinematicTargetY - cinematicStartY) * eased;
                player.afterburner = 1;
                player.roll += (-Math.PI / 2 - player.roll) * 8 * dt;
                if (progress >= 1) {
                    player.y = cinematicTargetY;
                    cinematicState = null;
                    userControlEnabled = true;
                    player.afterburner = 0;
                }
            } else if (cinematicState === 'exiting') {
                player.y = cinematicStartY + (cinematicTargetY - cinematicStartY) * eased;
                player.afterburner = 1;
                player.roll += (-Math.PI / 2 - player.roll) * 8 * dt;
                if (progress >= 1) { cinematicState = null;
                    startStage(currentStage + 1); }
            }
        }

        // Mega explosion
        if (megaExplosion) {
            megaExplosion.life -= dt;
            megaExplosion.radius += (megaExplosion.maxRadius - megaExplosion.radius) * 12 * dt;
            megaExplosion.shockwaves.forEach(sw => {
                sw.delay -= dt;
                if (sw.delay <= 0) sw.r += (sw.maxR - sw.r) * 10 * dt;
                sw.alpha -= 0.3 * dt;
            });
            if (megaExplosion.life <= 0) megaExplosion = null;
        }

        // Particles & Explosions always update
        updateParticles(dt);
        updateExplosions(dt);

        if (gameState === 'menu' || gameState === 'gameOver') {
            if (screenShake > 0) screenShake *= Math.pow(0.0001, dt);
            if (screenShake < 0.04) screenShake = 0;
            return;
        }

        if (screenShake > 0) screenShake *= Math.pow(0.0001, dt);
        if (screenShake < 0.04) screenShake = 0;

        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) { comboCount = 0;
                comboDisplay.classList.remove('active'); }
        }

        if (gameState === 'mpBattle') {
            updateMP(dt);
            return;
        }

        // ====== SINGLE PLAYER ======
        if (userControlEnabled && !cinematicState) {
            let mx = 0,
                my = 0;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
            if (joystickActive) { mx += joystickDX;
                my += joystickDY; }
            const mag = Math.sqrt(mx * mx + my * my);
            if (mag > 1) { mx /= mag;
                my /= mag; }
            const targetVx = mx * player.speed;
            const targetVy = my * player.speed;
            player.vx += (targetVx - player.vx) * 8 * dt;
            player.vy += (targetVy - player.vy) * 8 * dt;
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            player.x = Math.max(player.width / 2, Math.min(gameWidth - player.width / 2, player.x));
            player.y = Math.max(player.height / 2, Math.min(gameHeight - player.height / 2, player.y));
            if (mag > 0.1) player.targetRoll = Math.atan2(my, mx) + Math.PI / 2;
            let rd = player.targetRoll - player.roll;
            while (rd > Math.PI) rd -= Math.PI * 2;
            while (rd < -Math.PI) rd += Math.PI * 2;
            player.roll += rd * Math.min(1, 12 * dt);
            player.banking += (mx * 0.3 - player.banking) * 6 * dt;
            player.afterburner = mag > 0.7 ? Math.min(1, player.afterburner + 4 * dt) : Math.max(0, player.afterburner - 5 * dt);
        }
        if (player.invincible > 0) player.invincible -= dt;
        player.fireTimer -= dt;
        player.missileTimer -= dt;

        if (userControlEnabled && (firePressed || keys[' '] || keys['Space'])) {
            if (player.fireTimer <= 0) { fireBullets();
                player.fireTimer = player.fireInterval; }
        }

        // Squadron spawning
        if (stageActive && squadronsCleared < squadronsRequired && userControlEnabled && !cinematicState) {
            if (stageDelay > 0) { stageDelay -= dt; } else if (!currentSquadron && enemies.length === 0) {
                stageDelay = Math.max(0.35, 1.1 - currentStage * 0.07);
                spawnSquadron();
            }
        }
        if (stageActive && squadronsCleared >= squadronsRequired && enemies.length === 0 && userControlEnabled && !cinematicState && !currentSquadron) {
            completeStage();
        }

        // Bullets
        for (let i = activeBullets.length - 1; i >= 0; i--) {
            const b = activeBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.trail.push({ x: b.x, y: b.y, life: 1 });
            if (b.trail.length > 4) b.trail.shift();
            b.trail.forEach(t => t.life -= 3 * dt);
            b.life -= dt;
            if (b.life <= 0 || b.x < -30 || b.x > gameWidth + 30 || b.y < -30 || b.y > gameHeight + 30) {
                bulletPool.release(b);
                activeBullets.splice(i, 1);
                continue;
            }
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (Math.hypot(b.x - enemies[j].x, b.y - enemies[j].y) < enemies[j].w / 2 + 4) {
                    enemies[j].hp -= b.dmg;
                    enemies[j].flash = 0.1;
                    createParticles(b.x, b.y, '#ffffff', 2);
                    audio.play('hit', 0.25);
                    if (enemies[j].hp <= 0) killEnemy(j);
                    else if (Math.random() < 0.2) { enemies[j].evadeTimer = 0.3;
                        enemies[j].evadeDir = Math.random() > 0.5 ? 1 : -1; }
                    hit = true;
                    break;
                }
            }
            if (hit) { bulletPool.release(b);
                activeBullets.splice(i, 1); }
        }

        // Missiles
        for (let i = missiles.length - 1; i >= 0; i--) {
            const m = missiles[i];
            if (m.target && m.target.alive) {
                const dx = m.target.x - m.x;
                const dy = m.target.y - m.y;
                const ta = Math.atan2(dy, dx);
                let ad = ta - Math.atan2(m.vy, m.vx);
                while (ad > Math.PI) ad -= Math.PI * 2;
                while (ad < -Math.PI) ad += Math.PI * 2;
                m.turnRate = 4.5 + Math.sin(m.wobble) * 1.5;
                m.wobble += dt * 8;
                const turn = Math.sign(ad) * Math.min(Math.abs(ad), m.turnRate * dt);
                const ca = Math.atan2(m.vy, m.vx) + turn;
                m.vx = Math.cos(ca) * m.spd;
                m.vy = Math.sin(ca) * m.spd;
            }
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.trail.push({ x: m.x, y: m.y, life: 1 });
            if (m.trail.length > 7) m.trail.shift();
            m.trail.forEach(t => t.life -= 2 * dt);
            m.life -= dt;
            if (m.life <= 0) { createExplosion(m.x, m.y, 16, '#ff6600');
                missiles.splice(i, 1); continue; }
            if (m.x < -50 || m.x > gameWidth + 50 || m.y < -50 || m.y > gameHeight + 50) { missiles.splice(i, 1); continue; }
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (Math.hypot(m.x - enemies[j].x, m.y - enemies[j].y) < enemies[j].w / 2 + 8) {
                    createExplosion(enemies[j].x, enemies[j].y, enemies[j].w * 0.8, enemies[j].color);
                    enemies[j].hp -= 5;
                    enemies[j].flash = 0.15;
                    if (enemies[j].hp <= 0) killEnemy(j);
                    hit = true;
                    break;
                }
            }
            if (hit) missiles.splice(i, 1);
        }

        // Enemy bullets
        for (let i = activeEnemyBullets.length - 1; i >= 0; i--) {
            const eb = activeEnemyBullets[i];
            eb.x += eb.vx * dt;
            eb.y += eb.vy * dt;
            eb.life -= dt;
            if (eb.life <= 0 || eb.x < -30 || eb.x > gameWidth + 30 || eb.y < -30 || eb.y > gameHeight + 30) {
                enemyBulletPool.release(eb);
                activeEnemyBullets.splice(i, 1);
                continue;
            }
            if (player.invincible <= 0 && Math.hypot(eb.x - player.x, eb.y - player.y) < player.width / 2 + 3) {
                player.health -= 10;
                player.invincible = 1.2;
                addScreenShake(8);
                createParticles(player.x, player.y, '#ff4444', 10);
                audio.play('playerHit', 0.55);
                enemyBulletPool.release(eb);
                activeEnemyBullets.splice(i, 1);
                if (player.health <= 0) { player.health = 0;
                    gameOver(); return; }
            }
        }

        // Enemies AI
        const aliveEnemies = enemies.filter(e => e.alive);
        aliveEnemies.forEach(e => {
            const dx = player.x - e.x;
            const dy = player.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            e.targetAngle = Math.atan2(dy, dx);
            let ad = e.targetAngle - e.angle;
            while (ad > Math.PI) ad -= Math.PI * 2;
            while (ad < -Math.PI) ad += Math.PI * 2;
            e.angle += ad * e.agility * 3.5 * dt;
            if (e.evadeTimer > 0) {
                e.evadeTimer -= dt;
                const ea = e.angle + e.evadeDir * Math.PI / 2;
                e.x += Math.cos(ea) * e.spd * 1.4 * dt;
                e.y += Math.sin(ea) * e.spd * 1.4 * dt;
            } else {
                e.x += Math.cos(e.angle) * e.spd * dt;
                e.y += Math.sin(e.angle) * e.spd * dt;
                if (Math.random() < 0.4 * dt && dist < 300) {
                    e.evadeTimer = 0.35 + Math.random() * 0.5;
                    e.evadeDir = Math.random() > 0.5 ? 1 : -1;
                }
            }
            if (e.flash > 0) e.flash -= dt;
            e.shootCD -= dt;
            const nearbyAllies = aliveEnemies.filter(o => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 120).length;
            const fireRateBonus = 1 + nearbyAllies * 0.3;
            if (e.shootCD <= 0 && Math.random() < e.shootChance * fireRateBonus * dt * 60 && dist < 500) {
                const ba = e.angle + (Math.random() - 0.5) * 0.25;
                const eb = acquireEnemyBullet();
                eb.x = e.x + Math.cos(ba) * e.w / 2;
                eb.y = e.y + Math.sin(ba) * e.w / 2;
                eb.vx = Math.cos(ba) * e.bulletSpeed;
                eb.vy = Math.sin(ba) * e.bulletSpeed;
                eb.color = e.bulletColor;
                eb.type = e.bulletType;
                eb.size = e.bulletType === 'plasmaDart' ? 2.5 : e.bulletType === 'trackingPulse' ? 4 : 3;
                activeEnemyBullets.push(eb);
                e.shootCD = (0.4 + Math.random() * 0.6) / fireRateBonus;
                if (e.fireSound) audio.play(e.fireSound, 0.3);
            }
            if (player.invincible <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < e.w / 2 + player.width / 2) {
                player.health -= 25;
                player.invincible = 1.8;
                addScreenShake(16);
                createParticles(player.x, player.y, '#ff0000', 20);
                createExplosion(e.x, e.y, e.w * 0.5, e.color);
                audio.play('playerHit', 0.7);
                killEnemy(enemies.indexOf(e));
                if (player.health <= 0) { player.health = 0;
                    gameOver(); }
            }
        });

        // Power-ups
        powerUps.forEach(p => { p.y += p.vy * dt;
            p.glow += 3 * dt;
            p.life -= dt; });
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            if (Math.hypot(p.x - player.x, p.y - player.y) < player.width / 2 + p.size) {
                if (p.type === 'weapon') {
                    weaponTier = Math.min(4, weaponTier + 1);
                    player.fireInterval = Math.max(0.04, 0.12 - weaponTier * 0.02);
                    addFloatingText(player.x, player.y - 15, '🔫 مستوى ' + weaponTier + '!', '#ffd700');
                    updateWeaponUI();
                    audio.play('powerup', 0.5, weaponTier);
                } else if (p.type === 'health') {
                    player.health = Math.min(player.maxHealth, player.health + 25);
                    addFloatingText(player.x, player.y - 15, '+❤️', '#00ff88');
                    audio.play('powerup', 0.4, 1);
                } else if (p.type === 'missile') {
                    missileCount = Math.min(6, missileCount + 1);
                    missileCountDisplay.textContent = '🚀 ' + missileCount;
                    addFloatingText(player.x, player.y - 15, '+🚀', '#ffaa00');
                    audio.play('powerup', 0.4, 1);
                }
                powerUps.splice(i, 1);
            } else if (p.life <= 0 || p.y > gameHeight + 40) { powerUps.splice(i, 1); }
        }

        floatingTexts.forEach(ft => { ft.y += ft.vy * dt;
            ft.life -= dt; });
        floatingTexts = floatingTexts.filter(ft => ft.life > 0);

        // Combo display
        if (comboCount >= 5 && comboTimer > 0) {
            comboDisplay.textContent = '🔥 COMBO x' + comboCount;
            comboDisplay.classList.add('active');
        } else { comboDisplay.classList.remove('active'); }

        // Damage vignette
        const hpPct = player.health / player.maxHealth;
        if (hpPct < 0.3) damageVignette.classList.add('active');
        else damageVignette.classList.remove('active');

        scoreDisplay.textContent = score;
        healthFill.style.width = (hpPct * 100) + '%';
        healthPercent.textContent = Math.round(hpPct * 100) + '%';
        healthFill.className = 'hud-health-fill';
        if (hpPct < 0.25) healthFill.classList.add('danger');
        else if (hpPct < 0.5) healthFill.classList.add('warning');
    }

    function updateMP(dt) {
        // Player 1 (local) movement
        if (userControlEnabled) {
            let mx = 0,
                my = 0;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) mx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) mx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) my -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) my += 1;
            if (joystickActive) { mx += joystickDX;
                my += joystickDY; }
            const mag = Math.sqrt(mx * mx + my * my);
            if (mag > 1) { mx /= mag;
                my /= mag; }
            const targetVx = mx * player.speed;
            const targetVy = my * player.speed;
            player.vx += (targetVx - player.vx) * 8 * dt;
            player.vy += (targetVy - player.vy) * 8 * dt;
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            player.x = Math.max(player.width / 2, Math.min(gameWidth - player.width / 2, player.x));
            player.y = Math.max(player.height / 2, Math.min(gameHeight - player.height / 2, player.y));
            if (mag > 0.1) player.targetRoll = Math.atan2(my, mx) + Math.PI / 2;
            let rd = player.targetRoll - player.roll;
            while (rd > Math.PI) rd -= Math.PI * 2;
            while (rd < -Math.PI) rd += Math.PI * 2;
            player.roll += rd * Math.min(1, 12 * dt);
            player.banking += (mx * 0.3 - player.banking) * 6 * dt;
            player.afterburner = mag > 0.7 ? Math.min(1, player.afterburner + 4 * dt) : Math.max(0, player.afterburner - 5 * dt);
            player.fireTimer -= dt;
            player.missileTimer -= dt;
        }

        // Firing in MP
        if (userControlEnabled && (firePressed || keys[' '] || keys['Space'])) {
            if (player.fireTimer <= 0) {
                fireMPBullet();
                player.fireTimer = player.fireInterval || 0.12;
            }
        }

        // ====== MP COMBAT ======
        // Player bullets hitting opponent
        if (mpPlayer2) {
            for (let i = activeBullets.length - 1; i >= 0; i--) {
                const b = activeBullets[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.trail.push({ x: b.x, y: b.y, life: 1 });
                if (b.trail.length > 4) b.trail.shift();
                b.trail.forEach(t => t.life -= 3 * dt);
                b.life -= dt;
                if (b.life <= 0 || b.x < -30 || b.x > gameWidth + 30 || b.y < -30 || b.y > gameHeight + 30) {
                    bulletPool.release(b);
                    activeBullets.splice(i, 1);
                    continue;
                }
                if (Math.hypot(b.x - mpPlayer2.x, b.y - mpPlayer2.y) < player.width / 2 + 4) {
                    mpPlayer2.health -= b.dmg;
                    score += 10;
                    createParticles(b.x, b.y, '#ff4444', 4);
                    audio.play('hit', 0.25);
                    sendBTData('dmg:' + b.dmg);
                    bulletPool.release(b);
                    activeBullets.splice(i, 1);
                    if (mpPlayer2.health <= 0) {
                        mpPlayer2.health = 0;
                        score += 500;
                        createExplosion(mpPlayer2.x, mpPlayer2.y, 40, '#ff4444');
                        addFloatingText(mpPlayer2.x, mpPlayer2.y - 20, '+500', '#ffd700');
                    }
                }
            }
        }

        // Enemy bullets (from opponent) hitting local player
        if (player.invincible > 0) player.invincible -= dt;
        for (let i = activeEnemyBullets.length - 1; i >= 0; i--) {
            const eb = activeEnemyBullets[i];
            eb.x += eb.vx * dt;
            eb.y += eb.vy * dt;
            eb.life -= dt;
            if (eb.life <= 0 || eb.x < -30 || eb.x > gameWidth + 30 || eb.y < -30 || eb.y > gameHeight + 30) {
                enemyBulletPool.release(eb);
                activeEnemyBullets.splice(i, 1);
                continue;
            }
            if (player.invincible <= 0 && Math.hypot(eb.x - player.x, eb.y - player.y) < player.width / 2 + 3) {
                player.health -= 10;
                player.invincible = 1.2;
                addScreenShake(8);
                createParticles(player.x, player.y, '#ff4444', 10);
                audio.play('playerHit', 0.55);
                enemyBulletPool.release(eb);
                activeEnemyBullets.splice(i, 1);
                if (player.health <= 0) {
                    player.health = 0;
                    gameOver();
                    return;
                }
            }
        }

        // Send state to opponent
        sendPlayerState();
        updateMPHealthBars();

        // Update scores
        mpScore1.textContent = score;
        mpScore2.textContent = mpPlayer2 ? mpPlayer2.score : 0;
        mpName1.textContent = '🎮 أنت';
        mpName2.textContent = mpRole === 'host' ? '🎮 العميل' : '🎮 المضيف';
    }

    function fireMPBullet() {
        const angle = player.roll - Math.PI / 2;
        const md = player.height / 2 + 8;
        const mx = player.x + Math.cos(angle) * md;
        const my = player.y + Math.sin(angle) * md;
        const b = acquireBullet();
        b.x = mx;
        b.y = my;
        b.vx = Math.cos(angle) * CONFIG.BULLET_SPEED;
        b.vy = Math.sin(angle) * CONFIG.BULLET_SPEED;
        b.dmg = 1;
        b.tier = 1;
        createParticles(mx, my, '#ffdd00', 3);
        audio.play('gunfire', 0.4, 1);

        // Send bullet to opponent
        const bData = 'b:' + [Math.round(b.x), Math.round(b.y), b.vx.toFixed(1), b.vy.toFixed(1)].join(',');
        sendBTData(bData);
    }

    function updateParticles(dt) {
        for (let i = activeParticles.length - 1; i >= 0; i--) {
            const p = activeParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) { particlePool.release(p);
                activeParticles.splice(i, 1); }
        }
    }

    function updateExplosions(dt) {
        for (let i = activeExplosions.length - 1; i >= 0; i--) {
            const exp = activeExplosions[i];
            exp.radius += (exp.maxR - exp.radius) * 10 * dt;
            exp.life -= 1.2 * dt;
            exp.rings.forEach(ring => {
                ring.delay -= dt;
                if (ring.delay <= 0) { ring.r += (ring.maxR - ring.r) * 8 * dt;
                    ring.alpha -= 0.9 * dt; }
            });
            if (exp.life <= 0) { explosionPool.release(exp);
                activeExplosions.splice(i, 1); }
        }
    }

    // ==================== RENDER ====================
    function render() {
        ctx.clearRect(0, 0, gameWidth, gameHeight);
        let sx = 0,
            sy = 0;
        if (screenShake > 0) { sx = (Math.random() - 0.5) * screenShake * 2;
            sy = (Math.random() - 0.5) * screenShake * 2; }
        ctx.save();
        ctx.translate(sx, sy);

        // Background
        const def = getStageDef(currentStage);
        const bg = ctx.createRadialGradient(gameWidth / 2, gameHeight * 0.35, 0, gameWidth / 2, gameHeight / 2, gameWidth);
        bg.addColorStop(0, def.bg1);
        bg.addColorStop(0.6, def.bg2);
        bg.addColorStop(1, '#000003');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, gameWidth, gameHeight);

        // Stars
        starfield.forEach(s => {
            s.y += s.spd * deltaTime;
            s.tw += 1.5 * deltaTime;
            if (s.y > gameHeight) { s.y = -5;
                s.x = Math.random() * gameWidth; }
            const twinkle = Math.sin(s.tw) * 0.3 + 0.7;
            if (s.color.startsWith('#'))
                ctx.fillStyle = s.color + Math.floor(s.b * twinkle * 255).toString(16).padStart(2, '0');
            else
                ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Mega explosion
        if (megaExplosion) {
            const me = megaExplosion;
            ctx.globalAlpha = Math.max(0, me.life / 1.5);
            const meg = ctx.createRadialGradient(me.centerX, me.centerY, 0, me.centerX, me.centerY, me.radius);
            meg.addColorStop(0, '#ffffff');
            meg.addColorStop(0.06, '#ffdd00');
            meg.addColorStop(0.2, '#ff8800');
            meg.addColorStop(0.5, '#ff4400');
            meg.addColorStop(0.8, 'rgba(100,0,0,0.2)');
            meg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = meg;
            ctx.beginPath();
            ctx.arc(me.centerX, me.centerY, me.radius, 0, Math.PI * 2);
            ctx.fill();
            me.shockwaves.forEach(sw => {
                if (sw.delay <= 0 && sw.alpha > 0) {
                    ctx.strokeStyle = 'rgba(255,255,255,' + sw.alpha + ')';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(me.centerX, me.centerY, sw.r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
            ctx.globalAlpha = 1;
        }

        // Explosions
        activeExplosions.forEach(exp => {
            ctx.globalAlpha = Math.max(0, exp.life);
            const eg = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
            eg.addColorStop(0, '#ffffff');
            eg.addColorStop(0.15, exp.color);
            eg.addColorStop(0.5, 'rgba(255,100,0,0.3)');
            eg.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = eg;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
            ctx.fill();
            exp.rings.forEach(ring => {
                if (ring.delay <= 0 && ring.alpha > 0) {
                    ctx.strokeStyle = 'rgba(255,200,100,' + ring.alpha + ')';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(exp.x, exp.y, ring.r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        });
        ctx.globalAlpha = 1;

        // Particles
        activeParticles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;

        // Power-ups
        powerUps.forEach(p => {
            const glow = Math.sin(p.glow) * 0.3 + 0.7;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12 * glow;
            ctx.beginPath();
            ctx.arc(0, 0, p.size + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = p.color;
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.icon, 0, 5);
            ctx.restore();
        });

        // Enemy bullets
        activeEnemyBullets.forEach(eb => {
            ctx.fillStyle = eb.color;
            ctx.shadowColor = eb.color;
            ctx.shadowBlur = eb.type === 'trackingPulse' ? 8 : eb.type === 'plasmaDart' ? 3 : 5;
            ctx.beginPath();
            if (eb.type === 'plasmaDart') {
                const a = Math.atan2(eb.vy, eb.vx);
                ctx.save();
                ctx.translate(eb.x, eb.y);
                ctx.rotate(a);
                ctx.fillRect(-5, -1, 10, 2);
                ctx.restore();
            } else if (eb.type === 'trackingPulse') {
                ctx.arc(eb.x, eb.y, eb.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.arc(eb.x, eb.y, eb.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.arc(eb.x, eb.y, eb.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        });

        // Bullets
        activeBullets.forEach(b => {
            const tier = b.tier || 1;
            if (b.trail.length > 1) {
                ctx.strokeStyle = 'rgba(255,200,50,' + (0.2 + tier * 0.06) + ')';
                ctx.lineWidth = 1 + tier * 0.35;
                ctx.beginPath();
                ctx.moveTo(b.trail[0].x, b.trail[0].y);
                for (let i = 1; i < b.trail.length; i++)
                    if (b.trail[i].life > 0) ctx.lineTo(b.trail[i].x, b.trail[i].y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            const colors = ['#ffdd00', '#ffcc00', '#ff9900', '#ff6600'];
            const sizes = [2, 2.5, 3, 3.5];
            const glows = [5, 7, 10, 15];
            ctx.fillStyle = colors[tier - 1] || '#ffdd00';
            ctx.shadowColor = colors[tier - 1];
            ctx.shadowBlur = glows[tier - 1] || 5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, sizes[tier - 1] || 2, 0, Math.PI * 2);
            ctx.fill();
            if (tier >= 4) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        });

        // Missiles
        missiles.forEach(m => {
            if (m.trail.length > 1) {
                ctx.strokeStyle = 'rgba(255,140,0,0.5)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(m.trail[0].x, m.trail[0].y);
                for (let i = 1; i < m.trail.length; i++) ctx.lineTo(m.trail[i].x, m.trail[i].y);
                ctx.lineTo(m.x, m.y);
                ctx.stroke();
            }
            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(Math.atan2(m.vy, m.vx));
            ctx.fillStyle = '#ff8800';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 8;
            ctx.fillRect(-5, -2, 10, 4);
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(-7, -1.5, 3, 3);
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        // Enemies
        enemies.forEach(e => {
            if (!e.alive) return;
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);
            const fc = e.flash > 0 ? '#ffffff' : e.color;
            const bw = e.w;
            const bh = e.h;
            ctx.fillStyle = fc;
            ctx.shadowColor = e.sc;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(0, -bh / 2);
            ctx.bezierCurveTo(bw * 0.12, -bh * 0.35, bw * 0.18, -bh * 0.15, bw * 0.2, 0);
            ctx.bezierCurveTo(bw * 0.22, bh * 0.1, bw * 0.18, bh * 0.25, bw * 0.12, bh * 0.4);
            ctx.lineTo(bw * 0.06, bh * 0.42);
            ctx.lineTo(-bw * 0.06, bh * 0.42);
            ctx.lineTo(-bw * 0.12, bh * 0.4);
            ctx.bezierCurveTo(-bw * 0.18, bh * 0.25, -bw * 0.22, bh * 0.1, -bw * 0.2, 0);
            ctx.bezierCurveTo(-bw * 0.18, -bh * 0.15, -bw * 0.12, -bh * 0.35, 0, -bh / 2);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = e.sc;
            ctx.beginPath();
            ctx.moveTo(-bw * 0.08, -bh * 0.08);
            ctx.lineTo(-bw * 0.48, bh * 0.04);
            ctx.lineTo(-bw * 0.45, bh * 0.18);
            ctx.lineTo(-bw * 0.08, bh * 0.13);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(bw * 0.08, -bh * 0.08);
            ctx.lineTo(bw * 0.48, bh * 0.04);
            ctx.lineTo(bw * 0.45, bh * 0.18);
            ctx.lineTo(bw * 0.08, bh * 0.13);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(150,220,255,0.55)';
            ctx.beginPath();
            ctx.ellipse(0, -bh * 0.1, bw * 0.09, bh * 0.14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,100,30,0.6)';
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(0, bh * 0.38, bw * 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (e.maxHp >= 3) {
                const barW = bw * 0.6;
                const barH = 3;
                const barY = -bh / 2 - 8;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(-barW / 2, barY, barW, barH);
                ctx.fillStyle = e.hp > e.maxHp * 0.5 ? '#00ff88' : '#ff4444';
                ctx.fillRect(-barW / 2, barY, barW * (e.hp / e.maxHp), barH);
            }
            ctx.restore();
        });

        // Player (main)
        if (gameState === 'playing' || gameState === 'mpBattle') {
            drawPlayer(ctx, player, playerConfig, false);
        }

        // Player 2 (multiplayer opponent)
        if (mpMode && mpPlayer2) {
            const p2Cfg = { ...playerConfig };
            p2Cfg.color1 = '#cc4444';
            p2Cfg.color2 = '#882222';
            drawPlayer(ctx, mpPlayer2, p2Cfg, true);
        }

        ctx.restore();

        // Floating texts
        floatingTexts.forEach(ft => {
            ctx.globalAlpha = ft.life;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 13px Cairo, "Segoe UI", Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 5;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;

        // Vignette
        const vg = ctx.createRadialGradient(gameWidth / 2, gameHeight / 2, gameWidth * 0.32, gameWidth / 2, gameHeight / 2, gameWidth * 0.8);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, gameWidth, gameHeight);
    }

    function drawPlayer(ctx, p, cfg, isEnemy) {
        if (!p) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.roll || -Math.PI / 2);
        const pw = playerConfig.width;
        const ph = playerConfig.height;
        if (isEnemy) {
            ctx.globalAlpha = 0.85;
        }
        ctx.transform(1, 0, (p.banking || 0) * 0.3, 1, 0, 0);
        if (p.afterburner > 0) {
            const ab = ctx.createRadialGradient(0, ph * 0.4, 0, 0, ph * 0.7, ph * 0.6);
            ab.addColorStop(0, 'rgba(0,160,255,0.9)');
            ab.addColorStop(0.4, 'rgba(0,100,255,0.5)');
            ab.addColorStop(1, 'rgba(0,40,255,0)');
            ctx.fillStyle = ab;
            ctx.beginPath();
            ctx.arc(0, ph * 0.38, ph * 0.5 * p.afterburner, 0, Math.PI * 2);
            ctx.fill();
            const fg = ctx.createLinearGradient(0, ph * 0.28, 0, ph * 0.8);
            fg.addColorStop(0, '#ffffff');
            fg.addColorStop(0.2, '#00aaff');
            fg.addColorStop(0.6, '#0044ff');
            fg.addColorStop(1, 'transparent');
            ctx.fillStyle = fg;
            ctx.beginPath();
            const fl = ph * 0.5 * p.afterburner;
            ctx.moveTo(-pw * 0.07, ph * 0.32);
            ctx.lineTo(pw * 0.07, ph * 0.32);
            ctx.lineTo(0, ph * 0.32 + fl);
            ctx.closePath();
            ctx.fill();
        }
        const bodyGrad = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
        bodyGrad.addColorStop(0, cfg.color1);
        bodyGrad.addColorStop(0.3, cfg.color1);
        bodyGrad.addColorStop(0.7, cfg.color2);
        bodyGrad.addColorStop(1, cfg.color2);
        ctx.fillStyle = bodyGrad;
        ctx.shadowColor = cfg.color1;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -ph / 2);
        ctx.bezierCurveTo(pw * 0.12, -ph * 0.35, pw * 0.18, -ph * 0.15, pw * 0.2, 0);
        ctx.bezierCurveTo(pw * 0.22, ph * 0.1, pw * 0.18, ph * 0.25, pw * 0.12, ph * 0.4);
        ctx.lineTo(pw * 0.06, ph * 0.42);
        ctx.lineTo(-pw * 0.06, ph * 0.42);
        ctx.lineTo(-pw * 0.12, ph * 0.4);
        ctx.bezierCurveTo(-pw * 0.18, ph * 0.25, -pw * 0.22, ph * 0.1, -pw * 0.2, 0);
        ctx.bezierCurveTo(-pw * 0.18, -ph * 0.15, -pw * 0.12, -ph * 0.35, 0, -ph / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.fillStyle = cfg.color2;
        ctx.beginPath();
        ctx.moveTo(-pw * 0.07, -ph * 0.08);
        ctx.lineTo(-pw * 0.5, ph * 0.05);
        ctx.lineTo(-pw * 0.47, ph * 0.19);
        ctx.lineTo(-pw * 0.07, ph * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(pw * 0.07, -ph * 0.08);
        ctx.lineTo(pw * 0.5, ph * 0.05);
        ctx.lineTo(pw * 0.47, ph * 0.19);
        ctx.lineTo(pw * 0.07, ph * 0.14);
        ctx.closePath();
        ctx.fill();
        const cg = ctx.createLinearGradient(0, -ph * 0.33, 0, -ph * 0.04);
        cg.addColorStop(0, 'rgba(100,200,255,0.7)');
        cg.addColorStop(0.5, 'rgba(50,150,220,0.5)');
        cg.addColorStop(1, 'rgba(30,80,150,0.6)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(0, -ph * 0.14, pw * 0.09, ph * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(0, -ph * 0.44, pw * 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        // Player name tag in MP
        if (isEnemy && mpMode) {
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 11px Cairo, Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🎯 P2', p.x, p.y - ph * 0.5 - 12);
        }
    }

    // ==================== GAME LOOP ====================
    function gameLoop(t) {
        deltaTime = Math.min(0.1, (t - lastTime) / 1000);
        lastTime = t;
        frameCount++;
        update(deltaTime);
        render();
        requestAnimationFrame(gameLoop);
    }

    // ==================== INPUT ====================
    const keys = {};
    let joystickActive = false,
        joystickDX = 0,
        joystickDY = 0,
        joystickId = null,
        firePressed = false,
        missilePressed = false;

    document.addEventListener('click', () => audio.init(), { once: true });
    document.addEventListener('touchstart', () => audio.init(), { once: true });

    window.addEventListener('keydown', e => {
        audio.init();
        keys[e.key] = true;
        if (e.key === ' ') e.preventDefault();
        if (e.key === 'm' || e.key === 'M') {
            if (player.missileTimer <= 0 && missileCount > 0 && userControlEnabled && !cinematicState && !mpMode) {
                fireMissile();
                player.missileTimer = 1.2;
            }
        }
    });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    const jb = document.getElementById('joystickBase');
    const jt = document.getElementById('joystickThumb');

    function updateJoystick(cx, cy) {
        const r = jb.getBoundingClientRect();
        const jcx = r.left + r.width / 2;
        const jcy = r.top + r.height / 2;
        const maxR = r.width / 2 - 22;
        let dx = cx - jcx;
        let dy = cy - jcy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) { dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR; }
        joystickDX = dx / maxR;
        joystickDY = dy / maxR;
        jt.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    }

    function resetJoystick() {
        joystickActive = false;
        joystickDX = 0;
        joystickDY = 0;
        joystickId = null;
        jt.style.transform = 'translate(-50%, -50%)';
        jt.classList.remove('active');
    }
    jb.addEventListener('touchstart', e => { e.preventDefault();
        audio.init();
        joystickActive = true;
        joystickId = e.touches[0].identifier;
        jt.classList.add('active');
        updateJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    jb.addEventListener('touchmove', e => { e.preventDefault(); if (!joystickActive) return; for (const t of e.touches) { if (t.identifier === joystickId) { updateJoystick(t.clientX, t.clientY); break; } } }, { passive: false });
    jb.addEventListener('touchend', e => { let found = false; for (const t of e.touches) { if (t.identifier === joystickId) found = true; } if (!found) resetJoystick(); });
    jb.addEventListener('touchcancel', resetJoystick);
    jb.addEventListener('mousedown', e => { audio.init();
        joystickActive = true;
        joystickId = 'mouse';
        jt.classList.add('active');
        updateJoystick(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => { if (joystickActive && joystickId === 'mouse') updateJoystick(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (joystickId === 'mouse') resetJoystick(); });

    const fb = document.getElementById('fireButton');
    fb.addEventListener('touchstart', e => { e.preventDefault();
        audio.init();
        firePressed = true; });
    fb.addEventListener('touchend', () => { firePressed = false; });
    fb.addEventListener('mousedown', e => { e.preventDefault();
        audio.init();
        firePressed = true; });
    fb.addEventListener('mouseup', () => { firePressed = false; });
    fb.addEventListener('mouseleave', () => { firePressed = false; });

    const mb = document.getElementById('missileButton');
    mb.addEventListener('touchstart', e => { e.preventDefault();
        audio.init(); if (player.missileTimer <= 0 && missileCount > 0 && userControlEnabled && !cinematicState && !mpMode) { fireMissile();
            player.missileTimer = 1.2; } });
    mb.addEventListener('mousedown', e => { e.preventDefault();
        audio.init(); if (player.missileTimer <= 0 && missileCount > 0 && userControlEnabled && !cinematicState && !mpMode) { fireMissile();
            player.missileTimer = 1.2; } });

    // ==================== PAUSE ====================
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('btnResume').addEventListener('click', togglePause);
    document.getElementById('btnPauseRestart').addEventListener('click', function() { isPaused = false;
        document.getElementById('pauseOverlay').classList.remove('visible');
        resetGame(); });
    document.getElementById('btnPauseMenu').addEventListener('click', function() { isPaused = false;
        document.getElementById('pauseOverlay').classList.remove('visible');
        backToMenu(); });
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            if (gameState === 'playing' || gameState === 'mpBattle') togglePause();
        }
    });

    // ==================== UI BINDINGS ====================
    $('btnStart').addEventListener('click', resetGame);
    $('btnStart').addEventListener('touchend', e => { e.preventDefault();
        resetGame(); });
    $('btnAircraft').addEventListener('click', () => { buildAircraftGrid();
        $('mainMenu').classList.remove('visible');
        $('aircraftScreen').classList.add('visible'); });
    $('btnBackFromAircraft').addEventListener('click', () => { $('aircraftScreen').classList.remove('visible');
        $('mainMenu').classList.add('visible'); });
    $('btnCredits').addEventListener('click', () => { $('mainMenu').classList.remove('visible');
        $('creditsScreen').classList.add('visible'); });
    $('btnBackFromCredits').addEventListener('click', () => { $('creditsScreen').classList.remove('visible');
        $('mainMenu').classList.add('visible'); });
    $('restartButton').addEventListener('click', resetGame);
    $('restartButton').addEventListener('touchend', e => { e.preventDefault();
        resetGame(); });
    $('btnBackToMenu').addEventListener('click', backToMenu);
    $('btnBackToMenu').addEventListener('touchend', e => { e.preventDefault();
        backToMenu(); });

    // Multiplayer buttons
    $('btnMultiplayer').addEventListener('click', () => { $('mainMenu').classList.remove('visible');
        $('multiplayerPanel').classList.add('visible'); });
    $('btnBackFromMP').addEventListener('click', () => { $('multiplayerPanel').classList.remove('visible');
        $('mainMenu').classList.add('visible'); });
    $('btnHostGame').addEventListener('click', hostGame);
    $('btnScanDevices').addEventListener('click', scanDevices);
    $('btnDisconnect').addEventListener('click', () => { disconnectBluetooth();
        backToMenu(); });

    document.addEventListener('touchmove', e => { if (e.target.closest('#gameContainer')) e.preventDefault(); }, { passive: false });

    // ==================== INIT ====================
    applyPlayerConfig(playerConfig);
    player.x = gameWidth / 2;
    player.y = gameHeight * 0.7;
    player.roll = -Math.PI / 2;
    player.targetRoll = -Math.PI / 2;
    generateStarfield('#ffddbb');
    updateWeaponUI();
    updateSquadronUI();
    buildAircraftGrid();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

})();
