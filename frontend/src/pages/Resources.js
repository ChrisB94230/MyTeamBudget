import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Paper, IconButton, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, FormControl,
  InputLabel, Select, MenuItem, Switch, FormControlLabel, Grid,
  Alert, Stepper, Step, StepLabel, Checkbox, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getResources, addResource, updateResource, deleteResource, getYears } from '../services/api';
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const ACTIVITES = ['TRANSV', 'CBI/TBS', 'DATA', 'STRAT', 'CSI/FIT', 'CYBER', 'CLOUD', 'CMI'];

const emptyForm = {
  name: '', activite: '', tribu: '', statut: 'Interne', etp: 1,
  repartition_run: 1, nb_jours_total: 206, year: new Date().getFullYear(),
  is_fictive: false,
  jan: '', feb: '', mar: '', apr: '', may: '', jun: '',
  jul: '', aug: '', sep: '', oct: '', nov: '', dec: '',
};

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [importPreview, setImportPreview] = useState(null);
  const [importSelected, setImportSelected] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    getResources(year).then(res => setResources(res.data));
  }, [year]);

  useEffect(() => {
    getYears().then(res => setYears(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpen = (resource = null) => {
    if (resource) {
      setForm({ ...resource });
      setEditId(resource.id);
    } else {
      setForm({ ...emptyForm, year });
      setEditId(null);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (editId) {
      await updateResource(editId, form);
    } else {
      await addResource(form);
    }
    setOpen(false);
    load();
    getYears().then(res => setYears(res.data));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cette ressource ?')) {
      await deleteResource(id);
      load();
    }
  };

  // --- Import handlers ---

  const handleImportOpen = () => {
    setImportOpen(true);
    setImportStep(0);
    setImportPreview(null);
    setImportSelected([]);
    setImportResult(null);
    setImportError(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('year', year);

    try {
      const res = await axios.post(`${API_BASE}/resources/import/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportPreview(res.data);
      setImportSelected(res.data.rows.map((_, i) => i));
      setImportStep(1);
    } catch (err) {
      setImportError(err.response?.data?.error || 'Erreur lors de la lecture du fichier');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleRow = (idx) => {
    setImportSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleToggleAll = () => {
    if (!importPreview) return;
    if (importSelected.length === importPreview.rows.length) {
      setImportSelected([]);
    } else {
      setImportSelected(importPreview.rows.map((_, i) => i));
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    const selectedRows = importPreview.rows.filter((_, i) => importSelected.includes(i));

    try {
      const res = await axios.post(`${API_BASE}/resources/import/confirm`, { rows: selectedRows });
      setImportResult(res.data);
      setImportStep(2);
      load();
      getYears().then(r => setYears(r.data));
    } catch (err) {
      setImportError(err.response?.data?.error || "Erreur lors de l'import");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/resources/import/template`, '_blank');
  };

  const totalBudget = resources.reduce((s, r) => s + (r.nb_jours_run || 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Gestion des Ressources</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Année</InputLabel>
            <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              <MenuItem value={new Date().getFullYear()}>{new Date().getFullYear()}</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={handleImportOpen}>
            Importer Excel
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Ajouter
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Typography variant="body2">
          <strong>{resources.length}</strong> ressources — Budget total RUN : <strong>{Math.round(totalBudget * 100) / 100} j</strong>
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white' }}>Nom</TableCell>
              <TableCell sx={{ color: 'white' }}>Activité</TableCell>
              <TableCell sx={{ color: 'white' }}>Statut</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">ETP</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Run</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Jours Run</TableCell>
              {MONTH_LABELS.map(m => (
                <TableCell key={m} sx={{ color: 'white' }} align="center">{m}</TableCell>
              ))}
              <TableCell sx={{ color: 'white' }} align="center">Total</TableCell>
              <TableCell sx={{ color: 'white' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map(r => {
              const monthTotal = MONTHS.reduce((s, m) => s + (parseFloat(r[m]) || 0), 0);
              return (
                <TableRow key={r.id} sx={{ bgcolor: r.is_fictive ? '#fff3e0' : 'inherit' }}>
                  <TableCell>
                    {r.name}
                    {r.is_fictive && <Chip label="Fictive" size="small" color="warning" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{r.activite}</TableCell>
                  <TableCell>
                    <Chip
                      label={r.statut}
                      size="small"
                      color={r.statut === 'Interne' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell align="center">{r.etp}</TableCell>
                  <TableCell align="center">{r.repartition_run}</TableCell>
                  <TableCell align="center"><strong>{r.nb_jours_run}</strong></TableCell>
                  {MONTHS.map(m => (
                    <TableCell key={m} align="center">{r[m] || ''}</TableCell>
                  ))}
                  <TableCell align="center"><strong>{Math.round(monthTotal * 100) / 100}</strong></TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpen(r)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog ajout/modif unitaire */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Modifier Ressource' : 'Ajouter Ressource'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nom" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Activité</InputLabel>
                <Select value={form.activite} label="Activité"
                  onChange={e => setForm({ ...form, activite: e.target.value })}>
                  {ACTIVITES.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Tribu" value={form.tribu}
                onChange={e => setForm({ ...form, tribu: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select value={form.statut} label="Statut"
                  onChange={e => setForm({ ...form, statut: e.target.value, nb_jours_total: e.target.value === 'Interne' ? 206 : 210 })}>
                  <MenuItem value="Interne">Interne</MenuItem>
                  <MenuItem value="Externe">Externe</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="ETP" type="number" value={form.etp}
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                onChange={e => setForm({ ...form, etp: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Répartition RUN" type="number" value={form.repartition_run}
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                onChange={e => setForm({ ...form, repartition_run: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Nb jours total/an" type="number" value={form.nb_jours_total}
                onChange={e => setForm({ ...form, nb_jours_total: parseInt(e.target.value) || 206 })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Année" type="number" value={form.year}
                onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={!!form.is_fictive} onChange={e => setForm({ ...form, is_fictive: e.target.checked })} />}
                label="Ressource fictive"
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Ventilation mensuelle (jours)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Laisser vide pour distribuer automatiquement
          </Typography>
          <Grid container spacing={1}>
            {MONTHS.map((m, i) => (
              <Grid item xs={4} sm={2} md={1} key={m}>
                <TextField
                  size="small"
                  label={MONTH_LABELS[i]}
                  type="number"
                  value={form[m] || ''}
                  onChange={e => setForm({ ...form, [m]: parseFloat(e.target.value) || 0 })}
                  inputProps={{ step: 0.25 }}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog import Excel */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Import de Ressources depuis Excel</DialogTitle>
        <DialogContent>
          <Stepper activeStep={importStep} sx={{ mb: 3, mt: 1 }}>
            <Step><StepLabel>Sélection du fichier</StepLabel></Step>
            <Step><StepLabel>Vérification & sélection</StepLabel></Step>
            <Step><StepLabel>Résultat</StepLabel></Step>
          </Stepper>

          {importLoading && <LinearProgress sx={{ mb: 2 }} />}
          {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}

          {/* Step 0: File selection */}
          {importStep === 0 && (
            <Box>
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5', border: '2px dashed #ccc', mb: 3 }}>
                <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="h6" gutterBottom>Sélectionnez un fichier Excel (.xlsx)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Le fichier doit contenir les colonnes : Nom, Activité, Statut, ETP, Répartition RUN, etc.
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importLoading}
                  >
                    Choisir un fichier
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadTemplate}
                  >
                    Télécharger le template
                  </Button>
                </Box>
              </Paper>

              <Alert severity="info">
                <Typography variant="body2" fontWeight="bold" gutterBottom>Colonnes reconnues :</Typography>
                <Typography variant="body2">
                  Nom (ou Ressource), Activité, Tribu, Statut (Interne/Externe),
                  ETP, Répartition RUN (ou % Run), Nb Jours Total, Année, Fictive,
                  Jan-Déc (ou 01-12, ou noms complets des mois)
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Les colonnes non reconnues seront ignorées. Les noms de colonnes sont insensibles à la casse.
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Step 1: Preview & selection */}
          {importStep === 1 && importPreview && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${importPreview.count} ressources détectées`} color="primary" />
                <Chip label={`${importSelected.length} sélectionnées`} color="success" />
                {importPreview.warnings.length > 0 && (
                  <Chip label={`${importPreview.warnings.length} avertissements`} color="warning" />
                )}
                {importPreview.unmapped_columns.length > 0 && (
                  <Chip label={`${importPreview.unmapped_columns.length} colonnes ignorées`} color="default" />
                )}
              </Box>

              {importPreview.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {importPreview.warnings.map((w, i) => (
                    <Typography key={i} variant="body2">{w}</Typography>
                  ))}
                </Alert>
              )}

              {importPreview.unmapped_columns.length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Colonnes ignorées : {importPreview.unmapped_columns.join(', ')}
                </Alert>
              )}

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={importSelected.length === importPreview.rows.length}
                          indeterminate={importSelected.length > 0 && importSelected.length < importPreview.rows.length}
                          onChange={handleToggleAll}
                        />
                      </TableCell>
                      <TableCell>Nom</TableCell>
                      <TableCell>Activité</TableCell>
                      <TableCell>Statut</TableCell>
                      <TableCell align="center">ETP</TableCell>
                      <TableCell align="center">Run</TableCell>
                      <TableCell align="center">Jours Run</TableCell>
                      <TableCell align="center">Année</TableCell>
                      {MONTH_LABELS.map(m => (
                        <TableCell key={m} align="center">{m}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.rows.map((r, i) => (
                      <TableRow
                        key={i}
                        selected={importSelected.includes(i)}
                        sx={{ opacity: importSelected.includes(i) ? 1 : 0.4 }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={importSelected.includes(i)}
                            onChange={() => handleToggleRow(i)}
                          />
                        </TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.activite}</TableCell>
                        <TableCell>
                          <Chip label={r.statut} size="small" color={r.statut === 'Interne' ? 'success' : 'warning'} />
                        </TableCell>
                        <TableCell align="center">{r.etp}</TableCell>
                        <TableCell align="center">{r.repartition_run}</TableCell>
                        <TableCell align="center"><strong>{r.nb_jours_run}</strong></TableCell>
                        <TableCell align="center">{r.year}</TableCell>
                        {MONTHS.map(m => (
                          <TableCell key={m} align="center">{r[m] || ''}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Step 2: Result */}
          {importStep === 2 && importResult && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>Import terminé</Typography>
              <Typography variant="h6" color="primary">
                {importResult.added} ressource{importResult.added > 1 ? 's' : ''} importée{importResult.added > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {importStep === 0 && (
            <Button onClick={() => setImportOpen(false)}>Annuler</Button>
          )}
          {importStep === 1 && (
            <>
              <Button onClick={() => { setImportStep(0); setImportPreview(null); }}>
                Retour
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirmImport}
                disabled={importSelected.length === 0 || importLoading}
              >
                Importer {importSelected.length} ressource{importSelected.length > 1 ? 's' : ''}
              </Button>
            </>
          )}
          {importStep === 2 && (
            <Button variant="contained" onClick={() => setImportOpen(false)}>
              Fermer
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
