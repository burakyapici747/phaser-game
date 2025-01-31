import Phaser from "phaser";
import {
  CLIENT_TICK_RATE,
  INPUT_TYPE,
  PLAYER_MOVE_SPEED,
  PLAYER_ROTATE_SPEED,
  PLAYER_SIZE,
} from "../constant.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
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
    this.inputQueue = [];
    this.inputSequenceNumber = 0;
  }

  startPingInterval() {
    // Send ping every 2 seconds
    setInterval(() => {
      this.lastPingTime = Date.now();
      this.socket.emit("ping");
    }, 2000);

    // Listen for pong
    this.socket.on("pong", () => {
      this.currentPing = Date.now() - this.lastPingTime;
      if (this.pingText) {
        this.pingText.setText(`Ping: ${this.currentPing}ms`);
      }
    });
  }

  setupSocketListeners() {
    this.socket.on("game:init", ({ player, players }) => {
      this.createLocalPlayer(player);
      players?.forEach((p) => {
        if (p.id !== this.socket.id) {
          this.addOtherPlayer(p);
        }
      });
    });

    this.socket.on("player:new", (playerData) => {
      this.addOtherPlayer(playerData);
    });

    this.socket.on("player:moved", (playerData) => {
      const player = this.players.get(playerData.id);
      if (player) {
        player.x = playerData.x;
        player.y = playerData.y;
        player.rotation = playerData.rotation;
      }
    });

    this.socket.on("snapshot", (gameState) => {
      Object.keys(gameState?.players)?.forEach((socketId) => {
        const player = gameState?.players[socketId];
        if (socketId === this.socket.id) {
          // Server'dan gelen son onaylanan pozisyonu al
          const serverPos = {
            x: player.x,
            y: player.y,
            rotation: player.rotation,
          };

          // Server tarafından işlenen input'ları temizle
          if (gameState.processedInputs[socketId]) {
            const lastProcessedInput = Math.max(
              ...gameState.processedInputs[socketId]
            );
            this.inputQueue = this.inputQueue.filter(
              (input) => input.sequenceNumber > lastProcessedInput
            );
          }

          // Eğer server pozisyonu ile client pozisyonu arasında büyük fark varsa
          const threshold = 5; // 5 pixel tolerans
          if (
            Math.abs(this.localPlayer.x - serverPos.x) > threshold ||
            Math.abs(this.localPlayer.y - serverPos.y) > threshold
          ) {
            // Server pozisyonuna geri dön
            this.localPlayer.x = serverPos.x;
            this.localPlayer.y = serverPos.y;
            this.localPlayer.rotation = serverPos.rotation;

            // Henüz işlenmemiş input'ları tekrar uygula
            this.inputQueue.forEach((input) => {
              this.applyInput(input);
            });
          }
        } else {
          // Diğer oyuncuları güncelle
          const otherPlayer = this.players.get(socketId);
          if (otherPlayer) {
            otherPlayer.x = player.x;
            otherPlayer.y = player.y;
            otherPlayer.rotation = player.rotation;
          }
        }
      });
    });

    this.socket.on("player:left", (playerId) => {
      const player = this.players.get(playerId);
      if (player) {
        player.destroy();
        this.players.delete(playerId);
      }
    });
  }

  create() {
    this.elapsedTime = 0;
    this.physics.world.setBounds(0, 0, 2400, 1800);

    // Create a background
    this.add
      .grid(0, 0, 2400, 1800, 32, 32, 0xe0e0e0, 1, 0xcccccc)
      .setOrigin(0, 0);

    // Setup keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Create ping text
    this.pingText = this.add
      .text(16, 16, "Ping: 0ms", {
        fontSize: "18px",
        fill: "#000",
        backgroundColor: "#ffffff80",
        padding: { x: 10, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    /*this.time.addEvent({
      delay: CLIENT_TICK_RATE,
      callback: this.sendInputQueue,
      callbackScope: this,
      loop: true,
    });*/
  }

  createLocalPlayer(playerData) {
    const square = this.add.rectangle(
      playerData.x,
      playerData.y,
      32,
      32,
      parseInt(playerData.color.slice(1), 16)
    );
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
      offsetY: 0,
    });

    this.cameras.main.setZoom(1);
  }

  addOtherPlayer(playerData) {
    const square = this.add.rectangle(
      playerData.x,
      playerData.y,
      32,
      32,
      parseInt(playerData.color.slice(1), 16)
    );
    square.setStrokeStyle(2, 0xffffff);
    this.players.set(playerData.id, square);
  }

  sendInputQueue() {
    if (this.inputQueue.length > 0) {
      const input = this.inputQueue[0];
      this.socket.emit("input", {
        sequenceNumber: input.sequenceNumber,
        socketId: this.socket.id,
        type: input.type,
        vx: input.vx,
        vy: input.vy,
        rotation: input.rotation,
        timestamp: input.timestamp,
      });
      // Input'u queue'dan silmiyoruz, server onaylayana kadar tutuyoruz
    }
  }

  handleInput(delta) {
    this.elapsedTime += delta;
    if (this.elapsedTime > CLIENT_TICK_RATE) {
      // Velocity vektörünü hesapla
      let vx = 0;
      let vy = 0;

      if (this.cursors.left.isDown || this.wasd.left.isDown)
        vx -= PLAYER_MOVE_SPEED;
      if (this.cursors.right.isDown || this.wasd.right.isDown)
        vx += PLAYER_MOVE_SPEED;
      if (this.cursors.up.isDown || this.wasd.up.isDown)
        vy -= PLAYER_MOVE_SPEED;
      if (this.cursors.down.isDown || this.wasd.down.isDown)
        vy += PLAYER_MOVE_SPEED;

      // Çapraz hareket için normalize et
      if (vx !== 0 && vy !== 0) {
        const normalize = Math.sqrt(2);
        vx /= normalize;
        vy /= normalize;
      }

      // Mouse rotasyonunu hesapla
      const pointer = this.input.activePointer;
      const angle = Phaser.Math.Angle.Between(
        this.localPlayer.x,
        this.localPlayer.y,
        pointer.x + this.cameras.main.scrollX,
        pointer.y + this.cameras.main.scrollY
      );

      // Sadece hareket veya rotasyon varsa input gönder
      if (vx !== 0 || vy !== 0 || this.lastRotation !== angle) {
        const input = {
          sequenceNumber: this.inputSequenceNumber++,
          type: vx !== 0 || vy !== 0 ? INPUT_TYPE.MOVE : INPUT_TYPE.ROTATE,
          vx,
          vy,
          rotation: Phaser.Math.RadToDeg(angle),
          timestamp: Date.now(),
          x: this.localPlayer.x,
          y: this.localPlayer.y,
        };

        // Client-side prediction uygula
        this.applyInput(input);
        this.inputQueue.push(input);
        this.sendInputQueue();
      }

      this.elapsedTime = 0;
    }
  }

  applyInput(input) {
    if (input.type === INPUT_TYPE.MOVE) {
      this.localPlayer.x += input.vx;
      this.localPlayer.y += input.vy;
    }
    if (input.type === INPUT_TYPE.ROTATE || input.rotation !== undefined) {
      this.localPlayer.rotation = Phaser.Math.DegToRad(input.rotation);
    }
  }

  update(time, delta) {
    if (!this.localPlayer) return;

    // Input handling
    this.handleInput(delta);

    // Client-side prediction'ı burada tekrar uygulamıyoruz
    // Çünkü handleInput zaten yapıyor
  }
}
