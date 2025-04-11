# 💬 ChatApp

A simple real-time chat application using **FastAPI** and **React**. Enter a username and a room ID to start chatting!

---

## 🚀 Features

- 🔁 Real-time messaging with WebSockets
- 👥 Join any chat room by entering a room ID
- 🧑 Anonymous chat using just a username
- 🎨 Clean and responsive UI with React and Tailwind CSS
- 🐍 FastAPI backend with WebSocket support

---

## 🛠️ Tech Stack

**Frontend**
- React (Vite)
- Tailwind CSS

**Backend**
- FastAPI
- WebSockets
- Uvicorn

---


---

## ⚙️ Getting Started

### 🔧 Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
fastapi dev main.py
```

### 🌐 Frontend (FastAPI)

```bash
cd frontend
npm install
npm run dev
```