const { getDb } = require('./db');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec_'];
const MONTHS_API = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS_OUVRABLES_PAR_MOIS = [22, 21, 21, 21, 19, 20, 23, 21, 22, 21, 20, 20];

// Map API month name ('dec') to DB column name ('dec_')
function dbCol(apiMonth) {
  return apiMonth === 'dec' ? 'dec_' : apiMonth;
}

// Convert a DB row to API format (dec_ -> dec)
function rowToApi(row) {
  if (!row) return null;
  const out = { ...row };
  if ('dec_' in out) {
    out.dec = out.dec_;
    delete out.dec_;
  }
  if ('is_fictive' in out) {
    out.is_fictive = !!out.is_fictive;
  }
  return out;
}

// ==================== RESOURCES ====================

function getResources(year) {
  const db = getDb();
  let rows;
  if (year) {
    rows = db.prepare('SELECT * FROM resources WHERE year = ?').all(year);
  } else {
    rows = db.prepare('SELECT * FROM resources').all();
  }
  return rows.map(rowToApi);
}

function addResource(data) {
  const db = getDb();

  if (!data.nb_jours_total) {
    data.nb_jours_total = data.statut === 'Interne' ? 206 : 210;
  }

  const etp = parseFloat(data.etp || 1);
  const run = parseFloat(data.repartition_run || 1);
  const total = parseFloat(data.nb_jours_total);
  data.nb_jours_run = Math.round(total * etp * run * 100) / 100;

  // Distribute months if none provided
  const hasMonths = MONTHS_API.some(m => parseFloat(data[m]) > 0);
  if (!hasMonths) {
    distributeMonths(data);
  }

  const stmt = db.prepare(`
    INSERT INTO resources (name, activite, tribu, statut, etp, repartition_run,
      nb_jours_total, nb_jours_run, year, is_fictive,
      jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec_)
    VALUES (@name, @activite, @tribu, @statut, @etp, @repartition_run,
      @nb_jours_total, @nb_jours_run, @year, @is_fictive,
      @jan, @feb, @mar, @apr, @may, @jun, @jul, @aug, @sep, @oct, @nov, @dec_)
  `);

  const params = {
    name: data.name || '',
    activite: data.activite || '',
    tribu: data.tribu || '',
    statut: data.statut || 'Interne',
    etp: etp,
    repartition_run: run,
    nb_jours_total: total,
    nb_jours_run: data.nb_jours_run,
    year: parseInt(data.year) || new Date().getFullYear(),
    is_fictive: data.is_fictive ? 1 : 0,
    jan: parseFloat(data.jan) || 0,
    feb: parseFloat(data.feb) || 0,
    mar: parseFloat(data.mar) || 0,
    apr: parseFloat(data.apr) || 0,
    may: parseFloat(data.may) || 0,
    jun: parseFloat(data.jun) || 0,
    jul: parseFloat(data.jul) || 0,
    aug: parseFloat(data.aug) || 0,
    sep: parseFloat(data.sep) || 0,
    oct: parseFloat(data.oct) || 0,
    nov: parseFloat(data.nov) || 0,
    dec_: parseFloat(data.dec) || 0,
  };

  const result = stmt.run(params);
  return rowToApi({ id: result.lastInsertRowid, ...params });
}

function updateResource(resourceId, data) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId);
  if (!existing) return null;

  // Merge
  const merged = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    const col = k === 'dec' ? 'dec_' : k;
    if (col in merged) merged[col] = v;
  }

  // Recalculate
  const etp = parseFloat(merged.etp);
  const run = parseFloat(merged.repartition_run);
  const total = parseFloat(merged.nb_jours_total);
  merged.nb_jours_run = Math.round(total * etp * run * 100) / 100;
  merged.is_fictive = merged.is_fictive ? 1 : 0;

  db.prepare(`
    UPDATE resources SET name=@name, activite=@activite, tribu=@tribu, statut=@statut,
      etp=@etp, repartition_run=@repartition_run, nb_jours_total=@nb_jours_total,
      nb_jours_run=@nb_jours_run, year=@year, is_fictive=@is_fictive,
      jan=@jan, feb=@feb, mar=@mar, apr=@apr, may=@may, jun=@jun,
      jul=@jul, aug=@aug, sep=@sep, oct=@oct, nov=@nov, dec_=@dec_
    WHERE id = @id
  `).run(merged);

  return rowToApi(db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId));
}

function deleteResource(resourceId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM resources WHERE id = ?').run(resourceId);
  return result.changes > 0;
}

function distributeMonths(data) {
  const nbJoursRun = parseFloat(data.nb_jours_run || 0);
  const monthly = Math.round((nbJoursRun / 12) * 100) / 100;
  MONTHS_API.forEach(m => { data[m] = monthly; });
}

// ==================== IMPORT ====================

const IMPORT_COL_MAP = {
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
};

function previewImport(filePath, year) {
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (e) {
    return { error: `Impossible de lire le fichier: ${e.message}` };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet);

  if (!rawRows.length) return { error: 'Le fichier est vide' };

  // Map columns
  const colMapping = {};
  const unmapped = [];
  const sampleRow = rawRows[0];
  for (const col of Object.keys(sampleRow)) {
    const key = String(col).trim().toLowerCase();
    if (IMPORT_COL_MAP[key]) {
      colMapping[col] = IMPORT_COL_MAP[key];
    } else {
      unmapped.push(String(col));
    }
  }

  const rows = [];
  const warnings = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const mapped = {};
    for (const [origCol, val] of Object.entries(raw)) {
      const target = colMapping[origCol];
      if (target) mapped[target] = val;
    }

    const r = {};
    r.name = String(mapped.name || '').trim();
    if (!r.name || r.name === 'undefined') {
      warnings.push(`Ligne ${idx + 2}: nom manquant, ignorée`);
      continue;
    }

    r.activite = String(mapped.activite || '').trim();
    r.tribu = String(mapped.tribu || '').trim();
    if (r.tribu === 'undefined') r.tribu = '';

    const statut = String(mapped.statut || 'Interne').trim().toLowerCase();
    if (['interne', 'int', 'i', 'cdi', 'cdd'].includes(statut)) {
      r.statut = 'Interne';
    } else if (['externe', 'ext', 'e', 'presta', 'prestataire'].includes(statut)) {
      r.statut = 'Externe';
    } else {
      r.statut = 'Interne';
      warnings.push(`Ligne ${idx + 2}: statut "${statut}" non reconnu, défaut Interne`);
    }

    r.etp = safeFloat(mapped.etp, 1);
    r.repartition_run = safeFloat(mapped.repartition_run, 1);
    const defaultDays = r.statut === 'Interne' ? 206 : 210;
    r.nb_jours_total = safeFloat(mapped.nb_jours_total, defaultDays);
    r.year = parseInt(safeFloat(mapped.year, year || new Date().getFullYear()));
    r.is_fictive = !!mapped.is_fictive;
    r.nb_jours_run = Math.round(r.nb_jours_total * r.etp * r.repartition_run * 100) / 100;

    let hasMonths = false;
    for (const m of MONTHS_API) {
      const val = safeFloat(mapped[m], 0);
      r[m] = val;
      if (val > 0) hasMonths = true;
    }
    if (!hasMonths) {
      const monthly = Math.round((r.nb_jours_run / 12) * 100) / 100;
      MONTHS_API.forEach(m => { r[m] = monthly; });
    }

    rows.push(r);
  }

  return {
    rows,
    count: rows.length,
    warnings,
    unmapped_columns: unmapped,
    mapped_columns: colMapping,
  };
}

function bulkAddResources(rows) {
  const added = rows.map(r => addResource(r));
  return { added: added.length, resources: added };
}

function generateImportTemplate() {
  const templateData = [
    {
      Nom: 'Exemple Dupont', Activité: 'DATA', Tribu: '', Statut: 'Interne',
      ETP: 1, 'Répartition RUN': 0.8, 'Nb Jours Total': 206,
      Année: new Date().getFullYear(), Fictive: false,
      Jan: '', Fev: '', Mar: '', Avr: '', Mai: '', Jun: '',
      Jul: '', Aou: '', Sep: '', Oct: '', Nov: '', Dec: '',
    },
    {
      Nom: 'Exemple Martin', Activité: 'CYBER', Tribu: '', Statut: 'Externe',
      ETP: 0.5, 'Répartition RUN': 0.6, 'Nb Jours Total': 210,
      Année: new Date().getFullYear(), Fictive: false,
      Jan: '', Fev: '', Mar: '', Avr: '', Mai: '', Jun: '',
      Jul: '', Aou: '', Sep: '', Oct: '', Nov: '', Dec: '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const outPath = path.join(__dirname, '..', 'data', '_template_import.xlsx');
  XLSX.writeFile(wb, outPath);
  return outPath;
}

// ==================== PRESENCE ====================

function getPresence(year) {
  const db = getDb();
  if (year) {
    return db.prepare('SELECT * FROM presence WHERE year = ?').all(year);
  }
  return db.prepare('SELECT * FROM presence').all();
}

function updatePresence(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO presence (year, month, resource_id, jours_travailles)
    VALUES (@year, @month, @resource_id, @jours_travailles)
    ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles = @jours_travailles
  `).run({
    year: data.year,
    month: data.month,
    resource_id: data.resource_id,
    jours_travailles: data.jours_travailles,
  });
}

function bulkUpdatePresence(entries) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO presence (year, month, resource_id, jours_travailles)
    VALUES (@year, @month, @resource_id, @jours_travailles)
    ON CONFLICT(year, month, resource_id) DO UPDATE SET jours_travailles = @jours_travailles
  `);
  const tx = db.transaction((items) => { items.forEach(e => stmt.run(e)); });
  tx(entries);
}

function getPresenceDashboard(year) {
  if (!year) year = new Date().getFullYear();

  const db = getDb();
  const resources = db.prepare('SELECT * FROM resources WHERE year = ? AND is_fictive = 0').all(year);
  const presenceRows = db.prepare('SELECT * FROM presence WHERE year = ?').all(year);

  const now = new Date();
  const currentMonth = (now.getFullYear() === year) ? now.getMonth() + 1 : 12;
  const joursOuvrablesEcoules = JOURS_OUVRABLES_PAR_MOIS.slice(0, currentMonth).reduce((a, b) => a + b, 0);
  const joursOuvrablesAnnee = JOURS_OUVRABLES_PAR_MOIS.reduce((a, b) => a + b, 0);
  const joursOuvrablesRestants = joursOuvrablesAnnee - joursOuvrablesEcoules;

  const results = [];
  const alerts = [];

  for (const res of resources) {
    const rid = res.id;
    const etp = parseFloat(res.etp || 1);
    const nbJoursTotal = parseFloat(res.nb_jours_total || (res.statut === 'Interne' ? 206 : 210));
    const limiteAnnuelle = nbJoursTotal * etp;

    const monthly = {};
    let totalTravaille = 0;
    let moisActifs = 0;

    for (let m = 1; m <= 12; m++) {
      const pRow = presenceRows.find(p => p.resource_id === rid && p.month === m);
      const val = pRow ? Math.round(pRow.jours_travailles * 100) / 100 : 0;
      monthly[m] = val;
      totalTravaille += val;
      if (val > 0) moisActifs++;
    }

    const joursRestants = Math.round((limiteAnnuelle - totalTravaille) * 100) / 100;
    const rythmeMensuel = moisActifs > 0 ? totalTravaille / moisActifs : 0;
    const moisRestants = 12 - currentMonth;

    let projectionAnnuelle, moisEpuisement;
    if (rythmeMensuel > 0) {
      projectionAnnuelle = totalTravaille + (rythmeMensuel * moisRestants);
      const moisAvantEpuisement = joursRestants > 0 ? joursRestants / rythmeMensuel : 0;
      moisEpuisement = currentMonth + moisAvantEpuisement;
    } else {
      projectionAnnuelle = totalTravaille;
      moisEpuisement = null;
    }

    const joursOuvrablesParMoisMoyen = joursOuvrablesAnnee / 12;
    const rythmeTheorique = (limiteAnnuelle / joursOuvrablesAnnee) * joursOuvrablesParMoisMoyen;

    const joursOuvrablesEtp = joursOuvrablesEcoules * etp;
    const congesPris = Math.round(Math.max(0, joursOuvrablesEtp - totalTravaille) * 100) / 100;
    let congesAttendus = Math.round((joursOuvrablesEtp - (limiteAnnuelle * currentMonth / 12)) * 100) / 100;
    congesAttendus = Math.max(0, congesAttendus);

    let alertLevel = 'ok';
    let alertMsg = '';

    if (moisActifs > 0 && currentMonth >= 3) {
      if (moisEpuisement !== null && moisEpuisement <= 9) {
        alertLevel = 'critical';
        const moisLabel = MONTH_LABELS[Math.min(Math.floor(moisEpuisement), 11)];
        alertMsg = `Budget épuisé vers ${moisLabel} — risque d'arrêt anticipé`;
      } else if (moisEpuisement !== null && moisEpuisement <= 11) {
        alertLevel = 'warning';
        const moisLabel = MONTH_LABELS[Math.min(Math.floor(moisEpuisement), 11)];
        alertMsg = `Budget épuisé vers ${moisLabel} — congés insuffisants`;
      } else if (congesPris < congesAttendus * 0.5 && currentMonth >= 4) {
        alertLevel = 'warning';
        alertMsg = `Très peu de congés pris (${congesPris}j vs ${congesAttendus}j attendus)`;
      }

      if (projectionAnnuelle > limiteAnnuelle * 1.05) {
        if (alertLevel !== 'critical') {
          alertLevel = 'warning';
          alertMsg = `Projection ${Math.round(projectionAnnuelle)}j dépasse la limite ${Math.round(limiteAnnuelle)}j`;
        }
      }
    }

    const entry = {
      resource_id: rid,
      name: res.name,
      activite: res.activite || '',
      statut: res.statut,
      etp,
      limite_annuelle: Math.round(limiteAnnuelle * 100) / 100,
      monthly,
      total_travaille: Math.round(totalTravaille * 100) / 100,
      jours_restants: joursRestants,
      rythme_mensuel: Math.round(rythmeMensuel * 100) / 100,
      rythme_theorique: Math.round(rythmeTheorique * 100) / 100,
      projection_annuelle: Math.round(projectionAnnuelle * 100) / 100,
      mois_epuisement: moisEpuisement !== null ? Math.round(moisEpuisement * 10) / 10 : null,
      conges_pris: congesPris,
      conges_attendus: congesAttendus,
      alert_level: alertLevel,
      alert_msg: alertMsg,
    };
    results.push(entry);

    if (['warning', 'critical'].includes(alertLevel)) {
      alerts.push({ name: res.name, statut: res.statut, level: alertLevel, message: alertMsg });
    }
  }

  alerts.sort((a, b) => (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1));

  return {
    year,
    current_month: currentMonth,
    jours_ouvrables_ecoules: joursOuvrablesEcoules,
    jours_ouvrables_annee: joursOuvrablesAnnee,
    jours_ouvrables_restants: joursOuvrablesRestants,
    jours_ouvrables_par_mois: JOURS_OUVRABLES_PAR_MOIS,
    resources: results,
    alerts,
    nb_alerts_critical: alerts.filter(a => a.level === 'critical').length,
    nb_alerts_warning: alerts.filter(a => a.level === 'warning').length,
  };
}

// ==================== CONSUMPTION ====================

function getConsumption(year) {
  const db = getDb();
  if (year) {
    return db.prepare('SELECT * FROM consumption WHERE year = ?').all(year);
  }
  return db.prepare('SELECT * FROM consumption').all();
}

function updateConsumption(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO consumption (year, month, resource_id, consumed)
    VALUES (@year, @month, @resource_id, @consumed)
    ON CONFLICT(year, month, resource_id) DO UPDATE SET consumed = @consumed
  `).run({
    year: data.year,
    month: data.month,
    resource_id: data.resource_id,
    consumed: data.consumed,
  });
}

// ==================== PREVISIONS ====================

function getPrevisions(year) {
  const db = getDb();
  let rows;
  if (year) {
    rows = db.prepare('SELECT * FROM previsions WHERE year = ?').all(year);
  } else {
    rows = db.prepare('SELECT * FROM previsions').all();
  }
  return rows.map(rowToApi);
}

function addPrevision(data) {
  const db = getDb();

  if (!data.nb_jours_total) {
    data.nb_jours_total = data.statut === 'Interne' ? 206 : 210;
  }

  const etp = parseFloat(data.etp || 1);
  const run = parseFloat(data.repartition_run || 1);
  const total = parseFloat(data.nb_jours_total || 206);
  data.nb_jours_run = Math.round(total * etp * run * 100) / 100;

  const dateEffet = data.date_effet || '';
  const hasMonths = MONTHS_API.some(m => parseFloat(data[m]) > 0);
  if (dateEffet && !hasMonths) {
    distributePrevisionMonths(data, dateEffet);
  }

  const stmt = db.prepare(`
    INSERT INTO previsions (type, name, activite, tribu, statut, etp, repartition_run,
      date_effet, motif, year, nb_jours_run,
      jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec_)
    VALUES (@type, @name, @activite, @tribu, @statut, @etp, @repartition_run,
      @date_effet, @motif, @year, @nb_jours_run,
      @jan, @feb, @mar, @apr, @may, @jun, @jul, @aug, @sep, @oct, @nov, @dec_)
  `);

  const params = {
    type: data.type || 'entree',
    name: data.name || '',
    activite: data.activite || '',
    tribu: data.tribu || '',
    statut: data.statut || 'Interne',
    etp,
    repartition_run: run,
    date_effet: dateEffet,
    motif: data.motif || '',
    year: parseInt(data.year) || new Date().getFullYear(),
    nb_jours_run: data.nb_jours_run,
    jan: parseFloat(data.jan) || 0,
    feb: parseFloat(data.feb) || 0,
    mar: parseFloat(data.mar) || 0,
    apr: parseFloat(data.apr) || 0,
    may: parseFloat(data.may) || 0,
    jun: parseFloat(data.jun) || 0,
    jul: parseFloat(data.jul) || 0,
    aug: parseFloat(data.aug) || 0,
    sep: parseFloat(data.sep) || 0,
    oct: parseFloat(data.oct) || 0,
    nov: parseFloat(data.nov) || 0,
    dec_: parseFloat(data.dec) || 0,
  };

  const result = stmt.run(params);
  return rowToApi({ id: result.lastInsertRowid, ...params });
}

function updatePrevision(previsionId, data) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM previsions WHERE id = ?').get(previsionId);
  if (!existing) return null;

  const merged = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    const col = k === 'dec' ? 'dec_' : k;
    if (col in merged) merged[col] = v;
  }

  db.prepare(`
    UPDATE previsions SET type=@type, name=@name, activite=@activite, tribu=@tribu,
      statut=@statut, etp=@etp, repartition_run=@repartition_run, date_effet=@date_effet,
      motif=@motif, year=@year, nb_jours_run=@nb_jours_run,
      jan=@jan, feb=@feb, mar=@mar, apr=@apr, may=@may, jun=@jun,
      jul=@jul, aug=@aug, sep=@sep, oct=@oct, nov=@nov, dec_=@dec_
    WHERE id = @id
  `).run(merged);

  return rowToApi(db.prepare('SELECT * FROM previsions WHERE id = ?').get(previsionId));
}

function deletePrevision(previsionId) {
  const db = getDb();
  return db.prepare('DELETE FROM previsions WHERE id = ?').run(previsionId).changes > 0;
}

function distributePrevisionMonths(data, dateEffet) {
  let startMonth = 0;
  try {
    const dt = new Date(dateEffet);
    if (!isNaN(dt)) startMonth = dt.getMonth();
  } catch (e) { /* default 0 */ }

  const nbJoursRun = parseFloat(data.nb_jours_run || 0);
  const monthly = Math.round((nbJoursRun / 12) * 100) / 100;
  const ptype = data.type || 'entree';

  MONTHS_API.forEach((m, i) => {
    data[m] = i >= startMonth ? (ptype === 'entree' ? monthly : -monthly) : 0;
  });
}

// ==================== SETTINGS ====================

function getSettings(year) {
  const db = getDb();
  if (year) {
    const row = db.prepare('SELECT * FROM settings WHERE year = ?').get(year);
    if (row) return row;
  }
  return {
    year: year || new Date().getFullYear(),
    budget_global_alloue: 0,
    reduction_jours: 0,
    label_reduction: '',
    nb_jours_ouvrables_interne: 206,
    nb_jours_ouvrables_externe: 210,
    notes: '',
  };
}

function updateSettings(data) {
  const db = getDb();
  const year = data.year || new Date().getFullYear();

  db.prepare(`
    INSERT INTO settings (year, budget_global_alloue, reduction_jours, label_reduction,
      nb_jours_ouvrables_interne, nb_jours_ouvrables_externe, notes)
    VALUES (@year, @budget_global_alloue, @reduction_jours, @label_reduction,
      @nb_jours_ouvrables_interne, @nb_jours_ouvrables_externe, @notes)
    ON CONFLICT(year) DO UPDATE SET
      budget_global_alloue=@budget_global_alloue, reduction_jours=@reduction_jours,
      label_reduction=@label_reduction, nb_jours_ouvrables_interne=@nb_jours_ouvrables_interne,
      nb_jours_ouvrables_externe=@nb_jours_ouvrables_externe, notes=@notes
  `).run({
    year,
    budget_global_alloue: parseFloat(data.budget_global_alloue) || 0,
    reduction_jours: parseFloat(data.reduction_jours) || 0,
    label_reduction: data.label_reduction || '',
    nb_jours_ouvrables_interne: parseFloat(data.nb_jours_ouvrables_interne) || 206,
    nb_jours_ouvrables_externe: parseFloat(data.nb_jours_ouvrables_externe) || 210,
    notes: data.notes || '',
  });

  return db.prepare('SELECT * FROM settings WHERE year = ?').get(year);
}

function getAllSettings() {
  return getDb().prepare('SELECT * FROM settings').all();
}

// ==================== DASHBOARD ====================

function getDashboard(year) {
  if (!year) year = new Date().getFullYear();
  const db = getDb();

  const resources = db.prepare('SELECT * FROM resources WHERE year = ?').all(year);
  const consumptions = db.prepare('SELECT * FROM consumption WHERE year = ?').all(year);
  const previsions = db.prepare('SELECT * FROM previsions WHERE year = ?').all(year);

  const budgetTotal = resources.reduce((s, r) => s + (r.nb_jours_run || 0), 0);

  const monthlyBudget = MONTHS.map(m => {
    return Math.round(resources.reduce((s, r) => s + (r[m] || 0), 0) * 100) / 100;
  });

  const monthlyConsumed = [];
  for (let i = 1; i <= 12; i++) {
    const mc = consumptions.filter(c => c.month === i).reduce((s, c) => s + (c.consumed || 0), 0);
    monthlyConsumed.push(Math.round(mc * 100) / 100);
  }

  const totalConsumed = monthlyConsumed.reduce((a, b) => a + b, 0);
  const budgetRestant = Math.round((budgetTotal - totalConsumed) * 100) / 100;

  const byActivite = {};
  resources.forEach(r => {
    byActivite[r.activite] = (byActivite[r.activite] || 0) + (r.nb_jours_run || 0);
  });
  Object.keys(byActivite).forEach(k => { byActivite[k] = Math.round(byActivite[k] * 100) / 100; });

  const byStatut = { Interne: 0, Externe: 0 };
  resources.forEach(r => {
    if (r.statut === 'Interne' || r.statut === 'Externe') {
      byStatut[r.statut] += r.nb_jours_run || 0;
    }
  });
  byStatut.Interne = Math.round(byStatut.Interne * 100) / 100;
  byStatut.Externe = Math.round(byStatut.Externe * 100) / 100;

  const nbEtpInterne = Math.round(resources.filter(r => r.statut === 'Interne').reduce((s, r) => s + (r.etp || 0), 0) * 100) / 100;
  const nbEtpExterne = Math.round(resources.filter(r => r.statut === 'Externe').reduce((s, r) => s + (r.etp || 0), 0) * 100) / 100;

  const prevEntries = previsions.filter(p => p.type === 'entree').map(rowToApi);
  const prevExits = previsions.filter(p => p.type === 'sortie').map(rowToApi);

  const settings = getSettings(year);
  const budgetGlobalAlloue = parseFloat(settings.budget_global_alloue || 0);
  const reductionJours = parseFloat(settings.reduction_jours || 0);
  const labelReduction = settings.label_reduction || '';
  const budgetEnveloppe = Math.round((budgetGlobalAlloue - reductionJours) * 100) / 100;
  const ecartEnveloppe = budgetGlobalAlloue > 0 ? Math.round((budgetTotal - budgetEnveloppe) * 100) / 100 : 0;

  let presenceAlerts;
  try {
    const pd = getPresenceDashboard(year);
    presenceAlerts = {
      nb_critical: pd.nb_alerts_critical,
      nb_warning: pd.nb_alerts_warning,
      alerts: pd.alerts.slice(0, 5),
    };
  } catch (e) {
    presenceAlerts = { nb_critical: 0, nb_warning: 0, alerts: [] };
  }

  return {
    year,
    budget_total: budgetTotal,
    total_consumed: Math.round(totalConsumed * 100) / 100,
    budget_restant: budgetRestant,
    monthly_budget: monthlyBudget,
    monthly_consumed: monthlyConsumed,
    month_labels: MONTH_LABELS,
    by_activite: byActivite,
    by_statut: byStatut,
    nb_etp_interne: nbEtpInterne,
    nb_etp_externe: nbEtpExterne,
    nb_resources: resources.length,
    prevision_entries: prevEntries,
    prevision_exits: prevExits,
    budget_global_alloue: budgetGlobalAlloue,
    reduction_jours: reductionJours,
    label_reduction: labelReduction,
    budget_enveloppe: budgetEnveloppe,
    ecart_enveloppe: ecartEnveloppe,
    presence_alerts: presenceAlerts,
  };
}

// ==================== YEARS ====================

function getYears() {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT year FROM resources ORDER BY year').all();
  const years = rows.map(r => r.year);
  return years.length ? years : [new Date().getFullYear()];
}

// ==================== COMPARISON ====================

function getComparison(selectedYears) {
  const db = getDb();
  const result = {};

  for (const year of selectedYears) {
    const resources = db.prepare('SELECT * FROM resources WHERE year = ?').all(year);
    const consumptions = db.prepare('SELECT * FROM consumption WHERE year = ?').all(year);

    const monthlyBudget = MONTHS.map(m =>
      Math.round(resources.reduce((s, r) => s + (r[m] || 0), 0) * 100) / 100
    );

    const monthlyConsumed = [];
    for (let i = 1; i <= 12; i++) {
      const mc = consumptions.filter(c => c.month === i).reduce((s, c) => s + (c.consumed || 0), 0);
      monthlyConsumed.push(Math.round(mc * 100) / 100);
    }

    const budgetTotal = Math.round(resources.reduce((s, r) => s + (r.nb_jours_run || 0), 0) * 100) / 100;

    const byActivite = {};
    resources.forEach(r => {
      byActivite[r.activite] = Math.round(((byActivite[r.activite] || 0) + (r.nb_jours_run || 0)) * 100) / 100;
    });

    const byStatut = { Interne: 0, Externe: 0 };
    resources.forEach(r => {
      if (r.statut === 'Interne' || r.statut === 'Externe') {
        byStatut[r.statut] += r.nb_jours_run || 0;
      }
    });
    byStatut.Interne = Math.round(byStatut.Interne * 100) / 100;
    byStatut.Externe = Math.round(byStatut.Externe * 100) / 100;

    const nbEtp = Math.round(resources.reduce((s, r) => s + (r.etp || 0), 0) * 100) / 100;

    result[String(year)] = {
      year,
      budget_total: budgetTotal,
      total_consumed: Math.round(monthlyConsumed.reduce((a, b) => a + b, 0) * 100) / 100,
      monthly_budget: monthlyBudget,
      monthly_consumed: monthlyConsumed,
      by_activite: byActivite,
      by_statut: byStatut,
      nb_resources: resources.length,
      nb_etp: nbEtp,
    };
  }

  return result;
}

// ==================== UTILS ====================

function safeFloat(val, def = 0) {
  if (val === null || val === undefined || val === '') return def;
  const f = parseFloat(val);
  return isNaN(f) ? def : f;
}

module.exports = {
  getResources, addResource, updateResource, deleteResource,
  previewImport, bulkAddResources, generateImportTemplate,
  getPresence, updatePresence, bulkUpdatePresence, getPresenceDashboard,
  getConsumption, updateConsumption,
  getPrevisions, addPrevision, updatePrevision, deletePrevision,
  getSettings, updateSettings, getAllSettings,
  getDashboard, getYears, getComparison,
};
