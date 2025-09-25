import { createMobileSocket } from '../src/socketClient';

const socket = createMobileSocket('test-room');

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});

setInterval(() => {}, 1000);
