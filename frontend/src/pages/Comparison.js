import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, FormGroup, FormControlLabel,
  Checkbox, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { getComparison, getYears } from '../services/api';

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const YEAR_COLORS = ['#1b5e20', '#ff8f00', '#1565c0', '#6a1b9a', '#c62828'];

export default function Comparison() {
  const [years, setYears] = useState([]);
  const [selected, setSelected] = useState([]);
  const [data, setData] = useState(null);

  useEffect(() => {
    getYears().then(res => {
      const y = res.data;
      setYears(y);
      const last3 = y.slice(-3);
      setSelected(last3);
    });
  }, []);

  useEffect(() => {
    if (selected.length > 0) {
      getComparison(selected).then(res => setData(res.data));
    }
  }, [selected]);

  const toggleYear = (y) => {
    setSelected(prev =>
      prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y].sort()
    );
  };

  if (!data) return <Typography>Chargement...</Typography>;

  const activeYears = selected.filter(y => data[String(y)]);

  // Monthly consumption comparison (like the Excel "Conso 2023 vs 2024 vs 2025")
  const monthlyData = MONTH_SHORT.map((label, i) => {
    const row = { name: label };
    activeYears.forEach(y => {
      const d = data[String(y)];
      row[String(y)] = d.monthly_consumed[i] || d.monthly_budget[i];
    });
    return row;
  });

  // Cumulative comparison
  const cumulData = MONTH_SHORT.map((label, i) => {
    const row = { name: label };
    activeYears.forEach(y => {
      const d = data[String(y)];
      const vals = d.monthly_consumed.some(v => v > 0) ? d.monthly_consumed : d.monthly_budget;
      const cum = vals.slice(0, i + 1).reduce((a, b) => a + b, 0);
      row[String(y)] = Math.round(cum * 100) / 100;
    });
    return row;
  });

  // Activités radar data
  const allActivites = new Set();
  activeYears.forEach(y => {
    Object.keys(data[String(y)].by_activite).forEach(a => allActivites.add(a));
  });
  const radarData = [...allActivites].map(act => {
    const row = { activite: act };
    activeYears.forEach(y => {
      row[String(y)] = data[String(y)].by_activite[act] || 0;
    });
    return row;
  });

  // Summary table
  const summaryRows = activeYears.map(y => {
    const d = data[String(y)];
    return {
      year: y,
      budget_total: d.budget_total,
      total_consumed: d.total_consumed,
      nb_resources: d.nb_resources,
      nb_etp: d.nb_etp,
      interne: d.by_statut.Interne,
      externe: d.by_statut.Externe,
    };
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Comparatif Multi-Années</Typography>
        <FormGroup row>
          {years.map((y, i) => (
            <FormControlLabel
              key={y}
              control={
                <Checkbox
                  checked={selected.includes(y)}
                  onChange={() => toggleYear(y)}
                  sx={{ color: YEAR_COLORS[i % YEAR_COLORS.length], '&.Mui-checked': { color: YEAR_COLORS[i % YEAR_COLORS.length] } }}
                />
              }
              label={String(y)}
            />
          ))}
        </FormGroup>
      </Box>

      {/* KPI comparison cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryRows.map((r, i) => (
          <Grid item xs={12} sm={6} md={4} key={r.year}>
            <Card sx={{ borderTop: `4px solid ${YEAR_COLORS[i % YEAR_COLORS.length]}` }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}>{r.year}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  <Chip label={`Budget: ${r.budget_total} j`} size="small" />
                  <Chip label={`Consommé: ${r.total_consumed} j`} size="small" />
                  <Chip label={`${r.nb_resources} ress.`} size="small" />
                  <Chip label={`${r.nb_etp} ETP`} size="small" />
                  <Chip label={`Int: ${r.interne} j`} size="small" color="success" variant="outlined" />
                  <Chip label={`Ext: ${r.externe} j`} size="small" color="warning" variant="outlined" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Monthly bar chart */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consommation mensuelle — {activeYears.join(' vs ')}
            </Typography>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {activeYears.map((y, i) => (
                  <Bar key={y} dataKey={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Cumulative line chart */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Courbe cumulée comparée</Typography>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={cumulData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {activeYears.map((y, i) => (
                  <Line
                    key={y}
                    type="monotone"
                    dataKey={String(y)}
                    stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Radar by activity */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Répartition par activité</Typography>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="activite" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis />
                <Tooltip />
                <Legend />
                {activeYears.map((y, i) => (
                  <Radar
                    key={y}
                    name={String(y)}
                    dataKey={String(y)}
                    stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                    fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                    fillOpacity={0.15}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Detail table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white' }}>Mois</TableCell>
              {activeYears.map(y => (
                <TableCell key={y} sx={{ color: 'white' }} align="center">{y}</TableCell>
              ))}
              {activeYears.length >= 2 && (
                <TableCell sx={{ color: 'white' }} align="center">
                  Variation {activeYears[activeYears.length - 2]}/{activeYears[activeYears.length - 1]}
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {MONTH_SHORT.map((label, i) => {
              const vals = activeYears.map(y => monthlyData[i][String(y)] || 0);
              let variation = null;
              if (vals.length >= 2) {
                const prev = vals[vals.length - 2];
                const curr = vals[vals.length - 1];
                if (prev > 0) {
                  variation = Math.round(((curr - prev) / prev) * 100);
                }
              }
              return (
                <TableRow key={label}>
                  <TableCell><strong>{label}</strong></TableCell>
                  {vals.map((v, j) => (
                    <TableCell key={j} align="center">{v}</TableCell>
                  ))}
                  {activeYears.length >= 2 && (
                    <TableCell align="center">
                      {variation !== null ? (
                        <Chip
                          label={`${variation > 0 ? '+' : ''}${variation}%`}
                          size="small"
                          color={variation > 10 ? 'error' : variation < -10 ? 'success' : 'default'}
                        />
                      ) : '—'}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {/* Total row */}
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Total</strong></TableCell>
              {activeYears.map(y => {
                const total = monthlyData.reduce((s, m) => s + (m[String(y)] || 0), 0);
                return (
                  <TableCell key={y} align="center"><strong>{Math.round(total * 100) / 100}</strong></TableCell>
                );
              })}
              {activeYears.length >= 2 && (
                <TableCell align="center">
                  {(() => {
                    const t1 = monthlyData.reduce((s, m) => s + (m[String(activeYears[activeYears.length - 2])] || 0), 0);
                    const t2 = monthlyData.reduce((s, m) => s + (m[String(activeYears[activeYears.length - 1])] || 0), 0);
                    const v = t1 > 0 ? Math.round(((t2 - t1) / t1) * 100) : null;
                    return v !== null ? (
                      <Chip label={`${v > 0 ? '+' : ''}${v}%`} size="small" color={v > 10 ? 'error' : v < -10 ? 'success' : 'default'} />
                    ) : '—';
                  })()}
                </TableCell>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
