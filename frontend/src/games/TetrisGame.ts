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
const MINI_BLOCK_SIZE = 10;

interface TetrisPlayer extends PlayerData {
  board: number[][];
  currentPiece: any;
  nextPiece: any;
  currentX: number;
  currentY: number;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  graphics?: Phaser.GameObjects.Graphics;
  miniGraphics?: Phaser.GameObjects.Graphics;
  nextPieceGraphics?: Phaser.GameObjects.Graphics;
  scoreText?: Phaser.GameObjects.Text;
  statsText?: Phaser.GameObjects.Text;
  dropCounter: number;
  lastTime: number;
  isMainPlayer?: boolean;
}

export class TetrisGame extends BaseGame {
  private scene?: Phaser.Scene;
  private tetrisPlayers: Map<string, TetrisPlayer> = new Map();
  private playersList: TetrisPlayer[] = [];
  private localPlayerId: string | null = null;

  constructor(containerId: string) {
    const config: GameConfig = {
      name: 'Tetris Battle',
      description: 'Multiplayer competitive Tetris game',
      minPlayers: 1,
      maxPlayers: 4
    };
    super(containerId, config);
  }

  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
    console.log('TetrisGame: Local player set to', playerId);

    if (this.scene && this.playersList.length > 0) {
      this.layoutPlayers();
    }
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

      if (player.isMainPlayer) {
        this.drawNextPiece(player);
        this.updateStatsText(player);
      }
    });
  }

  private updateStatsText(player: TetrisPlayer): void {
    if (player.statsText) {
      player.statsText.setText(`Score: ${player.score} | Level: ${player.level}`);
    }
  }

  private initializeTetrisPlayer(scene: Phaser.Scene, playerData: PlayerData): void {
    const tetrisPlayer: TetrisPlayer = {
      ...playerData,
      board: this.createEmptyBoard(),
      currentPiece: null,
      nextPiece: null,
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
    tetrisPlayer.nextPieceGraphics = scene.add.graphics();

    this.tetrisPlayers.set(playerData.id, tetrisPlayer);
    this.playersList.push(tetrisPlayer);

    this.generateNextPiece(tetrisPlayer);
    this.spawnNewPiece(tetrisPlayer);
  }

  private layoutPlayers(): void {
    if (!this.localPlayerId) {
      console.warn('TetrisGame: Cannot layout players without localPlayerId');
      return;
    }

    const localPlayer = this.playersList.find(p => p.id === this.localPlayerId);
    if (!localPlayer) {
      console.warn('TetrisGame: Local player not found in players list');
      return;
    }

    this.playersList.forEach(p => {
      p.isMainPlayer = (p.id === this.localPlayerId);
    });

    this.setupMainBoard(localPlayer, 700, 350, true);

    const otherPlayers = this.playersList.filter(p => p.id !== this.localPlayerId);
    otherPlayers.forEach((player, index) => {
      const yPosition = 150 + (index * 200);
      this.setupMiniBoard(player, 150, yPosition);
    });
  }

  private setupMainBoard(player: TetrisPlayer, x: number, y: number, showPreview: boolean = false): void {
    if (!this.scene) return;

    player.graphics?.setPosition(x - (BOARD_WIDTH * BLOCK_SIZE) / 2, y - (BOARD_HEIGHT * BLOCK_SIZE) / 2);

    this.scene.add.text(x, y - (BOARD_HEIGHT * BLOCK_SIZE) / 2 - 30, player.username, {
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    player.scoreText = this.scene.add.text(x, y + (BOARD_HEIGHT * BLOCK_SIZE) / 2 + 20,
      `Lines: ${player.lines}`, {
      fontSize: '18px',
      color: '#00F0F0',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (showPreview) {
      const previewX = x + (BOARD_WIDTH * BLOCK_SIZE) / 2 + 40;
      const previewY = y - (BOARD_HEIGHT * BLOCK_SIZE) / 2 + 40;

      this.scene.add.text(previewX + 45, previewY - 20, 'Next', {
        fontSize: '18px',
        color: '#00F0F0',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.scene.add.rectangle(previewX + 45, previewY + 35, 90, 90, 0x0a0a1e)
        .setStrokeStyle(2, 0x00F0F0, 0.8);

      player.nextPieceGraphics?.setPosition(0, 0);
      player.nextPieceGraphics?.setDepth(10);

      const helpPanelWidth = 260;
      const helpPanelHeight = 300;
      const helpPanelX = previewX + 10 - 20;
      const helpPanelY = previewY + 160;
      const helpPanelCenterX = helpPanelX + helpPanelWidth / 2;

      player.statsText = this.scene.add.text(helpPanelCenterX, previewY + 110,
        `Score: ${player.score} | Level: ${player.level}`, {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#000000',
        padding: { x: 15, y: 8 }
      }).setOrigin(0.5);

      const helpPanel = this.scene.add.graphics();
      helpPanel.fillStyle(0x1a1a2e, 0.95);
      helpPanel.fillRoundedRect(helpPanelX, helpPanelY, helpPanelWidth, helpPanelHeight, 8);
      helpPanel.lineStyle(2, 0x00F0F0, 0.8);
      helpPanel.strokeRoundedRect(helpPanelX, helpPanelY, helpPanelWidth, helpPanelHeight, 8);

      this.scene.add.text(helpPanelCenterX, helpPanelY + 25, '🕹️ CONTROLS', {
        fontSize: '22px',
        color: '#00F0F0',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const controlsText = [
        'LEFT/RIGHT   Move piece',
        'DOWN   Fast drop',
        'A   Rotate piece',
      ];

      controlsText.forEach((line, index) => {
        this.scene!.add.text(helpPanelCenterX, helpPanelY + 65 + index * 30, line, {
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5);
      });

      this.scene.add.text(helpPanelCenterX, helpPanelY + 210, '🎯 OBJECTIVE', {
        fontSize: '22px',
        color: '#00F0F0',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.scene.add.text(helpPanelCenterX, helpPanelY + 250, 'Complete lines to score\nHigher levels = faster!', {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5);

      (player as any).previewX = previewX;
      (player as any).previewY = previewY;
    }
  }

  private setupMiniBoard(player: TetrisPlayer, x: number, y: number): void {
    if (!this.scene) return;

    player.miniGraphics = this.scene.add.graphics();
    player.miniGraphics.setPosition(x, y);

    const borderPadding = 5;
    this.scene.add.rectangle(
      x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2,
      y + (BOARD_HEIGHT * MINI_BLOCK_SIZE) / 2,
      BOARD_WIDTH * MINI_BLOCK_SIZE + borderPadding * 2,
      BOARD_HEIGHT * MINI_BLOCK_SIZE + borderPadding * 2,
      0x000000,
      0
    ).setStrokeStyle(2, 0x555566, 0.8);

    this.scene.add.text(x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2, y - 25, player.username, {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    player.scoreText = this.scene.add.text(x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2,
      y + (BOARD_HEIGHT * MINI_BLOCK_SIZE) + 15, `Score: 0`, {
      fontSize: '12px',
      color: '#00F0F0'
    }).setOrigin(0.5);
  }

  private createEmptyBoard(): number[][] {
    return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
  }

  private generateNextPiece(player: TetrisPlayer): void {
    const pieces = Object.keys(TETROMINOS);
    const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
    const tetromino = TETROMINOS[randomPiece as keyof typeof TETROMINOS];

    player.nextPiece = {
      type: randomPiece,
      shape: JSON.parse(JSON.stringify(tetromino.shape)),
      color: tetromino.color,
      rotation: 0
    };
  }

  private spawnNewPiece(player: TetrisPlayer): void {
    if (player.nextPiece) {
      player.currentPiece = player.nextPiece;
    } else {
      const pieces = Object.keys(TETROMINOS);
      const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
      const tetromino = TETROMINOS[randomPiece as keyof typeof TETROMINOS];

      player.currentPiece = {
        type: randomPiece,
        shape: JSON.parse(JSON.stringify(tetromino.shape)),
        color: tetromino.color,
        rotation: 0
      };
    }

    this.generateNextPiece(player);

    player.currentX = Math.floor(BOARD_WIDTH / 2) - Math.floor(player.currentPiece.shape[0].length / 2);
    player.currentY = -1;

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

          if (newX < 0 || newX >= BOARD_WIDTH) {
            return true;
          }

          if (newY >= BOARD_HEIGHT) {
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

  private drawNextPiece(player: TetrisPlayer): void {
    const graphics = player.nextPieceGraphics;

    if (!(player as any).hasLoggedDrawNextPiece) {
      (player as any).hasLoggedDrawNextPiece = true;
    }

    if (!graphics || !player.nextPiece) {
      console.error('drawNextPiece: EARLY EXIT - missing graphics or nextPiece', {
        hasGraphics: !!graphics,
        hasNextPiece: !!player.nextPiece,
        username: player.username
      });
      return;
    }

    const previewX = (player as any).previewX || 0;
    const previewY = (player as any).previewY || 0;

    if (previewX === 0 && previewY === 0) {
      console.error('drawNextPiece: EARLY EXIT - no preview position set for', player.username);
      return;
    }

    graphics.clear();

    const shape = player.nextPiece.shape;
    const color = player.nextPiece.color;
    const blockSize = 20;

    const frameLeft = previewX + 45 - 45;
    const frameTop = previewY + 35 - 45;

    const pieceWidth = shape[0].length * blockSize;
    const pieceHeight = shape.length * blockSize;
    const offsetX = frameLeft + (90 - pieceWidth) / 2;
    const offsetY = frameTop + (90 - pieceHeight) / 2;

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const x = offsetX + col * blockSize;
          const y = offsetY + row * blockSize;

          graphics.fillStyle(color, 1);
          graphics.fillRect(x + 1, y + 1, blockSize - 2, blockSize - 2);

          graphics.fillStyle(0xFFFFFF, 0.3);
          graphics.fillRect(x + 2, y + 2, blockSize - 4, 2);
          graphics.fillRect(x + 2, y + 2, 2, blockSize - 4);

          graphics.fillStyle(0x000000, 0.3);
          graphics.fillRect(x + 2, y + blockSize - 4, blockSize - 4, 2);
          graphics.fillRect(x + blockSize - 4, y + 2, 2, blockSize - 4);
        }
      }
    }
  }

  private showGameOver(player: TetrisPlayer): void {
    if (!this.scene) return;

    let centerX, centerY;

    if (player.graphics) {
      centerX = player.graphics.x + (BOARD_WIDTH * BLOCK_SIZE) / 2;
      centerY = player.graphics.y + (BOARD_HEIGHT * BLOCK_SIZE) / 2;
    } else if (player.miniGraphics) {
      centerX = player.miniGraphics.x + (BOARD_WIDTH * MINI_BLOCK_SIZE) / 2;
      centerY = player.miniGraphics.y + (BOARD_HEIGHT * MINI_BLOCK_SIZE) / 2;
    } else {
      return;
    }

    this.scene.add.text(centerX, centerY, 'GAME OVER', {
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
      tetrisPlayer.nextPieceGraphics?.destroy();
      tetrisPlayer.scoreText?.destroy();
      this.tetrisPlayers.delete(player.id);
      this.playersList = this.playersList.filter(p => p.id !== player.id);
    }
  }

  destroy(): void {
    this.tetrisPlayers.forEach(player => {
      player.graphics?.destroy();
      player.miniGraphics?.destroy();
      player.nextPieceGraphics?.destroy();
      player.scoreText?.destroy();
    });
    this.tetrisPlayers.clear();
    this.playersList = [];
    super.destroy();
  }
}
