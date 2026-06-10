#!/bin/bash
echo "============================================"
echo "  My Team Budget - Installation"
echo "  Capacity & Budget Cockpit (RUN ManDays)"
echo "============================================"
echo ""

cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

# Check prerequisites
echo "[1/4] Vérification des prérequis..."

if ! command -v python3 &> /dev/null; then
    echo "ERREUR: Python 3 n'est pas installé."
    echo "  → Installez Python 3.9+ depuis https://www.python.org/downloads/"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1)
echo "  Python: $PYTHON_VERSION"

if ! command -v node &> /dev/null; then
    echo "ERREUR: Node.js n'est pas installé."
    echo "  → Installez Node.js 16+ depuis https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version 2>&1)
echo "  Node.js: $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "ERREUR: npm n'est pas installé."
    exit 1
fi
NPM_VERSION=$(npm --version 2>&1)
echo "  npm: $NPM_VERSION"

echo ""

# Backend setup
echo "[2/4] Installation du backend Python..."
cd "$ROOT_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt
echo "  Backend installé."
deactivate
echo ""

# Frontend setup
echo "[3/4] Installation du frontend React (peut prendre quelques minutes)..."
cd "$ROOT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo "  Frontend installé."
echo ""

# Create data directory
echo "[4/4] Initialisation des données..."
mkdir -p "$ROOT_DIR/data"
echo "  Dossier data/ prêt."
echo ""

echo "============================================"
echo "  Installation terminée !"
echo "============================================"
echo ""
echo "Pour lancer l'application :"
echo "  cd $ROOT_DIR"
echo "  ./start.sh"
echo ""
echo "Puis ouvrir : http://localhost:3000"
echo ""
echo "Pour charger des données de démo (optionnel) :"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python seed_data.py"
echo "  python seed_presence.py"
echo ""
