const Messages = require("../models/messageModel");

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    const chatHistory = await Messages.find({
      users: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });
    const projectedMessages = chatHistory.length > 0 && chatHistory[0].messages.map((msg) => {
      return {
        fromSelf: msg.from.toString() === from,
        message: msg.text,
        read: msg.read,
        timestamp: msg.timestamp
      };
    });
    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message } = req.body;

    // Check if a document already exists for the users
    let conversation = await Messages.findOne({
      users: { $all: [from, to] }
    });

    if (conversation) {
      // If conversation exists, push the new message to the messages array
      conversation.messages.push({ from: from, to: to, text: message });
      await conversation.save();
      return res.json({ msg: "Message added successfully." });
    } else {
      // If no conversation exists, create a new one
      const newConversation = await Messages.create({
        users: [from, to],
        messages: [{ from: from, to: to, text: message }]
      });
      if (newConversation) return res.json({ msg: "Message added successfully." });
      else return res.json({ msg: "Failed to add message to the database" });
    }
  } catch (ex) {
    next(ex);
  }
};