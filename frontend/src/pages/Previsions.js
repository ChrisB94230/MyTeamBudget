import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Typography, Paper, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, FormControl,
  InputLabel, Select, MenuItem, Grid, Chip, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { getPrevisions, addPrevision, updatePrevision, deletePrevision, getYears } from '../services/api';

const ACTIVITES = ['TRANSV', 'CBI/TBS', 'DATA', 'STRAT', 'CSI/FIT', 'CYBER', 'CLOUD', 'CMI'];
const MOTIFS_ENTREE = ['Embauche', 'Remplacement', 'Renfort', 'Mobilité interne', 'Prestation'];
const MOTIFS_SORTIE = ['Fin de contrat', 'Retraite', 'Démission', 'Mobilité interne', 'Fin de prestation', 'Congé maternité', 'Congé longue durée'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const emptyForm = {
  type: 'entree', name: '', activite: '', tribu: '', statut: 'Interne',
  etp: 1, repartition_run: 1, date_effet: '', motif: '',
  year: new Date().getFullYear(), nb_jours_run: 0,
  jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
  jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
};

export default function Previsions() {
  const [previsions, setPrevisions] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    getPrevisions(year).then(res => setPrevisions(res.data));
  }, [year]);

  useEffect(() => { getYears().then(res => setYears(res.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const entries = previsions.filter(p => p.type === 'entree');
  const exits = previsions.filter(p => p.type === 'sortie');

  const handleOpen = (prev = null, type = 'entree') => {
    if (prev) {
      setForm({ ...prev });
      setEditId(prev.id);
    } else {
      setForm({ ...emptyForm, year, type });
      setEditId(null);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (editId) {
      await updatePrevision(editId, form);
    } else {
      await addPrevision(form);
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer cette prévision ?')) {
      await deletePrevision(id);
      load();
    }
  };

  const renderTable = (items, type) => (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {type === 'entree' ? <PersonAddIcon sx={{ mr: 1, verticalAlign: 'bottom' }} /> : <PersonRemoveIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />}
          {type === 'entree' ? 'Entrées Prévisionnelles' : 'Sorties Prévisionnelles'}
          <Chip label={items.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpen(null, type)}>
          Ajouter
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
            <TableRow><TableCell colSpan={20} align="center">Aucune prévision</TableCell></TableRow>
          )}
          {items.map(p => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.activite}</TableCell>
              <TableCell><Chip label={p.statut} size="small" color={p.statut === 'Interne' ? 'success' : 'warning'} /></TableCell>
              <TableCell align="center">{p.etp}</TableCell>
              <TableCell>{p.date_effet}</TableCell>
              <TableCell>{p.motif}</TableCell>
              <TableCell align="center"><strong>{p.nb_jours_run}</strong></TableCell>
              {MONTHS.map(m => <TableCell key={m} align="center">{p[m] || ''}</TableCell>)}
              <TableCell>
                <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon /></IconButton>
                <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}><DeleteIcon /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const motifs = form.type === 'entree' ? MOTIFS_ENTREE : MOTIFS_SORTIE;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Prévisions d'Entrées / Sorties</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Année</InputLabel>
          <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            <MenuItem value={new Date().getFullYear()}>{new Date().getFullYear()}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Entrées (${entries.length})`} />
        <Tab label={`Sorties (${exits.length})`} />
      </Tabs>

      {tab === 0 && renderTable(entries, 'entree')}
      {tab === 1 && renderTable(exits, 'sortie')}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editId ? 'Modifier' : 'Ajouter'} — {form.type === 'entree' ? 'Entrée' : 'Sortie'} prévisionnelle
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nom / Description" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={form.type} label="Type" onChange={e => setForm({ ...form, type: e.target.value })}>
                  <MenuItem value="entree">Entrée</MenuItem>
                  <MenuItem value="sortie">Sortie</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Activité</InputLabel>
                <Select value={form.activite} label="Activité" onChange={e => setForm({ ...form, activite: e.target.value })}>
                  {ACTIVITES.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Tribu" value={form.tribu}
                onChange={e => setForm({ ...form, tribu: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select value={form.statut} label="Statut" onChange={e => setForm({ ...form, statut: e.target.value })}>
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
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Date d'effet" type="date" value={form.date_effet}
                InputLabelProps={{ shrink: true }}
                onChange={e => setForm({ ...form, date_effet: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Motif</InputLabel>
                <Select value={form.motif} label="Motif" onChange={e => setForm({ ...form, motif: e.target.value })}>
                  {motifs.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Année" type="number" value={form.year}
                onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
