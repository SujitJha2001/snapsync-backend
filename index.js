const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
require('dotenv').config();

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204, 
};

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8, // Set the maximum buffer size to 100MB (adjust as needed)
});

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from the server");
});

const socket_Joined_Room_Mapping = new Map();
const socket_Created_Room_Mapping = new Map();
const existingRooms = [];


io.on('connection', (socket) => {
  console.log('A user connected', socket.id);
  socket.emit("ConnectionEstablished", socket.id);

  socket.on('joinRoom', (roomName) => {
    if (existingRooms.find(ele => ele == roomName)) {
      let alreadyInARoom = false;
      // Leave current room (if any)
      if (socket_Joined_Room_Mapping.has(socket.id)) {
        const currentRoom = socket_Joined_Room_Mapping.get(socket.id);
        socket.leave(currentRoom);
        socket_Joined_Room_Mapping.delete(socket.id);
        alreadyInARoom = true;
      }
      // Join the new room
      socket.join(roomName);
      socket_Joined_Room_Mapping.set(socket.id, roomName);
      if (alreadyInARoom) {
        socket.emit("message", { message: "One user can join only one room. Hence removing user from previous rooms and adding to the new one", value: roomName });
      }
      else {
        socket.emit("message", { message: "Joined Room Successfully", value: roomName });
      }
    }
    else {
      socket.emit("message", { message: "Invalid Room Id", value: roomName });
    }
  });

  socket.on('createRoom', (roomName) => {
    socket_Created_Room_Mapping.set(socket.id, roomName);
    existingRooms.push(roomName);
    socket.emit("message", { message: "Room created successfully", value: roomName });
  });

  socket.on('sendFileChunk', (data) => {
    io.to(data.room).emit("recieveFileChunk", data);
  });

  socket.on('disconnect', () => { 
    console.log('User disconnected');
    // Remove user from rooms he created  on disconnect
    if (socket_Created_Room_Mapping.has(socket.id)) {
      let roomName = socket_Created_Room_Mapping.get(socket.id);
      const indexToRemove = existingRooms.indexOf(roomName);
      if (indexToRemove != -1) existingRooms.splice(indexToRemove, 1);
      socket_Created_Room_Mapping.delete(socket.id);
    }

    // Remove user from rooms he joined  on disconnect
    if (socket_Joined_Room_Mapping.has(socket.id)) {
      const roomName = socket_Joined_Room_Mapping.get(socket.id);
      socket.leave(roomName);
      socket_Joined_Room_Mapping.delete(socket.id);
    }
  });
}); 


const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
