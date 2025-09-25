import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

import { join } from 'path';
const publicPath = join(__dirname, '..', '..', 'frontend', 'public');
app.use(express.static(publicPath));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

httpServer.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

export { app, io };
