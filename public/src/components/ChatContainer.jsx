import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sendMessageRoute, recieveMessageRoute } from "../utils/APIRoutes";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../utils/common";

export default function ChatContainer({ currentChat, socket }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);
  // const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const fetchUser = async () => {
      if (!localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)) {
        navigate("/login");
      // } else {
      //   const user = JSON.parse(
      //     localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
      //   );
        // setCurrentUser(user);
      }
    };
    fetchUser();
  }, [navigate]);

  useEffect(() => {
    if (currentChat) {
      const fetchMessages = async () => {
        const data = JSON.parse(
          localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
        );
        const response = await axios.post(recieveMessageRoute, {
          from: data._id,
          to: currentChat._id,
        });
        setMessages(response.data);
      };
      fetchMessages();
    }
  }, [currentChat]);

  const handleSendMsg = async (msg) => {
    const data = JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    // Emit an event to check if the recipient is on the same chat window
    socket.current.emit(
      "check-recipient-active",
      {
        to: currentChat._id,
        from: data._id,
      },
      (response) => {
        const newMessage = {
          fromSelf: true,
          message: msg,
          read: response.isActive, // Set based on server response
          timestamp: Date.now(),
        };
    
        setMessages((prevMessages) =>
          Array.isArray(prevMessages) ? [...prevMessages, newMessage] : [newMessage]
        );
      }
    );

    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: data._id,
      msg,
    });

    await axios.post(sendMessageRoute, {
      from: data._id,
      to: currentChat._id,
      message: msg,
    });
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieve", (msg) => {
        // Check if the message is for the current chat
        if (currentChat && msg.from === currentChat._id) {
          setArrivalMessage({
            fromSelf: false,
            from: msg.from,
            message: msg.msg,
            read: false,
            timestamp: msg.timestamp || Date.now(),
          });
        }
      });
    }

    return () => {
      socket.current.off("msg-recieve");
    };
  }, [socket, currentChat]);

  useEffect(() => {
    if (arrivalMessage) {
      setMessages((prev) =>
        Array.isArray(prev) ? [...prev, arrivalMessage] : [arrivalMessage]
      );
    }
  }, [arrivalMessage]);

  useEffect(() => {
    if (currentChat && messages.length > 0) {
      const data = JSON.parse(
        localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
      );
      // Emit read receipt when the chat is opened and messages are viewed
      socket.current.emit("message-read", {
        currentChatId: currentChat._id,
        from: data._id, // Assuming this is the ID of the chat being opened
      });
    }
  }, [currentChat, messages.length]); // Re-trigger on chat change or when new messages are loaded

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]); // Trigger when the messages array changes

  useEffect(() => {
    if (socket.current && currentChat) {
      socket.current.emit("update-active-chat", currentChat._id);
    }
  }, [currentChat, socket]);  

  useEffect(() => {
    if (socket.current) {
      socket.current.on("message-read-receipt", ({ chatId }) => {
        // Check if the current chat matches the chatId received
        if (currentChat && chatId === currentChat._id) {
          setMessages((prevMessages) =>
            prevMessages.map((message) => ({
              ...message,
              read: true, // Assuming you want to mark all messages as read
            }))
          );
        }
      });

      return () => {
        socket.current.off("message-read-receipt");
      };
    }
  }, [socket, currentChat]);

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <div className="avatar">
            <img
              src={`data:image/svg+xml;base64,${currentChat.avatarImage}`}
              alt=""
            />
          </div>
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
        <Logout />
      </div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.length > 0 &&
          messages.map((message) => (
            <div key={uuidv4()}>
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                }`}
              >
                <div className="content ">
                  <p>{message.message}</p>
                  <span className="timestamp">
                    {formatDateTime(message.timestamp)}
                  </span>
                  {message.fromSelf && (
                    <span className="read-receipt">
                      {message.read ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
        }
      }
      .username {
        h3 {
          color: white;
        }
      }
    }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: #d1d1d1;
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .timestamp {
      font-size: 0.8rem;
      color: grey;
      margin-top: 5px;
      display: block;
      text-align: right;
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: #4f04ff21;
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: #9900ff20;
      }
    }
    .read-receipt {
      font-size: 0.8rem;
      color: grey;
      margin-left: 5px;
    }
  }
`;
