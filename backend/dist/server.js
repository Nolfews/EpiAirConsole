"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.use(express_1.default.json());
const path_1 = require("path");
const frontendPagesPath = (0, path_1.join)(__dirname, '..', '..', 'frontend', 'src', 'pages');
app.get('/', (_req, res) => {
    res.sendFile((0, path_1.join)(frontendPagesPath, 'homepage.html'));
});
const frontendSrcPath = (0, path_1.join)(__dirname, '..', '..', 'frontend', 'src');
app.use('/src', express_1.default.static(frontendSrcPath));
const publicPath = (0, path_1.join)(__dirname, '..', '..', 'frontend', 'public');
app.use(express_1.default.static(publicPath));
const mobilePublicPath = (0, path_1.join)(__dirname, '..', '..', 'mobile', 'public');
app.use(express_1.default.static(mobilePublicPath));
app.get('/signup.html', (_req, res) => {
    res.sendFile((0, path_1.join)(frontendPagesPath, 'signup.html'));
});
app.get('/signin.html', (_req, res) => {
    res.sendFile((0, path_1.join)(frontendPagesPath, 'signin.html'));
});
app.get('/room.html', (_req, res) => {
    res.sendFile((0, path_1.join)(frontendPagesPath, 'room.html'));
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
const os_1 = require("os");
function getServerIPs() {
    const interfaces = (0, os_1.networkInterfaces)();
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
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
exports.io = io;
const roomManager = __importStar(require("./rooms"));
const gameNs = io.of('/game');
const mobileNs = io.of('/mobile');
gameNs.on('connection', (socket) => {
    console.log('Frontend connected to /game namespace:', socket.id);
    socket.on('create_room', (options = {}, cb) => {
        const { name, maxPlayers } = options;
        const room = roomManager.createRoom(socket.id, name, maxPlayers);
        socket.join(room.id);
        const player = roomManager.addPlayerToRoom(room.id, socket.id);
        let username = `Player ${player?.playerNumber || 1}`;
        if (socket.handshake.query && socket.handshake.query.token) {
            try {
                const token = socket.handshake.query.token;
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                if (payload && payload.username) {
                    username = payload.username;
                }
            }
            catch (err) {
                console.error('Error parsing token:', err);
            }
        }
        const allPlayers = room.players.map(p => ({
            id: p.id,
            playerNumber: p.playerNumber,
            deviceCode: p.deviceCode,
            isConnected: p.mobileId !== null,
            isCurrentPlayer: p.id === socket.id,
            username: username
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
    socket.on('join_room_by_pin', (pin, cb) => {
        const room = roomManager.findRoomByPin(pin);
        if (!room) {
            if (cb)
                cb({ success: false, error: 'Room not found' });
            return;
        }
        const player = roomManager.addPlayerToRoom(room.id, socket.id);
        if (!player) {
            if (cb)
                cb({ success: false, error: 'Room is full' });
            return;
        }
        socket.join(room.id);
        let username = `Player ${player.playerNumber}`;
        if (socket.handshake.query && socket.handshake.query.token) {
            try {
                const token = socket.handshake.query.token;
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                if (payload && payload.username) {
                    username = payload.username;
                }
            }
            catch (err) {
                console.error('Error parsing token:', err);
            }
        }
        const allPlayers = room.players.map(p => ({
            id: p.id,
            playerNumber: p.playerNumber,
            deviceCode: p.deviceCode,
            isConnected: p.mobileId !== null,
            isCurrentPlayer: p.id === socket.id,
            username: p.id === socket.id ? username : `Player ${p.playerNumber}`
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
    socket.on('join', (room, cb) => {
        socket.join(room);
        const ack = { ok: true, room };
        if (cb)
            cb(ack);
        socket.to(room).emit('system', { msg: `User ${socket.id} joined ${room}` });
    });
    socket.on('message', (payload) => {
        const { room, data } = payload || {};
        if (room) {
            gameNs.to(room).emit('message', { from: socket.id, data });
        }
        else {
            gameNs.emit('message', { from: socket.id, data });
        }
    });
    socket.on('ping', (cb) => {
        if (cb)
            cb('pong');
    });
    socket.on('button_clicked', (payload) => {
        const { room, ts } = payload || {};
        if (room) {
            gameNs.to(room).emit('front_clicked', { from: 'frontend', ts });
        }
    });
    socket.on('disconnect', (reason) => {
        console.log('Frontend disconnected', socket.id, reason);
        const playerRooms = roomManager.getActiveRooms().filter(room => room.players.some(player => player.id === socket.id));
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
                    username: `Player ${p.playerNumber}`
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
    socket.on('join_room_by_pin', (pin, cb) => {
        const room = roomManager.findRoomByPin(pin);
        if (!room) {
            if (cb)
                cb({ success: false, error: 'Room not found' });
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
    socket.on('pair_with_player', (data, cb) => {
        const room = roomManager.findRoomByPin(data.roomPin);
        if (!room) {
            if (cb)
                cb({ success: false, error: 'Room not found' });
            return;
        }
        const result = roomManager.connectMobileToPlayer(data.deviceCode, socket.id);
        if (!result) {
            if (cb)
                cb({ success: false, error: 'Invalid device code or player not found' });
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
    socket.on('controller_input', (data) => {
        const rooms = roomManager.getActiveRooms();
        for (const room of rooms) {
            const player = room.players.find(p => p.mobileId === socket.id);
            if (player) {
                // Broadcast input to ALL players in the room (including the sender)
                // This allows all players to see each other move
                gameNs.to(room.id).emit('controller_input', {
                    playerId: player.id,
                    playerNumber: player.playerNumber,
                    action: data.action,
                    timestamp: data.timestamp,
                    // Include analog joystick data if present
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
const db_1 = require("./db");
const auth_1 = __importDefault(require("./auth"));
(0, db_1.initDb)().then(() => {
    console.log('Database initialized');
}).catch(err => {
    console.error('Database init error', err);
});
app.use('/api/auth', auth_1.default);
httpServer.listen(port, host, () => {
    console.log(`Backend listening on http://${host}:${port}`);
});
