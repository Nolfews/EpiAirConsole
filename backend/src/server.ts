import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/config.json', (_req, res) => {
  res.json({
    serverUrl: process.env.SERVER_URL || '',
    defaultRoom: process.env.DEFAULT_ROOM || 'test-room',
  });
});

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const gameNs = io.of('/game');

gameNs.on('connection', (socket) => {
  console.log('Socket connected to /game namespace:', socket.id);

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

  socket.on('button_clicked', (payload: any) => {
    const { room, ts } = payload || {};
    if (room) {
      gameNs.to(room).emit('front_clicked', { from: 'frontend', ts });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected', socket.id, reason);
  });
});

const host = process.env.HOST || '0.0.0.0';
import { initDb } from './db';
import authRouter from './auth';

initDb().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Database init error', err);
});

app.use('/api/auth', authRouter);

httpServer.listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});

export { app, io };
