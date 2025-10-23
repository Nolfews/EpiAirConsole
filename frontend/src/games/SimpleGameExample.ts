import Phaser from 'phaser';
import { BaseGame, PlayerData, GameConfig } from './BaseGame';

export class SimpleGameExample extends BaseGame {
  private playerSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private playerColors = [0x00ff00, 0xff0000, 0x0000ff, 0xffff00];
  private currentScene?: Phaser.Scene;

  constructor(containerId: string) {
    const config: GameConfig = {
      name: 'Simple Example Game',
      description: 'A simple game with moving circles',
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
      width: 800,
      height: 600,
      backgroundColor: '#2d2d2d',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: {
        create: function(this: Phaser.Scene) {
          self.currentScene = this;
          self.setupScene(this);
        },
        update: function(this: Phaser.Scene) {
          self.updateScene(this);
        }
      }
    };
  }

  private setupScene(scene: Phaser.Scene): void {
    scene.add.text(400, 30, this.gameConfig.name, {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    scene.add.text(400, 570, 'Use mobile controller to move your circle', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.players.forEach((player) => {
      this.createPlayerSprite(scene, player);
    });
  }

  private updateScene(scene: Phaser.Scene): void {
  }

  private createPlayerSprite(scene: Phaser.Scene, player: PlayerData): void {
    const playerIndex = this.players.size - 1;
    const color = this.playerColors[playerIndex % this.playerColors.length];

    const x = 200 + (playerIndex * 150);
    const y = 300;

    const circle = scene.add.circle(x, y, 30, color);
    scene.physics.add.existing(circle);

    const body = circle.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0.2);
    body.setDamping(true);
    body.setDrag(0.9);

    const text = scene.add.text(x, y - 50, player.username, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5);

    this.playerSprites.set(player.id, circle);

    scene.events.on('update', () => {
      text.setPosition(circle.x, circle.y - 50);
    });
  }

  protected onPlayerAdded(player: PlayerData): void {
    console.log('Player added to game:', player.username);

    if (this.currentScene) {
      this.createPlayerSprite(this.currentScene, player);
    }
  }

  protected onPlayerRemoved(player: PlayerData): void {
    console.log('Player removed from game:', player.username);

    const sprite = this.playerSprites.get(player.id);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(player.id);
    }
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    const sprite = this.playerSprites.get(playerId);
    if (!sprite || !sprite.body) return;

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const maxSpeed = 300;

    if (action === 'joystick' && data) {
      const joystickX = data.joystickX || 0;
      const joystickY = data.joystickY || 0;

      body.setVelocityX(joystickX * maxSpeed);
      body.setVelocityY(joystickY * maxSpeed);

      return;
    }

    switch (action) {
      case 'up':
        body.setVelocityY(-maxSpeed);
        break;
      case 'down':
        body.setVelocityY(maxSpeed);
        break;
      case 'left':
        body.setVelocityX(-maxSpeed);
        break;
      case 'right':
        body.setVelocityX(maxSpeed);
        break;
      case 'action':
        sprite.setScale(1.5);
        setTimeout(() => sprite.setScale(1), 200);
        break;
    }
  }

  destroy(): void {
    this.playerSprites.clear();
    super.destroy();
  }
}
