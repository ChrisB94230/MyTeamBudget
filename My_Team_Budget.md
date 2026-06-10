# My Team Budget — Capacity & Budget Cockpit (RUN en Man Days)

## Contexte

Dans le cadre du pilotage capacitaire et budgétaire de l'équipe d'architectes, un besoin a été identifié pour :

- Centraliser la gestion des ressources (réelles et fictives)
- Intégrer les prévisions d'entrées et sorties de ressources
- Suivre la consommation du budget RUN en Man Days
- Suivre le temps de présence et les congés pour anticiper les risques d'arrêt anticipé
- Fournir un dashboard clair pour le pilotage managérial (type CoDir / CVAC)

---

## Objectifs

- Fournir une vision consolidée :
  - Capacité (ETP / Man Days)
  - Consommation
  - Prévision
  - Temps de présence
- Permettre :
  - L'anticipation des dérives budgétaires
  - L'aide à la décision (staffing, arbitrage externes)
  - Le suivi des congés pour éviter les arrêts anticipés de prestas

---

## Architecture technique

### Stack

- **Frontend** : React 18 + Material UI 5 + Recharts
- **Backend** : Python Flask (API REST)
- **Stockage** : Fichiers Excel (.xlsx) via openpyxl/pandas
- **Exécution** : 100% local (pas de serveur distant, pas de base de données)

### Schéma d'architecture

```
┌─────────────────────┐     HTTP/JSON      ┌──────────────────────┐
│                     │  ◄──────────────►  │                      │
│   Frontend React    │    localhost:3000   │   Backend Flask      │
│   Material UI       │                    │   localhost:5001      │
│   Recharts          │                    │                      │
│                     │                    │   data_service.py    │
└─────────────────────┘                    └──────────┬───────────┘
                                                      │
                                                      ▼
                                           ┌──────────────────────┐
                                           │   data/ (Excel)      │
                                           │                      │
                                           │   resources.xlsx     │
                                           │   consumption.xlsx   │
                                           │   previsions.xlsx    │
                                           │   presence.xlsx      │
                                           │   settings.xlsx      │
                                           └──────────────────────┘
```

### Structure du projet

```
MyBudget/
├── start.sh                          # Script de démarrage (backend + frontend)
├── My_Team_Budget.md                 # Ce fichier
│
├── backend/
│   ├── app.py                        # Routes API Flask
│   ├── data_service.py               # Logique métier + accès données Excel
│   ├── requirements.txt              # Dépendances Python
│   ├── seed_data.py                  # Script de données de démo
│   ├── seed_presence.py              # Script de données présence de démo
│   └── venv/                         # Environnement virtuel Python
│
├── data/
│   ├── resources.xlsx                # Ressources (réelles + fictives)
│   ├── consumption.xlsx              # Consommation mensuelle par ressource
│   ├── previsions.xlsx               # Prévisions d'entrées/sorties
│   ├── presence.xlsx                 # Jours travaillés par mois/ressource
│   ├── settings.xlsx                 # Paramètres globaux par année
│   └── _template_import.xlsx         # Template d'import Excel
│
└── frontend/
    ├── package.json
    ├── public/
    └── src/
        ├── index.js
        ├── App.js                    # Routes + thème Material UI
        ├── components/
        │   ├── Layout.js             # Drawer + AppBar + navigation
        │   └── YearSelector.js       # Composant sélecteur d'année
        ├── pages/
        │   ├── Dashboard.js          # Dashboard principal
        │   ├── Resources.js          # Gestion des ressources + import Excel
        │   ├── Consumption.js        # Saisie consommation budget RUN
        │   ├── Previsions.js         # Entrées/sorties prévisionnelles
        │   ├── Presence.js           # Suivi temps de présence + alertes congés
        │   └── Settings.js           # Paramètres globaux (enveloppe, réduction)
        └── services/
            └── api.js                # Client Axios vers l'API Flask
```

---

## Fonctionnalités développées

### 1. Dashboard (`/dashboard`)

Vue synthétique pour le pilotage managérial.

**Bandeau Enveloppe Budgétaire** (conditionnel — affiché si configuré) :
- Budget global alloué par la direction
- Réduction appliquée (avec motif : effort productivité, gel budgétaire...)
- Budget net enveloppe = alloué - réduction
- Écart entre le budget réel (somme des ressources) et l'enveloppe
- Indicateur visuel vert (sous l'enveloppe) / rouge (dépassement)

**4 KPI cards** :
- Budget Total (jours RUN + nb ressources)
- Consommé (jours + % du budget)
- Budget Restant (avec alerte si dépassement)
- ETP total (ventilation Interne / Externe)

**Graphiques** :
- Bar chart : Budget vs Consommation mensuelle
- Pie chart : Répartition du budget par activité (TRANSV, DATA, CYBER, etc.)
- Line chart : Courbe cumulée budget vs consommation
- Pie chart : Répartition Interne / Externe

**Alertes Temps de Présence** (remontées automatiques) :
- Affichage des ressources en risque d'épuisement anticipé
- Lien direct vers la page Temps de Présence

**Prévisions d'Entrées / Sorties** :
- Chips visuels pour les entrées (vert) et sorties (rouge) prévues

### 2. Gestion des Ressources (`/resources`)

**Ajout unitaire** — Formulaire avec :
- Nom, Activité, Tribu, Statut (Interne/Externe)
- ETP (0 à 1), Répartition RUN (0 à 1)
- Nb jours total/an (défaut : 206 Interne, 210 Externe)
- Année, Flag "Ressource fictive"
- Ventilation mensuelle (auto-distribuée si laissée vide)
- Calcul automatique : `nb_jours_run = nb_jours_total × ETP × répartition_run`

**Import Excel** — Flux en 3 étapes :
1. **Sélection** : upload d'un fichier .xlsx + téléchargement d'un template
2. **Preview** : tableau de vérification avec checkbox par ligne, warnings, colonnes ignorées
3. **Confirmation** : import des lignes sélectionnées

Mapping de colonnes intelligent :
- Reconnaît les noms FR/EN/abrégés (Nom/Name/Ressource, Statut/Status, ETP/FTE...)
- Mois par nom (Jan/Janvier), numéro (01/1), ou abrégé
- Insensible à la casse

**Tableau de gestion** :
- Vue complète avec ventilation mensuelle
- Chips de statut (Interne vert / Externe orange)
- Badge "Fictive" pour les ressources prévisionnelles
- Actions : modifier, supprimer

### 3. Saisie de la Consommation (`/consumption`)

- Tableau avec une cellule de saisie par mois par ressource
- Colonne Budget (jours RUN alloués)
- Colonne Total (somme des jours consommés)
- Colonne Reste avec chip coloré (vert/orange/rouge)
- Fond rouge si la saisie dépasse le budget mensuel
- Sauvegarde en un clic

### 4. Prévisions d'Entrées / Sorties (`/previsions`)

**2 onglets** : Entrées / Sorties

**Entrées prévisionnelles** :
- Embauche, Remplacement, Renfort, Mobilité interne, Prestation
- Date d'effet, ETP, Répartition RUN
- Distribution automatique des jours à partir de la date d'effet

**Sorties prévisionnelles** :
- Fin de contrat, Retraite, Démission, Mobilité interne, Fin de prestation
- Congé maternité, Congé longue durée
- Impact budgétaire calculé automatiquement

### 5. Temps de Présence (`/presence`)

Suivi des jours travaillés pour s'assurer que les ressources prennent leurs congés et éviter les arrêts anticipés.

**Onglet "Saisie & Suivi"** :
- Tableau de saisie des jours travaillés par mois
- Limite annuelle par ressource (nb_jours_total × ETP)
- Barre de progression visuelle (vert → orange → rouge)
- Indicateur d'alerte par ligne
- Cellule en rouge si dépassement des jours ouvrables du mois

**Onglet "Analyse des risques"** :
- Rythme mensuel réel vs rythme théorique attendu
- Projection annuelle : si la personne continue au même rythme, combien de jours en fin d'année ?
- Mois d'épuisement prévu (ex: "Novembre" = le presta doit s'arrêter en novembre)
- Congés pris vs congés attendus à date
- Diagnostic textuel par ressource
- Tri par criticité (alertes critiques en premier)

**Onglet "Vue graphique"** :
- Bar chart : jours travaillés vs jours ouvrables par mois (équipe)
- Bar chart horizontal : projection individuelle vs limite annuelle

**Logique d'alerte** :
| Niveau | Condition | Exemple |
|--------|-----------|---------|
| **Critique** | Budget épuisé avant octobre (mois 9) | Presta 210j qui aura tout consommé en septembre |
| **Warning** | Budget épuisé avant décembre (mois 11) | Risque d'arrêt en novembre |
| **Warning** | Projection dépasse la limite de +5% | Projection 220j pour une limite de 210j |
| **Warning** | Très peu de congés pris (< 50% des attendus) | 3j de congés pris au lieu de 10j attendus |

### 6. Paramètres Globaux (`/settings`)

**Enveloppe Budgétaire** :
- Budget global alloué (jours)
- Réduction à appliquer (jours) + motif
- Budget net calculé automatiquement

**Paramètres de Calcul** :
- Jours ouvrables par an pour les Internes (défaut : 206)
- Jours ouvrables par an pour les Externes (défaut : 210)

**Notes** :
- Champ libre pour commentaires par année budgétaire

---

## Modèle de données

### resources.xlsx

| Colonne | Type | Description |
|---------|------|-------------|
| id | int | Identifiant unique |
| name | str | Nom de la ressource |
| activite | str | Activité (TRANSV, DATA, CYBER, etc.) |
| tribu | str | Tribu |
| statut | str | "Interne" ou "Externe" |
| etp | float | Equivalent temps plein (0 à 1) |
| repartition_run | float | Part du temps allouée au RUN (0 à 1) |
| nb_jours_total | int | Jours ouvrables par an (206/210) |
| nb_jours_run | float | = nb_jours_total × etp × repartition_run |
| year | int | Année |
| is_fictive | bool | Ressource fictive (prévision) |
| jan...dec | float | Ventilation mensuelle en jours |

### consumption.xlsx

| Colonne | Type | Description |
|---------|------|-------------|
| year | int | Année |
| month | int | Mois (1-12) |
| resource_id | int | Référence vers resources.id |
| consumed | float | Jours consommés |

### previsions.xlsx

| Colonne | Type | Description |
|---------|------|-------------|
| id | int | Identifiant unique |
| type | str | "entree" ou "sortie" |
| name | str | Description |
| activite | str | Activité |
| statut | str | Interne / Externe |
| etp | float | ETP |
| repartition_run | float | Répartition RUN |
| date_effet | date | Date d'effet (YYYY-MM-DD) |
| motif | str | Motif (Embauche, Fin de contrat, etc.) |
| year | int | Année |
| jan...dec | float | Impact mensuel en jours |

### presence.xlsx

| Colonne | Type | Description |
|---------|------|-------------|
| year | int | Année |
| month | int | Mois (1-12) |
| resource_id | int | Référence vers resources.id |
| jours_travailles | float | Jours effectivement travaillés |

### settings.xlsx

| Colonne | Type | Description |
|---------|------|-------------|
| year | int | Année |
| budget_global_alloue | float | Enveloppe budgétaire allouée (jours) |
| reduction_jours | float | Réduction à appliquer |
| label_reduction | str | Motif de la réduction |
| nb_jours_ouvrables_interne | int | Base de calcul Internes |
| nb_jours_ouvrables_externe | int | Base de calcul Externes |
| notes | str | Notes libres |

---

## API REST

### Ressources
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/resources?year=` | Liste des ressources |
| POST | `/api/resources` | Ajout unitaire |
| PUT | `/api/resources/:id` | Modification |
| DELETE | `/api/resources/:id` | Suppression |
| POST | `/api/resources/import/preview` | Preview import Excel (multipart) |
| POST | `/api/resources/import/confirm` | Confirmation import |
| GET | `/api/resources/import/template` | Télécharger le template Excel |

### Consommation
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/consumption?year=` | Consommation par année |
| POST | `/api/consumption` | Mise à jour d'une entrée |

### Prévisions
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/previsions?year=` | Liste des prévisions |
| POST | `/api/previsions` | Ajout |
| PUT | `/api/previsions/:id` | Modification |
| DELETE | `/api/previsions/:id` | Suppression |

### Temps de Présence
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/presence?year=` | Données de présence brutes |
| POST | `/api/presence` | Mise à jour (unitaire ou bulk) |
| GET | `/api/presence/dashboard?year=` | Dashboard présence avec alertes |

### Paramètres
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/settings?year=` | Paramètres d'une année |
| POST | `/api/settings` | Mise à jour paramètres |
| GET | `/api/settings/all` | Tous les paramètres |

### Autres
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/dashboard?year=` | Données complètes du dashboard |
| GET | `/api/years` | Liste des années disponibles |

---

## Installation et lancement

### Prérequis

- Python 3.9+
- Node.js 16+
- npm

### Installation

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Lancement

**Option 1 — Script unifié :**
```bash
./start.sh
```

**Option 2 — Manuellement :**
```bash
# Terminal 1 — Backend
cd backend
source venv/bin/activate
python app.py
# → http://localhost:5001

# Terminal 2 — Frontend
cd frontend
npm start
# → http://localhost:3000
```

### Données de démo

```bash
cd backend
source venv/bin/activate
python seed_data.py        # Ressources, consommation, prévisions
python seed_presence.py    # Données de présence
```

---

## Constantes métier

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| Jours ouvrables Interne | 206 j/an | Configurable dans Paramètres |
| Jours ouvrables Externe | 210 j/an | Configurable dans Paramètres |
| Jours ouvrables par mois | 22, 21, 21, 21, 19, 20, 23, 21, 22, 21, 20, 20 | Jan à Déc |
| Activités | TRANSV, CBI/TBS, DATA, STRAT, CSI/FIT, CYBER, CLOUD, CMI | Liste extensible |

---

## Sécurité et contraintes

- **100% local** : aucune donnée ne quitte le poste
- Pas d'authentification nécessaire (usage mono-utilisateur local)
- Les fichiers Excel dans `data/` constituent la source de vérité
- Sauvegarde des données = copie du dossier `data/`
