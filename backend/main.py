from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, List
from sqlalchemy.exc import IntegrityError
import json, logging, models, crud, database

app = FastAPI()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active WebSocket connections
active_connections: Dict[str, List[Dict[str, WebSocket | str]]] = {}

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

MAX_USERS_PER_ROOM = 50

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(room_id: str, websocket: WebSocket):
    db = database.SessionLocal()
    room = crud.get_room(db, room_id)
    db.close()

    if not room:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    try:
        init_data = await websocket.receive_text()
        init_json = json.loads(init_data)
        username = init_json.get("username", "Anonymous")

        if not username or not username.isalnum() or len(username) < 3:
            await websocket.send_text(json.dumps({"error": "Invalid username"}))
            await websocket.close(code=1003)
            return

        if room_id not in active_connections:
            active_connections[room_id] = []

        if any(conn["username"] == username for conn in active_connections[room_id]):
            await websocket.send_text(json.dumps({"error": "Username is already taken"}))
            await websocket.close(code=1003)
            return

        if len(active_connections[room_id]) >= MAX_USERS_PER_ROOM:
            await websocket.send_text(json.dumps({"error": "Room is full"}))
            await websocket.close(code=1004)
            return

        connection_info = {"websocket": websocket, "username": username}
        active_connections[room_id].append(connection_info)

        # Send join message
        join_message = {
            "type": "system",
            "message": f"{username} joined the room",
            "username": "System",
        }
        
        # Send updated user list to all clients
        user_list = {
            "type": "users",
            "users": [conn["username"] for conn in active_connections[room_id]]
        }
        
        for conn in active_connections[room_id]:
            # Send join message to everyone except the new user
            if conn["websocket"] != websocket:
                await conn["websocket"].send_text(json.dumps(join_message))
            
            # Send updated user list to everyone
            await conn["websocket"].send_text(json.dumps(user_list))

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type", "chat")  # Default to chat if no type specified

                if msg_type == "chat":
                    content = {
                        "type": "chat",
                        "message": message.get("message", ""),
                        "username": username
                    }
                    # Send chat messages to everyone except sender
                    for conn in active_connections[room_id]:
                        if conn["websocket"] != websocket:
                            await conn["websocket"].send_text(json.dumps(content))
                
                elif msg_type in ["offer", "answer", "candidate"]:
                    target = message.get("target")
                    content = {
                        "type": msg_type,
                        "username": username,
                        "sdp": message.get("sdp"),
                        "candidate": message.get("candidate"),
                        "sdpMid": message.get("sdpMid"),
                        "sdpMLineIndex": message.get("sdpMLineIndex")
                    }
                    # Send WebRTC signals only to the target user
                    for conn in active_connections[room_id]:
                        if conn["username"] == target:
                            await conn["websocket"].send_text(json.dumps(content))
                            break

            except Exception as e:
                logger.error(f"Error processing message: {e}")

    except WebSocketDisconnect:
        logger.info(f"{username} disconnected")
    finally:
        if room_id in active_connections:
            # Find and remove the user from active connections
            for i, conn in enumerate(active_connections[room_id]):
                if conn["websocket"] == websocket:
                    active_connections[room_id].pop(i)
                    
                    # Send leave message to remaining users
                    leave_msg = {
                        "type": "system",
                        "message": f"{username} left",
                        "username": "System",
                    }
                    
                    # Update user list
                    user_list = {
                        "type": "users",
                        "users": [c["username"] for c in active_connections[room_id]]
                    }
                    
                    for other_conn in active_connections[room_id]:
                        await other_conn["websocket"].send_text(json.dumps(leave_msg))
                        await other_conn["websocket"].send_text(json.dumps(user_list))
                    break
                    
            # Clean up empty rooms
            if not active_connections[room_id]:
                del active_connections[room_id]

@app.post("/rooms")
def create_room_handler(room: models.Room, db: Session = Depends(get_db)):
    try:
        db_room = crud.create_room(db, room)
        return {"message": "Room created", "room_id": db_room.name}
    except IntegrityError:
        return {"error": "Room already exists"}, 400

@app.get("/rooms/{room_id}")
def get_room_handler(room_id: str, db: Session = Depends(get_db)):
    room = crud.get_room(db, room_id)
    if room:
        return {"id": room.id, "name": room.name}
    return {"message": "Room not found"}