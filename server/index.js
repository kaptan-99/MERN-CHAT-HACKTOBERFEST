const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const app = express();
const socket = require("socket.io");
const messageModel = require("./models/messageModel");
require("dotenv").config();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connection Successful");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on ${process.env.PORT}`)
);

const io = socket(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

global.onlineUsers = new Map();
global.userActiveChats = new Map();

io.on("connection", (socket) => {
  global.chatSocket = socket;

  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("get-users", Array.from(onlineUsers.keys()));
    socket.userId = userId;
  });

  socket.on("update-active-chat", (chatId) => {
    if (socket.userId) {
      userActiveChats.set(socket.userId, chatId);
    }
  });

  socket.on("check-recipient-active", (data, callback) => {
    const recipientActiveChat = userActiveChats.get(data.to);
    callback({ isActive: recipientActiveChat === data.from });
  });

  socket.on("send-msg", async (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    const recipientActiveChat = userActiveChats.get(data.to);
  
    if (sendUserSocket) {
      // Send the message to the recipient
      socket.to(sendUserSocket).emit("msg-recieve", data);
  
      // Check if the recipient is viewing the same chat
      if (recipientActiveChat === data.from) {
        // Update the message as read in the database
        await messageModel.updateMany(
          { "users": { $all: [data.from, data.to] }, "messages.read": false, "messages.from": data.from },
          { $set: { "messages.$.read": true } }
        );
  
        // Notify both users that the message has been read
        [data.from, data.to].forEach(userId => {
          const userSocketId = onlineUsers.get(userId);
          if (userSocketId) {
            io.to(userSocketId).emit("message-read-receipt", { chatId: data.from });
          }
        });
      }
    }
  });  

  socket.on("message-read", async ({ currentChatId, from }) => {
    const activeChatId = userActiveChats.get(socket.userId);
    
    // Only mark messages as read if the active chat is the one the messages are from
    if (activeChatId === currentChatId) {
      const chats = await messageModel.find({
        users: { $all: [currentChatId, from] }
      });
  
      chats.forEach(async (chat) => {
        await messageModel.updateMany(
          { _id: chat._id, "messages.from": currentChatId, "messages.read": false },
          { $set: { "messages.$.read": true } },
          { multi: true }
        );
  
        // Notify both participants
        [currentChatId, socket.userId].forEach(userId => {
          const userSocketId = onlineUsers.get(userId);
          if (userSocketId) {
            io.to(userSocketId).emit("message-read-receipt", { chatId: chat._id });
          }
        });
      });
    }
  });

  const removeUser = (socketId) => {
    onlineUsers.forEach((value, key) => {
      if (value === socketId) {
        onlineUsers.delete(key);
        userActiveChats.delete(key); // Also remove from active chat tracking
      }
    });
    io.emit("get-users", Array.from(onlineUsers.keys()));
  };

  socket.on("disconnect", () => {
    removeUser(socket.id);
  });

  socket.on("offline", () => {
    removeUser(socket.id);
  });
});

