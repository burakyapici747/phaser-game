import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.localPlayer = null;
        this.pingText = null;
        this.lastPingTime = Date.now();
        this.currentPing = 0;
    }

    init(data) {
        this.socket = data.socket;
        this.setupSocketListeners();
        this.startPingInterval();
    }

    startPingInterval() {
        // Send ping every 2 seconds
        setInterval(() => {
            this.lastPingTime = Date.now();
            this.socket.emit('ping');
        }, 2000);

        // Listen for pong
        this.socket.on('pong', () => {
            this.currentPing = Date.now() - this.lastPingTime;
            if (this.pingText) {
                this.pingText.setText(`Ping: ${this.currentPing}ms`);
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('game:init', ({ player, players }) => {
            this.createLocalPlayer(player);
            players.forEach(p => {
                if (p.id !== this.socket.id) {
                    this.addOtherPlayer(p);
                }
            });
        });

        this.socket.on('player:new', (playerData) => {
            this.addOtherPlayer(playerData);
        });

        this.socket.on('player:moved', (playerData) => {
            const player = this.players.get(playerData.id);
            if (player) {
                player.x = playerData.x;
                player.y = playerData.y;
                player.rotation = playerData.rotation;
            }
        });

        this.socket.on('player:left', (playerId) => {
            const player = this.players.get(playerId);
            if (player) {
                player.destroy();
                this.players.delete(playerId);
            }
        });
    }

    create() {
        // Set world bounds
        this.physics.world.setBounds(0, 0, 2400, 1800);
        
        // Create a background
        this.add.grid(0, 0, 2400, 1800, 32, 32, 0xe0e0e0, 1, 0xcccccc)
            .setOrigin(0, 0);

        // Setup keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Create ping text
        this.pingText = this.add.text(16, 16, 'Ping: 0ms', {
            fontSize: '18px',
            fill: '#000',
            backgroundColor: '#ffffff80',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0).setDepth(1000);
    }

    createLocalPlayer(playerData) {
        const square = this.add.rectangle(playerData.x, playerData.y, 32, 32, parseInt(playerData.color.slice(1), 16));
        square.setStrokeStyle(2, 0xffffff);
        this.physics.add.existing(square);
        square.body.setCollideWorldBounds(true);
        
        this.localPlayer = square;
        this.localPlayer.playerData = playerData;
        this.players.set(playerData.id, square);

        // Setup camera to follow player
        this.cameras.main.setBounds(0, 0, 2400, 1800);
        
        // Daha smooth kamera takibi için ayarlar
        this.cameras.main.startFollow(this.localPlayer, {
            lerpX: 0.15,
            lerpY: 0.15,
            offsetX: 0,
            offsetY: 0
        });
        
        this.cameras.main.setZoom(1);
    }

    addOtherPlayer(playerData) {
        const square = this.add.rectangle(playerData.x, playerData.y, 32, 32, parseInt(playerData.color.slice(1), 16));
        square.setStrokeStyle(2, 0xffffff);
        this.players.set(playerData.id, square);
    }

    update() {
        if (!this.localPlayer) return;

        const speed = 200;
        const velocity = { x: 0, y: 0 };

        // Arrow keys
        if (this.cursors.left.isDown || this.wasd.left.isDown) {
            velocity.x = -speed;
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
            velocity.x = speed;
        }

        if (this.cursors.up.isDown || this.wasd.up.isDown) {
            velocity.y = -speed;
        } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
            velocity.y = speed;
        }

        this.localPlayer.body.setVelocity(velocity.x, velocity.y);

        // Handle rotation towards mouse
        const pointer = this.input.activePointer;
        const angle = Phaser.Math.Angle.Between(
            this.localPlayer.x, this.localPlayer.y,
            pointer.x + this.cameras.main.scrollX,
            pointer.y + this.cameras.main.scrollY
        );
        this.localPlayer.rotation = angle;

        // Send position update to server
        if (velocity.x !== 0 || velocity.y !== 0 || this.lastRotation !== angle) {
            this.socket.emit('player:move', {
                x: this.localPlayer.x,
                y: this.localPlayer.y,
                rotation: angle
            });
            this.lastRotation = angle;
        }
    }
} 