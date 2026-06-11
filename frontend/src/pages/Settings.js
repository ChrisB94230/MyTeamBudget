import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Button, Card, CardContent, Grid, Typography, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Divider, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Collapse, IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getSettings, updateSettings, getYears, previewExcelImport, applyExcelImport, getLogs } from '../services/api';

const MONTH_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function Settings() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [form, setForm] = useState({
    budget_global_alloue: 0,
    reduction_jours: 0,
    label_reduction: '',
    nb_jours_ouvrables_interne: 206,
    nb_jours_ouvrables_externe: 210,
    notes: '',
  });
  const [saved, setSaved] = useState(false);

  // Import state
  const fileRef = useRef(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [sheetDialog, setSheetDialog] = useState(false);
  const [sheetChoices, setSheetChoices] = useState([]);
  const [selectedConflicts, setSelectedConflicts] = useState({});
  const [selectedNewRes, setSelectedNewRes] = useState({});
  const [selectedExits, setSelectedExits] = useState({});
  const [applying, setApplying] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showNewRes, setShowNewRes] = useState(true);
  const [showConflicts, setShowConflicts] = useState(true);
  const [showExits, setShowExits] = useState(true);
  const [logsDialog, setLogsDialog] = useState(false);
  const [logLines, setLogLines] = useState([]);

  useEffect(() => {
    getYears().then(res => setYears(res.data));
  }, []);

  useEffect(() => {
    getSettings(year).then(res => {
      setForm({
        budget_global_alloue: res.data.budget_global_alloue || 0,
        reduction_jours: res.data.reduction_jours || 0,
        label_reduction: res.data.label_reduction || '',
        nb_jours_ouvrables_interne: res.data.nb_jours_ouvrables_interne || 206,
        nb_jours_ouvrables_externe: res.data.nb_jours_ouvrables_externe || 210,
        notes: res.data.notes || '',
      });
      setSaved(false);
    });
  }, [year]);

  const handleSave = async () => {
    await updateSettings({ ...form, year });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ---- Import handlers ----

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportError('');
    setImportSuccess('');
    doPreview(file, null);
  };

  const doPreview = async (file, sheetName) => {
    setImporting(true);
    setImportError('');
    try {
      const res = await previewExcelImport(file || importFile, sheetName, year);
      const data = res.data;

      if (data.error) {
        setImportError(data.error);
        setImporting(false);
        return;
      }

      if (data.need_sheet_selection) {
        setSheetChoices(data.sheets);
        setSheetDialog(true);
        setImporting(false);
        return;
      }

      setImportPreview(data);
      // Auto-select all conflicts as "keep DB" (unchecked = keep DB, checked = use Excel)
      const cSel = {};
      (data.conflicts || []).forEach((c, i) => { cSel[i] = false; });
      setSelectedConflicts(cSel);
      // Auto-select all new resources
      const nSel = {};
      (data.new_resources || []).forEach((r, i) => { nSel[i] = true; });
      setSelectedNewRes(nSel);
      // Auto-select all inactive exits
      const eSel = {};
      (data.inactive_exits || []).forEach((e, i) => { eSel[i] = true; });
      setSelectedExits(eSel);
    } catch (err) {
      const serverMsg = err.response?.data?.error;
      const status = err.response?.status;
      const detail = serverMsg
        ? `${serverMsg}`
        : `Erreur réseau ou serveur (${status || err.message}). Consultez les logs serveur pour plus de détails.`;
      setImportError(detail);
    }
    setImporting(false);
  };

  const handleShowLogs = async () => {
    try {
      const res = await getLogs(80);
      setLogLines(res.data.lines || []);
      setLogsDialog(true);
    } catch (e) {
      setLogLines([`Impossible de récupérer les logs: ${e.message}`]);
      setLogsDialog(true);
    }
  };

  const handleSheetSelect = (name) => {
    setSheetDialog(false);
    doPreview(importFile, name);
  };

  const handleApplyImport = async () => {
    if (!importPreview) return;
    setApplying(true);
    setImportError('');

    // Gather confirmed changes
    const updates = importPreview.updates || [];
    const resolvedConflicts = (importPreview.conflicts || [])
      .filter((_, i) => selectedConflicts[i]);
    const newResources = (importPreview.new_resources || [])
      .filter((_, i) => selectedNewRes[i]);
    const inactiveExits = (importPreview.inactive_exits || [])
      .filter((_, i) => selectedExits[i]);

    try {
      const res = await applyExcelImport({
        year: importPreview.year,
        updates,
        resolved_conflicts: resolvedConflicts,
        new_resources: newResources,
        inactive_exits: inactiveExits,
      });
      const nb = res.data.applied || 0;
      setImportSuccess(`Import terminé : ${nb} modification${nb > 1 ? 's' : ''} appliquée${nb > 1 ? 's' : ''}`);
      setImportPreview(null);
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setImportError(err.response?.data?.error || 'Erreur lors de l\'application');
    }
    setApplying(false);
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setImportFile(null);
    setImportError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const budgetNet = Math.round((form.budget_global_alloue - form.reduction_jours) * 100) / 100;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Paramètres Globaux</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Année</InputLabel>
            <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              <MenuItem value={new Date().getFullYear()}>{new Date().getFullYear()}</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
            Enregistrer
          </Button>
        </Box>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Paramètres enregistrés avec succès</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Enveloppe Budgétaire</Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Budget global alloué (jours)"
                    type="number"
                    value={form.budget_global_alloue}
                    onChange={e => setForm({ ...form, budget_global_alloue: parseFloat(e.target.value) || 0 })}
                    helperText="Enveloppe totale de jours RUN allouée par la direction"
                    inputProps={{ step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Réduction (jours)"
                    type="number"
                    value={form.reduction_jours}
                    onChange={e => setForm({ ...form, reduction_jours: parseFloat(e.target.value) || 0 })}
                    helperText="Nombre de jours à retrancher du budget global"
                    inputProps={{ step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Motif de la réduction"
                    value={form.label_reduction}
                    onChange={e => setForm({ ...form, label_reduction: e.target.value })}
                    helperText="Ex: Effort productivité, Gel budgétaire..."
                  />
                </Grid>
              </Grid>

              <Paper sx={{ mt: 3, p: 2, bgcolor: budgetNet > 0 ? '#e8f5e9' : '#fff3e0' }}>
                <Typography variant="body2" color="text.secondary">Budget net disponible</Typography>
                <Typography variant="h4" fontWeight="bold" color={budgetNet > 0 ? 'primary' : 'error'}>
                  {budgetNet} jours
                </Typography>
                {form.reduction_jours > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {form.budget_global_alloue} j alloués − {form.reduction_jours} j de réduction
                    {form.label_reduction ? ` (${form.label_reduction})` : ''}
                  </Typography>
                )}
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Paramètres de Calcul</Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Jours ouvrables / an (Interne)"
                    type="number"
                    value={form.nb_jours_ouvrables_interne}
                    onChange={e => setForm({ ...form, nb_jours_ouvrables_interne: parseInt(e.target.value) || 206 })}
                    helperText="Base de calcul pour les internes (défaut: 206)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Jours ouvrables / an (Externe)"
                    type="number"
                    value={form.nb_jours_ouvrables_externe}
                    onChange={e => setForm({ ...form, nb_jours_ouvrables_externe: parseInt(e.target.value) || 210 })}
                    helperText="Base de calcul pour les externes (défaut: 210)"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notes</Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notes / Commentaires"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                helperText="Notes libres pour cette année budgétaire"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== EXCEL IMPORT SECTION ===== */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <UploadFileIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Import Excel (Présence & Consommation)
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Importez un fichier Excel (.xlsx) contenant les données de présence et consommation.
            Le fichier doit contenir une colonne "Ressource" et des colonnes par mois
            (ex: Présence Jan, ABS Février, Run Mars...).
            Les mois déjà saisis ne seront pas écrasés — les différences seront listées pour confirmation.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={importing ? <CircularProgress size={18} /> : <UploadFileIcon />}
              disabled={importing}
            >
              {importFile ? importFile.name : 'Choisir un fichier .xlsx'}
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
              />
            </Button>
            {importFile && !importPreview && (
              <Button variant="text" color="error" onClick={handleCancelImport}>Annuler</Button>
            )}
          </Box>

          {importError && (
            <Alert severity="error" sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleShowLogs}>
                  Voir les logs
                </Button>
              }
            >
              {importError}
            </Alert>
          )}
          {importSuccess && <Alert severity="success" sx={{ mb: 2 }}>{importSuccess}</Alert>}

          {/* ---- Preview Results ---- */}
          {importPreview && (
            <Box>
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Résumé de l'analyse — {importPreview.sheet_name} ({importPreview.year})
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip label={`${importPreview.summary.nb_excel_resources} ressources dans le fichier`} />
                  <Chip label={`${importPreview.summary.nb_existing} existantes`} color="primary" variant="outlined" />
                  <Chip
                    icon={<PersonAddIcon />}
                    label={`${importPreview.summary.nb_new} nouvelles`}
                    color={importPreview.summary.nb_new > 0 ? 'success' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    icon={<SyncIcon />}
                    label={`${importPreview.summary.nb_auto_updates} mises à jour auto`}
                    color={importPreview.summary.nb_auto_updates > 0 ? 'info' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    icon={<PersonRemoveIcon />}
                    label={`${importPreview.summary.nb_inactive_exits || 0} sorties (INACTIVE)`}
                    color={(importPreview.summary.nb_inactive_exits || 0) > 0 ? 'error' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    icon={<WarningIcon />}
                    label={`${importPreview.summary.nb_conflicts} conflits`}
                    color={importPreview.summary.nb_conflicts > 0 ? 'warning' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Paper>

              {/* Auto-updates section */}
              {importPreview.updates.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setShowUpdates(!showUpdates)}>
                    <CheckCircleIcon color="info" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      Mises à jour automatiques ({importPreview.updates.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      Mois vides qui seront remplis
                    </Typography>
                    <IconButton size="small">
                      {showUpdates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={showUpdates}>
                    <TableContainer sx={{ mt: 1, maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Ressource</TableCell>
                            <TableCell>Catégorie</TableCell>
                            <TableCell>Mois</TableCell>
                            <TableCell align="right">Valeur Excel</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {importPreview.updates.map((u, i) => (
                            <TableRow key={i}>
                              <TableCell>{u.name}</TableCell>
                              <TableCell>
                                <Chip label={u.category} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>{MONTH_LABELS[u.month] || u.month}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                                {u.new_value} j
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              )}

              {/* Inactive exits section */}
              {(importPreview.inactive_exits || []).length > 0 && (
                <Paper sx={{ p: 2, mb: 2, border: '1px solid #c62828' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setShowExits(!showExits)}>
                    <PersonRemoveIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      Sorties détectées — INACTIVE ({importPreview.inactive_exits.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      Budget mis à 0 après le dernier mois de présence
                    </Typography>
                    <IconButton size="small">
                      {showExits ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={showExits}>
                    <TableContainer sx={{ mt: 1, maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">Appliquer</TableCell>
                            <TableCell>Ressource</TableCell>
                            <TableCell>Nom Excel</TableCell>
                            <TableCell>Dernier mois actif</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {importPreview.inactive_exits.map((ex, i) => (
                            <TableRow key={i} sx={{ bgcolor: selectedExits[i] ? '#ffebee' : 'inherit' }}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={!!selectedExits[i]}
                                  onChange={(e) => setSelectedExits({ ...selectedExits, [i]: e.target.checked })}
                                />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>{ex.name}</TableCell>
                              <TableCell>
                                <Chip label={ex.excel_name} size="small" color="error" variant="outlined" />
                              </TableCell>
                              <TableCell>{ex.last_active_month_label}</TableCell>
                              <TableCell>
                                <Typography variant="body2" color="error">
                                  Budget → 0 à partir de {MONTH_LABELS[ex.last_active_month + 1] || 'fin d\'année'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              )}

              {/* Conflicts section */}
              {importPreview.conflicts.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, border: '1px solid #ff8f00' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setShowConflicts(!showConflicts)}>
                    <WarningIcon color="warning" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      Conflits à résoudre ({importPreview.conflicts.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      Cochez pour remplacer par la valeur Excel
                    </Typography>
                    <IconButton size="small">
                      {showConflicts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={showConflicts}>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                      <Button size="small" variant="outlined"
                        onClick={() => {
                          const all = {};
                          importPreview.conflicts.forEach((_, i) => { all[i] = true; });
                          setSelectedConflicts(all);
                        }}>
                        Tout remplacer
                      </Button>
                      <Button size="small" variant="outlined" color="secondary"
                        onClick={() => {
                          const none = {};
                          importPreview.conflicts.forEach((_, i) => { none[i] = false; });
                          setSelectedConflicts(none);
                        }}>
                        Tout garder (DB)
                      </Button>
                    </Box>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">Remplacer</TableCell>
                            <TableCell>Ressource</TableCell>
                            <TableCell>Catégorie</TableCell>
                            <TableCell>Mois</TableCell>
                            <TableCell align="right">Valeur actuelle (DB)</TableCell>
                            <TableCell align="right">Valeur Excel</TableCell>
                            <TableCell align="right">Écart</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {importPreview.conflicts.map((c, i) => {
                            const ecart = Math.round((c.excel_value - c.db_value) * 100) / 100;
                            return (
                              <TableRow key={i} sx={{ bgcolor: selectedConflicts[i] ? '#fff3e0' : 'inherit' }}>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={!!selectedConflicts[i]}
                                    onChange={(e) => setSelectedConflicts({ ...selectedConflicts, [i]: e.target.checked })}
                                  />
                                </TableCell>
                                <TableCell>{c.name}</TableCell>
                                <TableCell>
                                  <Chip label={c.category} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>{MONTH_LABELS[c.month] || c.month}</TableCell>
                                <TableCell align="right">{c.db_value} j</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{c.excel_value} j</TableCell>
                                <TableCell align="right" sx={{ color: ecart > 0 ? '#1b5e20' : '#c62828', fontWeight: 'bold' }}>
                                  {ecart > 0 ? '+' : ''}{ecart} j
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              )}

              {/* New resources section */}
              {importPreview.new_resources.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, border: '1px solid #1b5e20' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setShowNewRes(!showNewRes)}>
                    <PersonAddIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      Nouvelles ressources ({importPreview.new_resources.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      Cochez pour les ajouter
                    </Typography>
                    <IconButton size="small">
                      {showNewRes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={showNewRes}>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                      <Button size="small" variant="outlined"
                        onClick={() => {
                          const all = {};
                          importPreview.new_resources.forEach((_, i) => { all[i] = true; });
                          setSelectedNewRes(all);
                        }}>
                        Tout sélectionner
                      </Button>
                      <Button size="small" variant="outlined" color="secondary"
                        onClick={() => {
                          const none = {};
                          importPreview.new_resources.forEach((_, i) => { none[i] = false; });
                          setSelectedNewRes(none);
                        }}>
                        Tout désélectionner
                      </Button>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">Ajouter</TableCell>
                            <TableCell>Nom</TableCell>
                            <TableCell>Mois avec présence</TableCell>
                            <TableCell>Mois avec conso Run</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {importPreview.new_resources.map((r, i) => {
                            const presMonths = Object.entries(r.presence || {})
                              .filter(([, v]) => v > 0).map(([m]) => MONTH_LABELS[parseInt(m)] || m);
                            const runMonths = Object.entries(r.run || {})
                              .filter(([, v]) => v > 0).map(([m]) => MONTH_LABELS[parseInt(m)] || m);
                            return (
                              <TableRow key={i} sx={{ bgcolor: selectedNewRes[i] ? '#e8f5e9' : 'inherit' }}>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={!!selectedNewRes[i]}
                                    onChange={(e) => setSelectedNewRes({ ...selectedNewRes, [i]: e.target.checked })}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>{r.name}</TableCell>
                                <TableCell>{presMonths.join(', ') || '—'}</TableCell>
                                <TableCell>{runMonths.join(', ') || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              )}

              {/* No changes */}
              {importPreview.updates.length === 0 && importPreview.conflicts.length === 0 && importPreview.new_resources.length === 0 && (importPreview.inactive_exits || []).length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Aucune modification détectée — toutes les données du fichier correspondent déjà à la base.
                </Alert>
              )}

              {/* Apply / Cancel */}
              {(importPreview.updates.length > 0 || importPreview.conflicts.length > 0 || importPreview.new_resources.length > 0 || (importPreview.inactive_exits || []).length > 0) && (
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="outlined" color="error" onClick={handleCancelImport}>
                    Annuler
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={applying ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                    onClick={handleApplyImport}
                    disabled={applying}
                  >
                    Appliquer l'import
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Logs dialog */}
      <Dialog open={logsDialog} onClose={() => setLogsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Logs serveur (dernières lignes)</DialogTitle>
        <DialogContent>
          <Paper sx={{
            p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace',
            fontSize: 11, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {logLines.length > 0
              ? logLines.map((line, i) => (
                <Box key={i} sx={{
                  color: line.includes('[ERROR]') ? '#f44336'
                    : line.includes('[WARNING]') ? '#ff9800'
                    : line.includes('[INFO]') ? '#4fc3f7' : '#d4d4d4',
                  mb: 0.2,
                }}>
                  {line}
                </Box>
              ))
              : 'Aucun log disponible'
            }
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsDialog(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Sheet selection dialog */}
      <Dialog open={sheetDialog} onClose={() => setSheetDialog(false)}>
        <DialogTitle>Choisir l'onglet à importer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Le fichier contient plusieurs onglets. Sélectionnez celui à importer :
          </Typography>
          {sheetChoices.map((name, i) => (
            <Button
              key={i}
              fullWidth
              variant="outlined"
              sx={{ mb: 1, justifyContent: 'flex-start', textTransform: 'none' }}
              onClick={() => handleSheetSelect(name)}
            >
              {name}
            </Button>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSheetDialog(false)}>Annuler</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
