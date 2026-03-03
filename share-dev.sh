#!/bin/bash

echo "🚀 Starting Development Server with ngrok Sharing..."

# Start backend
echo "📡 Starting backend..."
cd backend
PYTHONPATH=src/backend uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start ngrok for backend
echo "🌐 Starting ngrok for backend..."
ngrok http 8000 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Start frontend with ngrok URL
echo "🎨 Starting frontend..."
cd ../frontend
NGROK_URL=https://transpiratory-unfairly-althea.ngrok-free.app npm run dev:network &
FRONTEND_PID=$!

echo "✅ All services started!"
echo "📊 Backend: http://localhost:8000"
echo "🌐 Backend (External): https://transpiratory-unfairly-althea.ngrok-free.app"
echo "🎨 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
wait

# Cleanup on exit
kill $BACKEND_PID $NGROK_PID $FRONTEND_PID 2>/dev/null
