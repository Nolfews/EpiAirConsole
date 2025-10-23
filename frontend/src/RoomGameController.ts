import { GameManager, type PlayerData, type GameType } from './games/index';

export class RoomGameController {
  private gameManager: GameManager;
  private socket: any;
  private selectedGameType: GameType | null = null;

  constructor(containerId: string, socket: any) {
    this.gameManager = new GameManager(containerId);
    this.socket = socket;
    this.setupSocketListeners();
  }

  getAvailableGames() {
    return GameManager.getAvailableGames();
  }

  selectGame(gameType: GameType): void {
    console.log('Game selected:', gameType);
    this.selectedGameType = gameType;
  }

  loadGame(gameType?: GameType): void {
    const typeToLoad = gameType || this.selectedGameType || 'simple-example';
    console.log('Loading game:', typeToLoad);

    const container = document.getElementById('gameContainer');
    if (container) {
      container.innerHTML = '';
    }

    this.gameManager.loadGame(typeToLoad as GameType);
    this.selectedGameType = typeToLoad as GameType;
  }

  addPlayer(player: PlayerData): void {
    this.gameManager.addPlayer(player);
  }

  removePlayer(playerId: string): void {
    this.gameManager.removePlayer(playerId);
  }

  private setupSocketListeners(): void {
    this.socket.on('controller_input', (data: any) => {
      console.log('Controller input received:', data);
      if (data.playerId && data.action) {
        this.gameManager.handlePlayerInput(data.playerId, data.action, data);
      }
    });

    this.socket.on('game_start', (data: any) => {
      console.log('Game starting:', data);
      this.loadGame(data.gameType || 'simple-example');
    });

    this.socket.on('game_end', () => {
      console.log('Game ended');
      this.gameManager.destroy();
    });
  }

  startGame(players: PlayerData[], gameType?: GameType): void {
    this.loadGame(gameType);

    players.forEach(player => {
      if (player.isConnected) {
        this.addPlayer(player);
      }
    });

    this.socket.emit('game_started', { gameType: this.selectedGameType });
  }

  destroy(): void {
    this.gameManager.destroy();
  }
}

(window as any).RoomGameController = RoomGameController;
