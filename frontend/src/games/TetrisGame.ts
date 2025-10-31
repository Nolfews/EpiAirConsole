import Phaser from 'phaser';
import { BaseGame, PlayerData, GameConfig } from './BaseGame';

const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: 0x00F0F0, // Cyan
    rotations: 2
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: 0xF0F000, // Yellow
    rotations: 1
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1]
    ],
    color: 0xA000F0, // Purple
    rotations: 4
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0]
    ],
    color: 0x00F000, // Green
    rotations: 2
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1]
    ],
    color: 0xF00000, // Red
    rotations: 2
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1]
    ],
    color: 0x0000F0, // Blue
    rotations: 4
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1]
    ],
    color: 0xF0A000, // Orange
    rotations: 4
  }
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 25;
const MINI_BLOCK_SIZE = 8;

interface TetrisPlayer extends PlayerData {
  board: number[][];
  currentPiece: any;
  currentX: number;
  currentY: number;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  graphics?: Phaser.GameObjects.Graphics;
  miniGraphics?: Phaser.GameObjects.Graphics;
  scoreText?: Phaser.GameObjects.Text;
  dropCounter: number;
  lastTime: number;
}

export class TetrisGame extends BaseGame {
  private scene?: Phaser.Scene;
  private tetrisPlayers: Map<string, TetrisPlayer> = new Map();
  private playersList: TetrisPlayer[] = [];

  constructor(containerId: string) {
    const config: GameConfig = {
      name: 'Tetris Battle',
      description: 'Tetris multijoueur compétitif - Meilleur score gagne!',
      minPlayers: 1,
      maxPlayers: 4
    };
    super(containerId, config);
  }

  createPhaserConfig(): Phaser.Types.Core.GameConfig {
    const self = this;

    return {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: 1200,
      height: 700,
      backgroundColor: '#1a1a2e',
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
    scene.add.text(600, 20, 'TETRIS BATTLE', {
      fontSize: '48px',
      color: '#00F0F0',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(600, 680, 'Joystick: ← → déplacer | ↓ descendre vite | A = rotation', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.players.forEach((player) => {
      this.initializeTetrisPlayer(scene, player);
    });

    this.layoutPlayers();
  }

  private updateScene(scene: Phaser.Scene, time: number): void {
    const deltaTime = time;

    this.playersList.forEach(player => {
      if (player.gameOver) return;

      const dropInterval = Math.max(100, 1000 - (player.level * 100));

      if (deltaTime - player.lastTime > dropInterval) {
        player.lastTime = deltaTime;
        this.movePieceDown(player);
      }

      this.drawBoard(player);
    });
  }

  private initializeTetrisPlayer(scene: Phaser.Scene, playerData: PlayerData): void {
    const tetrisPlayer: TetrisPlayer = {
      ...playerData,
      board: this.createEmptyBoard(),
      currentPiece: null,
      currentX: 0,
      currentY: 0,
      score: 0,
      lines: 0,
      level: 1,
      gameOver: false,
      dropCounter: 0,
      lastTime: 0
    };

    tetrisPlayer.graphics = scene.add.graphics();

    this.tetrisPlayers.set(playerData.id, tetrisPlayer);
    this.playersList.push(tetrisPlayer);

    this.spawnNewPiece(tetrisPlayer);
  }

  private layoutPlayers(): void {
    const count = this.playersList.length;

    if (count === 1) {
      this.setupMainBoard(this.playersList[0], 600, 350);
    } else if (count === 2) {
      this.setupMainBoard(this.playersList[0], 400, 350);
      this.setupMainBoard(this.playersList[1], 800, 350);
    } else if (count === 3) {
      this.setupMainBoard(this.playersList[0], 600, 350);
      this.setupMiniBoard(this.playersList[1], 200, 200);
      this.setupMiniBoard(this.playersList[2], 1000, 200);
    } else if (count === 4) {
      this.setupMainBoard(this.playersList[0], 600, 350);
      this.setupMiniBoard(this.playersList[1], 150, 150);
      this.setupMiniBoard(this.playersList[2], 1050, 150);
      this.setupMiniBoard(this.playersList[3], 150, 550);
    }
  }

  private setupMainBoard(player: TetrisPlayer, x: number, y: number): void {
    if (!this.scene) return;

    player.graphics?.setPosition(x - (BOARD_WIDTH * BLOCK_SIZE) / 2, y - (BOARD_HEIGHT * BLOCK_SIZE) / 2);

    this.scene.add.text(x, y - (BOARD_HEIGHT * BLOCK_SIZE) / 2 - 30, player.username, {
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    player.scoreText = this.scene.add.text(x, y + (BOARD_HEIGHT * BLOCK_SIZE) / 2 + 20,
      `Score: 0 | Lignes: 0 | Niveau: 1`, {
      fontSize: '16px',
      color: '#00F0F0'
    }).setOrigin(0.5);
  }

  private setupMiniBoard(player: TetrisPlayer, x: number, y: number): void {
    if (!this.scene) return;

    player.miniGraphics = this.scene.add.graphics();
    player.miniGraphics.setPosition(x, y);

    this.scene.add.text(x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2, y - 20, player.username, {
      fontSize: '14px',
      color: '#FFFFFF'
    }).setOrigin(0.5);

    player.scoreText = this.scene.add.text(x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2,
      y + (BOARD_HEIGHT * MINI_BLOCK_SIZE) + 10, `Score: 0`, {
      fontSize: '12px',
      color: '#00F0F0'
    }).setOrigin(0.5);
  }

  private createEmptyBoard(): number[][] {
    return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
  }

  private spawnNewPiece(player: TetrisPlayer): void {
    const pieces = Object.keys(TETROMINOS);
    const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
    const tetromino = TETROMINOS[randomPiece as keyof typeof TETROMINOS];

    player.currentPiece = {
      type: randomPiece,
      shape: JSON.parse(JSON.stringify(tetromino.shape)),
      color: tetromino.color,
      rotation: 0
    };

    player.currentX = Math.floor(BOARD_WIDTH / 2) - Math.floor(player.currentPiece.shape[0].length / 2);
    player.currentY = 0;

    if (this.checkCollision(player, player.currentX, player.currentY)) {
      player.gameOver = true;
      this.showGameOver(player);
    }
  }

  private checkCollision(player: TetrisPlayer, x: number, y: number, shape?: number[][]): boolean {
    const pieceShape = shape || player.currentPiece.shape;

    for (let row = 0; row < pieceShape.length; row++) {
      for (let col = 0; col < pieceShape[row].length; col++) {
        if (pieceShape[row][col]) {
          const newX = x + col;
          const newY = y + row;

          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return true;
          }

          if (newY >= 0 && player.board[newY][newX]) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private movePieceDown(player: TetrisPlayer): void {
    if (player.gameOver) return;

    if (!this.checkCollision(player, player.currentX, player.currentY + 1)) {
      player.currentY++;
    } else {
      this.lockPiece(player);
      const linesCleared = this.clearLines(player);
      this.updateScore(player, linesCleared);
      this.spawnNewPiece(player);
    }
  }

  private lockPiece(player: TetrisPlayer): void {
    const shape = player.currentPiece.shape;
    const color = player.currentPiece.color;

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const boardY = player.currentY + row;
          const boardX = player.currentX + col;

          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            player.board[boardY][boardX] = color;
          }
        }
      }
    }
  }

  private clearLines(player: TetrisPlayer): number {
    let linesCleared = 0;

    for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
      if (player.board[row].every(cell => cell !== 0)) {
        player.board.splice(row, 1);
        player.board.unshift(Array(BOARD_WIDTH).fill(0));
        linesCleared++;
        row++;
      }
    }

    return linesCleared;
  }

  private updateScore(player: TetrisPlayer, linesCleared: number): void {
    if (linesCleared === 0) return;

    player.lines += linesCleared;

    const basePoints = [0, 100, 300, 500, 800];
    player.score += basePoints[linesCleared] * player.level;

    const newLevel = Math.floor(player.lines / 10) + 1;
    if (newLevel > player.level) {
      player.level = newLevel;
    }

    if (player.scoreText) {
      player.scoreText.setText(`Score: ${player.score} | Lignes: ${player.lines} | Niveau: ${player.level}`);
    }
  }

  private rotatePiece(player: TetrisPlayer): void {
    if (player.gameOver) return;

    const shape = player.currentPiece.shape;
    const rotated: number[][] = [];

    for (let col = 0; col < shape[0].length; col++) {
      const newRow: number[] = [];
      for (let row = shape.length - 1; row >= 0; row--) {
        newRow.push(shape[row][col]);
      }
      rotated.push(newRow);
    }

    if (!this.checkCollision(player, player.currentX, player.currentY, rotated)) {
      player.currentPiece.shape = rotated;
    }
  }

  private drawBoard(player: TetrisPlayer): void {
    const graphics = player.miniGraphics || player.graphics;
    if (!graphics) return;

    const blockSize = player.miniGraphics ? MINI_BLOCK_SIZE : BLOCK_SIZE;

    graphics.clear();

    graphics.fillStyle(0x0a0a1e, 1);
    graphics.fillRect(0, 0, BOARD_WIDTH * blockSize, BOARD_HEIGHT * blockSize);

    graphics.lineStyle(1, 0x333344, 0.5);
    for (let i = 0; i <= BOARD_HEIGHT; i++) {
      graphics.lineBetween(0, i * blockSize, BOARD_WIDTH * blockSize, i * blockSize);
    }
    for (let i = 0; i <= BOARD_WIDTH; i++) {
      graphics.lineBetween(i * blockSize, 0, i * blockSize, BOARD_HEIGHT * blockSize);
    }

    for (let row = 0; row < BOARD_HEIGHT; row++) {
      for (let col = 0; col < BOARD_WIDTH; col++) {
        if (player.board[row][col]) {
          this.drawBlock(graphics, col, row, player.board[row][col], blockSize);
        }
      }
    }

    if (player.currentPiece && !player.gameOver) {
      const shape = player.currentPiece.shape;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const drawX = player.currentX + col;
            const drawY = player.currentY + row;
            if (drawY >= 0) {
              this.drawBlock(graphics, drawX, drawY, player.currentPiece.color, blockSize);
            }
          }
        }
      }
    }
  }

  private drawBlock(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number, size: number): void {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

    graphics.fillStyle(0xFFFFFF, 0.3);
    graphics.fillRect(x * size + 2, y * size + 2, size - 4, 2);
    graphics.fillRect(x * size + 2, y * size + 2, 2, size - 4);

    graphics.fillStyle(0x000000, 0.3);
    graphics.fillRect(x * size + 2, y * size + size - 4, size - 4, 2);
    graphics.fillRect(x * size + size - 4, y * size + 2, 2, size - 4);
  }

  private showGameOver(player: TetrisPlayer): void {
    if (!this.scene) return;

    const x = player.graphics ? player.graphics.x + (BOARD_WIDTH * BLOCK_SIZE) / 2 :
                (player.miniGraphics?.x || 0) + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2;
    const y = player.graphics ? player.graphics.y + (BOARD_HEIGHT * BLOCK_SIZE) / 2 :
                (player.miniGraphics?.y || 0) + (BOARD_HEIGHT * MINI_BLOCK_SIZE) / 2;

    this.scene.add.text(x, y, 'GAME OVER', {
      fontSize: '32px',
      color: '#FF0000',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    const player = this.tetrisPlayers.get(playerId);
    if (!player || player.gameOver) return;

    if (action === 'joystick' && data) {
      const joystickX = data.joystickX || 0;
      const joystickY = data.joystickY || 0;

      if (joystickX < -0.5) {
        if (!this.checkCollision(player, player.currentX - 1, player.currentY)) {
          player.currentX--;
        }
      } else if (joystickX > 0.5) {
        if (!this.checkCollision(player, player.currentX + 1, player.currentY)) {
          player.currentX++;
        }
      }

      if (joystickY > 0.7) {
        this.movePieceDown(player);
      }

      return;
    }

    if (action === 'action') {
      this.rotatePiece(player);
    }

    switch (action) {
      case 'left':
        if (!this.checkCollision(player, player.currentX - 1, player.currentY)) {
          player.currentX--;
        }
        break;
      case 'right':
        if (!this.checkCollision(player, player.currentX + 1, player.currentY)) {
          player.currentX++;
        }
        break;
      case 'down':
        this.movePieceDown(player);
        break;
    }
  }

  protected onPlayerAdded(player: PlayerData): void {
    console.log('Player added to Tetris:', player.username);

    if (this.scene) {
      this.initializeTetrisPlayer(this.scene, player);
      this.layoutPlayers();
    }
  }

  protected onPlayerRemoved(player: PlayerData): void {
    console.log('Player removed from Tetris:', player.username);

    const tetrisPlayer = this.tetrisPlayers.get(player.id);
    if (tetrisPlayer) {
      tetrisPlayer.graphics?.destroy();
      tetrisPlayer.miniGraphics?.destroy();
      tetrisPlayer.scoreText?.destroy();
      this.tetrisPlayers.delete(player.id);
      this.playersList = this.playersList.filter(p => p.id !== player.id);
    }
  }

  destroy(): void {
    this.tetrisPlayers.forEach(player => {
      player.graphics?.destroy();
      player.miniGraphics?.destroy();
      player.scoreText?.destroy();
    });
    this.tetrisPlayers.clear();
    this.playersList = [];
    super.destroy();
  }
}
