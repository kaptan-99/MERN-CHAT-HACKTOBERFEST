
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  users: { type: Array, required: true },
  messages: [
    {
      from: { type: String, required: true },
      to: { type: String, required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      read: { type: Boolean, default: false }, // Add this field
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('Messages', MessageSchema);
