import Phaser from 'phaser';
import { BaseGame, type GameConfig, type PlayerData } from './BaseGame';

const GAME_CONFIG: GameConfig = {
  name: 'Bomberman Battle',
  description: 'Classic Bomberman - Place bombs, destroy walls, eliminate enemies!',
  minPlayers: 2,
  maxPlayers: 4,
};

interface BombermanPlayer extends PlayerData {
  sprite?: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  bombCount: number;
  maxBombs: number;
  bombRange: number;
  alive: boolean;
  color: number;
  playerNumber?: number;
}

interface Bomb {
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  range: number;
  timer: number;
  playerId: string;
  id: string;
}

interface PowerUp {
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  type: 'bomb' | 'range';
}

const GRID_SIZE = 15;
const TILE_SIZE = 40;
const BOMB_TIMER = 3000;
const EXPLOSION_DURATION = 500;

const PLAYER_COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
const SPAWN_POSITIONS = [
  { x: 1, y: 1 },
  { x: GRID_SIZE - 2, y: 1 },
  { x: 1, y: GRID_SIZE - 2 },
  { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
];

class BombermanScene extends Phaser.Scene {
  private gameInstance: BombermanGame;
  private grid: number[][] = [];
  private tiles: Phaser.GameObjects.Rectangle[][] = [];
  private bombs: Bomb[] = [];
  private powerUps: PowerUp[] = [];
  private players: Map<string, BombermanPlayer> = new Map();
  private lastInputTime: Map<string, number> = new Map();
  private inputCooldown = 50;
  private gameOver = false;
  private winnerText?: Phaser.GameObjects.Text;
  private localPlayerId: string = '';
  private mapSeed: number = 12345;

  constructor(gameInstance: BombermanGame) {
    super({ key: 'BombermanScene' });
    this.gameInstance = gameInstance;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a1a');
    this.generateMap();
    this.renderMap();
    this.spawnPlayers();

    const uiY = GRID_SIZE * TILE_SIZE + 30;
    this.add.text(20, uiY, '🎮 Bomberman Battle', {
      fontSize: '24px',
      color: '#fff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });

    this.add.text(20, uiY + 35, 'Joystick: Move | A: Place Bomb', {
      fontSize: '16px',
      color: '#aaa',
      fontFamily: 'Arial'
    });
  }

  private seededRandom(): number {
    this.mapSeed = (this.mapSeed * 9301 + 49297) % 233280;
    return this.mapSeed / 233280;
  }

  private generateMap() {
    this.mapSeed = 12345;

    for (let y = 0; y < GRID_SIZE; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) {
          this.grid[y][x] = 1;
        } else if (x % 2 === 0 && y % 2 === 0) {
          this.grid[y][x] = 1;
        } else {
          this.grid[y][x] = 0;
        }
      }
    }

    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        if (this.grid[y][x] === 0) {
          const isSpawnZone =
            (x <= 2 && y <= 2) ||
            (x >= GRID_SIZE - 3 && y <= 2) ||
            (x <= 2 && y >= GRID_SIZE - 3) ||
            (x >= GRID_SIZE - 3 && y >= GRID_SIZE - 3);

          if (!isSpawnZone && this.seededRandom() < 0.5) {
            this.grid[y][x] = 2;
          }
        }
      }
    }
  }

  private renderMap() {
    this.tiles = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const tile = this.grid[y][x];
        let color = 0x222222;

        if (tile === 1) {
          color = 0x555555;
        } else if (tile === 2) {
          color = 0x8b4513;
        }

        const rect = this.add.rectangle(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          color
        );
        this.tiles[y][x] = rect;
      }
    }
  }

  private spawnPlayers() {
    let playerIndex = 0;
    const sortedPlayers = Array.from(this.gameInstance.getPlayers().entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    sortedPlayers.forEach(([playerId, player]) => {
      if (playerIndex < 4) {
        const spawn = SPAWN_POSITIONS[playerIndex];
        const color = PLAYER_COLORS[playerIndex];

        const bombermanPlayer: BombermanPlayer = {
          ...player,
          x: spawn.x,
          y: spawn.y,
          bombCount: 0,
          maxBombs: 1,
          bombRange: 1,
          alive: true,
          color: color,
          playerNumber: playerIndex + 1
        };

        const sprite = this.add.sprite(
          spawn.x * TILE_SIZE + TILE_SIZE / 2,
          spawn.y * TILE_SIZE + TILE_SIZE / 2,
          ''
        );
        sprite.setDisplaySize(TILE_SIZE - 10, TILE_SIZE - 10);

        const graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillCircle(0, 0, (TILE_SIZE - 10) / 2);
        graphics.generateTexture(`player_${playerId}`, TILE_SIZE - 10, TILE_SIZE - 10);
        graphics.destroy();

        sprite.setTexture(`player_${playerId}`);
        bombermanPlayer.sprite = sprite;

        this.add.text(
          spawn.x * TILE_SIZE + TILE_SIZE / 2,
          spawn.y * TILE_SIZE + TILE_SIZE / 2 - TILE_SIZE,
          player.username || `P${playerIndex + 1}`,
          {
            fontSize: '14px',
            color: '#fff',
            fontStyle: 'bold',
            backgroundColor: '#000',
            padding: { x: 4, y: 2 }
          }
        ).setOrigin(0.5);

        this.players.set(playerId, bombermanPlayer);
        playerIndex++;
      }
    });
  }

  setLocalPlayerId(playerId: string) {
    this.localPlayerId = playerId;
  }

  handleInput(playerId: string, action: string, data?: any) {
    if (this.gameOver) return;

    const player = this.players.get(playerId);
    if (!player) {
      console.error(`❌ handleInput: Player ${playerId} not found in players map`);
      console.log('Available players:', Array.from(this.players.keys()));
      return;
    }

    if (!player.alive) {
      console.log(`⚰️ Player ${player.username} is dead, ignoring input`);
      return;
    }

    const now = Date.now();
    const lastTime = this.lastInputTime.get(playerId) || 0;

    if (action === 'action' && now - lastTime >= 100) {
      console.log(`🎮 ACTION button pressed by ${player.username}`);
      this.placeBomb(player);
      this.lastInputTime.set(playerId, now);
    } else if (action === 'joystick' && now - lastTime >= this.inputCooldown) {
      const { joystickX, joystickY } = data;
      this.movePlayer(player, joystickX, joystickY);
      this.lastInputTime.set(playerId, now);
    }
  }

  private movePlayer(player: BombermanPlayer, jx: number, jy: number) {
    let newX = player.x;
    let newY = player.y;

    const threshold = 0.5;
    if (Math.abs(jx) > Math.abs(jy)) {
      if (jx > threshold) newX++;
      else if (jx < -threshold) newX--;
    } else {
      if (jy > threshold) newY++;
      else if (jy < -threshold) newY--;
    }

    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
      if (this.grid[newY][newX] === 0) {
        const hasBomb = this.bombs.some(b => b.gridX === newX && b.gridY === newY);
        if (!hasBomb) {
          player.x = newX;
          player.y = newY;
          if (player.sprite) {
            player.sprite.setPosition(
              newX * TILE_SIZE + TILE_SIZE / 2,
              newY * TILE_SIZE + TILE_SIZE / 2
            );
          }

          this.checkPowerUpPickup(player);
        }
      }
    }
  }

  private placeBomb(player: BombermanPlayer) {
    console.log(`🔍 ${player.username} attempting to place bomb - Current count: ${player.bombCount}/${player.maxBombs}`);

    if (player.bombCount >= player.maxBombs) {
      console.log(`⚠️ ${player.username} at max bombs (${player.bombCount}/${player.maxBombs}) - BLOCKED`);
      return;
    }

    const existingBomb = this.bombs.find(b => b.gridX === player.x && b.gridY === player.y);
    if (existingBomb) {
      console.log(`⚠️ Already a bomb at (${player.x},${player.y})`);
      return;
    }

    const bombSprite = this.add.sprite(
      player.x * TILE_SIZE + TILE_SIZE / 2,
      player.y * TILE_SIZE + TILE_SIZE / 2,
      ''
    );

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 3);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(TILE_SIZE / 2 - 2, TILE_SIZE / 2 - TILE_SIZE / 2, 4, TILE_SIZE / 3);
    graphics.generateTexture('bomb', TILE_SIZE, TILE_SIZE);
    graphics.destroy();

    bombSprite.setTexture('bomb');

    const bombId = `${player.x}_${player.y}_${Date.now()}`;

    const bomb: Bomb = {
      sprite: bombSprite,
      gridX: player.x,
      gridY: player.y,
      range: player.bombRange,
      timer: BOMB_TIMER,
      playerId: player.id,
      id: bombId
    };

    this.bombs.push(bomb);
    player.bombCount++;
    console.log(`💣 ${player.username} placed bomb at (${bomb.gridX},${bomb.gridY}) - ID: ${bombId} - Count: ${player.bombCount}/${player.maxBombs}`);

    this.tweens.add({
      targets: bombSprite,
      scale: { from: 1, to: 1.2 },
      duration: 300,
      yoyo: true,
      repeat: -1
    });
  }

  update(time: number, delta: number) {
    if (this.gameOver) return;

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.timer -= delta;

      if (bomb.timer <= 0) {
        this.explodeBomb(bomb);
        this.bombs.splice(i, 1);
      }
    }

    this.checkWinCondition();
  }

  private explodeBomb(bomb: Bomb) {
    console.log(`💥 Bomb ${bomb.id} exploded at (${bomb.gridX},${bomb.gridY})`);
    bomb.sprite.destroy();

    const player = this.players.get(bomb.playerId);
    if (player) {
      console.log(`   ├─ BEFORE decrement: ${player.username} has ${player.bombCount} bombs`);
      player.bombCount--;
      console.log(`   └─ AFTER decrement: ${player.username} now has ${player.bombCount}/${player.maxBombs} bombs`);
    } else {
      console.error(`❌ Could not find player ${bomb.playerId} to decrement bomb count!`);
      console.error(`   Available players:`, Array.from(this.players.keys()));
    }

    const explosionCells: { x: number, y: number }[] = [{ x: bomb.gridX, y: bomb.gridY }];

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    for (const dir of directions) {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.gridX + dir.dx * i;
        const y = bomb.gridY + dir.dy * i;

        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) break;

        const tile = this.grid[y][x];

        if (tile === 1) {
          break;
        }

        explosionCells.push({ x, y });

        if (tile === 2) {
          this.grid[y][x] = 0;
          this.tiles[y][x].setFillStyle(0x222222);

          if (Math.random() < 0.2) {
            this.mapSeed = (x * 1000 + y);
            this.spawnPowerUp(x, y);
          }
          break;
        }
      }
    }

    this.showExplosion(explosionCells);

    this.players.forEach((player) => {
      if (player.alive) {
        const hit = explosionCells.some(cell => cell.x === player.x && cell.y === player.y);
        if (hit) {
          this.killPlayer(player);
        }
      }
    });

    this.bombs.forEach((otherBomb) => {
      const hit = explosionCells.some(cell => cell.x === otherBomb.gridX && cell.y === otherBomb.gridY);
      if (hit) {
        otherBomb.timer = 0;
      }
    });
  }

  private showExplosion(cells: { x: number, y: number }[]) {
    cells.forEach(cell => {
      const explosion = this.add.rectangle(
        cell.x * TILE_SIZE + TILE_SIZE / 2,
        cell.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 2,
        TILE_SIZE - 2,
        0xff6600,
        0.8
      );

      this.tweens.add({
        targets: explosion,
        alpha: 0,
        duration: EXPLOSION_DURATION,
        onComplete: () => explosion.destroy()
      });
    });
  }

  private spawnPowerUp(x: number, y: number) {
    const type = this.seededRandom() < 0.5 ? 'bomb' : 'range';
    const color = type === 'bomb' ? 0x00ffff : 0xff00ff;

    const sprite = this.add.sprite(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      ''
    );

    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);

    graphics.beginPath();
    graphics.moveTo(TILE_SIZE / 2, TILE_SIZE / 6);
    graphics.lineTo(TILE_SIZE * 5/6, TILE_SIZE / 2);
    graphics.lineTo(TILE_SIZE / 2, TILE_SIZE * 5/6);
    graphics.lineTo(TILE_SIZE / 6, TILE_SIZE / 2);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture(`powerup_${x}_${y}`, TILE_SIZE, TILE_SIZE);
    graphics.destroy();

    sprite.setTexture(`powerup_${x}_${y}`);

    this.tweens.add({
      targets: sprite,
      angle: 360,
      duration: 2000,
      repeat: -1
    });

    this.powerUps.push({ sprite, gridX: x, gridY: y, type });
  }

  private checkPowerUpPickup(player: BombermanPlayer) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (powerUp.gridX === player.x && powerUp.gridY === player.y) {
        if (powerUp.type === 'bomb') {
          player.maxBombs++;
        } else if (powerUp.type === 'range') {
          player.bombRange++;
        }
        powerUp.sprite.destroy();
        this.powerUps.splice(i, 1);
      }
    }
  }

  private killPlayer(player: BombermanPlayer) {
    player.alive = false;
    if (player.sprite) {
      this.tweens.add({
        targets: player.sprite,
        alpha: 0,
        scale: 0,
        duration: 500,
        onComplete: () => player.sprite?.destroy()
      });
    }
  }

  private checkWinCondition() {
    const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);

    if (alivePlayers.length === 1) {
      this.endGame(alivePlayers[0]);
    } else if (alivePlayers.length === 0) {
      this.endGame(null);
    }
  }

  private endGame(winner: BombermanPlayer | null) {
    if (this.gameOver) return;
    this.gameOver = true;

    const localPlayer = this.players.get(this.localPlayerId);
    if (localPlayer) {
      const won = winner?.id === this.localPlayerId;
      this.saveGameResult(won);
    }

    const centerX = (GRID_SIZE * TILE_SIZE) / 2;
    const centerY = (GRID_SIZE * TILE_SIZE) / 2;

    const overlay = this.add.rectangle(
      centerX,
      centerY,
      GRID_SIZE * TILE_SIZE,
      GRID_SIZE * TILE_SIZE,
      0x000000,
      0.7
    );

    let message = 'Draw!';
    if (winner) {
      message = `Player ${winner.playerNumber} Wins! 🎉`;
    }

    this.winnerText = this.add.text(centerX, centerY - 50, message, {
      fontSize: '48px',
      color: winner ? `#${winner.color.toString(16).padStart(6, '0')}` : '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 30, 'Game Over', {
      fontSize: '32px',
      color: '#aaa',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
  }

  private async saveGameResult(won: boolean) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/games/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gameName: 'bomberman',
          result: won ? 'win' : 'loss',
          score: 0,
          duration: 0
        })
      });

      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  }
}

export class BombermanGame extends BaseGame {
  private scene?: BombermanScene;

  constructor(containerId: string) {
    super(containerId, GAME_CONFIG);
  }

  createPhaserConfig(): Phaser.Types.Core.GameConfig {
    this.scene = new BombermanScene(this);

    return {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: GRID_SIZE * TILE_SIZE,
      height: GRID_SIZE * TILE_SIZE + 80,
      backgroundColor: '#1a1a1a',
      scene: this.scene,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      }
    };
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    if (this.scene) {
      this.scene.handleInput(playerId, action, data);
    }
  }

  protected onPlayerAdded(player: PlayerData): void {
    console.log('Player added to Bomberman:', player);
  }

  protected onPlayerRemoved(player: PlayerData): void {
    console.log('Player removed from Bomberman:', player);
  }

  setLocalPlayerId(playerId: string): void {
    if (this.scene) {
      this.scene.setLocalPlayerId(playerId);
    }
  }

  getPlayers(): Map<string, PlayerData> {
    return this.players;
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }

  static getConfig(): GameConfig {
    return GAME_CONFIG;
  }
}
