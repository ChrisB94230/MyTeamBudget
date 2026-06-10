#!/bin/bash
echo "=== My Team Budget - Capacity & Budget Cockpit ==="
echo ""

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

# Install server deps if needed
if [ ! -d "server/node_modules" ]; then
    echo "Installing server dependencies..."
    cd server && npm install && cd ..
fi

# Start backend (Express + SQLite)
echo "Starting server (Express.js + SQLite)..."
cd "$ROOT_DIR/server"
node server.js &
BACKEND_PID=$!
echo "Server started (PID: $BACKEND_PID) on http://localhost:5001"

# Start frontend
echo "Starting frontend (React)..."
cd "$ROOT_DIR/frontend"
BROWSER=none npm start &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID) on http://localhost:3000"

echo ""
echo "Application ready!"
echo "  Dashboard: http://localhost:3000"
echo "  API:       http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
