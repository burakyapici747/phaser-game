import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.localPlayer = null;
    }

    init(data) {
        this.socket = data.socket;
        this.setupSocketListeners();
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
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    createLocalPlayer(playerData) {
        const square = this.add.rectangle(playerData.x, playerData.y, 32, 32, parseInt(playerData.color.slice(1), 16));
        square.setStrokeStyle(2, 0xffffff);
        this.physics.add.existing(square);
        square.body.setCollideWorldBounds(true);
        
        this.localPlayer = square;
        this.localPlayer.playerData = playerData;
        this.players.set(playerData.id, square);
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

        if (this.cursors.left.isDown) {
            velocity.x = -speed;
        } else if (this.cursors.right.isDown) {
            velocity.x = speed;
        }

        if (this.cursors.up.isDown) {
            velocity.y = -speed;
        } else if (this.cursors.down.isDown) {
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