import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Paper, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, FormControl,
  InputLabel, Select, MenuItem, Grid, Chip, Tabs, Tab,
  Alert, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import {
  getPrevisions, addPrevision, updatePrevision, deletePrevision,
  getYears, getResources, applySortieRessource, applyEntreeRessource,
} from '../services/api';

const ACTIVITES = ['TRANSV', 'CBI/TBS', 'DATA', 'STRAT', 'CSI/FIT', 'CYBER', 'CLOUD', 'CMI'];
const MOTIFS_ENTREE = ['Embauche', 'Remplacement', 'Renfort', 'Mobilité interne', 'Prestation'];
const MOTIFS_SORTIE = ['Fin de contrat', 'Retraite', 'Démission', 'Mobilité interne', 'Fin de prestation', 'Congé maternité', 'Congé longue durée'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const emptyEntreeForm = {
  name: '', activite: '', tribu: '', statut: 'Interne',
  etp: 1, repartition_run: 1, date_effet: '', motif: '',
  year: new Date().getFullYear(),
};

export default function Previsions() {
  const [previsions, setPrevisions] = useState([]);
  const [resources, setResources] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [tab, setTab] = useState(0);

  // Dialogs
  const [entreeOpen, setEntreeOpen] = useState(false);
  const [sortieOpen, setSortieOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Forms
  const [entreeForm, setEntreeForm] = useState({ ...emptyEntreeForm });
  const [sortieForm, setSortieForm] = useState({ resource_id: null, date_effet: '', motif: '', year: new Date().getFullYear() });
  const [editForm, setEditForm] = useState(null);
  const [editId, setEditId] = useState(null);

  // Feedback
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      getPrevisions(year),
      getResources(year),
    ]).then(([prevRes, resRes]) => {
      setPrevisions(prevRes.data);
      setResources(resRes.data);
    });
  }, [year]);

  useEffect(() => { getYears().then(res => setYears(res.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const entries = previsions.filter(p => p.type === 'entree');
  const exits = previsions.filter(p => p.type === 'sortie');

  // ==================== ENTREE ====================

  const handleOpenEntree = () => {
    setEntreeForm({ ...emptyEntreeForm, year });
    setEntreeOpen(true);
  };

  const handleSaveEntree = async () => {
    try {
      await applyEntreeRessource(entreeForm);
      setEntreeOpen(false);
      setFeedback({ type: 'success', msg: `Entrée "${entreeForm.name}" enregistrée — ressource créée et budget distribué` });
      load();
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Erreur lors de l\'enregistrement' });
    }
  };

  // ==================== SORTIE ====================

  const handleOpenSortie = () => {
    setSortieForm({ resource_id: null, date_effet: '', motif: '', year });
    setSortieOpen(true);
  };

  const handleSaveSortie = async () => {
    if (!sortieForm.resource_id || !sortieForm.date_effet) {
      setFeedback({ type: 'error', msg: 'Sélectionnez une ressource et une date d\'effet' });
      return;
    }
    try {
      const res = await applySortieRessource(sortieForm);
      setSortieOpen(false);
      const removed = res.data.jours_removed;
      setFeedback({ type: 'success', msg: `Sortie enregistrée — ${removed} jours retirés du budget` });
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'enregistrement';
      setFeedback({ type: 'error', msg });
    }
  };

  // Preview: show what months will be zeroed
  const selectedResource = resources.find(r => r.id === sortieForm.resource_id);
  let sortiePreview = null;
  if (selectedResource && sortieForm.date_effet) {
    try {
      const dt = new Date(sortieForm.date_effet);
      const departMonth = dt.getMonth(); // 0-indexed
      const monthsRemoved = MONTHS.slice(departMonth);
      const joursRemoved = monthsRemoved.reduce((s, m) => s + (selectedResource[m] || 0), 0);
      sortiePreview = {
        departMonth,
        monthsRemoved,
        joursRemoved: Math.round(joursRemoved * 100) / 100,
        monthsKept: MONTHS.slice(0, departMonth),
      };
    } catch (e) { /* ignore */ }
  }

  // ==================== EDIT (legacy) ====================

  const handleOpenEdit = (prev) => {
    setEditForm({ ...prev });
    setEditId(prev.id);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    await updatePrevision(editId, editForm);
    setEditOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cette prévision ?')) {
      await deletePrevision(id);
      load();
    }
  };

  // ==================== RENDER TABLE ====================

  const renderTable = (items, type) => (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {type === 'entree'
            ? <PersonAddIcon sx={{ mr: 1, verticalAlign: 'bottom', color: '#1b5e20' }} />
            : <PersonRemoveIcon sx={{ mr: 1, verticalAlign: 'bottom', color: '#c62828' }} />}
          {type === 'entree' ? 'Entrées Prévisionnelles' : 'Sorties Prévisionnelles'}
          <Chip label={items.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          color={type === 'entree' ? 'success' : 'error'}
          onClick={type === 'entree' ? handleOpenEntree : handleOpenSortie}
        >
          {type === 'entree' ? 'Nouvelle entrée' : 'Déclarer une sortie'}
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: type === 'entree' ? '#e8f5e9' : '#ffebee' }}>
            <TableCell>Nom</TableCell>
            <TableCell>Activité</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="center">ETP</TableCell>
            <TableCell>Date effet</TableCell>
            <TableCell>Motif</TableCell>
            <TableCell align="center">Jours Run</TableCell>
            {MONTH_LABELS.map(m => <TableCell key={m} align="center">{m}</TableCell>)}
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 && (
            <TableRow><TableCell colSpan={20} align="center" sx={{ py: 3, color: 'text.secondary' }}>
              Aucune prévision
            </TableCell></TableRow>
          )}
          {items.map(p => (
            <TableRow key={p.id}>
              <TableCell><strong>{p.name}</strong></TableCell>
              <TableCell>{p.activite}</TableCell>
              <TableCell><Chip label={p.statut} size="small" color={p.statut === 'Interne' ? 'success' : 'warning'} /></TableCell>
              <TableCell align="center">{p.etp}</TableCell>
              <TableCell>{p.date_effet}</TableCell>
              <TableCell>{p.motif}</TableCell>
              <TableCell align="center"><strong>{Math.abs(p.nb_jours_run)}</strong></TableCell>
              {MONTHS.map(m => (
                <TableCell key={m} align="center" sx={{ color: p[m] < 0 ? '#c62828' : 'inherit' }}>
                  {p[m] ? Math.abs(p[m]) : ''}
                </TableCell>
              ))}
              <TableCell>
                <IconButton size="small" onClick={() => handleOpenEdit(p)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Prévisions d'Entrées / Sorties</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Année</InputLabel>
          <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>
          {feedback.msg}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Entrées (${entries.length})`} icon={<PersonAddIcon />} iconPosition="start" />
        <Tab label={`Sorties (${exits.length})`} icon={<PersonRemoveIcon />} iconPosition="start" />
      </Tabs>

      {tab === 0 && renderTable(entries, 'entree')}
      {tab === 1 && renderTable(exits, 'sortie')}

      {/* ==================== DIALOG SORTIE (simplifié) ==================== */}
      <Dialog open={sortieOpen} onClose={() => setSortieOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ffebee' }}>
          <PersonRemoveIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          Déclarer une sortie de ressource
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={resources.filter(r => !r.is_fictive)}
                getOptionLabel={(r) => `${r.name} — ${r.activite} (${r.statut}, ${r.etp} ETP)`}
                value={selectedResource || null}
                onChange={(_, val) => setSortieForm({ ...sortieForm, resource_id: val ? val.id : null })}
                renderOption={(props, r) => (
                  <li {...props} key={r.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                      <Typography noWrap={false}><strong>{r.name}</strong></Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {r.activite} · {r.statut} · {r.etp} ETP · {r.nb_jours_run}j
                      </Typography>
                    </Box>
                  </li>
                )}
                ListboxProps={{ sx: { maxHeight: 300 } }}
                renderInput={(params) => (
                  <TextField {...params} label="Sélectionner la ressource à sortir" fullWidth
                    sx={{ '& .MuiInputBase-root': { fontSize: '1rem' } }}
                  />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                sx={{
                  '& .MuiAutocomplete-inputRoot': { flexWrap: 'nowrap' },
                  '& .MuiAutocomplete-input': { minWidth: '300px !important' },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Date de départ" type="date"
                value={sortieForm.date_effet}
                InputLabelProps={{ shrink: true }}
                onChange={e => setSortieForm({ ...sortieForm, date_effet: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Motif</InputLabel>
                <Select value={sortieForm.motif} label="Motif"
                  onChange={e => setSortieForm({ ...sortieForm, motif: e.target.value })}>
                  {MOTIFS_SORTIE.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* Preview */}
            {sortiePreview && selectedResource && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: '#fff3e0', border: '1px solid #ff8f00' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Aperçu de l'impact :
                  </Typography>
                  <Typography variant="body2">
                    <strong>{selectedResource.name}</strong> quitte l'équipe à partir de{' '}
                    <strong>{MONTH_LABELS[sortiePreview.departMonth]}</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1, mb: 1 }}>
                    {MONTHS.map((m, i) => (
                      <Chip
                        key={m}
                        label={`${MONTH_LABELS[i]}: ${selectedResource[m] || 0}`}
                        size="small"
                        color={i >= sortiePreview.departMonth ? 'error' : 'success'}
                        variant={i >= sortiePreview.departMonth ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                  <Typography variant="body2" color="error" fontWeight="bold">
                    → {sortiePreview.joursRemoved} jours seront retirés du budget
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSortieOpen(false)}>Annuler</Button>
          <Button
            variant="contained" color="error"
            onClick={handleSaveSortie}
            disabled={!sortieForm.resource_id || !sortieForm.date_effet}
          >
            Confirmer la sortie
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIALOG ENTREE ==================== */}
      <Dialog open={entreeOpen} onClose={() => setEntreeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#e8f5e9' }}>
          <PersonAddIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
          Nouvelle entrée prévisionnelle
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nom / Description" value={entreeForm.name}
                onChange={e => setEntreeForm({ ...entreeForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Activité</InputLabel>
                <Select value={entreeForm.activite} label="Activité"
                  onChange={e => setEntreeForm({ ...entreeForm, activite: e.target.value })}>
                  {ACTIVITES.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select value={entreeForm.statut} label="Statut"
                  onChange={e => setEntreeForm({ ...entreeForm, statut: e.target.value })}>
                  <MenuItem value="Interne">Interne</MenuItem>
                  <MenuItem value="Externe">Externe</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Tribu" value={entreeForm.tribu}
                onChange={e => setEntreeForm({ ...entreeForm, tribu: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="ETP" type="number" value={entreeForm.etp}
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                onChange={e => setEntreeForm({ ...entreeForm, etp: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Répartition RUN" type="number" value={entreeForm.repartition_run}
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                onChange={e => setEntreeForm({ ...entreeForm, repartition_run: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Date d'arrivée" type="date" value={entreeForm.date_effet}
                InputLabelProps={{ shrink: true }}
                onChange={e => setEntreeForm({ ...entreeForm, date_effet: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Motif</InputLabel>
                <Select value={entreeForm.motif} label="Motif"
                  onChange={e => setEntreeForm({ ...entreeForm, motif: e.target.value })}>
                  {MOTIFS_ENTREE.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntreeOpen(false)}>Annuler</Button>
          <Button variant="contained" color="success" onClick={handleSaveEntree}
            disabled={!entreeForm.name || !entreeForm.date_effet}>
            Enregistrer l'entrée
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIALOG EDIT (legacy) ==================== */}
      {editForm && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Modifier la prévision</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Nom" value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth label="Date d'effet" type="date" value={editForm.date_effet}
                  InputLabelProps={{ shrink: true }}
                  onChange={e => setEditForm({ ...editForm, date_effet: e.target.value })} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Motif</InputLabel>
                  <Select value={editForm.motif} label="Motif"
                    onChange={e => setEditForm({ ...editForm, motif: e.target.value })}>
                    {(editForm.type === 'entree' ? MOTIFS_ENTREE : MOTIFS_SORTIE).map(m => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth label="ETP" type="number" value={editForm.etp}
                  inputProps={{ step: 0.1 }}
                  onChange={e => setEditForm({ ...editForm, etp: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth label="Jours Run" type="number" value={editForm.nb_jours_run}
                  onChange={e => setEditForm({ ...editForm, nb_jours_run: parseFloat(e.target.value) || 0 })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button variant="contained" onClick={handleSaveEdit}>Enregistrer</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
