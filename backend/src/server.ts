import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

import { join } from 'path';

const frontendPagesPath = join(__dirname, '..', '..', 'frontend', 'src', 'pages');
app.get('/', (_req, res) => {
  res.sendFile(join(frontendPagesPath, 'homepage.html'));
});

const frontendSrcPath = join(__dirname, '..', '..', 'frontend', 'src');
app.use('/src', express.static(frontendSrcPath));

const publicPath = join(__dirname, '..', '..', 'frontend', 'public');
app.use(express.static(publicPath));

const mobilePublicPath = join(__dirname, '..', '..', 'mobile', 'public');
app.use(express.static(mobilePublicPath));

app.get('/signup.html', (_req, res) => {
  res.sendFile(join(frontendPagesPath, 'signup.html'));
});

app.get('/signin.html', (_req, res) => {
  res.sendFile(join(frontendPagesPath, 'signin.html'));
});

app.get('/room.html', (_req, res) => {
  res.sendFile(join(frontendPagesPath, 'room.html'));
});

app.get('/profile.html', (_req, res) => {
  res.sendFile(join(frontendPagesPath, 'profile.html'));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

import { networkInterfaces } from 'os';

function getServerIPs() {
  const interfaces = networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

app.get('/config.json', (req, res) => {
  if (process.env.SERVER_URL) {
    return res.json({
      serverUrl: process.env.SERVER_URL,
      defaultRoom: process.env.DEFAULT_ROOM || 'test-room',
    });
  }

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port}`;
  const detectedUrl = `${protocol}://${host}`;
  const ipAddresses = getServerIPs();

  res.json({
    serverUrl: detectedUrl,
    defaultRoom: process.env.DEFAULT_ROOM || 'test-room',
    availableUrls: ipAddresses.map(ip => `http://${ip}:${port}`),
  });
});

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

import * as roomManager from './rooms';

const onlineUsers = new Map<string, string>();

const gameNs = io.of('/game');
const mobileNs = io.of('/mobile');

function getSocketByUserId(userId: string) {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    return gameNs.sockets.get(socketId);
  }
  return undefined;
}

function emitToUser(userId: string, event: string, data: any) {
  const socket = getSocketByUserId(userId);
  if (socket) {
    socket.emit(event, data);
  }
}

gameNs.on('connection', (socket) => {
  console.log('Frontend connected to /game namespace:', socket.id);

  if (socket.handshake.query && socket.handshake.query.token) {
    try {
      const token = socket.handshake.query.token as string;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload && payload.id) {
        onlineUsers.set(payload.id, socket.id);
        console.log(`User ${payload.username} (${payload.id}) is now online`);

        socket.broadcast.emit('user_online', { userId: payload.id, username: payload.username });
      }
    } catch (err) {
      console.error('Error parsing token on connection:', err);
    }
  }

  socket.on('send_friend_request', async (data: { friendId: string }) => {
    try {
      const token = socket.handshake.query.token as string;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      if (payload && payload.id) {
        emitToUser(data.friendId, 'friend_request_received', {
          senderId: payload.id,
          senderUsername: payload.username
        });
      }
    } catch (err) {
      console.error('Error sending friend request notification:', err);
    }
  });

  socket.on('accept_friend_request', async (data: { friendId: string }) => {
    try {
      const token = socket.handshake.query.token as string;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      if (payload && payload.id) {
        emitToUser(data.friendId, 'friend_request_accepted', {
          userId: payload.id,
          username: payload.username
        });
      }
    } catch (err) {
      console.error('Error sending friend accepted notification:', err);
    }
  });

  socket.on('send_room_invitation', async (data: { friendId: string, roomId: string, pin: string }) => {
    try {
      const token = socket.handshake.query.token as string;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      if (payload && payload.id) {
        emitToUser(data.friendId, 'room_invitation_received', {
          senderId: payload.id,
          senderUsername: payload.username,
          roomId: data.roomId,
          pin: data.pin
        });
      }
    } catch (err) {
      console.error('Error sending room invitation notification:', err);
    }
  });

  socket.on('create_room', (options: { name?: string, maxPlayers?: number } = {}, cb?: (room: any) => void) => {
    const { name, maxPlayers } = options;
    const room = roomManager.createRoom(socket.id, name, maxPlayers);

    socket.join(room.id);

    const player = roomManager.addPlayerToRoom(room.id, socket.id);

    let username = `Player ${player?.playerNumber || 1}`;
    if (socket.handshake.query && socket.handshake.query.token) {
      try {
        const token = socket.handshake.query.token as string;
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload && payload.username) {
          username = payload.username;
        }
      } catch (err) {
        console.error('Error parsing token:', err);
      }
    }

    const allPlayers = room.players.map(p => ({
      id: p.id,
      playerNumber: p.playerNumber,
      deviceCode: p.deviceCode,
      isConnected: p.mobileId !== null,
      isCurrentPlayer: p.id === socket.id,
      username: username,
      ready: !!p.ready
    }));

    if (cb) {
      cb({
        roomId: room.id,
        pin: room.pin,
        name: room.name,
        deviceCode: player?.deviceCode,
        playerNumber: player?.playerNumber,
        allPlayers: allPlayers
      });
    }

    console.log(`Room created: ${room.id}, PIN: ${room.pin}`);
  });

  socket.on('join_room_by_pin', (pin: string, cb?: (result: any) => void) => {
    const room = roomManager.findRoomByPin(pin);

    if (!room) {
      if (cb) cb({ success: false, error: 'Room not found' });
      return;
    }

    const player = roomManager.addPlayerToRoom(room.id, socket.id);

    if (!player) {
      if (cb) cb({ success: false, error: 'Room is full' });
      return;
    }

    socket.join(room.id);

    let username = `Player ${player.playerNumber}`;
    if (socket.handshake.query && socket.handshake.query.token) {
      try {
        const token = socket.handshake.query.token as string;
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload && payload.username) {
          username = payload.username;
        }
      } catch (err) {
        console.error('Error parsing token:', err);
      }
    }

    const allPlayers = room.players.map(p => ({
      id: p.id,
      playerNumber: p.playerNumber,
      deviceCode: p.deviceCode,
      isConnected: p.mobileId !== null,
      isCurrentPlayer: p.id === socket.id,
      username: p.id === socket.id ? username : `Player ${p.playerNumber}`,
      ready: !!p.ready
    }));

    gameNs.to(room.id).emit('room_players_updated', {
      roomId: room.id,
      roomName: room.name,
      players: allPlayers,
      newPlayerId: socket.id,
      newPlayerNumber: player.playerNumber
    });

    if (cb) {
      cb({
        success: true,
        roomId: room.id,
        name: room.name,
        deviceCode: player.deviceCode,
        playerNumber: player.playerNumber,
        allPlayers: allPlayers
      });
    }
  });
  socket.on('join', (room: string, cb?: (ack: any) => void) => {
    socket.join(room);
    const ack = { ok: true, room };
    if (cb) cb(ack);
    socket.to(room).emit('system', { msg: `User ${socket.id} joined ${room}` });
  });

  socket.on('message', (payload: any) => {
    const { room, data } = payload || {};
    if (room) {
      gameNs.to(room).emit('message', { from: socket.id, data });
    } else {
      gameNs.emit('message', { from: socket.id, data });
    }
  });

  socket.on('ping', (cb?: (res: string) => void) => {
    if (cb) cb('pong');
  });

  socket.on('player_ready', (payload: { roomId: string, ready: boolean }, cb?: (ack: any) => void) => {
    const { roomId, ready } = payload || {};
    if (!roomId) {
      if (cb) cb({ success: false, error: 'Missing roomId' });
      return;
    }

    const ok = roomManager.setPlayerReady(roomId, socket.id, !!ready);
    const updatedRoom = roomManager.getRoomInfo(roomId);
    if (updatedRoom) {
      const allPlayers = updatedRoom.players.map(p => ({
        id: p.id,
        playerNumber: p.playerNumber,
        deviceCode: p.deviceCode,
        isConnected: p.mobileId !== null,
        isCurrentPlayer: p.id === socket.id,
        username: `Player ${p.playerNumber}`,
        ready: !!p.ready
      }));

      gameNs.to(roomId).emit('room_players_updated', {
        roomId: updatedRoom.id,
        roomName: updatedRoom.name,
        players: allPlayers,
        changedPlayerId: socket.id
      });
    }

    if (cb) cb({ success: !!ok });
  });

  socket.on('start_game', (payload: { roomId: string, gameType?: string }, cb?: (ack: any) => void) => {
    const { roomId, gameType } = payload || {};
    if (!roomId) {
      if (cb) cb({ success: false, error: 'Missing roomId' });
      return;
    }

    if (!roomManager.isRoomHost(socket.id, roomId)) {
      if (cb) cb({ success: false, error: 'Only the room host can start the game' });
      return;
    }

    const allReady = roomManager.areAllPlayersReady(roomId);
    if (!allReady) {
      if (cb) cb({ success: false, error: 'Not all players are ready' });
      return;
    }

    const countdownMs = 3000;
    const startAt = Date.now() + countdownMs;

    gameNs.to(roomId).emit('game_start_countdown', { startAt, countdown: 3, gameType });

    const updatedRoom = roomManager.getRoomInfo(roomId);
    if (!updatedRoom) {
      if (cb) cb({ success: false, error: 'Room not found' });
      return;
    }

    const playersSnapshot = updatedRoom.players.map((p: any) => ({
      id: p.id,
      username: `Player ${p.playerNumber}`,
      deviceCode: p.deviceCode,
      isConnected: p.mobileId !== null
    }));

    setTimeout(() => {
      gameNs.to(roomId).emit('game_start', { gameType, players: playersSnapshot });
    }, countdownMs);

    if (cb) cb({ success: true, startAt });
  });

  socket.on('button_clicked', (payload: any) => {
    const { room, ts } = payload || {};
    if (room) {
      gameNs.to(room).emit('front_clicked', { from: 'frontend', ts });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Frontend disconnected', socket.id, reason);

    if (socket.handshake.query && socket.handshake.query.token) {
      try {
        const token = socket.handshake.query.token as string;
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload && payload.id) {
          onlineUsers.delete(payload.id);
          console.log(`User ${payload.username} (${payload.id}) is now offline`);

          socket.broadcast.emit('user_offline', { userId: payload.id, username: payload.username });
        }
      } catch (err) {
        console.error('Error removing user from online list:', err);
      }
    }

    const playerRooms = roomManager.getActiveRooms().filter(room =>
      room.players.some(player => player.id === socket.id)
    );

    roomManager.handleDisconnect(socket.id);

    playerRooms.forEach(room => {
      const updatedRoom = roomManager.getRoomInfo(room.id);
      if (updatedRoom) {
        const remainingPlayers = updatedRoom.players.map(p => ({
          id: p.id,
          playerNumber: p.playerNumber,
          deviceCode: p.deviceCode,
          isConnected: p.mobileId !== null,
          isCurrentPlayer: false,
          username: `Player ${p.playerNumber}`,
          ready: !!p.ready
        }));

        gameNs.to(room.id).emit('room_players_updated', {
          roomId: room.id,
          roomName: room.name,
          players: remainingPlayers,
          playerDisconnected: socket.id
        });
      }
    });
  });
});

mobileNs.on('connection', (socket) => {
  console.log('Mobile connected to /mobile namespace:', socket.id);

  socket.on('join_room_by_pin', (pin: string, cb?: (result: any) => void) => {
    const room = roomManager.findRoomByPin(pin);

    if (!room) {
      if (cb) cb({ success: false, error: 'Room not found' });
      return;
    }

    if (cb) {
      cb({
        success: true,
        roomId: room.id,
        name: room.name,
        waitingForDeviceCode: true
      });
    }
  });

  socket.on('pair_with_player', (data: { roomPin: string, deviceCode: string }, cb?: (result: any) => void) => {
    const room = roomManager.findRoomByPin(data.roomPin);

    if (!room) {
      if (cb) cb({ success: false, error: 'Room not found' });
      return;
    }

    const result = roomManager.connectMobileToPlayer(data.deviceCode, socket.id);

    if (!result) {
      if (cb) cb({ success: false, error: 'Invalid device code or player not found' });
      return;
    }

    socket.join(result.room.id);

    const allPlayers = result.room.players.map(p => ({
      id: p.id,
      playerNumber: p.playerNumber,
      deviceCode: p.deviceCode,
      isConnected: p.mobileId !== null,
      isCurrentPlayer: false,
      username: `Player ${p.playerNumber}`
    }));

    gameNs.to(result.room.id).emit('room_players_updated', {
      roomId: result.room.id,
      roomName: result.room.name,
      players: allPlayers,
      controllerConnected: {
        playerNumber: result.player.playerNumber,
        mobileId: socket.id
      }
    });

    gameNs.to(result.player.id).emit('controller_connected', {
      playerNumber: result.player.playerNumber,
      mobileId: socket.id
    });

    if (cb) {
      cb({
        success: true,
        roomId: result.room.id,
        playerNumber: result.player.playerNumber
      });
    }
  });

  socket.on('controller_input', (data: any) => {
    const rooms = roomManager.getActiveRooms();

    for (const room of rooms) {
      const player = room.players.find(p => p.mobileId === socket.id);
      if (player) {
        gameNs.to(room.id).emit('controller_input', {
          playerId: player.id,
          playerNumber: player.playerNumber,
          action: data.action,
          timestamp: data.timestamp,
          joystickX: data.joystickX,
          joystickY: data.joystickY,
          data: data
        });
        break;
      }
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Mobile disconnected', socket.id, reason);
    roomManager.handleDisconnect(socket.id);
  });
});

const host = process.env.HOST || '0.0.0.0';
import { initDb } from './db';
import authRouter from './auth';
import friendsRouter from './friends';
import profileRouter from './profile';
import gamesRouter from './games';

initDb().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Database init error', err);
});

app.use('/api/auth', authRouter);
app.use('/api', friendsRouter);
app.use('/api', profileRouter);
app.use('/api/games', gamesRouter);

httpServer.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

export { app, io };
