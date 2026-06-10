import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select,
  MenuItem, Button, Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { getResources, getConsumption, updateConsumption, getYears } from '../services/api';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Consumption() {
  const [resources, setResources] = useState([]);
  const [consumption, setConsumption] = useState({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    Promise.all([getResources(year), getConsumption(year)]).then(([resRes, consRes]) => {
      setResources(resRes.data);
      const consMap = {};
      consRes.data.forEach(c => {
        const key = `${c.resource_id}-${c.month}`;
        consMap[key] = c.consumed;
      });
      setConsumption(consMap);
    });
  }, [year]);

  useEffect(() => { getYears().then(res => setYears(res.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const getValue = (resourceId, month) => {
    const key = `${resourceId}-${month}`;
    return consumption[key] || 0;
  };

  const setValue = (resourceId, month, value) => {
    const key = `${resourceId}-${month}`;
    setConsumption(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
    setDirty(true);
  };

  const handleSave = async () => {
    const promises = [];
    resources.forEach(r => {
      for (let m = 1; m <= 12; m++) {
        const val = getValue(r.id, m);
        if (val > 0) {
          promises.push(updateConsumption({
            year, month: m, resource_id: r.id, consumed: val,
          }));
        }
      }
    });
    await Promise.all(promises);
    setDirty(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Saisie de la Consommation</Typography>
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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white' }}>Ressource</TableCell>
              <TableCell sx={{ color: 'white' }}>Activité</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Budget</TableCell>
              {MONTH_LABELS.map(m => (
                <TableCell key={m} sx={{ color: 'white' }} align="center">{m}</TableCell>
              ))}
              <TableCell sx={{ color: 'white' }} align="center">Total</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Reste</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map(r => {
              const totalConsumed = Array.from({ length: 12 }, (_, i) => getValue(r.id, i + 1))
                .reduce((s, v) => s + v, 0);
              const reste = Math.round((r.nb_jours_run - totalConsumed) * 100) / 100;
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.activite}</TableCell>
                  <TableCell align="center"><strong>{r.nb_jours_run}</strong></TableCell>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const budgetMonth = r[MONTHS[m - 1]] || 0;
                    const val = getValue(r.id, m);
                    const over = val > budgetMonth && budgetMonth > 0;
                    return (
                      <TableCell key={m} align="center" sx={{ p: 0.3 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={val || ''}
                          onChange={e => setValue(r.id, m, e.target.value)}
                          inputProps={{ step: 0.25, style: { textAlign: 'center', padding: '6px 2px', fontSize: '0.85rem' } }}
                          sx={{
                            width: 70,
                            '& .MuiInputBase-root': { bgcolor: over ? '#ffebee' : 'inherit' },
                            '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                              WebkitAppearance: 'none', margin: 0,
                            },
                            '& input[type=number]': { MozAppearance: 'textfield' },
                          }}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell align="center"><strong>{Math.round(totalConsumed * 100) / 100}</strong></TableCell>
                  <TableCell align="center">
                    <Chip
                      label={reste}
                      size="small"
                      color={reste < 0 ? 'error' : reste === 0 ? 'default' : 'success'}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
