import { BaseGame, PlayerData } from './BaseGame';
import { SimpleGameExample } from './SimpleGameExample';

export const AVAILABLE_GAMES = {
  'simple-example': SimpleGameExample,
} as const;

export type GameType = keyof typeof AVAILABLE_GAMES;

export class GameManager {
  private currentGame: BaseGame | null = null;
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  loadGame(gameType: GameType): BaseGame {
    if (this.currentGame) {
      this.currentGame.destroy();
    }

    const GameClass = AVAILABLE_GAMES[gameType];
    this.currentGame = new GameClass(this.containerId);

    this.currentGame.start();

    return this.currentGame;
  }

  getCurrentGame(): BaseGame | null {
    return this.currentGame;
  }

  addPlayer(player: PlayerData): void {
    if (this.currentGame) {
      this.currentGame.addPlayer(player);
    }
  }

  removePlayer(playerId: string): void {
    if (this.currentGame) {
      this.currentGame.removePlayer(playerId);
    }
  }

  handlePlayerInput(playerId: string, action: string, data?: any): void {
    if (this.currentGame) {
      this.currentGame.handlePlayerInput(playerId, action, data);
    }
  }

  destroy(): void {
    if (this.currentGame) {
      this.currentGame.destroy();
      this.currentGame = null;
    }
  }

  static getAvailableGames(): Array<{
    id: GameType;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
  }> {
    return Object.entries(AVAILABLE_GAMES).map(([id, GameClass]) => {
      const tempGame = new GameClass('temp');
      const config = tempGame.getConfig();
      return {
        id: id as GameType,
        name: config.name,
        description: config.description,
        minPlayers: config.minPlayers,
        maxPlayers: config.maxPlayers
      };
    });
  }
}
