import { useEffect, useRef, useState } from "react";

function App() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);

  const connectWebSocket = () => {
    if (username.trim() === "") return;

    ws.current = new WebSocket(`ws://localhost:8000/ws/${username}`);
    ws.current.onopen = () => {
      setConnected(true);
    };
    ws.current.onmessage = (event) => {
      setChat((prev) => [...prev, event.data]);
    };
    ws.current.onclose = () => {
      setConnected(false);
    };
  };

  const sendMessage = () => {
    if (ws.current && connected && message.trim() !== "") {
      ws.current.send(message);
      setMessage("");
    }
  };

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      {!connected ? (
        <div>
          <h2>Enter your username to join chat</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
          />
          <button onClick={connectWebSocket}>Join</button>
        </div>
      ) : (
        <div>
          <h2>Welcome, {username}!</h2>
          <div
            style={{
              border: "1px solid #ccc",
              height: "300px",
              overflowY: "auto",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            {chat.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type message"
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      )}
    </div>
  );
}

export default App;
