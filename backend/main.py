from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, List
from sqlalchemy.exc import IntegrityError
import json, logging, models, crud, database

app = FastAPI()

# logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Store active WebSocket connections with usernames
active_connections: Dict[str, List[Dict[str, WebSocket | str]]] = {}

# Dependency for database session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

MAX_USERS_PER_ROOM = 50

@app.websocket("/messages/{room_id}")
async def websocket_endpoint(room_id: str, websocket: WebSocket):
    # for room validation
    db = database.SessionLocal()
    room = crud.get_room(db, room_id)
    db.close()

    if not room:
        await websocket.close(code=1008) 
        return

    await websocket.accept()

    try:
        initial_data = await websocket.receive_text()
        try:
            initial_message = json.loads(initial_data)
            username = initial_message.get("username", "Anonymous")
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
            await websocket.close(code=1007)  # Invalid data
            return

        # Validate username
        if not (isinstance(username, str) and 3 <= len(username) <= 20 and username.isalnum()):
            await websocket.send_text(json.dumps({"error": "Invalid username"}))
            await websocket.close(code=1003)
            return

        # Check for duplicate username in the room
        if room_id in active_connections:
            for conn in active_connections[room_id]:
                if conn["username"] == username:
                    await websocket.send_text(json.dumps({"error": "Username already in use"}))
                    await websocket.close(code=1003)  # Custom code for duplicate username
                    return

        # Check room capacity
        if room_id in active_connections and len(active_connections[room_id]) >= MAX_USERS_PER_ROOM:
            await websocket.send_text(json.dumps({"error": "Room is full"}))
            await websocket.close(code=1004)  # No space
            return

        # Add the connection with username to the room
        if room_id not in active_connections:
            active_connections[room_id] = []
        connection_info = {"websocket": websocket, "username": username}
        active_connections[room_id].append(connection_info)

        # Notify others in the room about the new user
        join_message = {
            "room_id": room_id,
            "message": f"{username} has joined the room",
            "username": "System",
        }
        for conn in active_connections[room_id]:
            if conn["websocket"] != websocket:
                await conn["websocket"].send_text(json.dumps(join_message))

        # Main message loop
        while True:
            message_data = await websocket.receive_text()
            try:
                message = json.loads(message_data)
                if "message" not in message:
                    raise ValueError("Missing 'message' key")
            except (json.JSONDecodeError, ValueError):
                await websocket.send_text(json.dumps({"error": "Invalid message format"}))
                continue

            broadcast_data = {
                "room_id": room_id,
                "message": message["message"],
                "username": username,
            }
            json_message = json.dumps(broadcast_data)

            disconnected_clients = []
            for conn in active_connections[room_id]:
                if conn["websocket"] != websocket:
                    try:
                        await conn["websocket"].send_text(json_message)
                    except WebSocketDisconnect:
                        disconnected_clients.append(conn)

            for conn in disconnected_clients:
                active_connections[room_id].remove(conn)
                logger.info(f"Removed disconnected client {conn['username']}")

    except WebSocketDisconnect:
        logger.info(f"Client {username} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if room_id in active_connections:
            for conn in active_connections[room_id]:
                if conn["websocket"] == websocket:
                    leave_message = {
                        "room_id": room_id,
                        "message": f"{conn['username']} has left the room",
                        "username": "System",
                    }
                    active_connections[room_id].remove(conn)
                    for remaining_conn in active_connections[room_id]:
                        try:
                            await remaining_conn["websocket"].send_text(json.dumps(leave_message))
                        except WebSocketDisconnect:
                            pass
                    break
            if not active_connections[room_id]:
                del active_connections[room_id]

@app.post("/rooms")
def create_room_handler(room: models.Room, db: Session = Depends(get_db)):
    try:
        db_room = crud.create_room(db, room)
        return {"message": "Room created", "room_id": db_room.name}
    except IntegrityError:
        return {"error": "Room name already exists"}, 400

@app.get("/rooms/{room_id}")
def get_room_handler(room_id: str, db: Session = Depends(get_db)):
    room = crud.get_room(db, room_id)
    if room:
        return {"id": room.id, "name": room.name}
    return {"message": "Room not found"}