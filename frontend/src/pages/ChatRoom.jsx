import { useState, useEffect, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function ChatRoom() {
  const [currentStep, setCurrentStep] = useState(1);
  const [roomId, setRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

  const webSocketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Create a new room
  const createRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Room name cannot be empty");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName }),
      });

      const data = await response.json();
      setRoomId(data.room_id);
      setNewRoomName("");
      toast.success(`Room created with ID: ${data.room_id}`);
      setCurrentStep(2);
    } catch (err) {
      toast.error("Failed to create room");
      console.error("Error creating room:", err);
    }
  };

  // Fetch room information
  const fetchRoom = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/rooms/${id}`);
      const data = await response.json();

      if (data.message === "Room not found") {
        toast.error("Room not found");
        return false;
      }
      return true;
    } catch (err) {
      toast.error("Failed to fetch room");
      console.error("Error fetching room:", err);
      return false;
    }
  };

  // Proceed from room ID to username step
  const proceedToUsername = async () => {
    if (!roomId.trim()) {
      toast.error("Room ID cannot be empty");
      return;
    }

    const roomExists = await fetchRoom(roomId);
    if (roomExists) setCurrentStep(2);
  };

  // Join a chat room
  const joinRoom = () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
  
    // Close any existing connection
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.close();
    }
  
    // Start a new WebSocket connection
    const ws = new WebSocket(`ws://127.0.0.1:8000/messages/${roomId}`);
  
    ws.onopen = () => {
      ws.send(JSON.stringify({ username }));
      setConnected(true);
      setMessages([]);
      setCurrentStep(3);
    };
  
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        toast.error(data.error === "Username already in use" ? "Username is already taken" : data.error);
        ws.close();
        setConnected(false);
        setCurrentStep(2);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            text: data.message,
            username: data.username,
            isMine: data.username === username,
          },
        ]);
      }
    };
  
    ws.onclose = () => {
      if (connected) {
        toast.info("Disconnected from chat room");
      }
      setConnected(false);
    };
  
    ws.onerror = (error) => {
      toast.error("WebSocket connection error");
      console.error("WebSocket error:", error);
    };
  
    webSocketRef.current = ws;
  };

  // Send a message
  const sendMessage = () => {
    if (!message.trim() || !connected) return;

    const messageData = { message };
    webSocketRef.current.send(JSON.stringify(messageData));
    setMessages((prev) => [...prev, { text: message, username, isMine: true }]);
    setMessage("");
  };

  const exitRoom = () => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.close();
    }
    setConnected(false);
    setMessages([]);
    setCurrentStep(1);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webSocketRef.current) webSocketRef.current.close();
    };
  }, []);

  // Handle Enter key press for sending messages
  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <h1 className="text-2xl font-bold mb-6 text-center">Chat Application</h1>

      {/* Step 1: Room ID Entry */}
      {currentStep === 1 && (
        <div className="flex flex-col items-center p-6 border rounded shadow-md">
          <h2 className="text-xl font-semibold mb-6">Enter Room ID</h2>
          <div className="w-full max-w-md mb-6">
            <label className="block text-gray-700 mb-2">
              Enter an existing room ID:
            </label>
            <div className="flex">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                className="flex-grow border rounded p-3 mr-2 focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />
              <button
                onClick={proceedToUsername}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Next
              </button>
            </div>
          </div>
          <div className="w-full max-w-md border-t pt-6 mt-4">
            <label className="block text-gray-700 mb-2">
              Or create a new room:
            </label>
            <div className="flex">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
                className="flex-grow border rounded p-3 mr-2 focus:ring-2 focus:ring-green-300 focus:outline-none"
              />
              <button
                onClick={createRoom}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Username Entry */}
      {currentStep === 2 && (
        <div className="flex flex-col items-center p-6 border rounded shadow-md">
          <h2 className="text-xl font-semibold mb-6">Choose Username</h2>
          <div className="w-full max-w-md mb-6">
            <p className="text-gray-700 mb-4">
              Joining Room ID: <span className="font-semibold">{roomId}</span>
            </p>
            <label className="block text-gray-700 mb-2">
              Choose your username:
            </label>
            <div className="flex">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="flex-grow border rounded p-3 mr-2 focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />
              <button
                onClick={joinRoom}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Join Chat
              </button>
            </div>
          </div>
          <button
            onClick={() => setCurrentStep(1)}
            className="mt-2 text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            ← Back to Room Selection
          </button>
        </div>
      )}

      {/* Step 3: Chat Room */}
      {currentStep === 3 && (
        <div className="flex flex-col flex-grow border rounded p-4 shadow-md">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <div>
              <h2 className="text-lg font-semibold">
                Room: <span className="text-blue-600">{roomId}</span>
              </h2>
              <p className="text-sm text-gray-600">
                Username: <span className="font-medium">{username}</span>
              </p>
            </div>
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="ml-2 text-sm text-gray-600">
                {connected ? "Connected" : "Disconnected"}
              </span>
              <button
                onClick={exitRoom}
                className="ml-4 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
              >
                Exit Room
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-grow overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center mt-8">
                No messages yet. Start chatting!
              </p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 p-3 rounded-lg max-w-xs md:max-w-md ${
                    msg.isMine
                      ? "ml-auto bg-blue-500 text-white"
                      : "mr-auto bg-gray-300"
                  }`}
                >
                  <span className="font-semibold">{msg.username}: </span>
                  {msg.text}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="flex">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-grow border rounded-l p-3 focus:ring-2 focus:ring-blue-300 focus:outline-none"
              disabled={!connected}
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white px-6 py-3 rounded-r hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!connected}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;