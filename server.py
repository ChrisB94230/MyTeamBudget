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
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from io import BytesIO

PORT = 5001
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
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

if __name__ == '__main__':
    init_db()
    seed_if_empty()

    if not os.path.isdir(BUILD_DIR):
        print(f'⚠️  Dossier frontend/build/ non trouvé.')
        print(f'   Le serveur API démarre quand même sur le port {PORT}.')
        print(f'   Pour le frontend, lancez: cd frontend && npm start')

    print(f'\n{"="*50}')
    print(f'  My Team Budget — Serveur démarré')
    print(f'  http://localhost:{PORT}')
    print(f'  Ctrl+C pour arrêter')
    print(f'{"="*50}\n')

    server = HTTPServer(('0.0.0.0', PORT), BudgetHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServeur arrêté.')
        server.server_close()
