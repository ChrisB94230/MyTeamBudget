import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import Consumption from './pages/Consumption';
import Previsions from './pages/Previsions';
import Comparison from './pages/Comparison';
import Presence from './pages/Presence';
import Settings from './pages/Settings';

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0', light: '#1e88e5', dark: '#0d47a1' },
    secondary: { main: '#ff8f00', light: '#ffa726', dark: '#e65100' },
    success: { main: '#2e7d32' },
    error: { main: '#c62828' },
    background: { default: '#f0f2f5', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    body2: { lineHeight: 1.6 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s ease',
          '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        contained: { boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(0,0,0,0.06)' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/consumption" element={<Consumption />} />
            <Route path="/previsions" element={<Previsions />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/presence" element={<Presence />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
