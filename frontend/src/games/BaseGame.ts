import Phaser from 'phaser';

export interface GameConfig {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface PlayerData {
  id: string;
  username: string;
  deviceCode: string;
  isConnected: boolean;
}

export abstract class BaseGame {
  protected game: Phaser.Game | null = null;
  protected players: Map<string, PlayerData> = new Map();

  constructor(
    protected containerId: string,
    protected gameConfig: GameConfig
  ) {}

  abstract createPhaserConfig(): Phaser.Types.Core.GameConfig;

  start(): void {
    const config = this.createPhaserConfig();
    this.game = new Phaser.Game(config);
  }

  addPlayer(player: PlayerData): void {
    this.players.set(player.id, player);
    this.onPlayerAdded(player);
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.onPlayerRemoved(player);
    }
  }

  abstract handlePlayerInput(playerId: string, action: string, data?: any): void;

  protected abstract onPlayerAdded(player: PlayerData): void;

  protected abstract onPlayerRemoved(player: PlayerData): void;

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
    this.players.clear();
  }

  getConfig(): GameConfig {
    return this.gameConfig;
  }

  getPlayers(): PlayerData[] {
    return Array.from(this.players.values());
  }
}
