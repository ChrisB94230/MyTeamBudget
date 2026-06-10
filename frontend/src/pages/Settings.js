import React, { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Grid, Typography, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Divider, Paper,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { getSettings, updateSettings, getYears } from '../services/api';

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
    </Box>
  );
}
