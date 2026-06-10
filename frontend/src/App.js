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
    primary: { main: '#1b5e20' },
    secondary: { main: '#ff8f00' },
    background: { default: '#f5f5f5' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
