import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select,
  MenuItem, Button, Chip, Alert, Grid, Card, CardContent, Tooltip,
  LinearProgress, Tabs, Tab,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import SpeedIcon from '@mui/icons-material/Speed';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getPresenceDashboard, updatePresence, getYears } from '../services/api';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function AlertIcon({ level }) {
  if (level === 'critical') return <ErrorIcon sx={{ color: '#c62828' }} />;
  if (level === 'warning') return <WarningAmberIcon sx={{ color: '#ff8f00' }} />;
  return <CheckCircleIcon sx={{ color: '#1b5e20' }} />;
}

function ProgressBar({ value, max, warning }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  let color = 'success';
  if (pct > 90) color = 'error';
  else if (pct > 75) color = 'warning';
  return (
    <Tooltip title={`${value} / ${max} jours (${Math.round(pct)}%)`}>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 4, minWidth: 60 }}
      />
    </Tooltip>
  );
}

export default function Presence() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    getPresenceDashboard(year).then(res => {
      setData(res.data);
      const vals = {};
      res.data.resources.forEach(r => {
        for (let m = 1; m <= 12; m++) {
          vals[`${r.resource_id}-${m}`] = r.monthly[m] || 0;
        }
      });
      setEditValues(vals);
      setDirty(false);
    });
  }, [year]);

  useEffect(() => { getYears().then(res => setYears(res.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const setValue = (rid, month, value) => {
    setEditValues(prev => ({ ...prev, [`${rid}-${month}`]: parseFloat(value) || 0 }));
    setDirty(true);
  };

  const handleSave = async () => {
    const entries = [];
    Object.entries(editValues).forEach(([key, val]) => {
      const [rid, month] = key.split('-').map(Number);
      if (val > 0) {
        entries.push({ year, month, resource_id: rid, jours_travailles: val });
      }
    });
    await updatePresence(entries);
    setDirty(false);
    load();
  };

  if (!data) return <Typography>Chargement...</Typography>;

  const alertResources = data.resources.filter(r => r.alert_level !== 'ok');
  const chartData = MONTH_LABELS.map((label, i) => {
    const month = i + 1;
    const totalWorked = data.resources.reduce((s, r) => s + (r.monthly[month] || 0), 0);
    return {
      name: label,
      'Jours travaillés': Math.round(totalWorked * 100) / 100,
      'Jours ouvrables': data.jours_ouvrables_par_mois[i],
    };
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Temps de Présence</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Année</InputLabel>
            <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!dirty}>
            Enregistrer
          </Button>
        </Box>
      </Box>

      {/* Alertes */}
      {data.nb_alerts_critical > 0 && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
          <Typography variant="body2" fontWeight="bold">
            {data.nb_alerts_critical} ressource{data.nb_alerts_critical > 1 ? 's' : ''} en alerte critique
          </Typography>
          {alertResources.filter(r => r.alert_level === 'critical').map((r, i) => (
            <Typography key={i} variant="body2">
              {r.name} ({r.statut}) — {r.alert_msg}
            </Typography>
          ))}
        </Alert>
      )}
      {data.nb_alerts_warning > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningAmberIcon />}>
          <Typography variant="body2" fontWeight="bold">
            {data.nb_alerts_warning} ressource{data.nb_alerts_warning > 1 ? 's' : ''} à surveiller
          </Typography>
          {alertResources.filter(r => r.alert_level === 'warning').map((r, i) => (
            <Typography key={i} variant="body2">
              {r.name} ({r.statut}) — {r.alert_msg}
            </Typography>
          ))}
        </Alert>
      )}

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Jours ouvrables écoulés</Typography>
                  <Typography variant="h4" fontWeight="bold">{data.jours_ouvrables_ecoules}</Typography>
                  <Typography variant="body2" color="text.secondary">sur {data.jours_ouvrables_annee} j/an</Typography>
                </Box>
                <EventBusyIcon sx={{ color: '#1565c0', fontSize: 32 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Ressources suivies</Typography>
                  <Typography variant="h4" fontWeight="bold">{data.resources.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.resources.filter(r => r.statut === 'Externe').length} externes
                  </Typography>
                </Box>
                <SpeedIcon sx={{ color: '#6a1b9a', fontSize: 32 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: data.nb_alerts_critical > 0 ? '#ffebee' : 'inherit' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Alertes congés</Typography>
                  <Typography variant="h4" fontWeight="bold" color={data.nb_alerts_critical > 0 ? 'error' : 'inherit'}>
                    {data.nb_alerts_critical + data.nb_alerts_warning}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.nb_alerts_critical} critiques
                  </Typography>
                </Box>
                <WarningAmberIcon sx={{ color: data.nb_alerts_critical > 0 ? '#c62828' : '#ff8f00', fontSize: 32 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Mois en cours</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {MONTH_LABELS[data.current_month - 1]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.jours_ouvrables_restants} j ouvrables restants
                  </Typography>
                </Box>
                <BeachAccessIcon sx={{ color: '#00695c', fontSize: 32 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Saisie & Suivi" />
        <Tab label="Analyse des risques" />
        <Tab label="Vue graphique" />
      </Tabs>

      {/* Tab 0: Saisie */}
      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white' }}>Alerte</TableCell>
                <TableCell sx={{ color: 'white' }}>Ressource</TableCell>
                <TableCell sx={{ color: 'white' }}>Statut</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Limite</TableCell>
                {MONTH_LABELS.map(m => (
                  <TableCell key={m} sx={{ color: 'white' }} align="center">{m}</TableCell>
                ))}
                <TableCell sx={{ color: 'white' }} align="center">Total</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Reste</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Avancement</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.resources.map(r => {
                const total = Object.values(editValues)
                  .filter((_, i) => {
                    const keys = Object.keys(editValues);
                    return keys[i] && keys[i].startsWith(`${r.resource_id}-`);
                  })
                  .reduce((s, v) => s + v, 0);
                const computedTotal = Array.from({ length: 12 }, (_, i) =>
                  editValues[`${r.resource_id}-${i + 1}`] || 0
                ).reduce((s, v) => s + v, 0);
                const reste = Math.round((r.limite_annuelle - computedTotal) * 100) / 100;

                return (
                  <TableRow
                    key={r.resource_id}
                    sx={{
                      bgcolor: r.alert_level === 'critical' ? '#ffebee'
                        : r.alert_level === 'warning' ? '#fff3e0' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Tooltip title={r.alert_msg || 'OK'}>
                        <Box><AlertIcon level={r.alert_level} /></Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>
                      <Chip label={r.statut} size="small" color={r.statut === 'Interne' ? 'success' : 'warning'} />
                    </TableCell>
                    <TableCell align="center"><strong>{r.limite_annuelle}</strong></TableCell>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const val = editValues[`${r.resource_id}-${m}`] || 0;
                      const joMax = data.jours_ouvrables_par_mois[m - 1] * r.etp;
                      const over = val > joMax;
                      return (
                        <TableCell key={m} align="center" sx={{ p: 0.3 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={val || ''}
                            onChange={e => setValue(r.resource_id, m, e.target.value)}
                            inputProps={{ step: 0.5, style: { textAlign: 'center', padding: '6px 2px', fontSize: '0.85rem' } }}
                            sx={{
                              width: 70,
                              '& .MuiInputBase-root': {
                                bgcolor: over ? '#ffcdd2' : val > 0 ? '#e8f5e9' : 'inherit'
                              },
                              '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                                WebkitAppearance: 'none', margin: 0,
                              },
                              '& input[type=number]': { MozAppearance: 'textfield' },
                            }}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell align="center">
                      <strong>{Math.round(computedTotal * 100) / 100}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={reste}
                        size="small"
                        color={reste < 0 ? 'error' : reste < 20 ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ minWidth: 80 }}>
                      <ProgressBar value={computedTotal} max={r.limite_annuelle} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 1: Analyse des risques */}
      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white' }}>Alerte</TableCell>
                <TableCell sx={{ color: 'white' }}>Ressource</TableCell>
                <TableCell sx={{ color: 'white' }}>Statut</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Limite / an</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Travaillé</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Rythme / mois</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Rythme théorique</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Projection annuelle</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Épuisement prévu</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Congés pris</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Congés attendus</TableCell>
                <TableCell sx={{ color: 'white' }}>Diagnostic</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.resources
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, ok: 2 };
                  return (order[a.alert_level] || 2) - (order[b.alert_level] || 2);
                })
                .map(r => {
                  const moisLabel = r.mois_epuisement
                    ? MONTH_LABELS[Math.min(Math.floor(r.mois_epuisement) - 1, 11)]
                    : '—';
                  return (
                    <TableRow
                      key={r.resource_id}
                      sx={{
                        bgcolor: r.alert_level === 'critical' ? '#ffebee'
                          : r.alert_level === 'warning' ? '#fff3e0' : 'inherit'
                      }}
                    >
                      <TableCell><AlertIcon level={r.alert_level} /></TableCell>
                      <TableCell><strong>{r.name}</strong></TableCell>
                      <TableCell>
                        <Chip label={r.statut} size="small" color={r.statut === 'Interne' ? 'success' : 'warning'} />
                      </TableCell>
                      <TableCell align="center">{r.limite_annuelle} j</TableCell>
                      <TableCell align="center"><strong>{r.total_travaille} j</strong></TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${r.rythme_mensuel} j/m`}
                          size="small"
                          color={r.rythme_mensuel > r.rythme_theorique * 1.1 ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">{r.rythme_theorique} j/m</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${r.projection_annuelle} j`}
                          size="small"
                          color={r.projection_annuelle > r.limite_annuelle ? 'error'
                            : r.projection_annuelle > r.limite_annuelle * 0.95 ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {r.mois_epuisement ? (
                          <Chip
                            label={moisLabel}
                            size="small"
                            color={r.mois_epuisement <= 9 ? 'error' : r.mois_epuisement <= 11 ? 'warning' : 'success'}
                          />
                        ) : '—'}
                      </TableCell>
                      <TableCell align="center">{r.conges_pris} j</TableCell>
                      <TableCell align="center">{r.conges_attendus} j</TableCell>
                      <TableCell>
                        {r.alert_msg ? (
                          <Typography variant="body2" color={r.alert_level === 'critical' ? 'error' : 'warning.main'}>
                            {r.alert_msg}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="success.main">OK</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Vue graphique */}
      {tab === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Jours travaillés vs Jours ouvrables (équipe)</Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="Jours ouvrables" fill="#e0e0e0" />
                  <Bar dataKey="Jours travaillés" fill="#1b5e20" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Projection individuelle vs Limite annuelle</Typography>
              <ResponsiveContainer width="100%" height={Math.max(300, data.resources.length * 40)}>
                <BarChart
                  data={data.resources.map(r => ({
                    name: r.name,
                    Travaillé: r.total_travaille,
                    'Projection restante': Math.max(0, r.projection_annuelle - r.total_travaille),
                    Limite: r.limite_annuelle,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="Travaillé" stackId="a" fill="#1b5e20" />
                  <Bar dataKey="Projection restante" stackId="a" fill="#ff8f00" />
                  <ReferenceLine x={0} stroke="#000" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
