import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, FormControl, InputLabel, Select, MenuItem,
  Chip, TextField,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { getAuditLog, getYears } from '../services/api';

const ACTION_COLORS = {
  'Ajout': 'success',
  'Modification': 'info',
  'Suppression': 'error',
  'Entrée prévisionnelle': 'success',
  'Sortie prévisionnelle': 'warning',
};

const ENTITY_ICONS = {
  'Ressource': 'primary',
  'Prévision': 'secondary',
  'Consommation': 'info',
  'Paramètres': 'default',
  'Import': 'warning',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    getAuditLog(year).then(res => setLogs(res.data));
  }, [year]);

  useEffect(() => { getYears().then(res => setYears(res.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? logs.filter(l =>
        l.entity_name.toLowerCase().includes(filter.toLowerCase()) ||
        l.action.toLowerCase().includes(filter.toLowerCase()) ||
        l.details.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">
            <HistoryIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
            Historique des Modifications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Journal d'audit des actions effectuées
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Filtrer..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Année</InputLabel>
            <Select value={year} label="Année" onChange={(e) => setYear(e.target.value)}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Typography variant="body2">
          <strong>{filtered.length}</strong> événement{filtered.length > 1 ? 's' : ''}
          {filter && ` (filtré sur "${filter}")`}
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 600 }}>Date & Heure</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Détails</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Aucun événement enregistré
                </TableCell>
              </TableRow>
            )}
            {filtered.map(log => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                  {log.timestamp}
                </TableCell>
                <TableCell>
                  <Chip
                    label={log.action}
                    size="small"
                    color={ACTION_COLORS[log.action] || 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={log.entity_type}
                    size="small"
                    color={ENTITY_ICONS[log.entity_type] || 'default'}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{log.entity_name}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
