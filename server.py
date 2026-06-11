#!/usr/bin/env python3
"""
My Team Budget — Serveur autonome (zéro dépendance externe)
Utilise uniquement des modules built-in Python : http.server, sqlite3, json
Sert l'API REST + les fichiers statiques du frontend pré-buildé.
"""

import os
import sys
import json
import sqlite3
import math
import cgi
import tempfile
import shutil
import zipfile
import re
import logging
import traceback
import xml.etree.ElementTree as ET
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from io import BytesIO
from logging.handlers import RotatingFileHandler

PORT = 5001
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

# ==================== LOGGING ====================

os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger('budget_server')
logger.setLevel(logging.DEBUG)

# File handler — rotating 5 MB x 3 backups, in logs/server.log
_fh = RotatingFileHandler(
    os.path.join(LOG_DIR, 'server.log'),
    maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8',
)
_fh.setLevel(logging.DEBUG)
_fh.setFormatter(logging.Formatter(
    '%(asctime)s [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
))
logger.addHandler(_fh)

# Console handler — INFO and above
_ch = logging.StreamHandler(sys.stderr)
_ch.setLevel(logging.INFO)
_ch.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
logger.addHandler(_ch)
DB_PATH = os.path.join(DATA_DIR, 'budget.db')
BUILD_DIR = os.path.join(BASE_DIR, 'frontend', 'build')

MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
JOURS_OUVRABLES_PAR_MOIS = [22, 21, 21, 21, 19, 20, 23, 21, 22, 21, 20, 20]


# ==================== DATABASE ====================

def get_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            activite TEXT DEFAULT '',
            tribu TEXT DEFAULT '',
            statut TEXT DEFAULT 'Interne',
            etp REAL DEFAULT 1,
            repartition_run REAL DEFAULT 1,
            nb_jours_total REAL DEFAULT 206,
            nb_jours_run REAL DEFAULT 0,
            year INTEGER NOT NULL,
            is_fictive INTEGER DEFAULT 0,
            jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
            apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
            jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
            oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS consumption (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            resource_id INTEGER NOT NULL,
            consumed REAL DEFAULT 0,
            UNIQUE(year, month, resource_id)
        );
        CREATE TABLE IF NOT EXISTS previsions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'entree',
            name TEXT NOT NULL,
            activite TEXT DEFAULT '',
            tribu TEXT DEFAULT '',
            statut TEXT DEFAULT 'Interne',
            etp REAL DEFAULT 1,
            repartition_run REAL DEFAULT 1,
            date_effet TEXT DEFAULT '',
            motif TEXT DEFAULT '',
            year INTEGER NOT NULL,
            nb_jours_run REAL DEFAULT 0,
            jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
            apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
            jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
            oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER UNIQUE NOT NULL,
            budget_global_alloue REAL DEFAULT 0,
            reduction_jours REAL DEFAULT 0,
            label_reduction TEXT DEFAULT '',
            nb_jours_ouvrables_interne REAL DEFAULT 206,
            nb_jours_ouvrables_externe REAL DEFAULT 210,
            notes TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS presence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            resource_id INTEGER NOT NULL,
            jours_travailles REAL DEFAULT 0,
            UNIQUE(year, month, resource_id)
        );
    ''')
    conn.commit()
    conn.close()


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    if 'is_fictive' in d:
        d['is_fictive'] = bool(d['is_fictive'])
    return d


def rd(val, decimals=2):
    """Round to n decimals."""
    f = 10 ** decimals
    return math.floor(val * f + 0.5) / f


def safe_float(val, default=0):
    if val is None:
        return default
    try:
        f = float(val)
        return f if not math.isnan(f) else default
    except (ValueError, TypeError):
        return default


# ==================== RESOURCES ====================

def get_resources(year=None):
    conn = get_db()
    if year:
        rows = conn.execute('SELECT * FROM resources WHERE year=?', (year,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM resources').fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


def add_resource(data):
    if not data.get('nb_jours_total'):
        data['nb_jours_total'] = 206 if data.get('statut') == 'Interne' else 210

    etp = safe_float(data.get('etp'), 1)
    run = safe_float(data.get('repartition_run'), 1)
    total = safe_float(data.get('nb_jours_total'))
    data['nb_jours_run'] = rd(total * etp * run)

    has_months = any(safe_float(data.get(m)) > 0 for m in MONTHS)
    if not has_months:
        monthly = rd(data['nb_jours_run'] / 12)
        for m in MONTHS:
            data[m] = monthly

    conn = get_db()
    cur = conn.execute('''
        INSERT INTO resources (name, activite, tribu, statut, etp, repartition_run,
            nb_jours_total, nb_jours_run, year, is_fictive,
            jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        data.get('name', ''), data.get('activite', ''), data.get('tribu', ''),
        data.get('statut', 'Interne'), etp, run, total, data['nb_jours_run'],
        int(safe_float(data.get('year'), datetime.now().year)),
        1 if data.get('is_fictive') else 0,
        safe_float(data.get('jan')), safe_float(data.get('feb')),
        safe_float(data.get('mar')), safe_float(data.get('apr')),
        safe_float(data.get('may')), safe_float(data.get('jun')),
        safe_float(data.get('jul')), safe_float(data.get('aug')),
        safe_float(data.get('sep')), safe_float(data.get('oct')),
        safe_float(data.get('nov')), safe_float(data.get('dec')),
    ))
    conn.commit()
    row = conn.execute('SELECT * FROM resources WHERE id=?', (cur.lastrowid,)).fetchone()
    conn.close()
    return row_to_dict(row)


def update_resource(resource_id, data):
    conn = get_db()
    existing = conn.execute('SELECT * FROM resources WHERE id=?', (resource_id,)).fetchone()
    if not existing:
        conn.close()
        return None

    d = dict(existing)
    for k, v in data.items():
        if k == 'id':
            continue
        if k in d:
            d[k] = v

    etp = safe_float(d['etp'])
    run = safe_float(d['repartition_run'])
    total = safe_float(d['nb_jours_total'])
    d['nb_jours_run'] = rd(total * etp * run)
    d['is_fictive'] = 1 if d.get('is_fictive') else 0

    conn.execute('''
        UPDATE resources SET name=?, activite=?, tribu=?, statut=?, etp=?,
            repartition_run=?, nb_jours_total=?, nb_jours_run=?, year=?, is_fictive=?,
            jan=?, feb=?, mar=?, apr=?, may=?, jun=?,
            jul=?, aug=?, sep=?, oct=?, nov=?, dec=?
        WHERE id=?
    ''', (
        d['name'], d['activite'], d['tribu'], d['statut'], d['etp'],
        d['repartition_run'], d['nb_jours_total'], d['nb_jours_run'],
        d['year'], d['is_fictive'],
        d['jan'], d['feb'], d['mar'], d['apr'], d['may'], d['jun'],
        d['jul'], d['aug'], d['sep'], d['oct'], d['nov'], d['dec'],
        resource_id,
    ))
    conn.commit()
    row = conn.execute('SELECT * FROM resources WHERE id=?', (resource_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


def delete_resource(resource_id):
    conn = get_db()
    cur = conn.execute('DELETE FROM resources WHERE id=?', (resource_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


# ==================== IMPORT (JSON-based, Excel parsing done in frontend) ====================

def bulk_add_resources(rows):
    added = [add_resource(r) for r in rows]
    return {'added': len(added), 'resources': added}


# ==================== CONSUMPTION ====================

def get_consumption(year=None):
    conn = get_db()
    if year:
        rows = conn.execute('SELECT * FROM consumption WHERE year=?', (year,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM consumption').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_consumption(data):
    conn = get_db()
    conn.execute('''
        INSERT INTO consumption (year, month, resource_id, consumed)
        VALUES (?,?,?,?)
        ON CONFLICT(year, month, resource_id) DO UPDATE SET consumed=?
    ''', (data['year'], data['month'], data['resource_id'],
          data['consumed'], data['consumed']))
    conn.commit()
    conn.close()


# ==================== PREVISIONS ====================

def get_previsions(year=None):
    conn = get_db()
    if year:
        rows = conn.execute('SELECT * FROM previsions WHERE year=?', (year,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM previsions').fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


def add_prevision(data):
    if not data.get('nb_jours_total'):
        data['nb_jours_total'] = 206 if data.get('statut') == 'Interne' else 210

    etp = safe_float(data.get('etp'), 1)
    run = safe_float(data.get('repartition_run'), 1)
    total = safe_float(data.get('nb_jours_total'), 206)
    data['nb_jours_run'] = rd(total * etp * run)

    date_effet = data.get('date_effet', '')
    has_months = any(safe_float(data.get(m)) > 0 for m in MONTHS)
    if date_effet and not has_months:
        _distribute_prevision_months(data, date_effet)

    conn = get_db()
    cur = conn.execute('''
        INSERT INTO previsions (type, name, activite, tribu, statut, etp, repartition_run,
            date_effet, motif, year, nb_jours_run,
            jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        data.get('type', 'entree'), data.get('name', ''),
        data.get('activite', ''), data.get('tribu', ''),
        data.get('statut', 'Interne'), etp, run,
        date_effet, data.get('motif', ''),
        int(safe_float(data.get('year'), datetime.now().year)),
        data['nb_jours_run'],
        safe_float(data.get('jan')), safe_float(data.get('feb')),
        safe_float(data.get('mar')), safe_float(data.get('apr')),
        safe_float(data.get('may')), safe_float(data.get('jun')),
        safe_float(data.get('jul')), safe_float(data.get('aug')),
        safe_float(data.get('sep')), safe_float(data.get('oct')),
        safe_float(data.get('nov')), safe_float(data.get('dec')),
    ))
    conn.commit()
    row = conn.execute('SELECT * FROM previsions WHERE id=?', (cur.lastrowid,)).fetchone()
    conn.close()
    return row_to_dict(row)


def update_prevision(prevision_id, data):
    conn = get_db()
    existing = conn.execute('SELECT * FROM previsions WHERE id=?', (prevision_id,)).fetchone()
    if not existing:
        conn.close()
        return None

    d = dict(existing)
    for k, v in data.items():
        if k == 'id':
            continue
        if k in d:
            d[k] = v

    conn.execute('''
        UPDATE previsions SET type=?, name=?, activite=?, tribu=?, statut=?, etp=?,
            repartition_run=?, date_effet=?, motif=?, year=?, nb_jours_run=?,
            jan=?, feb=?, mar=?, apr=?, may=?, jun=?,
            jul=?, aug=?, sep=?, oct=?, nov=?, dec=?
        WHERE id=?
    ''', (
        d['type'], d['name'], d['activite'], d['tribu'], d['statut'],
        d['etp'], d['repartition_run'], d['date_effet'], d['motif'],
        d['year'], d['nb_jours_run'],
        d['jan'], d['feb'], d['mar'], d['apr'], d['may'], d['jun'],
        d['jul'], d['aug'], d['sep'], d['oct'], d['nov'], d['dec'],
        prevision_id,
    ))
    conn.commit()
    row = conn.execute('SELECT * FROM previsions WHERE id=?', (prevision_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


def delete_prevision(prevision_id):
    conn = get_db()
    cur = conn.execute('DELETE FROM previsions WHERE id=?', (prevision_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def apply_resource_exit(data):
    """
    Sortie simplifiée : sélectionner une ressource existante, date d'effet, motif.
    - Crée une prévision de sortie à partir des infos de la ressource
    - Met à 0 les mois de la ressource après la date de départ
    - Recalcule nb_jours_run
    """
    resource_id = data.get('resource_id')
    date_effet = data.get('date_effet', '')
    motif = data.get('motif', '')
    year = data.get('year')

    conn = get_db()
    res = conn.execute('SELECT * FROM resources WHERE id=?', (resource_id,)).fetchone()
    if not res:
        conn.close()
        return {'error': 'Ressource non trouvée'}

    res = dict(res)
    if not year:
        year = res['year']

    # Determine the departure month (0-indexed)
    try:
        dt = datetime.strptime(date_effet, '%Y-%m-%d')
        depart_month = dt.month - 1  # 0 = jan
    except ValueError:
        conn.close()
        return {'error': 'Date d\'effet invalide (format: YYYY-MM-DD)'}

    # Save original monthly values for the prevision record (what we're removing)
    prev_months = {}
    for i, m in enumerate(MONTHS):
        if i >= depart_month:
            prev_months[m] = -(res[m] or 0)  # negative = sortie
        else:
            prev_months[m] = 0

    # Create the prevision record
    nb_jours_removed = sum(abs(v) for v in prev_months.values())
    prev_data = {
        'type': 'sortie', 'name': res['name'],
        'activite': res['activite'] or '', 'tribu': res['tribu'] or '',
        'statut': res['statut'], 'etp': res['etp'],
        'repartition_run': res['repartition_run'],
        'date_effet': date_effet, 'motif': motif,
        'year': year, 'nb_jours_run': rd(nb_jours_removed),
        'resource_id': resource_id,
    }
    prev_data.update(prev_months)

    cur = conn.execute('''
        INSERT INTO previsions (type, name, activite, tribu, statut, etp, repartition_run,
            date_effet, motif, year, nb_jours_run,
            jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        'sortie', res['name'], res['activite'] or '', res['tribu'] or '',
        res['statut'], res['etp'], res['repartition_run'],
        date_effet, motif, year, rd(nb_jours_removed),
        prev_months['jan'], prev_months['feb'], prev_months['mar'],
        prev_months['apr'], prev_months['may'], prev_months['jun'],
        prev_months['jul'], prev_months['aug'], prev_months['sep'],
        prev_months['oct'], prev_months['nov'], prev_months['dec'],
    ))
    prevision_id = cur.lastrowid

    # Zero out the resource months after departure
    updates = {}
    for i, m in enumerate(MONTHS):
        if i >= depart_month:
            updates[m] = 0

    set_clause = ', '.join(f'{m}=?' for m in updates.keys())
    new_run = sum(res[m] or 0 for i, m in enumerate(MONTHS) if i < depart_month)
    conn.execute(
        f'UPDATE resources SET {set_clause}, nb_jours_run=? WHERE id=?',
        list(updates.values()) + [rd(new_run), resource_id]
    )
    conn.commit()

    prev_row = conn.execute('SELECT * FROM previsions WHERE id=?', (prevision_id,)).fetchone()
    updated_res = conn.execute('SELECT * FROM resources WHERE id=?', (resource_id,)).fetchone()
    conn.close()

    return {
        'prevision': row_to_dict(prev_row),
        'resource': row_to_dict(updated_res),
        'jours_removed': rd(nb_jours_removed),
    }


def apply_resource_entry(data):
    """
    Entrée prévisionnelle : crée une nouvelle ressource avec budget distribué
    à partir de la date d'effet, et crée la prévision associée.
    """
    date_effet = data.get('date_effet', '')
    try:
        dt = datetime.strptime(date_effet, '%Y-%m-%d')
        start_month = dt.month - 1
    except ValueError:
        start_month = 0

    year = data.get('year', datetime.now().year)
    etp = safe_float(data.get('etp'), 1)
    run = safe_float(data.get('repartition_run'), 1)
    nb_jours_total = safe_float(data.get('nb_jours_total'),
                                 206 if data.get('statut') == 'Interne' else 210)
    nb_jours_run = rd(nb_jours_total * etp * run)

    # Distribute budget only on active months
    active_months = 12 - start_month
    monthly_val = rd(nb_jours_run / 12) if active_months > 0 else 0

    month_data = {}
    for i, m in enumerate(MONTHS):
        month_data[m] = monthly_val if i >= start_month else 0

    # Create the resource
    resource = add_resource({
        'name': data.get('name', ''),
        'activite': data.get('activite', ''),
        'tribu': data.get('tribu', ''),
        'statut': data.get('statut', 'Interne'),
        'etp': etp, 'repartition_run': run,
        'nb_jours_total': nb_jours_total,
        'year': year,
        **month_data,
    })

    # Create the prevision record
    prev = add_prevision({
        'type': 'entree', 'name': data.get('name', ''),
        'activite': data.get('activite', ''),
        'tribu': data.get('tribu', ''),
        'statut': data.get('statut', 'Interne'),
        'etp': etp, 'repartition_run': run,
        'date_effet': date_effet, 'motif': data.get('motif', ''),
        'year': year,
        **month_data,
    })

    return {
        'prevision': prev,
        'resource': resource,
    }


def _distribute_prevision_months(data, date_effet):
    try:
        dt = datetime.strptime(date_effet, '%Y-%m-%d')
        start_month = dt.month - 1
    except ValueError:
        start_month = 0

    nb_jours_run = safe_float(data.get('nb_jours_run'))
    monthly = rd(nb_jours_run / 12)
    ptype = data.get('type', 'entree')
    for i, m in enumerate(MONTHS):
        data[m] = (monthly if ptype == 'entree' else -monthly) if i >= start_month else 0


# ==================== PRESENCE ====================

def get_presence(year=None):
    conn = get_db()
    if year:
        rows = conn.execute('SELECT * FROM presence WHERE year=?', (year,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM presence').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_presence(data):
    conn = get_db()
    conn.execute('''
        INSERT INTO presence (year, month, resource_id, jours_travailles)
        VALUES (?,?,?,?)
        ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles=?
    ''', (data['year'], data['month'], data['resource_id'],
          data['jours_travailles'], data['jours_travailles']))
    conn.commit()
    conn.close()


def get_presence_dashboard(year=None):
    if not year:
        year = datetime.now().year

    conn = get_db()
    resources = conn.execute(
        'SELECT * FROM resources WHERE year=? AND is_fictive=0', (year,)
    ).fetchall()
    presence_rows = conn.execute(
        'SELECT * FROM presence WHERE year=?', (year,)
    ).fetchall()
    conn.close()

    now = datetime.now()
    current_month = now.month if now.year == year else 12
    jo_ecoules = sum(JOURS_OUVRABLES_PAR_MOIS[:current_month])
    jo_annee = sum(JOURS_OUVRABLES_PAR_MOIS)
    jo_restants = jo_annee - jo_ecoules

    pres_map = {}
    for p in presence_rows:
        pres_map[(p['resource_id'], p['month'])] = p['jours_travailles']

    results = []
    alerts = []

    for res in resources:
        rid = res['id']
        etp = safe_float(res['etp'], 1)
        nb_jours_total = safe_float(
            res['nb_jours_total'], 206 if res['statut'] == 'Interne' else 210
        )
        limite = nb_jours_total * etp

        monthly = {}
        total_t = 0
        mois_actifs = 0
        for m in range(1, 13):
            val = rd(safe_float(pres_map.get((rid, m))))
            monthly[str(m)] = val
            total_t += val
            if val > 0:
                mois_actifs += 1

        jours_restants = rd(limite - total_t)
        rythme = total_t / mois_actifs if mois_actifs > 0 else 0
        mois_restants = 12 - current_month

        if rythme > 0:
            projection = total_t + (rythme * mois_restants)
            m_avant_ep = jours_restants / rythme if jours_restants > 0 else 0
            mois_ep = current_month + m_avant_ep
        else:
            projection = total_t
            mois_ep = None

        jo_mois_moyen = jo_annee / 12
        rythme_theo = (limite / jo_annee) * jo_mois_moyen

        jo_etp = jo_ecoules * etp
        conges_pris = rd(max(0, jo_etp - total_t))
        conges_attendus = max(0, rd(jo_etp - (limite * current_month / 12)))

        alert_level = 'ok'
        alert_msg = ''

        if mois_actifs > 0 and current_month >= 3:
            if mois_ep is not None and mois_ep <= 9:
                alert_level = 'critical'
                label = MONTH_LABELS[min(int(mois_ep), 11)]
                alert_msg = f"Budget épuisé vers {label} — risque d'arrêt anticipé"
            elif mois_ep is not None and mois_ep <= 11:
                alert_level = 'warning'
                label = MONTH_LABELS[min(int(mois_ep), 11)]
                alert_msg = f"Budget épuisé vers {label} — congés insuffisants"
            elif conges_pris < conges_attendus * 0.5 and current_month >= 4:
                alert_level = 'warning'
                alert_msg = f"Très peu de congés pris ({conges_pris}j vs {conges_attendus}j attendus)"

            if projection > limite * 1.05 and alert_level != 'critical':
                alert_level = 'warning'
                alert_msg = f"Projection {round(projection)}j dépasse la limite {round(limite)}j"

        entry = {
            'resource_id': rid, 'name': res['name'],
            'activite': res['activite'] or '', 'statut': res['statut'],
            'etp': etp, 'limite_annuelle': rd(limite),
            'monthly': monthly, 'total_travaille': rd(total_t),
            'jours_restants': jours_restants,
            'rythme_mensuel': rd(rythme), 'rythme_theorique': rd(rythme_theo),
            'projection_annuelle': rd(projection),
            'mois_epuisement': round(mois_ep, 1) if mois_ep else None,
            'conges_pris': conges_pris, 'conges_attendus': conges_attendus,
            'alert_level': alert_level, 'alert_msg': alert_msg,
        }
        results.append(entry)

        if alert_level in ('warning', 'critical'):
            alerts.append({
                'name': res['name'], 'statut': res['statut'],
                'level': alert_level, 'message': alert_msg,
            })

    alerts.sort(key=lambda a: 0 if a['level'] == 'critical' else 1)

    return {
        'year': year, 'current_month': current_month,
        'jours_ouvrables_ecoules': jo_ecoules,
        'jours_ouvrables_annee': jo_annee,
        'jours_ouvrables_restants': jo_restants,
        'jours_ouvrables_par_mois': JOURS_OUVRABLES_PAR_MOIS,
        'resources': results, 'alerts': alerts,
        'nb_alerts_critical': sum(1 for a in alerts if a['level'] == 'critical'),
        'nb_alerts_warning': sum(1 for a in alerts if a['level'] == 'warning'),
    }


# ==================== SETTINGS ====================

def get_settings(year=None):
    conn = get_db()
    if year:
        row = conn.execute('SELECT * FROM settings WHERE year=?', (year,)).fetchone()
        conn.close()
        if row:
            return dict(row)
    else:
        conn.close()
    return {
        'year': year or datetime.now().year,
        'budget_global_alloue': 0, 'reduction_jours': 0,
        'label_reduction': '', 'nb_jours_ouvrables_interne': 206,
        'nb_jours_ouvrables_externe': 210, 'notes': '',
    }


def update_settings(data):
    year = data.get('year', datetime.now().year)
    conn = get_db()
    conn.execute('''
        INSERT INTO settings (year, budget_global_alloue, reduction_jours,
            label_reduction, nb_jours_ouvrables_interne, nb_jours_ouvrables_externe, notes)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(year) DO UPDATE SET
            budget_global_alloue=?, reduction_jours=?, label_reduction=?,
            nb_jours_ouvrables_interne=?, nb_jours_ouvrables_externe=?, notes=?
    ''', (
        year,
        safe_float(data.get('budget_global_alloue')),
        safe_float(data.get('reduction_jours')),
        data.get('label_reduction', ''),
        safe_float(data.get('nb_jours_ouvrables_interne'), 206),
        safe_float(data.get('nb_jours_ouvrables_externe'), 210),
        data.get('notes', ''),
        safe_float(data.get('budget_global_alloue')),
        safe_float(data.get('reduction_jours')),
        data.get('label_reduction', ''),
        safe_float(data.get('nb_jours_ouvrables_interne'), 206),
        safe_float(data.get('nb_jours_ouvrables_externe'), 210),
        data.get('notes', ''),
    ))
    conn.commit()
    row = conn.execute('SELECT * FROM settings WHERE year=?', (year,)).fetchone()
    conn.close()
    return dict(row)


def get_all_settings():
    conn = get_db()
    rows = conn.execute('SELECT * FROM settings').fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ==================== DASHBOARD ====================

def get_dashboard(year=None):
    if not year:
        year = datetime.now().year

    conn = get_db()
    resources = conn.execute('SELECT * FROM resources WHERE year=?', (year,)).fetchall()
    consumptions = conn.execute('SELECT * FROM consumption WHERE year=?', (year,)).fetchall()
    previsions_rows = conn.execute('SELECT * FROM previsions WHERE year=?', (year,)).fetchall()
    conn.close()

    budget_total = sum(r['nb_jours_run'] or 0 for r in resources)

    monthly_budget = []
    for m in MONTHS:
        mb = sum(r[m] or 0 for r in resources)
        monthly_budget.append(rd(mb))

    cons_map = {}
    for c in consumptions:
        key = c['month']
        cons_map[key] = cons_map.get(key, 0) + (c['consumed'] or 0)

    monthly_consumed = [rd(cons_map.get(i, 0)) for i in range(1, 13)]
    total_consumed = sum(monthly_consumed)
    budget_restant = rd(budget_total - total_consumed)

    by_activite = {}
    for r in resources:
        a = r['activite'] or ''
        by_activite[a] = rd((by_activite.get(a, 0) + (r['nb_jours_run'] or 0)))

    by_statut = {'Interne': 0, 'Externe': 0}
    for r in resources:
        s = r['statut']
        if s in by_statut:
            by_statut[s] += r['nb_jours_run'] or 0
    by_statut = {k: rd(v) for k, v in by_statut.items()}

    nb_etp_i = rd(sum(r['etp'] or 0 for r in resources if r['statut'] == 'Interne'))
    nb_etp_e = rd(sum(r['etp'] or 0 for r in resources if r['statut'] == 'Externe'))

    prev_entries = [row_to_dict(p) for p in previsions_rows if p['type'] == 'entree']
    prev_exits = [row_to_dict(p) for p in previsions_rows if p['type'] == 'sortie']

    settings = get_settings(year)
    bga = safe_float(settings.get('budget_global_alloue'))
    red = safe_float(settings.get('reduction_jours'))
    label_red = settings.get('label_reduction', '')
    budget_env = rd(bga - red)
    ecart = rd(budget_total - budget_env) if bga > 0 else 0

    try:
        pd = get_presence_dashboard(year)
        pa = {'nb_critical': pd['nb_alerts_critical'],
              'nb_warning': pd['nb_alerts_warning'],
              'alerts': pd['alerts'][:5]}
    except Exception:
        pa = {'nb_critical': 0, 'nb_warning': 0, 'alerts': []}

    return {
        'year': year, 'budget_total': budget_total,
        'total_consumed': rd(total_consumed), 'budget_restant': budget_restant,
        'monthly_budget': monthly_budget, 'monthly_consumed': monthly_consumed,
        'month_labels': MONTH_LABELS, 'by_activite': by_activite,
        'by_statut': by_statut,
        'nb_etp_interne': nb_etp_i, 'nb_etp_externe': nb_etp_e,
        'nb_resources': len(resources),
        'prevision_entries': prev_entries, 'prevision_exits': prev_exits,
        'budget_global_alloue': bga, 'reduction_jours': red,
        'label_reduction': label_red, 'budget_enveloppe': budget_env,
        'ecart_enveloppe': ecart, 'presence_alerts': pa,
    }


# ==================== YEARS ====================

def get_years():
    conn = get_db()
    rows = conn.execute('SELECT DISTINCT year FROM resources ORDER BY year').fetchall()
    conn.close()
    years = [r['year'] for r in rows]
    return years if years else [datetime.now().year]


# ==================== COMPARISON ====================

def get_comparison(selected_years):
    conn = get_db()
    result = {}

    for year in selected_years:
        resources = conn.execute('SELECT * FROM resources WHERE year=?', (year,)).fetchall()
        consumptions = conn.execute('SELECT * FROM consumption WHERE year=?', (year,)).fetchall()

        monthly_budget = [rd(sum(r[m] or 0 for r in resources)) for m in MONTHS]

        cons_map = {}
        for c in consumptions:
            cons_map[c['month']] = cons_map.get(c['month'], 0) + (c['consumed'] or 0)
        monthly_consumed = [rd(cons_map.get(i, 0)) for i in range(1, 13)]

        budget_total = rd(sum(r['nb_jours_run'] or 0 for r in resources))

        by_activite = {}
        for r in resources:
            a = r['activite'] or ''
            by_activite[a] = rd(by_activite.get(a, 0) + (r['nb_jours_run'] or 0))

        by_statut = {'Interne': 0, 'Externe': 0}
        for r in resources:
            if r['statut'] in by_statut:
                by_statut[r['statut']] += r['nb_jours_run'] or 0
        by_statut = {k: rd(v) for k, v in by_statut.items()}

        nb_etp = rd(sum(r['etp'] or 0 for r in resources))

        result[str(year)] = {
            'year': year, 'budget_total': budget_total,
            'total_consumed': rd(sum(monthly_consumed)),
            'monthly_budget': monthly_budget,
            'monthly_consumed': monthly_consumed,
            'by_activite': by_activite, 'by_statut': by_statut,
            'nb_resources': len(resources), 'nb_etp': nb_etp,
        }

    conn.close()
    return result


# ==================== EXCEL IMPORT (zero-dependency xlsx parser) ====================

def parse_xlsx(file_bytes):
    """Parse an .xlsx file using only built-in Python modules (zipfile + xml)."""
    logger.info(f"parse_xlsx: début, taille fichier = {len(file_bytes)} octets")
    NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

    with zipfile.ZipFile(BytesIO(file_bytes)) as zf:
        logger.debug(f"parse_xlsx: fichiers dans le zip = {zf.namelist()}")
        # Read shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            tree = ET.parse(zf.open('xl/sharedStrings.xml'))
            for si in tree.findall(f'{NS}si'):
                texts = si.findall(f'.//{NS}t')
                shared_strings.append(''.join(t.text or '' for t in texts))
            logger.debug(f"parse_xlsx: {len(shared_strings)} shared strings chargées")
        else:
            logger.warning("parse_xlsx: pas de sharedStrings.xml dans le fichier")

        # Read sheet names from workbook
        wb_tree = ET.parse(zf.open('xl/workbook.xml'))
        sheets_info = []
        for s in wb_tree.findall(f'{NS}sheets/{NS}sheet'):
            sheets_info.append(s.get('name'))
        logger.info(f"parse_xlsx: onglets trouvés = {sheets_info}")

        # Parse all sheets
        result = {}
        for idx, sheet_name in enumerate(sheets_info):
            sheet_file = f'xl/worksheets/sheet{idx + 1}.xml'
            if sheet_file not in zf.namelist():
                logger.warning(f"parse_xlsx: fichier {sheet_file} absent pour onglet '{sheet_name}'")
                continue
            tree = ET.parse(zf.open(sheet_file))
            rows_data = []
            for row_el in tree.findall(f'{NS}sheetData/{NS}row'):
                cells = []
                for c in row_el.findall(f'{NS}c'):
                    ref = c.get('r', '')
                    cell_type = c.get('t', '')
                    val_el = c.find(f'{NS}v')
                    val = val_el.text if val_el is not None else ''

                    if cell_type == 's' and val:
                        val = shared_strings[int(val)] if int(val) < len(shared_strings) else ''
                    elif cell_type == 'b':
                        val = bool(int(val)) if val else False

                    # Extract column letter to determine position
                    col_letter = re.match(r'([A-Z]+)', ref)
                    col_idx = 0
                    if col_letter:
                        for ch in col_letter.group(1):
                            col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
                        col_idx -= 1  # 0-based

                    cells.append((col_idx, val))
                # Fill into a list by column position
                if cells:
                    max_col = max(c[0] for c in cells) + 1
                    row_list = [''] * max_col
                    for ci, cv in cells:
                        row_list[ci] = cv
                    rows_data.append(row_list)
                else:
                    rows_data.append([])
            result[sheet_name] = rows_data
            logger.debug(f"parse_xlsx: onglet '{sheet_name}' = {len(rows_data)} lignes")

    logger.info(f"parse_xlsx: terminé, {len(result)} onglet(s) parsé(s)")
    return result


# Mapping of French month name fragments to month number
MONTH_NAME_MAP = {
    'janvier': 1, 'janv': 1, 'jan': 1,
    'février': 2, 'fevrier': 2, 'févr': 2, 'fev': 2, 'fév': 2, 'feb': 2,
    'mars': 3, 'mar': 3,
    'avril': 4, 'avri': 4, 'avr': 4, 'apr': 4, 'av': 4,
    'mai': 5, 'may': 5,
    'juin': 6, 'jun': 6,
    'juillet': 7, 'juil': 7, 'jul': 7,
    'août': 8, 'aout': 8, 'aou': 8, 'aoû': 8, 'aug': 8,
    'septembre': 9, 'sept': 9, 'sep': 9,
    'octobre': 10, 'octo': 10, 'oct': 10,
    'novembre': 11, 'nove': 11, 'nov': 11,
    'décembre': 12, 'decembre': 12, 'déce': 12, 'dec': 12, 'déc': 12,
}


def detect_month_from_header(header):
    """Detect month number from a French column header like 'Présence Jan', 'ABS Février'."""
    h = header.lower().strip()
    for fragment, month_num in sorted(MONTH_NAME_MAP.items(), key=lambda x: -len(x[0])):
        if fragment in h:
            return month_num
    return None


def detect_column_type(header):
    """Detect type: 'presence', 'abs', 'run', 'projet', 'run_other' from header."""
    h = header.lower().strip()
    if h.startswith('présence') or h.startswith('presence'):
        return 'presence'
    elif h.startswith('abs'):
        return 'abs'
    elif h.startswith('run_other') or h.startswith('run other'):
        return 'run_other'
    elif h.startswith('run'):
        return 'run'
    elif h.startswith('projet'):
        return 'projet'
    return None


def parse_excel_sheet(rows):
    """Parse a sheet into structured data: find header row, extract per-resource per-month values."""
    logger.info(f"parse_excel_sheet: début, {len(rows)} lignes à analyser")
    if len(rows) < 3:
        logger.error("parse_excel_sheet: feuille trop courte (< 3 lignes)")
        return {'error': 'Feuille trop courte, pas assez de lignes'}

    # Log first rows for debugging
    for i, row in enumerate(rows[:8]):
        logger.debug(f"  ligne {i}: {row[:6]}{'...' if len(row) > 6 else ''}")

    # Find the header row (contains 'Ressource' or 'ressource')
    header_row_idx = None
    for i, row in enumerate(rows):
        for cell in row:
            if str(cell).strip().lower() in ('ressource', 'resource', 'nom'):
                header_row_idx = i
                break
        if header_row_idx is not None:
            break

    if header_row_idx is None:
        logger.error("parse_excel_sheet: colonne 'Ressource' non trouvée dans aucune ligne")
        logger.error(f"  Premières cellules de chaque ligne: {[r[:3] if r else [] for r in rows[:10]]}")
        return {'error': 'Colonne "Ressource" non trouvée dans les en-têtes'}

    headers = [str(c).strip() for c in rows[header_row_idx]]
    logger.info(f"parse_excel_sheet: en-têtes trouvés en ligne {header_row_idx}: {headers}")

    # Detect year from metadata rows above the header
    detected_year = None
    for i in range(header_row_idx):
        for cell in rows[i]:
            val = str(cell).strip()
            if re.match(r'^20\d{2}$', val):
                detected_year = int(val)
                break
        if detected_year:
            break
    logger.info(f"parse_excel_sheet: année détectée = {detected_year}")

    # Map columns
    col_map = []  # list of (col_index, type, month)
    resource_col = None
    unrecognized = []
    for ci, h in enumerate(headers):
        hl = h.lower()
        if hl in ('ressource', 'resource', 'nom'):
            resource_col = ci
            continue
        ctype = detect_column_type(h)
        month = detect_month_from_header(h)
        if ctype and month:
            col_map.append((ci, ctype, month))
        elif h and h.strip():
            unrecognized.append(f"col{ci}='{h}' (type={ctype}, mois={month})")

    if unrecognized:
        logger.warning(f"parse_excel_sheet: colonnes non reconnues: {unrecognized}")
    logger.info(f"parse_excel_sheet: {len(col_map)} colonnes mappées, resource_col={resource_col}")

    if resource_col is None:
        logger.error("parse_excel_sheet: colonne Ressource introuvable après mapping")
        return {'error': 'Colonne "Ressource" non trouvée'}

    # Extract data per resource
    resources = []
    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]
        if not row or len(row) <= resource_col:
            continue
        name = str(row[resource_col]).strip()
        if not name:
            continue

        res_data = {'name': name, 'presence': {}, 'run': {}, 'projet': {}, 'abs': {}, 'run_other': {}}
        for ci, ctype, month in col_map:
            if ci < len(row):
                raw_val = row[ci]
                try:
                    val = round(float(raw_val), 2) if raw_val != '' else 0
                except (ValueError, TypeError):
                    val = 0
                res_data[ctype][month] = val
        resources.append(res_data)

    logger.info(f"parse_excel_sheet: {len(resources)} ressources extraites")
    if resources:
        logger.debug(f"  Première ressource: {resources[0]['name']} — présence={resources[0]['presence']}")

    return {
        'detected_year': detected_year,
        'resources': resources,
        'nb_columns': len(col_map),
    }


def preview_excel_import(file_bytes, sheet_name=None, year=None):
    """Parse xlsx and compare with DB data. Returns diff for user review."""
    logger.info(f"preview_excel_import: début (sheet={sheet_name}, year={year}, size={len(file_bytes)})")

    try:
        workbook = parse_xlsx(file_bytes)
    except zipfile.BadZipFile:
        msg = "Le fichier n'est pas un .xlsx valide (pas un fichier ZIP). Vérifiez qu'il s'agit bien d'un fichier Excel .xlsx et non .xls"
        logger.error(f"preview_excel_import: {msg}")
        return {'error': msg}
    except ET.ParseError as e:
        msg = f"Erreur de parsing XML dans le fichier Excel: {str(e)}"
        logger.error(f"preview_excel_import: {msg}")
        logger.error(traceback.format_exc())
        return {'error': msg}
    except Exception as e:
        msg = f"Erreur de lecture du fichier Excel: {type(e).__name__}: {str(e)}"
        logger.error(f"preview_excel_import: {msg}")
        logger.error(traceback.format_exc())
        return {'error': msg}

    if not workbook:
        logger.error("preview_excel_import: workbook vide après parsing")
        return {'error': 'Fichier Excel vide — aucun onglet trouvé'}

    sheet_names = list(workbook.keys())
    logger.info(f"preview_excel_import: onglets disponibles = {sheet_names}")

    # If no sheet specified, try the first one (or let user choose)
    if sheet_name is None and len(sheet_names) == 1:
        sheet_name = sheet_names[0]

    if sheet_name is None:
        logger.info(f"preview_excel_import: plusieurs onglets, demande sélection utilisateur")
        return {'sheets': sheet_names, 'need_sheet_selection': True}

    if sheet_name not in workbook:
        logger.error(f"preview_excel_import: onglet '{sheet_name}' non trouvé parmi {sheet_names}")
        return {'error': f'Onglet "{sheet_name}" non trouvé', 'sheets': sheet_names}

    parsed = parse_excel_sheet(workbook[sheet_name])
    if 'error' in parsed:
        logger.error(f"preview_excel_import: erreur dans parse_excel_sheet: {parsed['error']}")
        return parsed

    if year is None:
        year = parsed.get('detected_year') or datetime.now().year

    # Load existing DB data
    conn = get_db()
    db_resources = conn.execute('SELECT * FROM resources WHERE year=?', (year,)).fetchall()
    db_presence = conn.execute('SELECT * FROM presence WHERE year=?', (year,)).fetchall()
    db_consumption = conn.execute('SELECT * FROM consumption WHERE year=?', (year,)).fetchall()
    conn.close()

    # Index existing data
    res_by_name = {}
    for r in db_resources:
        res_by_name[r['name'].strip().lower()] = dict(r)

    pres_map = {}  # (resource_id, month) -> value
    for p in db_presence:
        pres_map[(p['resource_id'], p['month'])] = p['jours_travailles']

    cons_map = {}  # (resource_id, month) -> value
    for c in db_consumption:
        cons_map[(c['resource_id'], c['month'])] = c['consumed']

    # Also load existing previsions to detect already-processed exits
    db_previsions = conn.execute(
        "SELECT * FROM previsions WHERE year=? AND type='sortie'", (year,)
    ).fetchall()
    existing_exits = set()
    for pv in db_previsions:
        existing_exits.add(pv['name'].strip().lower())

    # Build diff
    new_resources = []
    conflicts = []
    updates = []  # new data for empty months
    inactive_exits = []  # resources flagged _INACTIVE => exit to process

    for excel_res in parsed['resources']:
        name = excel_res['name']
        name_key = name.strip().lower()

        # Detect _INACTIVE suffix
        is_inactive = name_key.endswith('_inactive')
        clean_name = re.sub(r'[_\s]*inactive\s*$', '', name, flags=re.IGNORECASE).strip()
        clean_key = clean_name.lower()

        # Try matching: first exact name, then without _INACTIVE suffix
        db_res = res_by_name.get(name_key) or res_by_name.get(clean_key)

        if db_res is None:
            # New resource
            new_resources.append({
                'name': clean_name,
                'excel_name': name,
                'is_inactive': is_inactive,
                'presence': excel_res['presence'],
                'run': excel_res['run'],
                'projet': excel_res['projet'],
                'abs': excel_res['abs'],
            })
            continue

        rid = db_res['id']
        db_name = db_res['name']

        # If resource is INACTIVE, detect the last month with presence > 0
        if is_inactive:
            last_active_month = 0
            for m in range(1, 13):
                pval = excel_res['presence'].get(m, 0)
                if pval and float(pval) > 0:
                    last_active_month = m
            # Check if exit already exists in previsions
            already_exited = clean_key in existing_exits or name_key in existing_exits
            if not already_exited and last_active_month > 0:
                inactive_exits.append({
                    'resource_id': rid,
                    'name': db_name,
                    'excel_name': name,
                    'last_active_month': last_active_month,
                    'last_active_month_label': MONTH_LABELS[last_active_month - 1] if last_active_month <= 12 else '?',
                })

        # Compare presence
        for month, excel_val in excel_res['presence'].items():
            db_val = pres_map.get((rid, month), 0)
            db_val = round(float(db_val or 0), 2)
            excel_val = round(float(excel_val or 0), 2)

            if db_val == 0 and excel_val != 0:
                updates.append({
                    'type': 'presence', 'resource_id': rid, 'name': db_name,
                    'month': month, 'new_value': excel_val,
                    'category': 'Présence',
                })
            elif db_val != 0 and excel_val != 0 and abs(db_val - excel_val) > 0.01:
                conflicts.append({
                    'type': 'presence', 'resource_id': rid, 'name': db_name,
                    'month': month, 'db_value': db_val, 'excel_value': excel_val,
                    'category': 'Présence',
                })

        # Compare consumption (Run)
        for month, excel_val in excel_res['run'].items():
            db_val = cons_map.get((rid, month), 0)
            db_val = round(float(db_val or 0), 2)
            excel_val = round(float(excel_val or 0), 2)

            if db_val == 0 and excel_val != 0:
                updates.append({
                    'type': 'consumption', 'resource_id': rid, 'name': db_name,
                    'month': month, 'new_value': excel_val,
                    'category': 'Consommation Run',
                })
            elif db_val != 0 and excel_val != 0 and abs(db_val - excel_val) > 0.01:
                conflicts.append({
                    'type': 'consumption', 'resource_id': rid, 'name': db_name,
                    'month': month, 'db_value': db_val, 'excel_value': excel_val,
                    'category': 'Consommation Run',
                })

    return {
        'year': year,
        'sheet_name': sheet_name,
        'sheets': sheet_names,
        'new_resources': new_resources,
        'conflicts': conflicts,
        'updates': updates,
        'inactive_exits': inactive_exits,
        'summary': {
            'nb_excel_resources': len(parsed['resources']),
            'nb_existing': len(parsed['resources']) - len(new_resources),
            'nb_new': len(new_resources),
            'nb_conflicts': len(conflicts),
            'nb_auto_updates': len(updates),
            'nb_inactive_exits': len(inactive_exits),
        },
    }


def apply_excel_import(data):
    """Apply confirmed import changes."""
    logger.info("apply_excel_import: début")
    year = data.get('year', datetime.now().year)
    updates = data.get('updates', [])
    resolved_conflicts = data.get('resolved_conflicts', [])
    new_resources = data.get('new_resources', [])
    inactive_exits = data.get('inactive_exits', [])

    conn = get_db()
    applied = 0

    # Apply auto-updates (empty months filled with new data)
    for u in updates:
        if u['type'] == 'presence':
            conn.execute('''
                INSERT INTO presence (year, month, resource_id, jours_travailles)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles=?
            ''', (year, u['month'], u['resource_id'], u['new_value'], u['new_value']))
            applied += 1
        elif u['type'] == 'consumption':
            conn.execute('''
                INSERT INTO consumption (year, month, resource_id, consumed)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(year, month, resource_id) DO UPDATE SET consumed=?
            ''', (year, u['month'], u['resource_id'], u['new_value'], u['new_value']))
            applied += 1

    # Apply resolved conflicts (user confirmed to overwrite)
    for c in resolved_conflicts:
        if c['type'] == 'presence':
            conn.execute('''
                INSERT INTO presence (year, month, resource_id, jours_travailles)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles=?
            ''', (year, c['month'], c['resource_id'], c['excel_value'], c['excel_value']))
            applied += 1
        elif c['type'] == 'consumption':
            conn.execute('''
                INSERT INTO consumption (year, month, resource_id, consumed)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(year, month, resource_id) DO UPDATE SET consumed=?
            ''', (year, c['month'], c['resource_id'], c['excel_value'], c['excel_value']))
            applied += 1

    # Process INACTIVE exits — zero budget months after departure + create exit prevision
    for ex in inactive_exits:
        rid = ex['resource_id']
        last_month = ex['last_active_month']
        res_name = ex['name']

        # Zero resource budget for all months after last_active_month
        months_to_zero = MONTHS[last_month:]  # MONTHS[last_month:] = months after departure
        if months_to_zero:
            set_clause = ', '.join(f'{m}=0' for m in months_to_zero)
            conn.execute(f'UPDATE resources SET {set_clause} WHERE id=?', (rid,))

        # Recalculate nb_jours_run for this resource
        res_row = conn.execute('SELECT * FROM resources WHERE id=?', (rid,)).fetchone()
        if res_row:
            total_run = sum(res_row[m] or 0 for m in MONTHS)
            conn.execute('UPDATE resources SET nb_jours_run=? WHERE id=?', (total_run, rid))

        # Create exit prevision if not already existing
        existing = conn.execute(
            "SELECT id FROM previsions WHERE name=? AND year=? AND type='sortie'",
            (res_name, year)
        ).fetchone()
        if not existing:
            date_effet = f"{year}-{last_month:02d}-28"
            conn.execute('''
                INSERT INTO previsions (type, name, date_effet, motif, year,
                    jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
                VALUES ('sortie', ?, ?, 'Import Excel - INACTIVE', ?, 0,0,0,0,0,0,0,0,0,0,0,0)
            ''', (res_name, date_effet, year))

        applied += 1

    # Add new resources
    for nr in new_resources:
        name = nr['name']
        is_inactive = nr.get('is_inactive', False)
        statut = 'Interne'  # default, user can change later

        conn.execute('''
            INSERT INTO resources (name, year, statut, is_fictive, etp, nb_jours_total,
                jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
            VALUES (?, ?, ?, ?, 1, 206, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        ''', (name, year, statut, 1 if is_inactive else 0))
        rid = conn.execute('SELECT last_insert_rowid()').fetchone()[0]

        # Insert presence data
        for month, val in nr.get('presence', {}).items():
            if val:
                conn.execute('''
                    INSERT INTO presence (year, month, resource_id, jours_travailles)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles=?
                ''', (year, int(month), rid, val, val))

        # Insert consumption data (Run)
        for month, val in nr.get('run', {}).items():
            if val:
                conn.execute('''
                    INSERT INTO consumption (year, month, resource_id, consumed)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(year, month, resource_id) DO UPDATE SET consumed=?
                ''', (year, int(month), rid, val, val))

        # If new resource is INACTIVE, create exit prevision too
        if is_inactive:
            last_m = 0
            for m in range(1, 13):
                if nr.get('presence', {}).get(m, 0) and float(nr['presence'][m]) > 0:
                    last_m = m
            if last_m > 0:
                months_to_zero = MONTHS[last_m:]
                if months_to_zero:
                    set_clause = ', '.join(f'{m}=0' for m in months_to_zero)
                    conn.execute(f'UPDATE resources SET {set_clause} WHERE id=?', (rid,))
                date_effet = f"{year}-{last_m:02d}-28"
                conn.execute('''
                    INSERT INTO previsions (type, name, date_effet, motif, year,
                        jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
                    VALUES ('sortie', ?, ?, 'Import Excel - INACTIVE', ?, 0,0,0,0,0,0,0,0,0,0,0,0)
                ''', (name, date_effet, year))

        applied += 1

    conn.commit()
    conn.close()
    logger.info(f"apply_excel_import: terminé, {applied} modification(s) appliquée(s)")
    return {'status': 'ok', 'applied': applied}


# ==================== HTTP SERVER ====================

class BudgetHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUILD_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        def p(key, default=None):
            v = params.get(key, [default])[0]
            return v

        # API routes
        if path == '/api/resources':
            year = int(p('year')) if p('year') else None
            return self._json(get_resources(year))

        elif path == '/api/consumption':
            year = int(p('year')) if p('year') else None
            return self._json(get_consumption(year))

        elif path == '/api/previsions':
            year = int(p('year')) if p('year') else None
            return self._json(get_previsions(year))

        elif path == '/api/presence':
            year = int(p('year')) if p('year') else None
            return self._json(get_presence(year))

        elif path == '/api/presence/dashboard':
            year = int(p('year')) if p('year') else None
            return self._json(get_presence_dashboard(year))

        elif path == '/api/settings':
            year = int(p('year')) if p('year') else None
            return self._json(get_settings(year))

        elif path == '/api/settings/all':
            return self._json(get_all_settings())

        elif path == '/api/dashboard':
            year = int(p('year')) if p('year') else None
            return self._json(get_dashboard(year))

        elif path == '/api/years':
            return self._json(get_years())

        elif path == '/api/comparison':
            years_str = p('years', '')
            try:
                selected = [int(y.strip()) for y in years_str.split(',') if y.strip()]
            except ValueError:
                return self._json({'error': 'Invalid years'}, 400)
            if not selected:
                selected = get_years()
            return self._json(get_comparison(selected))

        elif path == '/api/resources/import/template':
            # Generate a simple CSV template (no xlsx dependency needed)
            csv_content = 'Nom,Activité,Tribu,Statut,ETP,Répartition RUN,Nb Jours Total,Année,Fictive,Jan,Fev,Mar,Avr,Mai,Jun,Jul,Aou,Sep,Oct,Nov,Dec\n'
            csv_content += f'Exemple Dupont,DATA,,Interne,1,0.8,206,{datetime.now().year},false,,,,,,,,,,,,\n'
            csv_content += f'Exemple Martin,CYBER,,Externe,0.5,0.6,210,{datetime.now().year},false,,,,,,,,,,,,\n'
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="template_import_ressources.csv"')
            self.end_headers()
            self.wfile.write(csv_content.encode('utf-8'))
            return

        elif path == '/api/logs':
            # Return last N lines of log file for troubleshooting
            n = int(params.get('lines', ['100'])[0])
            log_file = os.path.join(LOG_DIR, 'server.log')
            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                    lines = f.readlines()
                    last_lines = lines[-n:]
                return self._json({'lines': [l.rstrip() for l in last_lines], 'total': len(lines)})
            return self._json({'lines': [], 'total': 0})

        # Serve static files (React SPA)
        elif not path.startswith('/api/'):
            # For SPA: serve index.html for non-file paths
            file_path = os.path.join(BUILD_DIR, path.lstrip('/'))
            if os.path.isfile(file_path):
                return super().do_GET()
            else:
                # SPA fallback — serve index.html
                self.path = '/index.html'
                return super().do_GET()

        else:
            return self._json({'error': 'Not found'}, 404)

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b'{}'
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}

        if path == '/api/resources':
            result = add_resource(data)
            return self._json(result, 201)

        elif path == '/api/resources/import/confirm':
            rows = data.get('rows', [])
            result = bulk_add_resources(rows)
            return self._json(result, 201)

        elif path == '/api/consumption':
            update_consumption(data)
            return self._json({'status': 'ok'})

        elif path == '/api/previsions':
            result = add_prevision(data)
            return self._json(result, 201)

        elif path == '/api/previsions/sortie-ressource':
            result = apply_resource_exit(data)
            if 'error' in result:
                return self._json(result, 400)
            return self._json(result, 201)

        elif path == '/api/previsions/entree-ressource':
            result = apply_resource_entry(data)
            return self._json(result, 201)

        elif path == '/api/presence':
            if isinstance(data, list):
                for entry in data:
                    update_presence(entry)
            else:
                update_presence(data)
            return self._json({'status': 'ok'})

        elif path == '/api/settings':
            result = update_settings(data)
            return self._json(result)

        elif path == '/api/import/preview':
            # Handle multipart file upload
            content_type = self.headers.get('Content-Type', '')
            logger.info(f"POST /api/import/preview — Content-Type: {content_type[:80]}, body size: {len(body)}")
            if 'multipart/form-data' in content_type:
                try:
                    environ = {
                        'REQUEST_METHOD': 'POST',
                        'CONTENT_TYPE': content_type,
                        'CONTENT_LENGTH': str(len(body)),
                    }
                    fs = cgi.FieldStorage(
                        fp=BytesIO(body),
                        environ=environ,
                        keep_blank_values=True,
                    )
                    logger.debug(f"  FieldStorage keys: {list(fs.keys())}")

                    file_item = fs['file'] if 'file' in fs else None
                    sheet_name = fs.getvalue('sheet_name', None)
                    import_year = fs.getvalue('year', None)
                    if import_year:
                        import_year = int(import_year)

                    if file_item is None or not file_item.file:
                        logger.error("  Aucun fichier trouvé dans le form-data")
                        logger.error(f"  Keys reçues: {list(fs.keys())}")
                        return self._json({'error': 'Aucun fichier reçu. Vérifiez que le champ s\'appelle "file".'}, 400)

                    file_bytes = file_item.file.read()
                    file_name = getattr(file_item, 'filename', 'inconnu')
                    logger.info(f"  Fichier reçu: '{file_name}', {len(file_bytes)} octets, sheet={sheet_name}, year={import_year}")

                    if len(file_bytes) == 0:
                        logger.error("  Fichier vide (0 octets)")
                        return self._json({'error': 'Le fichier reçu est vide (0 octets)'}, 400)

                    result = preview_excel_import(file_bytes, sheet_name, import_year)
                    logger.info(f"  Résultat preview: {json.dumps({k: v for k, v in result.items() if k == 'summary' or k == 'error'}, ensure_ascii=False)}")
                    return self._json(result)
                except Exception as e:
                    logger.error(f"  Exception dans /api/import/preview: {type(e).__name__}: {str(e)}")
                    logger.error(traceback.format_exc())
                    return self._json({'error': f'Erreur serveur lors de l\'analyse: {type(e).__name__}: {str(e)}'}, 500)
            else:
                # JSON body with sheet_name selection (file already uploaded)
                return self._json({'error': 'Content-Type multipart/form-data requis'}, 400)

        elif path == '/api/import/apply':
            try:
                result = apply_excel_import(data)
                return self._json(result)
            except Exception as e:
                logger.error(f"Exception dans /api/import/apply: {type(e).__name__}: {str(e)}")
                logger.error(traceback.format_exc())
                return self._json({'error': f'Erreur lors de l\'application: {type(e).__name__}: {str(e)}'}, 500)

        else:
            return self._json({'error': 'Not found'}, 404)

    def do_PUT(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b'{}'
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {}

        if path.startswith('/api/resources/') and path.count('/') == 3:
            rid = int(path.split('/')[-1])
            result = update_resource(rid, data)
            if not result:
                return self._json({'error': 'Not found'}, 404)
            return self._json(result)

        elif path.startswith('/api/previsions/') and path.count('/') == 3:
            pid = int(path.split('/')[-1])
            result = update_prevision(pid, data)
            if not result:
                return self._json({'error': 'Not found'}, 404)
            return self._json(result)

        else:
            return self._json({'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/resources/') and path.count('/') == 3:
            rid = int(path.split('/')[-1])
            if not delete_resource(rid):
                return self._json({'error': 'Not found'}, 404)
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        elif path.startswith('/api/previsions/') and path.count('/') == 3:
            pid = int(path.split('/')[-1])
            if not delete_prevision(pid):
                return self._json({'error': 'Not found'}, 404)
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        else:
            return self._json({'error': 'Not found'}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Quieter logs
        if '/api/' in str(args[0]) if args else False:
            sys.stderr.write(f"[API] {args[0]}\n")


# ==================== SEED DATA ====================

def seed_if_empty():
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) FROM resources').fetchone()[0]
    conn.close()
    if count > 0:
        return

    print('  Création des données de démonstration...')

    resources_2025 = [
        {'name': 'Ressource 1', 'activite': 'TRANSV', 'statut': 'Interne', 'etp': 1, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025, 'jan': 17.17, 'feb': 17.17, 'mar': 17.17, 'apr': 17.17, 'may': 17.17, 'jun': 17.17, 'jul': 17.17, 'aug': 17.17, 'sep': 17.17, 'oct': 17.17, 'nov': 17.17, 'dec': 17.17},
        {'name': 'Ressource 2', 'activite': 'CBI/TBS', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 3', 'activite': 'DATA', 'statut': 'Externe', 'etp': 0.5, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 20, 'feb': 20, 'mar': 8.75, 'apr': 8.75, 'may': 8.75, 'jun': 8.75, 'jul': 8.75, 'aug': 8.75, 'sep': 8.75, 'oct': 8.75, 'nov': 8.75, 'dec': 8.75},
        {'name': 'Ressource 4', 'activite': 'STRAT', 'statut': 'Interne', 'etp': 1, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025, 'jan': 0, 'feb': 0, 'mar': 5, 'apr': 8, 'may': 8, 'jun': 17.17, 'jul': 17.17, 'aug': 17.17, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 5', 'activite': 'CBI/TBS', 'statut': 'Interne', 'etp': 0.5, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025, 'jan': 8.58, 'feb': 8.58, 'mar': 8.58, 'apr': 8.58, 'may': 8.58, 'jun': 0, 'jul': 0, 'aug': 0, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
        {'name': 'Ressource 6', 'activite': 'CSI/FIT', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 0, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 7', 'activite': 'CYBER', 'statut': 'Interne', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 206, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 8', 'activite': 'CLOUD', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 9', 'activite': 'CMI', 'statut': 'Interne', 'etp': 0.8, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025, 'jan': 13.73, 'feb': 13.73, 'mar': 13.73, 'apr': 13.73, 'may': 13.73, 'jun': 13.73, 'jul': 13.73, 'aug': 13.73, 'sep': 13.73, 'oct': 13.73, 'nov': 13.73, 'dec': 13.73},
        {'name': 'Ressource 10', 'activite': 'CYBER', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 11', 'activite': 'CSI/FIT', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
        {'name': 'Ressource 12', 'activite': 'CYBER', 'statut': 'Interne', 'etp': 0.4, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025, 'jan': 6.87, 'feb': 6.87, 'mar': 6.87, 'apr': 0, 'may': 3, 'jun': 3, 'jul': 0, 'aug': 0, 'sep': 3, 'oct': 6.87, 'nov': 6.87, 'dec': 6.87},
        {'name': 'Ressource 13', 'activite': 'TRANSV', 'statut': 'Interne', 'etp': 0.8, 'repartition_run': 0, 'nb_jours_total': 206, 'year': 2025, 'jan': 13.73, 'feb': 13.73, 'mar': 13.73, 'apr': 13.73, 'may': 13.73, 'jun': 13.73, 'jul': 13.73, 'aug': 13.73, 'sep': 13.73, 'oct': 13.73, 'nov': 13.73, 'dec': 13.73},
        {'name': 'Ressource 14', 'activite': 'DATA', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 15', 'activite': 'CLOUD', 'statut': 'Interne', 'etp': 0.4, 'repartition_run': 0.6, 'nb_jours_total': 206, 'year': 2025, 'jan': 6.87, 'feb': 6.87, 'mar': 6.87, 'apr': 6.87, 'may': 6.87, 'jun': 6.87, 'jul': 6.87, 'aug': 6.87, 'sep': 6.87, 'oct': 6.87, 'nov': 6.87, 'dec': 6.87},
        {'name': 'Ressource 16', 'activite': 'CMI', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 17', 'activite': 'CLOUD', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 3.50, 'aug': 3.50, 'sep': 3.50, 'oct': 3.50, 'nov': 3.50, 'dec': 3.50},
        {'name': 'Ressource 18', 'activite': 'CYBER', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'nb_jours_total': 210, 'year': 2025, 'jan': 3.50, 'feb': 3.50, 'mar': 3.50, 'apr': 3.50, 'may': 3.50, 'jun': 3.50, 'jul': 0, 'aug': 0, 'sep': 0, 'oct': 0, 'nov': 0, 'dec': 0},
    ]

    # Historical data
    add_resource({'name': 'Equipe 2023', 'activite': 'TRANSV', 'statut': 'Interne', 'etp': 1, 'repartition_run': 1, 'nb_jours_total': 1862, 'year': 2023, 'jan': 183.25, 'feb': 158.25, 'mar': 132.75, 'apr': 96.25, 'may': 122.25, 'jun': 139.25, 'jul': 98, 'aug': 140, 'sep': 171, 'oct': 187.75, 'nov': 225.25, 'dec': 181.75})
    add_resource({'name': 'Equipe 2024', 'activite': 'TRANSV', 'statut': 'Interne', 'etp': 1, 'repartition_run': 1, 'nb_jours_total': 1863, 'year': 2024, 'jan': 213.25, 'feb': 166.5, 'mar': 190.25, 'apr': 206.25, 'may': 187.25, 'jun': 173.5, 'jul': 154.25, 'aug': 112.5, 'sep': 200.75, 'oct': 187.75, 'nov': 175, 'dec': 174})

    for r in resources_2025:
        add_resource(r)

    # Previsions
    add_prevision({'type': 'entree', 'name': 'Nouveau ETP Data', 'activite': 'DATA', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'date_effet': '2025-07-01', 'motif': 'Renfort', 'year': 2025})
    add_prevision({'type': 'sortie', 'name': 'Fin contrat CSI/FIT', 'activite': 'CSI/FIT', 'statut': 'Externe', 'etp': 0.2, 'repartition_run': 0.8, 'date_effet': '2025-09-30', 'motif': 'Fin de prestation', 'year': 2025})

    # Consumption (first 5 months)
    all_res = get_resources(2025)
    month_keys = ['jan', 'feb', 'mar', 'apr', 'may']
    for r in all_res:
        for mi in range(5):
            budget_val = r.get(month_keys[mi], 0) or 0
            if budget_val > 0:
                update_consumption({'year': 2025, 'month': mi + 1, 'resource_id': r['id'], 'consumed': rd(budget_val * 0.95)})

    # Presence
    jo = [22, 21, 21, 21, 19]
    for r in all_res:
        if r.get('is_fictive'):
            continue
        etp = safe_float(r.get('etp'), 1)
        for mi in range(5):
            factor = 1.0 if r['id'] == 10 else (0.95 if r['id'] == 8 else 0.85)
            worked = rd(jo[mi] * etp * factor)
            update_presence({'year': 2025, 'month': mi + 1, 'resource_id': r['id'], 'jours_travailles': worked})

    print(f'  ✅ {len(get_resources())} ressources créées (2023-2025)')


# ==================== MAIN ====================

def apply_pending_exits():
    """
    Rattrapage : pour chaque prévision de sortie existante avec une date_effet,
    vérifie si la ressource du même nom/année a encore du budget après la date de départ.
    Si oui, met les mois à 0 et recalcule nb_jours_run.
    Ne s'exécute qu'une fois (idempotent : ne modifie rien si déjà appliqué).
    """
    conn = get_db()
    exits = conn.execute("SELECT * FROM previsions WHERE type='sortie' AND date_effet != ''").fetchall()

    fixed = 0
    for ex in exits:
        date_effet = ex['date_effet']
        try:
            dt = datetime.strptime(date_effet, '%Y-%m-%d')
            depart_month = dt.month - 1  # 0-indexed
        except ValueError:
            continue

        name = ex['name']
        year = ex['year']

        # Find matching resource by name + year
        res = conn.execute(
            'SELECT * FROM resources WHERE name=? AND year=?', (name, year)
        ).fetchone()
        if not res:
            continue

        # Check if months after departure still have budget (not yet zeroed)
        has_remaining = False
        for i, m in enumerate(MONTHS):
            if i >= depart_month and (res[m] or 0) > 0:
                has_remaining = True
                break

        if not has_remaining:
            continue  # Already applied

        # Zero out months after departure
        new_run = sum(res[m] or 0 for i, m in enumerate(MONTHS) if i < depart_month)
        updates = {m: 0 for i, m in enumerate(MONTHS) if i >= depart_month}
        set_clause = ', '.join(f'{m}=?' for m in updates.keys())
        conn.execute(
            f'UPDATE resources SET {set_clause}, nb_jours_run=? WHERE id=?',
            list(updates.values()) + [rd(new_run), res['id']]
        )
        fixed += 1
        print(f'  ✅ Sortie appliquée : {name} — mois à 0 à partir de {MONTH_LABELS[depart_month]} (budget: {rd(new_run)}j)')

    if fixed > 0:
        conn.commit()
        print(f'  → {fixed} sortie(s) existante(s) appliquée(s) sur les ressources')
    conn.close()


if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("Démarrage du serveur My Team Budget")
    logger.info(f"Python {sys.version}")
    logger.info(f"Base dir: {BASE_DIR}")
    logger.info(f"DB: {DB_PATH}")
    logger.info(f"Logs: {os.path.join(LOG_DIR, 'server.log')}")

    init_db()
    seed_if_empty()
    apply_pending_exits()

    if not os.path.isdir(BUILD_DIR):
        print(f'⚠️  Dossier frontend/build/ non trouvé.')
        print(f'   Le serveur API démarre quand même sur le port {PORT}.')
        print(f'   Pour le frontend, lancez: cd frontend && npm start')

    print(f'\n{"="*50}')
    print(f'  My Team Budget — Serveur démarré')
    print(f'  http://localhost:{PORT}')
    print(f'  Logs: {os.path.join(LOG_DIR, "server.log")}')
    print(f'  Ctrl+C pour arrêter')
    print(f'{"="*50}\n')

    logger.info(f"Serveur prêt sur http://localhost:{PORT}")

    server = HTTPServer(('0.0.0.0', PORT), BudgetHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Serveur arrêté par l'utilisateur")
        print('\nServeur arrêté.')
        server.server_close()
