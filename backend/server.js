const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

let waitingQueue = [];
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinQueue', () => {
    console.log(`User ${socket.id} joined queue. Queue length: ${waitingQueue.length}`);
    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();
      const room = `${socket.id}-${partner.id}`;
      console.log(`Matching ${socket.id} with ${partner.id} in room ${room}`);
      socket.join(room);
      partner.join(room);
      rooms.set(socket.id, { partnerId: partner.id, room });
      rooms.set(partner.id, { partnerId: socket.id, room });
      io.to(room).emit('matched', {
        partnerId: socket.id === room.split('-')[0] ? partner.id : socket.id,
        initiator: socket.id === room.split('-')[0],
      });
    } else {
      waitingQueue.push(socket);
      console.log(`User ${socket.id} added to queue`);
    }
  });

  socket.on('signal', (data) => {
    const { to, signal } = data;
    console.log(`Relaying signal from ${socket.id} to ${to}`);
    io.to(to).emit('signal', { signal, from: socket.id });
  });

  socket.on('next', () => {
    console.log(`User ${socket.id} requested next partner`);
    handleLeave(socket);
    socket.emit('joiningQueue');
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const userRoom = rooms.get(socket.id);
  if (userRoom) {
    const { partnerId, room } = userRoom;
    console.log(`User ${socket.id} leaving room ${room}`);
    io.to(partnerId).emit('partnerLeft');
    socket.leave(room);
    if (io.sockets.sockets.get(partnerId)) {
      io.sockets.sockets.get(partnerId).leave(room);
    }
    rooms.delete(socket.id);
    rooms.delete(partnerId);
  }
  waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);
  console.log(`Queue after leave: ${waitingQueue.length}`);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));