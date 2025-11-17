import { Socket } from 'socket.io';
// Interface définissant la structure d'une room
interface Room {
  id: string;
  pin: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  createdAt: Date;
}


interface Player {
  id: string;
  playerNumber: number;
  deviceCode: string;
  mobileId: string | null;
  ready?: boolean;
}

const activeRooms: Map<string, Room> = new Map();
const pinToRoomMap: Map<string, string> = new Map();
const deviceCodeMap: Map<string, { roomId: string, playerId: string }> = new Map();

function generateUniquePin(): string {
  let pin: string;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (pinToRoomMap.has(pin));

  return pin;
}

function generateDeviceCode(): string {
  let code: string;
  do {
    code = Math.floor(100 + Math.random() * 900).toString();
  } while (deviceCodeMap.has(code));

  return code;
}

export function createRoom(hostId: string, roomName: string = '', maxPlayers: number = 4): Room {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const pin = generateUniquePin();

  const room: Room = {
    id: roomId,
    pin,
    name: roomName || `Room ${pin}`,
    hostId,
    players: [],
    maxPlayers,
    createdAt: new Date()
  };

  activeRooms.set(roomId, room);
  pinToRoomMap.set(pin, roomId);

  return room;
}

export function addPlayerToRoom(roomId: string, playerId: string): Player | null {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  if (room.players.length >= room.maxPlayers) return null;

  const existingPlayer = room.players.find(p => p.id === playerId);
  if (existingPlayer) return existingPlayer;

  const playerNumber = room.players.length + 1;
  const deviceCode = generateDeviceCode();

  const player: Player = {
    id: playerId,
    playerNumber,
    deviceCode,
    mobileId: null
  };

  player.ready = false;

  room.players.push(player);

  deviceCodeMap.set(deviceCode, { roomId, playerId });

  return player;
}

export function findRoomByPin(pin: string): Room | null {
  const roomId = pinToRoomMap.get(pin);
  if (!roomId) return null;

  return activeRooms.get(roomId) || null;
}

export function connectMobileToPlayer(deviceCode: string, mobileId: string): { room: Room, player: Player } | null {
  const mapping = deviceCodeMap.get(deviceCode);
  if (!mapping) return null;

  const { roomId, playerId } = mapping;
  const room = activeRooms.get(roomId);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  player.mobileId = mobileId;

  return { room, player };
}

export function handleDisconnect(socketId: string): void {
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.hostId === socketId) {
      for (const player of room.players) {
        if (player.deviceCode) {
          deviceCodeMap.delete(player.deviceCode);
        }
      }
      pinToRoomMap.delete(room.pin);
      activeRooms.delete(roomId);
      continue;
    }

    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex >= 0) {
      const player = room.players[playerIndex];

      if (player.deviceCode) {
        deviceCodeMap.delete(player.deviceCode);
      }

      room.players.splice(playerIndex, 1);
      continue;
    }

    for (const player of room.players) {
      if (player.mobileId === socketId) {
        player.mobileId = null;
        break;
      }
    }
  }
}

export function setPlayerReady(roomId: string, playerId: string, ready: boolean): boolean {
  const room = activeRooms.get(roomId);
  if (!room) return false;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;

  player.ready = ready;
  return true;
}

export function areAllPlayersReady(roomId: string): boolean {
  const room = activeRooms.get(roomId);
  if (!room) return false;

  if (room.players.length === 0) return false;

  return room.players.every(p => p.ready === true);
}

export function getActiveRooms(): Room[] {
  return Array.from(activeRooms.values());
}

export function getRoomInfo(roomId: string): Room | null {
  return activeRooms.get(roomId) || null;
}

export function isRoomHost(socketId: string, roomId: string): boolean {
  const room = activeRooms.get(roomId);
  return room ? room.hostId === socketId : false;
}
