import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { getYears } from '../services/api';

export default function YearSelector({ year, onChange }) {
  const [years, setYears] = useState([]);

  useEffect(() => {
    getYears().then(res => {
      const y = res.data;
      setYears(y);
      if (!year && y.length > 0) {
        onChange(y[y.length - 1]);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel>Année</InputLabel>
      <Select value={year || ''} label="Année" onChange={(e) => onChange(e.target.value)}>
        {years.map(y => (
          <MenuItem key={y} value={y}>{y}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
