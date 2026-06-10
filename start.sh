#!/bin/bash
cd "$(dirname "$0")"
echo "=== My Team Budget — Capacity & Budget Cockpit ==="
echo ""
echo "Démarrage du serveur..."
echo "  → http://localhost:5001"
echo ""
echo "Ctrl+C pour arrêter."
echo ""
python3 server.py
