const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8848');

ws.on('open', function open() {
  ws.send('connecting...');
});

ws.on('message', function incoming(data) {
  console.log(data);
});