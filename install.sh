#!/bin/bash
set -e
echo "============================================"
echo "  My Team Budget - Installation"
echo "  Capacity & Budget Cockpit (RUN ManDays)"
echo "============================================"
echo ""

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

# Check prerequisites
echo "[1/3] Vérification des prérequis..."

if ! command -v node &> /dev/null; then
    echo "ERREUR: Node.js n'est pas installé."
    echo "  → Installez Node.js 18+ depuis https://nodejs.org/"
    exit 1
fi
echo "  Node.js: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "ERREUR: npm n'est pas installé."
    exit 1
fi
echo "  npm: $(npm --version)"
echo ""

# Server setup
echo "[2/3] Installation du serveur (Express + SQLite)..."
cd "$ROOT_DIR/server"
npm install
echo "  Serveur installé."
echo ""

# Frontend setup
echo "[3/3] Installation du frontend React..."
cd "$ROOT_DIR/frontend"
npm install
echo "  Frontend installé."
echo ""

# Seed data
echo "🌱 Création des données de démonstration..."
cd "$ROOT_DIR/server"
node seed.js
echo ""

echo "============================================"
echo "  ✅ Installation terminée !"
echo "============================================"
echo ""
echo "Pour lancer l'application :"
echo "  cd $ROOT_DIR"
echo "  ./start.sh"
echo ""
echo "Puis ouvrir : http://localhost:3000"
echo ""
