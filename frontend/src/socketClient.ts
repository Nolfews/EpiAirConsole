import ioClient from 'socket.io-client';

const SERVER_URL = (process.env.BACKEND_URL as string) || 'http://localhost:3000';

export function createFrontendSocket(room = 'lobby') {
  const io = (ioClient as any).default ? (ioClient as any).default : ioClient;
  const socket = io(`${SERVER_URL}/game`);

  socket.on('connect', () => {
    console.log('Frontend connected', socket.id);
    socket.emit('join', room, (ack: { ok: boolean; room: string }) => {
      console.log('Joined room ack', ack);
    });
  });

  socket.on('message', (msg: { from?: string; data?: unknown }) => {
    console.log('Received message', msg);
  });

  socket.on('system', (payload: { msg?: string }) => {
    console.log('System message', payload);
  });

  socket.emit('ping', (res: string) => console.log('pong ->', res));

  return socket;
}
