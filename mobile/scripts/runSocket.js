const ioClient = require('socket.io-client');

const SERVER_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const io = (ioClient && ioClient.default) ? ioClient.default : ioClient;
const socket = io(`${SERVER_URL}/game`);

socket.on('connect', () => {
  console.log('Mobile JS runner connected', socket.id);
  socket.emit('join', 'test-room', (ack) => console.log('Joined ack', ack));
  socket.emit('ping', (res) => console.log('pong ->', res));
});

socket.on('message', (msg) => console.log('Mobile received', msg));
socket.on('system', (payload) => console.log('Mobile system', payload));
socket.on('front_clicked', (payload) => console.log('Mobile front_clicked', payload));

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});

setInterval(() => {}, 1000);
