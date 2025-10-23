"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.addPlayerToRoom = addPlayerToRoom;
exports.findRoomByPin = findRoomByPin;
exports.connectMobileToPlayer = connectMobileToPlayer;
exports.handleDisconnect = handleDisconnect;
exports.getActiveRooms = getActiveRooms;
exports.getRoomInfo = getRoomInfo;
exports.isRoomHost = isRoomHost;
const activeRooms = new Map();
const pinToRoomMap = new Map();
const deviceCodeMap = new Map();
function generateUniquePin() {
    let pin;
    do {
        pin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (pinToRoomMap.has(pin));
    return pin;
}
function generateDeviceCode() {
    let code;
    do {
        code = Math.floor(100 + Math.random() * 900).toString();
    } while (deviceCodeMap.has(code));
    return code;
}
function createRoom(hostId, roomName = '', maxPlayers = 4) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const pin = generateUniquePin();
    const room = {
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
function addPlayerToRoom(roomId, playerId) {
    const room = activeRooms.get(roomId);
    if (!room)
        return null;
    if (room.players.length >= room.maxPlayers)
        return null;
    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer)
        return existingPlayer;
    const playerNumber = room.players.length + 1;
    const deviceCode = generateDeviceCode();
    const player = {
        id: playerId,
        playerNumber,
        deviceCode,
        mobileId: null
    };
    room.players.push(player);
    deviceCodeMap.set(deviceCode, { roomId, playerId });
    return player;
}
function findRoomByPin(pin) {
    const roomId = pinToRoomMap.get(pin);
    if (!roomId)
        return null;
    return activeRooms.get(roomId) || null;
}
function connectMobileToPlayer(deviceCode, mobileId) {
    const mapping = deviceCodeMap.get(deviceCode);
    if (!mapping)
        return null;
    const { roomId, playerId } = mapping;
    const room = activeRooms.get(roomId);
    if (!room)
        return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player)
        return null;
    player.mobileId = mobileId;
    return { room, player };
}
function handleDisconnect(socketId) {
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
function getActiveRooms() {
    return Array.from(activeRooms.values());
}
function getRoomInfo(roomId) {
    return activeRooms.get(roomId) || null;
}
function isRoomHost(socketId, roomId) {
    const room = activeRooms.get(roomId);
    return room ? room.hostId === socketId : false;
}
