import os
import pandas as pd
from openpyxl import load_workbook, Workbook
from datetime import datetime

MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

RESOURCE_COLS = ['id', 'name', 'activite', 'tribu', 'statut', 'etp',
                 'repartition_run', 'nb_jours_total', 'nb_jours_run',
                 'year', 'is_fictive',
                 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

CONSUMPTION_COLS = ['year', 'month', 'resource_id', 'consumed']

PREVISION_COLS = ['id', 'type', 'name', 'activite', 'tribu', 'statut',
                  'etp', 'repartition_run', 'date_effet', 'motif',
                  'year', 'nb_jours_run',
                  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                  'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

SETTINGS_COLS = ['year', 'budget_global_alloue', 'reduction_jours',
                 'label_reduction', 'nb_jours_ouvrables_interne',
                 'nb_jours_ouvrables_externe', 'notes']

PRESENCE_COLS = ['year', 'month', 'resource_id', 'jours_travailles']

JOURS_OUVRABLES_PAR_MOIS = [22, 21, 21, 21, 19, 20, 23, 21, 22, 21, 20, 20]


class DataService:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self._ensure_files()

    def _file(self, name):
        return os.path.join(self.data_dir, name)

    def _ensure_files(self):
        for fname, cols in [
            ('resources.xlsx', RESOURCE_COLS),
            ('consumption.xlsx', CONSUMPTION_COLS),
            ('previsions.xlsx', PREVISION_COLS),
            ('settings.xlsx', SETTINGS_COLS),
            ('presence.xlsx', PRESENCE_COLS),
        ]:
            path = self._file(fname)
            if not os.path.exists(path):
                df = pd.DataFrame(columns=cols)
                df.to_excel(path, index=False)

    def _read(self, fname):
        path = self._file(fname)
        return pd.read_excel(path)

    def _write(self, fname, df):
        path = self._file(fname)
        df.to_excel(path, index=False)

    def _next_id(self, df):
        if df.empty or 'id' not in df.columns:
            return 1
        return int(df['id'].max()) + 1

    # --- Resources ---

    def get_resources(self, year=None):
        df = self._read('resources.xlsx')
        if year and not df.empty:
            df = df[df['year'] == year]
        return df.fillna(0).to_dict('records')

    def add_resource(self, data):
        df = self._read('resources.xlsx')
        data['id'] = self._next_id(df)

        if 'nb_jours_total' not in data or not data['nb_jours_total']:
            data['nb_jours_total'] = 206 if data.get('statut') == 'Interne' else 210

        etp = float(data.get('etp', 1))
        run = float(data.get('repartition_run', 1))
        total = float(data['nb_jours_total'])
        data['nb_jours_run'] = round(total * etp * run, 2)

        if not any(data.get(m) for m in MONTHS):
            self._distribute_months(data)

        row = {c: data.get(c, 0) for c in RESOURCE_COLS}
        row['is_fictive'] = data.get('is_fictive', False)
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        self._write('resources.xlsx', df)
        return row

    def update_resource(self, resource_id, data):
        df = self._read('resources.xlsx')
        idx = df.index[df['id'] == resource_id]
        if idx.empty:
            return None
        i = idx[0]

        for k, v in data.items():
            if k in RESOURCE_COLS and k != 'id':
                df.at[i, k] = v

        etp = float(df.at[i, 'etp'])
        run = float(df.at[i, 'repartition_run'])
        total = float(df.at[i, 'nb_jours_total'])
        df.at[i, 'nb_jours_run'] = round(total * etp * run, 2)

        self._write('resources.xlsx', df)
        return df.loc[i].fillna(0).to_dict()

    def delete_resource(self, resource_id):
        df = self._read('resources.xlsx')
        idx = df.index[df['id'] == resource_id]
        if idx.empty:
            return False
        df = df.drop(idx)
        self._write('resources.xlsx', df)
        return True

    # --- Import Excel ---

    IMPORT_COL_MAP = {
        'nom': 'name', 'name': 'name', 'ressource': 'name',
        'activité': 'activite', 'activite': 'activite', 'activity': 'activite',
        'tribu': 'tribu', 'tribe': 'tribu',
        'statut': 'statut', 'status': 'statut', 'type': 'statut',
        'etp': 'etp', 'fte': 'etp',
        'repartition_run': 'repartition_run', 'répartition run': 'repartition_run',
        'repartition run': 'repartition_run', 'run': 'repartition_run', '% run': 'repartition_run',
        'nb_jours_total': 'nb_jours_total', 'nb jours total': 'nb_jours_total',
        'jours total': 'nb_jours_total', 'jours/an': 'nb_jours_total',
        'année': 'year', 'annee': 'year', 'year': 'year',
        'fictive': 'is_fictive', 'is_fictive': 'is_fictive',
        'jan': 'jan', 'janvier': 'jan', '01': 'jan', '1': 'jan',
        'fev': 'feb', 'feb': 'feb', 'février': 'feb', 'fevrier': 'feb', '02': 'feb', '2': 'feb',
        'mar': 'mar', 'mars': 'mar', '03': 'mar', '3': 'mar',
        'avr': 'apr', 'apr': 'apr', 'avril': 'apr', '04': 'apr', '4': 'apr',
        'mai': 'may', 'may': 'may', '05': 'may', '5': 'may',
        'jun': 'jun', 'juin': 'jun', '06': 'jun', '6': 'jun',
        'jul': 'jul', 'juillet': 'jul', '07': 'jul', '7': 'jul',
        'aou': 'aug', 'aug': 'aug', 'août': 'aug', 'aout': 'aug', '08': 'aug', '8': 'aug',
        'sep': 'sep', 'septembre': 'sep', '09': 'sep', '9': 'sep',
        'oct': 'oct', 'octobre': 'oct', '10': 'oct',
        'nov': 'nov', 'novembre': 'nov', '11': 'nov',
        'dec': 'dec', 'décembre': 'dec', 'decembre': 'dec', '12': 'dec',
    }

    def preview_import(self, file_obj, year=None):
        try:
            df = pd.read_excel(file_obj)
        except Exception as e:
            return {'error': f'Impossible de lire le fichier: {str(e)}'}

        if df.empty:
            return {'error': 'Le fichier est vide'}

        col_mapping = {}
        unmapped = []
        for col in df.columns:
            key = str(col).strip().lower()
            if key in self.IMPORT_COL_MAP:
                col_mapping[col] = self.IMPORT_COL_MAP[key]
            else:
                unmapped.append(str(col))

        df = df.rename(columns=col_mapping)

        rows = []
        warnings = []
        for idx, row in df.iterrows():
            r = {}
            r['name'] = str(row.get('name', '')).strip()
            if not r['name'] or r['name'] == 'nan':
                warnings.append(f'Ligne {idx + 2}: nom manquant, ignorée')
                continue

            r['activite'] = str(row.get('activite', '')).strip()
            r['tribu'] = str(row.get('tribu', '')).strip()
            if r['tribu'] == 'nan':
                r['tribu'] = ''

            statut = str(row.get('statut', 'Interne')).strip()
            if statut.lower() in ('interne', 'int', 'i', 'cdi', 'cdd'):
                r['statut'] = 'Interne'
            elif statut.lower() in ('externe', 'ext', 'e', 'presta', 'prestataire'):
                r['statut'] = 'Externe'
            else:
                r['statut'] = 'Interne'
                warnings.append(f'Ligne {idx + 2}: statut "{statut}" non reconnu, défaut Interne')

            r['etp'] = self._safe_float(row.get('etp'), 1)
            r['repartition_run'] = self._safe_float(row.get('repartition_run'), 1)

            default_days = 206 if r['statut'] == 'Interne' else 210
            r['nb_jours_total'] = self._safe_float(row.get('nb_jours_total'), default_days)

            r['year'] = int(self._safe_float(row.get('year'), year or datetime.now().year))

            fict = row.get('is_fictive', False)
            r['is_fictive'] = bool(fict) if not pd.isna(fict) else False

            r['nb_jours_run'] = round(r['nb_jours_total'] * r['etp'] * r['repartition_run'], 2)

            has_months = False
            for m in MONTHS:
                val = self._safe_float(row.get(m), 0)
                r[m] = val
                if val > 0:
                    has_months = True

            if not has_months:
                monthly = round(r['nb_jours_run'] / 12, 2)
                for m in MONTHS:
                    r[m] = monthly

            rows.append(r)

        return {
            'rows': rows,
            'count': len(rows),
            'warnings': warnings,
            'unmapped_columns': unmapped,
            'mapped_columns': {str(k): v for k, v in col_mapping.items()},
        }

    def _safe_float(self, val, default=0):
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    def bulk_add_resources(self, rows):
        added = []
        for row in rows:
            r = self.add_resource(row)
            added.append(r)
        return {'added': len(added), 'resources': added}

    def generate_import_template(self):
        template_data = {
            'Nom': ['Exemple Dupont', 'Exemple Martin'],
            'Activité': ['DATA', 'CYBER'],
            'Tribu': ['', ''],
            'Statut': ['Interne', 'Externe'],
            'ETP': [1, 0.5],
            'Répartition RUN': [0.8, 0.6],
            'Nb Jours Total': [206, 210],
            'Année': [datetime.now().year, datetime.now().year],
            'Fictive': [False, False],
            'Jan': ['', ''], 'Fev': ['', ''], 'Mar': ['', ''],
            'Avr': ['', ''], 'Mai': ['', ''], 'Jun': ['', ''],
            'Jul': ['', ''], 'Aou': ['', ''], 'Sep': ['', ''],
            'Oct': ['', ''], 'Nov': ['', ''], 'Dec': ['', ''],
        }
        df = pd.DataFrame(template_data)
        path = self._file('_template_import.xlsx')
        df.to_excel(path, index=False)
        return path

    def _distribute_months(self, data):
        nb_jours_run = float(data.get('nb_jours_run', 0))
        monthly = round(nb_jours_run / 12, 2)
        for m in MONTHS:
            data[m] = monthly

    # --- Présence / Temps de travail ---

    def get_presence(self, year=None):
        df = self._read('presence.xlsx')
        if year and not df.empty:
            df = df[df['year'] == year]
        return df.fillna(0).to_dict('records')

    def update_presence(self, data):
        df = self._read('presence.xlsx')
        year = data['year']
        month = data['month']
        rid = data['resource_id']

        mask = (df['year'] == year) & (df['month'] == month) & (df['resource_id'] == rid)
        if mask.any():
            df.loc[mask, 'jours_travailles'] = data['jours_travailles']
        else:
            df = pd.concat([df, pd.DataFrame([data])], ignore_index=True)

        self._write('presence.xlsx', df)

    def bulk_update_presence(self, entries):
        for entry in entries:
            self.update_presence(entry)

    def get_presence_dashboard(self, year=None):
        if year is None:
            year = datetime.now().year

        resources = self._read('resources.xlsx')
        presence = self._read('presence.xlsx')

        res_year = resources[resources['year'] == year] if not resources.empty else resources
        pres_year = presence[presence['year'] == year] if not presence.empty else presence

        now = datetime.now()
        current_month = now.month if now.year == year else 12

        jours_ouvrables_ecoules = sum(JOURS_OUVRABLES_PAR_MOIS[:current_month])
        jours_ouvrables_annee = sum(JOURS_OUVRABLES_PAR_MOIS)
        jours_ouvrables_restants = jours_ouvrables_annee - jours_ouvrables_ecoules

        results = []
        alerts = []

        for _, res in res_year.iterrows():
            rid = int(res['id'])
            name = res['name']
            statut = res['statut']
            etp = float(res.get('etp', 1))
            nb_jours_total = float(res.get('nb_jours_total', 206 if statut == 'Interne' else 210))
            is_fictive = bool(res.get('is_fictive', False))

            if is_fictive:
                continue

            limite_annuelle = nb_jours_total * etp

            monthly = {}
            total_travaille = 0
            mois_actifs = 0
            for m in range(1, 13):
                val = 0
                if not pres_year.empty:
                    row = pres_year[(pres_year['resource_id'] == rid) & (pres_year['month'] == m)]
                    if not row.empty:
                        val = float(row.iloc[0]['jours_travailles'])
                monthly[m] = round(val, 2)
                total_travaille += val
                if val > 0:
                    mois_actifs += 1

            jours_restants = round(limite_annuelle - total_travaille, 2)

            # Rythme moyen par mois
            if mois_actifs > 0:
                rythme_mensuel = total_travaille / mois_actifs
            else:
                rythme_mensuel = 0

            # Projection fin d'année
            mois_restants = 12 - current_month
            if rythme_mensuel > 0:
                projection_annuelle = total_travaille + (rythme_mensuel * mois_restants)
                mois_avant_epuisement = jours_restants / rythme_mensuel if jours_restants > 0 else 0
                mois_epuisement = current_month + mois_avant_epuisement
            else:
                projection_annuelle = total_travaille
                mois_epuisement = None

            # Rythme théorique attendu (avec congés)
            jours_ouvrables_par_mois_moyen = jours_ouvrables_annee / 12
            rythme_theorique = (limite_annuelle / jours_ouvrables_annee) * jours_ouvrables_par_mois_moyen

            # Congés pris = jours ouvrables échus - jours travaillés
            jours_ouvrables_etp = jours_ouvrables_ecoules * etp
            conges_pris = round(max(0, jours_ouvrables_etp - total_travaille), 2)
            conges_attendus = round(jours_ouvrables_etp - (limite_annuelle * current_month / 12), 2)
            conges_attendus = max(0, conges_attendus)

            # Statut d'alerte
            alert_level = 'ok'
            alert_msg = ''

            if mois_actifs > 0 and current_month >= 3:
                if mois_epuisement is not None and mois_epuisement <= 9:
                    alert_level = 'critical'
                    mois_label = MONTH_LABELS[min(int(mois_epuisement), 11)]
                    alert_msg = f'Budget épuisé vers {mois_label} — risque d\'arrêt anticipé'
                elif mois_epuisement is not None and mois_epuisement <= 11:
                    alert_level = 'warning'
                    mois_label = MONTH_LABELS[min(int(mois_epuisement), 11)]
                    alert_msg = f'Budget épuisé vers {mois_label} — congés insuffisants'
                elif conges_pris < conges_attendus * 0.5 and current_month >= 4:
                    alert_level = 'warning'
                    alert_msg = f'Très peu de congés pris ({conges_pris}j vs {conges_attendus}j attendus)'

                if projection_annuelle > limite_annuelle * 1.05:
                    if alert_level != 'critical':
                        alert_level = 'warning'
                        alert_msg = f'Projection {round(projection_annuelle)}j dépasse la limite {round(limite_annuelle)}j'

            entry = {
                'resource_id': rid,
                'name': name,
                'activite': res.get('activite', ''),
                'statut': statut,
                'etp': etp,
                'limite_annuelle': round(limite_annuelle, 2),
                'monthly': monthly,
                'total_travaille': round(total_travaille, 2),
                'jours_restants': jours_restants,
                'rythme_mensuel': round(rythme_mensuel, 2),
                'rythme_theorique': round(rythme_theorique, 2),
                'projection_annuelle': round(projection_annuelle, 2),
                'mois_epuisement': round(mois_epuisement, 1) if mois_epuisement else None,
                'conges_pris': conges_pris,
                'conges_attendus': conges_attendus,
                'alert_level': alert_level,
                'alert_msg': alert_msg,
            }
            results.append(entry)

            if alert_level in ('warning', 'critical'):
                alerts.append({
                    'name': name,
                    'statut': statut,
                    'level': alert_level,
                    'message': alert_msg,
                })

        alerts.sort(key=lambda a: 0 if a['level'] == 'critical' else 1)

        return {
            'year': year,
            'current_month': current_month,
            'jours_ouvrables_ecoules': jours_ouvrables_ecoules,
            'jours_ouvrables_annee': jours_ouvrables_annee,
            'jours_ouvrables_restants': jours_ouvrables_restants,
            'jours_ouvrables_par_mois': JOURS_OUVRABLES_PAR_MOIS,
            'resources': results,
            'alerts': alerts,
            'nb_alerts_critical': len([a for a in alerts if a['level'] == 'critical']),
            'nb_alerts_warning': len([a for a in alerts if a['level'] == 'warning']),
        }

    # --- Consumption ---

    def get_consumption(self, year=None):
        df = self._read('consumption.xlsx')
        if year and not df.empty:
            df = df[df['year'] == year]
        return df.fillna(0).to_dict('records')

    def update_consumption(self, data):
        df = self._read('consumption.xlsx')
        year = data['year']
        month = data['month']
        rid = data['resource_id']

        mask = (df['year'] == year) & (df['month'] == month) & (df['resource_id'] == rid)
        if mask.any():
            df.loc[mask, 'consumed'] = data['consumed']
        else:
            df = pd.concat([df, pd.DataFrame([data])], ignore_index=True)

        self._write('consumption.xlsx', df)

    # --- Previsions ---

    def get_previsions(self, year=None):
        df = self._read('previsions.xlsx')
        if year and not df.empty:
            df = df[df['year'] == year]
        return df.fillna('').to_dict('records')

    def add_prevision(self, data):
        df = self._read('previsions.xlsx')
        data['id'] = self._next_id(df)

        if 'nb_jours_total' not in data:
            data['nb_jours_total'] = 206 if data.get('statut') == 'Interne' else 210

        etp = float(data.get('etp', 1))
        run = float(data.get('repartition_run', 1))
        total = float(data.get('nb_jours_total', 206))
        data['nb_jours_run'] = round(total * etp * run, 2)

        date_effet = data.get('date_effet', '')
        if date_effet and not any(data.get(m) for m in MONTHS):
            self._distribute_prevision_months(data, date_effet)

        row = {c: data.get(c, '') for c in PREVISION_COLS}
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        self._write('previsions.xlsx', df)
        return row

    def update_prevision(self, prevision_id, data):
        df = self._read('previsions.xlsx')
        idx = df.index[df['id'] == prevision_id]
        if idx.empty:
            return None
        i = idx[0]
        for k, v in data.items():
            if k in PREVISION_COLS and k != 'id':
                df.at[i, k] = v
        self._write('previsions.xlsx', df)
        return df.loc[i].fillna('').to_dict()

    def delete_prevision(self, prevision_id):
        df = self._read('previsions.xlsx')
        idx = df.index[df['id'] == prevision_id]
        if idx.empty:
            return False
        df = df.drop(idx)
        self._write('previsions.xlsx', df)
        return True

    def _distribute_prevision_months(self, data, date_effet):
        try:
            dt = datetime.strptime(date_effet, '%Y-%m-%d')
            start_month = dt.month - 1
        except ValueError:
            start_month = 0

        nb_jours_run = float(data.get('nb_jours_run', 0))
        active_months = 12 - start_month
        if active_months <= 0:
            return
        monthly = round(nb_jours_run / 12, 2)
        ptype = data.get('type', 'entree')
        for i, m in enumerate(MONTHS):
            if i >= start_month:
                data[m] = monthly if ptype == 'entree' else -monthly
            else:
                data[m] = 0

    # --- Settings ---

    def get_settings(self, year=None):
        df = self._read('settings.xlsx')
        if year and not df.empty:
            row = df[df['year'] == year]
            if not row.empty:
                return row.iloc[0].fillna('').to_dict()
        return {
            'year': year or datetime.now().year,
            'budget_global_alloue': 0,
            'reduction_jours': 0,
            'label_reduction': '',
            'nb_jours_ouvrables_interne': 206,
            'nb_jours_ouvrables_externe': 210,
            'notes': '',
        }

    def update_settings(self, data):
        df = self._read('settings.xlsx')
        year = data.get('year', datetime.now().year)

        if not df.empty:
            mask = df['year'] == year
            if mask.any():
                i = df.index[mask][0]
                for k, v in data.items():
                    if k in SETTINGS_COLS:
                        df.at[i, k] = v
                self._write('settings.xlsx', df)
                return df.loc[i].fillna('').to_dict()

        row = {c: data.get(c, '') for c in SETTINGS_COLS}
        row['year'] = year
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        self._write('settings.xlsx', df)
        return row

    def get_all_settings(self):
        df = self._read('settings.xlsx')
        if df.empty:
            return []
        return df.fillna('').to_dict('records')

    # --- Dashboard ---

    def get_dashboard(self, year=None):
        if year is None:
            year = datetime.now().year

        resources = self._read('resources.xlsx')
        consumption = self._read('consumption.xlsx')
        previsions = self._read('previsions.xlsx')

        res_year = resources[resources['year'] == year] if not resources.empty else resources
        cons_year = consumption[consumption['year'] == year] if not consumption.empty else consumption
        prev_year = previsions[previsions['year'] == year] if not previsions.empty else previsions

        budget_total = float(res_year['nb_jours_run'].sum()) if not res_year.empty else 0

        monthly_budget = []
        monthly_consumed = []
        for m in MONTHS:
            mb = float(res_year[m].sum()) if not res_year.empty and m in res_year.columns else 0
            monthly_budget.append(round(mb, 2))

        for i in range(1, 13):
            mc = 0
            if not cons_year.empty:
                mc = float(cons_year[cons_year['month'] == i]['consumed'].sum())
            monthly_consumed.append(round(mc, 2))

        total_consumed = sum(monthly_consumed)
        budget_restant = round(budget_total - total_consumed, 2)

        by_activite = {}
        if not res_year.empty:
            grouped = res_year.groupby('activite')['nb_jours_run'].sum()
            by_activite = {k: round(v, 2) for k, v in grouped.items()}

        by_statut = {'Interne': 0, 'Externe': 0}
        if not res_year.empty:
            for s in ['Interne', 'Externe']:
                val = res_year[res_year['statut'] == s]['nb_jours_run'].sum()
                by_statut[s] = round(float(val), 2)

        nb_etp_interne = 0
        nb_etp_externe = 0
        if not res_year.empty:
            nb_etp_interne = round(float(res_year[res_year['statut'] == 'Interne']['etp'].sum()), 2)
            nb_etp_externe = round(float(res_year[res_year['statut'] == 'Externe']['etp'].sum()), 2)

        prev_entries = []
        prev_exits = []
        if not prev_year.empty:
            entries = prev_year[prev_year['type'] == 'entree']
            exits = prev_year[prev_year['type'] == 'sortie']
            prev_entries = entries.fillna('').to_dict('records')
            prev_exits = exits.fillna('').to_dict('records')

        settings = self.get_settings(year)
        budget_global_alloue = float(settings.get('budget_global_alloue', 0) or 0)
        reduction_jours = float(settings.get('reduction_jours', 0) or 0)
        label_reduction = settings.get('label_reduction', '')
        budget_enveloppe = round(budget_global_alloue - reduction_jours, 2)
        ecart_enveloppe = round(budget_total - budget_enveloppe, 2) if budget_global_alloue > 0 else 0

        return {
            'year': year,
            'budget_total': budget_total,
            'total_consumed': round(total_consumed, 2),
            'budget_restant': budget_restant,
            'monthly_budget': monthly_budget,
            'monthly_consumed': monthly_consumed,
            'month_labels': MONTH_LABELS,
            'by_activite': by_activite,
            'by_statut': by_statut,
            'nb_etp_interne': nb_etp_interne,
            'nb_etp_externe': nb_etp_externe,
            'nb_resources': len(res_year),
            'prevision_entries': prev_entries,
            'prevision_exits': prev_exits,
            'budget_global_alloue': budget_global_alloue,
            'reduction_jours': reduction_jours,
            'label_reduction': label_reduction,
            'budget_enveloppe': budget_enveloppe,
            'ecart_enveloppe': ecart_enveloppe,
            'presence_alerts': self._get_presence_alert_summary(year),
        }

    def _get_presence_alert_summary(self, year):
        try:
            pd_data = self.get_presence_dashboard(year)
            return {
                'nb_critical': pd_data['nb_alerts_critical'],
                'nb_warning': pd_data['nb_alerts_warning'],
                'alerts': pd_data['alerts'][:5],
            }
        except Exception:
            return {'nb_critical': 0, 'nb_warning': 0, 'alerts': []}

    def get_years(self):
        df = self._read('resources.xlsx')
        if df.empty:
            return [datetime.now().year]
        years = sorted(df['year'].dropna().unique().astype(int).tolist())
        if not years:
            years = [datetime.now().year]
        return years

    # --- Comparatif multi-années ---

    def get_comparison(self, selected_years):
        resources = self._read('resources.xlsx')
        consumption = self._read('consumption.xlsx')

        result = {}
        for year in selected_years:
            res_year = resources[resources['year'] == year] if not resources.empty else resources
            cons_year = consumption[consumption['year'] == year] if not consumption.empty else consumption

            monthly_budget = []
            monthly_consumed = []
            for m in MONTHS:
                mb = float(res_year[m].sum()) if not res_year.empty and m in res_year.columns else 0
                monthly_budget.append(round(mb, 2))

            for i in range(1, 13):
                mc = 0
                if not cons_year.empty:
                    mc = float(cons_year[cons_year['month'] == i]['consumed'].sum())
                monthly_consumed.append(round(mc, 2))

            budget_total = float(res_year['nb_jours_run'].sum()) if not res_year.empty else 0

            by_activite = {}
            if not res_year.empty:
                grouped = res_year.groupby('activite')['nb_jours_run'].sum()
                by_activite = {k: round(v, 2) for k, v in grouped.items()}

            by_statut = {'Interne': 0, 'Externe': 0}
            if not res_year.empty:
                for s in ['Interne', 'Externe']:
                    val = res_year[res_year['statut'] == s]['nb_jours_run'].sum()
                    by_statut[s] = round(float(val), 2)

            nb_etp = 0
            if not res_year.empty:
                nb_etp = round(float(res_year['etp'].sum()), 2)

            result[str(year)] = {
                'year': year,
                'budget_total': round(budget_total, 2),
                'total_consumed': round(sum(monthly_consumed), 2),
                'monthly_budget': monthly_budget,
                'monthly_consumed': monthly_consumed,
                'by_activite': by_activite,
                'by_statut': by_statut,
                'nb_resources': len(res_year),
                'nb_etp': nb_etp,
            }

        return result
