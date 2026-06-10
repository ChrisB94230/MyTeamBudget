#!/bin/bash
echo "=== My Team Budget - Capacity & Budget Cockpit ==="
echo ""

# Start backend
echo "Starting backend (Flask)..."
cd "$(dirname "$0")/backend"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
python app.py &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID) on http://localhost:5001"

# Start frontend
echo "Starting frontend (React)..."
cd "$(dirname "$0")/frontend"
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
