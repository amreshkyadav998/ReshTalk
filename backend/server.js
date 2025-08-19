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

let waitingQueue = []; // Queue for users waiting to be matched
const rooms = new Map(); // Track rooms and partners

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinQueue', () => {
    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();
      const room = `${socket.id}-${partner.id}`;
      
      socket.join(room);
      partner.join(room);
      
      rooms.set(socket.id, { partnerId: partner.id, room });
      rooms.set(partner.id, { partnerId: socket.id, room });
      
      // Emit to both: matched, with partner's ID and who is initiator
      io.to(room).emit('matched', {
        partnerId: socket.id === room.split('-')[0] ? partner.id : socket.id,
        initiator: socket.id === room.split('-')[0],
      });
    } else {
      waitingQueue.push(socket);
    }
  });

  socket.on('signal', (data) => {
    const { to, signal } = data;
    io.to(to).emit('signal', { signal, from: socket.id });
  });

  socket.on('next', () => {
    handleLeave(socket);
    socket.emit('joiningQueue'); // Rejoin queue
  });

  socket.on('disconnect', () => {
    handleLeave(socket);
    console.log(`User disconnected: ${socket.id}`);
  });
});

function handleLeave(socket) {
  const userRoom = rooms.get(socket.id);
  if (userRoom) {
    const { partnerId, room } = userRoom;
    io.to(partnerId).emit('partnerLeft');
    socket.leave(room);
    if (io.sockets.sockets.get(partnerId)) {
      io.sockets.sockets.get(partnerId).leave(room);
    }
    rooms.delete(socket.id);
    rooms.delete(partnerId);
  }
  waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));