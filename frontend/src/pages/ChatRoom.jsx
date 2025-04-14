import { useState, useEffect, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function ChatRoom() {
  const baseUrl = "127.0.0.1:8000";
  const [step, setStep] = useState(1);
  const [roomId, setRoomId] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);

  const ws = useRef(null);
  const scrollRef = useRef(null);
  const messageInputRef = useRef(null);

  const notify = (msg, type = "info") => toast[type](msg);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      ws.current?.close();
    };
  }, []);

  const createRoom = async () => {
    if (!newRoom.trim()) return notify("Room name is required", "error");
    try {
      const res = await fetch(`http://${baseUrl}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoom }),
      });
      const data = await res.json();
      setRoomId(data.room_id);
      setNewRoom("");
      notify(`Room created: ${data.room_id}`, "success");
      setStep(2);
    } catch {
      notify("Room creation failed", "error");
    }
  };

  const proceedToUsername = async () => {
    if (!roomId.trim()) return notify("Room ID is required", "error");
    try {
      const res = await fetch(`http://${baseUrl}/rooms/${roomId}`);
      const data = await res.json();
      if (data.message === "Room not found")
        return notify("Room not found", "error");
      setStep(2);
    } catch {
      notify("Could not fetch room", "error");
    }
  };

  const joinRoom = () => {
    if (!username.trim()) return notify("Username is required", "error");

    if (ws.current?.readyState === WebSocket.OPEN) ws.current.close();

    ws.current = new WebSocket(`ws://${baseUrl}/ws/${roomId}`);
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ username }));
      setConnected(true);
      setMessages([]);
      setStep(3);
      setTimeout(() => messageInputRef.current?.focus(), 100);
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.error) {
        notify(
          data.error === "Username already taken"
            ? "Username taken"
            : data.error,
          "error"
        );
        ws.current.close();
        setConnected(false);
        setStep(2);
        return;
      }

      switch (data.type) {
        case "system":
          setMessages((prev) => [
            ...prev,
            {
              text: data.message,
              username: "System",
              isSystem: true,
            },
          ]);
          // Update active users list based on system messages
          if (data.message.includes("joined")) {
            const joinedUser = data.message.split(" ")[0];
            setActiveUsers((prev) => [
              ...prev.filter((u) => u !== joinedUser),
              joinedUser,
            ]);
          } else if (data.message.includes("left")) {
            const leftUser = data.message.split(" ")[0];
            setActiveUsers((prev) => prev.filter((u) => u !== leftUser));
          }
          break;
        case "chat":
          setMessages((prev) => [
            ...prev,
            {
              text: data.message,
              username: data.username,
              isMine: data.username === username,
            },
          ]);
          break;
        case "users":
          if (data.users) {
            setActiveUsers(data.users.filter((user) => user !== username));
          }
          break;
        default:
          break;
      }
    };

    ws.current.onclose = () => {
      if (connected) notify("Disconnected from chat");
      setConnected(false);
      setMessages([]);
      setActiveUsers([]);
    };

    ws.current.onerror = () => notify("WebSocket error", "error");
  };

  const sendMessage = () => {
    if (!message.trim() || !connected) return;

    ws.current.send(
      JSON.stringify({
        type: "chat",
        message
      })
    );
    
    setMessages((prev) => [
      ...prev,
      {
        text: message,
        username,
        isMine: true,
      },
    ]);
    setMessage("");
  };

  const exitRoom = () => {
    ws.current?.close();
    setConnected(false);
    setMessages([]);
    setStep(1);
    setActiveUsers([]);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center bg-gradient-to-b from-gray-50 to-gray-100">
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        theme="colored"
        className="mt-4"
      />
      
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-800 flex items-center justify-center gap-2">
          <span className="text-blue-600">💬</span> Chat Room
        </h1>
        <p className="text-gray-600 mt-2">Connect and chat with friends in real-time</p>
      </header>

      {step === 1 && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:shadow-2xl">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Get Started</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Join a Room</label>
              <div className="flex group">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                  className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                />
                <button
                  onClick={proceedToUsername}
                  className="bg-blue-600 text-white px-6 py-3 rounded-r-lg hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!roomId.trim()}
                >
                  Join
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Create New Room</label>
              <div className="flex group">
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Room Name"
                  className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all duration-200"
                />
                <button
                  onClick={createRoom}
                  className="bg-green-600 text-white px-6 py-3 rounded-r-lg hover:bg-green-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!newRoom.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:shadow-2xl">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Join Room</h2>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Room ID: <span className="font-semibold text-blue-600">{roomId}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Username</label>
              <div className="flex group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                />
                <button
                  onClick={joinRoom}
                  className="bg-blue-600 text-white px-6 py-3 rounded-r-lg hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!username.trim()}
                >
                  Join Chat
                </button>
              </div>
            </div>
            <button 
              onClick={() => setStep(1)} 
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              ← Back to Rooms
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="w-full max-w-5xl flex gap-6 h-[calc(100vh-8rem)]">
          {/* Chat Area */}
          <div className="flex flex-col flex-grow bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Room: <span className="text-blue-600">{roomId}</span>
                </h2>
                <p className="text-sm text-gray-600">
                  Welcome, <span className="font-medium">{username}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"} animate-pulse`}></div>
                <span className="text-sm font-medium text-gray-600">
                  {connected ? "Online" : "Offline"}
                </span>
                <button
                  onClick={exitRoom}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all duration-200"
                >
                  Leave Room
                </button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto mb-4 bg-gray-50 rounded-lg p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-lg">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl max-w-[70%] ${
                      msg.isSystem 
                        ? "mx-auto bg-gray-200 text-gray-700 text-sm text-center" 
                        : msg.isMine 
                          ? "ml-auto bg-blue-500 text-white" 
                          : "mr-auto bg-gray-100 text-gray-800"
                    } transition-all duration-200 hover:shadow-md`}
                  >
                    {!msg.isSystem && (
                      <span className="font-semibold mb-1">{msg.username}: </span>
                    )}
                    {msg.text}
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>

            <div className="flex group">
              <input
                ref={messageInputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 disabled:bg-gray-100"
                disabled={!connected}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-6 py-3 rounded-r-lg hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!connected || !message.trim()}
              >
                Send
              </button>
            </div>
          </div>

          {/* Users Panel */}
          <div className="w-80 bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Online Users
            </h3>
            <ul className="space-y-3">
              {activeUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No other users online</p>
              ) : (
                activeUsers.map((user) => (
                  <li 
                    key={user} 
                    className="flex items-center gap-2 text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{user}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;