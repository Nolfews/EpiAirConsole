import { createFrontendSocket } from '../src/socketClient';

const socket = createFrontendSocket('test-room');

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});

setInterval(() => {}, 1000);
