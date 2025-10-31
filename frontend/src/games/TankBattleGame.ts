import Phaser from 'phaser';
import { BaseGame, PlayerData, GameConfig } from './BaseGame';

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 700;
const TANK_SIZE = 30;
const BULLET_SIZE = 8;
const TANK_SPEED = 150;
const BULLET_SPEED = 400;
const FIRE_COOLDOWN = 500;
const TANK_HEALTH = 3;

interface TankPlayer extends PlayerData {
  sprite?: Phaser.GameObjects.Graphics;
  turretSprite?: Phaser.GameObjects.Graphics;
  body?: Phaser.Physics.Arcade.Body;
  health: number;
  isDead: boolean;
  nameText?: Phaser.GameObjects.Text;
  healthText?: Phaser.GameObjects.Text;
  lastFireTime: number;
  angle: number;
  color: number;
  kills: number;
}

interface Bullet {
  sprite: Phaser.GameObjects.Arc;
  body: Phaser.Physics.Arcade.Body;
  ownerId: string;
  active: boolean;
}

export class TankBattleGame extends BaseGame {
  private scene?: Phaser.Scene;
  private tankPlayers: Map<string, TankPlayer> = new Map();
  private walls: Phaser.GameObjects.Rectangle[] = [];
  private bullets: Bullet[] = [];
  private wallsGroup?: Phaser.Physics.Arcade.StaticGroup;
  private statusText?: Phaser.GameObjects.Text;
  private winnerText?: Phaser.GameObjects.Text;
  private gameEnded: boolean = false;

  private playerColors = [
    0x00ff00, // Vert
    0xff0000, // Rouge
    0x0000ff, // Bleu
    0xffff00  // Jaune
  ];

  constructor(containerId: string) {
    const config: GameConfig = {
      name: 'Tank Battle Royale',
      description: 'Combat de tanks dans un labyrinthe - Dernier survivant gagne!',
      minPlayers: 2,
      maxPlayers: 4
    };
    super(containerId, config);
  }

  createPhaserConfig(): Phaser.Types.Core.GameConfig {
    const self = this;

    return {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#1a1a1a',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: {
        create: function(this: Phaser.Scene) {
          self.scene = this;
          self.setupScene(this);
        },
        update: function(this: Phaser.Scene, time: number) {
          self.updateScene(this, time);
        }
      }
    };
  }

  private setupScene(scene: Phaser.Scene): void {
    scene.add.text(GAME_WIDTH / 2, 20, 'TANK BATTLE ROYALE', {
      fontSize: '32px',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    this.statusText = scene.add.text(GAME_WIDTH / 2, 50, '', {
      fontSize: '18px',
      color: '#FFFFFF'
    }).setOrigin(0.5).setDepth(100);

    // Instructions
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20,
      'Joystick: Déplacer | Bouton A: Tirer | 3 touches = éliminé', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(100);

    this.generateMaze(scene);

    let playerIndex = 0;
    this.players.forEach((player) => {
      this.initializeTankPlayer(scene, player, playerIndex);
      playerIndex++;
    });

    this.updateStatus();
  }

  private generateMaze(scene: Phaser.Scene): void {
    this.wallsGroup = scene.physics.add.staticGroup();

    const cellSize = 40;

    const mazeMatrix = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,1,0,1,0,0,1,1,0,0,1,0,1,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,1,0,1,1,1,1,0,0,0,0,1,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,0,0,1,1,0,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,0,1,1,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,1,0,0,1,0,0,0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,1,0,0,1,0],
      [0,1,0,0,1,0,0,0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,1,0,0,1,0],
      [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,0,0,1,1,0,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,0,1,1,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,0,1,1,1,1,0,0,0,0,1,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0],
      [0,0,0,0,1,0,0,0,0,1,0,1,0,0,1,1,0,0,1,0,1,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0]
    ];

    // Génération des murs intérieurs à partir de la matrice
    for (let row = 0; row < mazeMatrix.length; row++) {
      for (let col = 0; col < mazeMatrix[row].length; col++) {
        if (mazeMatrix[row][col] === 1) {
          // Calculer la position du mur (centré dans la cellule)
          const x = col * cellSize + cellSize / 2;
          const y = row * cellSize + cellSize / 2;

          // Créer un mur
          const wall = scene.add.rectangle(x, y, cellSize, cellSize, 0x666666);
          scene.physics.add.existing(wall, true);
          const body = wall.body as Phaser.Physics.Arcade.StaticBody;
          body.setSize(cellSize, cellSize);
          body.updateFromGameObject();
          this.walls.push(wall);
          if (this.wallsGroup) {
            this.wallsGroup.add(wall);
          }
        }
      }
    }
  }

  private initializeTankPlayer(scene: Phaser.Scene, playerData: PlayerData, index: number): void {
    const color = this.playerColors[index % this.playerColors.length];

    const spawnPositions = [
      { x: 100, y: 100 },
      { x: GAME_WIDTH - 100, y: 100 },
      { x: 100, y: GAME_HEIGHT - 100 },
      { x: GAME_WIDTH - 100, y: GAME_HEIGHT - 100 }
    ];
    const spawn = spawnPositions[index % spawnPositions.length];

    const tankPlayer: TankPlayer = {
      ...playerData,
      health: TANK_HEALTH,
      isDead: false,
      lastFireTime: 0,
      angle: 0,
      color: color,
      kills: 0
    };

    const tankSprite = scene.add.graphics();
    tankSprite.setPosition(spawn.x, spawn.y);
    tankSprite.setDepth(10);

    const turretSprite = scene.add.graphics();
    turretSprite.setPosition(spawn.x, spawn.y);
    turretSprite.setDepth(11);

    scene.physics.add.existing(tankSprite as any);
    const body = (tankSprite as any).body as Phaser.Physics.Arcade.Body;
    body.setCircle(TANK_SIZE / 2, 0, 0);
    body.setCollideWorldBounds(true);
    body.setOffset(-TANK_SIZE / 2, -TANK_SIZE / 2);

    tankPlayer.sprite = tankSprite;
    tankPlayer.turretSprite = turretSprite;
    tankPlayer.body = body;

    tankPlayer.nameText = scene.add.text(spawn.x, spawn.y - 40, playerData.username, {
      fontSize: '14px',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(20);

    tankPlayer.healthText = scene.add.text(spawn.x, spawn.y - 25, `❤️ ${TANK_HEALTH}`, {
      fontSize: '12px',
      color: '#FF0000'
    }).setOrigin(0.5).setDepth(20);

    this.drawTank(tankPlayer);

    if (this.wallsGroup) {
      scene.physics.add.collider(tankSprite as any, this.wallsGroup);
    }

    this.tankPlayers.set(playerData.id, tankPlayer);
  }

  private drawTank(player: TankPlayer): void {
    if (!player.sprite || !player.turretSprite) return;

    player.sprite.clear();
    player.sprite.fillStyle(player.color, 1);
    player.sprite.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);

    player.sprite.lineStyle(2, 0x000000, 1);
    player.sprite.strokeRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);

    player.turretSprite.clear();
    player.turretSprite.fillStyle(player.color, 1);
    player.turretSprite.fillRect(-4, -TANK_SIZE/2 - 8, 8, TANK_SIZE/2 + 8);
    player.turretSprite.setRotation(player.angle);

    if (player.isDead) {
      player.sprite.setAlpha(0.3);
      player.turretSprite.setAlpha(0.3);
    }
  }

  private updateScene(scene: Phaser.Scene, time: number): void {
    this.tankPlayers.forEach(player => {
      if (player.sprite && player.nameText && player.healthText) {
        player.nameText.setPosition(player.sprite.x, player.sprite.y - 40);
        player.healthText.setPosition(player.sprite.x, player.sprite.y - 25);

        if (player.turretSprite) {
          player.turretSprite.setPosition(player.sprite.x, player.sprite.y);
        }
      }
    });

    if (this.gameEnded) return;

    this.bullets = this.bullets.filter(bullet => {
      if (!bullet.active) {
        bullet.sprite.destroy();
        return false;
      }

      let hitWall = false;
      this.walls.forEach(wall => {
        if (!bullet.active) return;

        const wallBody = wall.body as Phaser.Physics.Arcade.Body;
        if (this.scene?.physics.overlap(bullet.sprite, wall)) {
          bullet.active = false;
          hitWall = true;
        }
      });

      if (hitWall) {
        bullet.sprite.destroy();
        return false;
      }

      this.tankPlayers.forEach(player => {
        if (!bullet.active || player.isDead || player.id === bullet.ownerId) return;

        if (player.sprite && this.scene?.physics.overlap(bullet.sprite, player.sprite as any)) {
          bullet.active = false;
          this.hitTank(player, bullet.ownerId);
          bullet.sprite.destroy();
        }
      });

      if (bullet.sprite.x < 0 || bullet.sprite.x > GAME_WIDTH ||
          bullet.sprite.y < 0 || bullet.sprite.y > GAME_HEIGHT) {
        bullet.active = false;
        bullet.sprite.destroy();
        return false;
      }

      return bullet.active;
    });

    this.checkWinner();
  }

  private hitTank(player: TankPlayer, attackerId: string): void {
    player.health--;

    if (player.healthText) {
      player.healthText.setText(`❤️ ${player.health}`);
    }

    if (player.health <= 0) {
      player.isDead = true;
      player.body?.setVelocity(0, 0);
      this.drawTank(player);

      if (player.nameText) {
        player.nameText.setColor('#FF0000');
        player.nameText.setText(player.username + ' - ÉLIMINÉ');
      }

      const attacker = this.tankPlayers.get(attackerId);
      if (attacker) {
        attacker.kills++;
      }

      this.updateStatus();
    }
  }

  private checkWinner(): void {
    const alivePlayers = Array.from(this.tankPlayers.values()).filter(p => !p.isDead);

    if (alivePlayers.length === 1 && !this.gameEnded) {
      this.gameEnded = true;
      const winner = alivePlayers[0];
      this.showWinner(winner);
    } else if (alivePlayers.length === 0 && !this.gameEnded) {
      this.gameEnded = true;
      this.showDraw();
    }
  }

  private showWinner(winner: TankPlayer): void {
    if (!this.scene) return;

    this.winnerText = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `🏆 ${winner.username} GAGNE! 🏆\n\n${winner.kills} élimination(s)`, {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 30, y: 20 },
      align: 'center'
    }).setOrigin(0.5).setDepth(200);
  }

  private showDraw(): void {
    if (!this.scene) return;

    this.winnerText = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      'ÉGALITÉ!\n\nTout le monde est éliminé', {
      fontSize: '48px',
      color: '#FF6600',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 30, y: 20 },
      align: 'center'
    }).setOrigin(0.5).setDepth(200);
  }

  private updateStatus(): void {
    const alive = Array.from(this.tankPlayers.values()).filter(p => !p.isDead).length;
    const total = this.tankPlayers.size;

    if (this.statusText) {
      this.statusText.setText(`Joueurs en vie: ${alive}/${total}`);
    }
  }

  private fireBullet(player: TankPlayer, time: number): void {
    if (!this.scene || !player.sprite || player.isDead) return;

    if (time - player.lastFireTime < FIRE_COOLDOWN) return;

    player.lastFireTime = time;

    const bulletX = player.sprite.x + Math.sin(player.angle) * (TANK_SIZE/2 + 10);
    const bulletY = player.sprite.y - Math.cos(player.angle) * (TANK_SIZE/2 + 10);

    const bulletSprite = this.scene.add.circle(bulletX, bulletY, BULLET_SIZE, 0xFFFF00);
    bulletSprite.setDepth(5);
    this.scene.physics.add.existing(bulletSprite);

    const bulletBody = bulletSprite.body as Phaser.Physics.Arcade.Body;

    const velocityX = Math.sin(player.angle) * BULLET_SPEED;
    const velocityY = -Math.cos(player.angle) * BULLET_SPEED;
    bulletBody.setVelocity(velocityX, velocityY);

    const bullet: Bullet = {
      sprite: bulletSprite,
      body: bulletBody,
      ownerId: player.id,
      active: true
    };

    this.bullets.push(bullet);
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    const player = this.tankPlayers.get(playerId);
    if (!player || player.isDead || !player.body) return;

    if (action === 'joystick' && data) {
      const joystickX = data.joystickX || 0;
      const joystickY = data.joystickY || 0;

      const velocityX = joystickX * TANK_SPEED;
      const velocityY = joystickY * TANK_SPEED;
      player.body.setVelocity(velocityX, velocityY);

      if (Math.abs(joystickX) > 0.1 || Math.abs(joystickY) > 0.1) {
        player.angle = Math.atan2(joystickX, -joystickY);
        this.drawTank(player);
      }

      return;
    }

    if (action === 'action' && data && this.scene) {
      if (this.gameEnded) return;
      this.fireBullet(player, data.timestamp || Date.now());
    }
  }

  protected onPlayerAdded(player: PlayerData): void {
    console.log('Player added to Tank Battle:', player.username);

    if (this.scene) {
      const index = this.tankPlayers.size;
      this.initializeTankPlayer(this.scene, player, index);
      this.updateStatus();
    }
  }

  protected onPlayerRemoved(player: PlayerData): void {
    console.log('Player removed from Tank Battle:', player.username);

    const tankPlayer = this.tankPlayers.get(player.id);
    if (tankPlayer) {
      tankPlayer.sprite?.destroy();
      tankPlayer.turretSprite?.destroy();
      tankPlayer.nameText?.destroy();
      tankPlayer.healthText?.destroy();
      this.tankPlayers.delete(player.id);
      this.updateStatus();
    }
  }

  destroy(): void {
    this.tankPlayers.forEach(player => {
      player.sprite?.destroy();
      player.turretSprite?.destroy();
      player.nameText?.destroy();
      player.healthText?.destroy();
    });

    this.bullets.forEach(bullet => {
      bullet.sprite?.destroy();
    });

    this.walls.forEach(wall => {
      wall.destroy();
    });

    this.tankPlayers.clear();
    this.bullets = [];
    this.walls = [];

    super.destroy();
  }
}
