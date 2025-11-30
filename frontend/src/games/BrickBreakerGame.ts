import Phaser from 'phaser';
import { BaseGame, PlayerData } from './BaseGame';

const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 25;
const PADDLE_SPEED = 400;
const BALL_RADIUS = 10;
const BRICK_WIDTH = 55;
const BRICK_HEIGHT = 25;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_PADDING = 5;
const BRICK_OFFSET_TOP = 100;
const BRICK_OFFSET_LEFT = 10;
const INITIAL_BALL_SPEED = 250;
const SPEED_INCREMENT = 20;

interface BrickBreakerPlayer extends PlayerData {
  graphics?: Phaser.GameObjects.Graphics;
  statsText?: Phaser.GameObjects.Text;
  paddleX?: number;
  paddleVelocity?: number;
  ballX?: number;
  ballY?: number;
  ballVelocityX?: number;
  ballVelocityY?: number;
  lives?: number;
  score?: number;
  level?: number;
  bricks?: boolean[][];
  ballSpeed?: number;
  isGameOver?: boolean;
  boardX?: number;
  boardY?: number;
}

export default class BrickBreakerGame extends BaseGame {
  private playersList: BrickBreakerPlayer[] = [];
  private scene?: Phaser.Scene;
  private localPlayerId?: string;
  private gameStartTime: number = 0;

  constructor(containerId: string) {
    super(containerId, {
      name: 'Brick Breaker',
      description: 'multi-player brick breaker game',
      minPlayers: 1,
      maxPlayers: 4,
    });
  }

  start(): void {
    this.gameStartTime = Date.now();
    super.start();
  }

  public createPhaserConfig(): Phaser.Types.Core.GameConfig {
    const self = this;
    return {
      type: Phaser.AUTO,
      width: 1200,
      height: 900,
      parent: this.containerId,
      backgroundColor: '#1a1a2e',
      scene: {
        create: function(this: Phaser.Scene) {
          self.scene = this;
          self.setupScene(this);
        },
        update: function(this: Phaser.Scene, time: number, delta: number) {
          self.updateGame(time, delta);
        }
      },
    };
  }

  private setupScene(scene: Phaser.Scene): void {
    scene.add.text(600, 40, 'BRICK BREAKER', {
      fontSize: '48px',
      color: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const panelX = 10;
    const panelY = 250;
    const panelWidth = 220;
    const panelHeight = 300;
    const instructionsX = panelX + panelWidth / 2;

    const instructionsBg = scene.add.graphics();
    instructionsBg.fillStyle(0x000000, 0.8);
    instructionsBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
    instructionsBg.lineStyle(3, 0x00ff00, 1);
    instructionsBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);

    scene.add.text(instructionsX, panelY + 30, '🕹️ CONTROLS', {
      fontSize: '22px',
      color: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 75, 'Joystick', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 110, 'Move the paddle', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 135, '← left | right →', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 180, '🎯 OBJECTIVE', {
      fontSize: '18px',
      color: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 220, 'Break all\nthe bricks!', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      fontStyle: 'bold',
      lineSpacing: 4
    }).setOrigin(0.5);

    scene.add.text(instructionsX, panelY + 265, 'Don\'t let the\nball fall!', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      fontStyle: 'bold',
      lineSpacing: 4
    }).setOrigin(0.5);

    this.playersList.forEach(player => {
      if (!player.graphics) {
        player.graphics = scene.add.graphics();
      }
      if (!player.statsText && player.boardX && player.boardY) {
        player.statsText = scene.add.text(
          player.boardX + GAME_WIDTH / 2,
          player.boardY - 40,
          this.getStatsText(player),
          {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 15, y: 8 }
          }
        ).setOrigin(0.5);
      }
    });
  }

  private getStatsText(player: BrickBreakerPlayer): string {
    const hearts = '❤️'.repeat(player.lives || 0);
    return `${player.username} | ${hearts} | Score: ${player.score} | Level: ${player.level}`;
  }

  public addPlayer(player: PlayerData): void {
    const brickPlayer: BrickBreakerPlayer = {
      ...player,
      paddleX: GAME_WIDTH / 2,
      paddleVelocity: 0,
      ballX: GAME_WIDTH / 2,
      ballY: GAME_HEIGHT - 100,
      ballVelocityX: INITIAL_BALL_SPEED,
      ballVelocityY: -INITIAL_BALL_SPEED,
      lives: 3,
      score: 0,
      level: 1,
      ballSpeed: INITIAL_BALL_SPEED,
      isGameOver: false,
      graphics: this.scene ? this.scene.add.graphics() : undefined,
    };

    brickPlayer.bricks = this.generateBricks();

    this.players.set(player.id, brickPlayer);
    this.playersList.push(brickPlayer);

    this.layoutPlayers();
  }

  public setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
    console.log('Local player ID set to:', playerId);
  }

  protected onPlayerAdded(player: PlayerData): void {

  }

  protected onPlayerRemoved(player: PlayerData): void {

  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId) as BrickBreakerPlayer;
    if (player?.graphics) {
      player.graphics.destroy();
    }
    this.players.delete(playerId);
    this.playersList = this.playersList.filter((p) => p.id !== playerId);
    this.layoutPlayers();
  }

  public handlePlayerInput(playerId: string, action: string, data?: any): void {
    const player = this.players.get(playerId) as BrickBreakerPlayer;
    if (!player || player.isGameOver) return;

    if (action === 'joystick' && data) {
      const joystickX = data.joystickX || 0;
      player.paddleVelocity = joystickX;
    }
  }

  private generateBricks(): boolean[][] {
    const bricks: boolean[][] = [];
    for (let row = 0; row < BRICK_ROWS; row++) {
      bricks[row] = [];
      for (let col = 0; col < BRICK_COLS; col++) {
        bricks[row][col] = true;
      }
    }
    return bricks;
  }

  private layoutPlayers(): void {
    this.playersList.forEach(player => {
      player.boardX = 300;
      player.boardY = 120;
    });
  }

  private updateGame(time: number, delta: number): void {
    const deltaSeconds = delta / 1000;
    this.playersList.forEach((player) => {
      if (!player.isGameOver) {
        this.updatePlayer(player, deltaSeconds);
      }
    });
    this.renderGame();
  }

  private updatePlayer(player: BrickBreakerPlayer, deltaSeconds: number): void {
    if (player.paddleVelocity !== 0) {
      const movement = player.paddleVelocity! * PADDLE_SPEED * deltaSeconds;
      player.paddleX! += movement;
      player.paddleX = Math.max(PADDLE_WIDTH / 2, Math.min(GAME_WIDTH - PADDLE_WIDTH / 2, player.paddleX!));
    }

    player.ballX! += player.ballVelocityX! * deltaSeconds;
    player.ballY! += player.ballVelocityY! * deltaSeconds;

    if (player.ballX! - BALL_RADIUS < 0 || player.ballX! + BALL_RADIUS > GAME_WIDTH) {
      player.ballVelocityX = -player.ballVelocityX!;
      player.ballX = Math.max(BALL_RADIUS, Math.min(GAME_WIDTH - BALL_RADIUS, player.ballX!));
    }

    if (player.ballY! - BALL_RADIUS < 0) {
      player.ballVelocityY = -player.ballVelocityY!;
      player.ballY = BALL_RADIUS;
    }

    const paddleTop = GAME_HEIGHT - 30;
    const paddleBottom = GAME_HEIGHT - 30 + PADDLE_HEIGHT;

    if (
      player.ballY! + BALL_RADIUS >= paddleTop &&
      player.ballY! - BALL_RADIUS <= paddleBottom &&
      player.ballX! >= player.paddleX! - PADDLE_WIDTH / 2 &&
      player.ballX! <= player.paddleX! + PADDLE_WIDTH / 2
    ) {
      player.ballVelocityY = -Math.abs(player.ballVelocityY!);
      player.ballY = paddleTop - BALL_RADIUS;
      const hitPos = (player.ballX! - player.paddleX!) / (PADDLE_WIDTH / 2);
      player.ballVelocityX = hitPos * player.ballSpeed! * 0.8;
    }

    this.checkBrickCollision(player);

    if (player.ballY! > GAME_HEIGHT + BALL_RADIUS) {
      player.lives!--;
      if (player.lives! <= 0) {
        player.isGameOver = true;
        if (player.id === this.localPlayerId) {
          this.sendGameResult(player.score || 0);
        }
      } else {
        player.ballX = GAME_WIDTH / 2;
        player.ballY = GAME_HEIGHT / 2;
        player.ballVelocityX = player.ballSpeed!;
        player.ballVelocityY = -player.ballSpeed!;
      }
    }

    if (this.allBricksDestroyed(player)) {
      this.nextLevel(player);
    }
  }

  private checkBrickCollision(player: BrickBreakerPlayer): void {
    const ballLeft = player.ballX! - BALL_RADIUS;
    const ballRight = player.ballX! + BALL_RADIUS;
    const ballTop = player.ballY! - BALL_RADIUS;
    const ballBottom = player.ballY! + BALL_RADIUS;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (player.bricks![row][col]) {
          const brickX = BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING);
          const brickY = BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING);
          const brickRight = brickX + BRICK_WIDTH;
          const brickBottom = brickY + BRICK_HEIGHT;

          if (
            ballRight > brickX &&
            ballLeft < brickRight &&
            ballBottom > brickY &&
            ballTop < brickBottom
          ) {
            player.bricks![row][col] = false;
            player.score! += 10;

            const ballCenterX = player.ballX!;
            const ballCenterY = player.ballY!;
            const brickCenterX = brickX + BRICK_WIDTH / 2;
            const brickCenterY = brickY + BRICK_HEIGHT / 2;

            const distLeft = Math.abs(ballRight - brickX);
            const distRight = Math.abs(ballLeft - brickRight);
            const distTop = Math.abs(ballBottom - brickY);
            const distBottom = Math.abs(ballTop - brickBottom);

            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            if (minDist === distTop || minDist === distBottom) {
              player.ballVelocityY = -player.ballVelocityY!;
              if (minDist === distTop) {
                player.ballY = brickY - BALL_RADIUS - 1;
              } else {
                player.ballY = brickBottom + BALL_RADIUS + 1;
              }
            } else {
              player.ballVelocityX = -player.ballVelocityX!;
              if (minDist === distLeft) {
                player.ballX = brickX - BALL_RADIUS - 1;
              } else {
                player.ballX = brickRight + BALL_RADIUS + 1;
              }
            }

            return;
          }
        }
      }
    }
  }

  private allBricksDestroyed(player: BrickBreakerPlayer): boolean {
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (player.bricks![row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  private nextLevel(player: BrickBreakerPlayer): void {
    player.level!++;
    player.ballSpeed! += SPEED_INCREMENT;
    player.bricks = this.generateBricks();

    player.ballX = GAME_WIDTH / 2;
    player.ballY = GAME_HEIGHT - 100;
    player.ballVelocityX = player.ballSpeed!;
    player.ballVelocityY = -player.ballSpeed!;
  }

  private renderGame(): void {
    if (this.localPlayerId) {
      const localPlayer = this.players.get(this.localPlayerId) as BrickBreakerPlayer;
      if (localPlayer) {
        this.renderPlayer(localPlayer);
      }
    }
  }

  private renderPlayer(player: BrickBreakerPlayer): void {
    if (!player.graphics) return;

    const graphics = player.graphics;
    graphics.clear();

    const offsetX = player.boardX!;
    const offsetY = player.boardY!;

    if (player.statsText) {
      player.statsText.setText(this.getStatsText(player));
    }

    graphics.lineStyle(3, 0x00ff00, 1);
    graphics.strokeRect(offsetX, offsetY, GAME_WIDTH, GAME_HEIGHT);

    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(
      offsetX + player.paddleX! - PADDLE_WIDTH / 2,
      offsetY + GAME_HEIGHT - 30,
      PADDLE_WIDTH,
      PADDLE_HEIGHT
    );

    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(offsetX + player.ballX!, offsetY + player.ballY!, BALL_RADIUS);

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        if (player.bricks![row][col]) {
          const brickX = offsetX + BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING);
          const brickY = offsetY + BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING);

          const colors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff];
          graphics.fillStyle(colors[row % colors.length], 1);
          graphics.fillRect(brickX, brickY, BRICK_WIDTH, BRICK_HEIGHT);

          graphics.lineStyle(1, 0x000000, 0.5);
          graphics.strokeRect(brickX, brickY, BRICK_WIDTH, BRICK_HEIGHT);
        }
      }
    }

    if (player.isGameOver) {
      graphics.fillStyle(0x000000, 0.7);
      graphics.fillRect(offsetX, offsetY + GAME_HEIGHT / 2 - 50, GAME_WIDTH, 100);

      if (this.scene) {
        const gameOverText = this.scene.add.text(
          offsetX + GAME_WIDTH / 2,
          offsetY + GAME_HEIGHT / 2,
          'GAME OVER',
          {
            fontSize: '48px',
            color: '#ff0000',
            fontStyle: 'bold'
          }
        ).setOrigin(0.5);

        this.scene.time.delayedCall(3000, () => {
          gameOverText.destroy();
        });
      }
    }
  }

  public cleanup(): void {
    this.playersList.forEach((player) => {
      if (player.graphics) {
        player.graphics.destroy();
      }
      if (player.statsText) {
        player.statsText.destroy();
      }
    });
    this.players.clear();
    this.playersList = [];
  }

  private async sendGameResult(score: number): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ No token found, skipping game result save');
      return;
    }

    const duration = Math.floor((Date.now() - this.gameStartTime) / 1000);

    const result = score > 500 ? 'win' : 'loss';

    const gameData = {
      gameName: 'Brick Breaker',
      result,
      score,
      duration
    };

    console.log('🎮 GAME OVER - Brick Breaker - Sending result to server:');
    console.log('  Game:', gameData.gameName);
    console.log('  Result:', gameData.result);
    console.log('  Score:', gameData.score);
    console.log('  Duration:', gameData.duration, 'seconds');

    try {
      const response = await fetch('/api/games/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(gameData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to save game result:', errorText);
        return;
      }

      const result = await response.json();
      console.log('✅ Game result saved successfully!');
      console.log('📊 Updated stats:', result.stats);
      console.log('  Total games:', result.stats.total_games);
      console.log('  Total wins:', result.stats.total_wins);
      console.log('  Total playtime:', result.stats.total_playtime, 'seconds');
      console.log('  Current streak:', result.stats.current_win_streak);
      console.log('  Best streak:', result.stats.best_win_streak);
    } catch (error) {
      console.error('Error sending game result:', error);
    }
  }
}
