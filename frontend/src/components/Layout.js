import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  Divider, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import NewReleasesIcon from '@mui/icons-material/NewReleases';

const APP_VERSION = '1.4.0';

const CHANGELOG = [
  {
    version: '1.4.0',
    date: '2026-06-19',
    features: [
      'Infobulles explicatives sur chaque section du Dashboard',
      'Export Excel du dashboard (ressources, consommation, KPIs)',
      'Page de versioning avec historique des releases',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-19',
    features: [
      'Historique / Audit trail de toutes les opérations',
      'Simulation What-if pour entrées et sorties de ressources',
      'Alertes budget avec seuils configurables (warning/critique)',
      'Distribution personnalisable : Uniforme, Proportionnel, Manuel',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-18',
    features: [
      'Redesign UX : thème moderne, layout épuré',
      'Graphiques présence séparés Internes / Externes',
      'Courbe cumulée et pie chart alignés en colonnes 6/6',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-17',
    features: [
      'Alertes de présence avec projection des entrées/sorties',
      'Correction du bug de base de données fermée à l\'import',
      'Export PDF du Dashboard',
      'Page Comparatif inter-années',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-15',
    features: [
      'Dashboard avec KPIs, graphiques budget et présence',
      'Gestion des ressources (CRUD, import Excel)',
      'Suivi de consommation mensuelle',
      'Prévisions d\'entrées et sorties',
      'Temps de présence et absences',
      'Paramétrage (enveloppe, jours ouvrables, réduction)',
    ],
  },
];

const DRAWER_WIDTH = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Ressources', icon: <PeopleIcon />, path: '/resources' },
  { text: 'Consommation', icon: <BarChartIcon />, path: '/consumption' },
  { text: 'Prévisions', icon: <TrendingUpIcon />, path: '/previsions' },
  { text: 'Temps de Présence', icon: <AccessTimeIcon />, path: '/presence' },
  { text: 'Comparatif', icon: <CompareArrowsIcon />, path: '/comparison' },
  { text: 'Historique', icon: <HistoryIcon />, path: '/audit' },
  { text: 'Paramètres', icon: <SettingsIcon />, path: '/settings' },
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand header */}
      <Box sx={{
        p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5,
        background: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)',
      }}>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
          <AccountBalanceIcon sx={{ color: 'white', fontSize: 22 }} />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>
            My Team Budget
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
            Capacity & Budget Cockpit
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Navigation */}
      <List sx={{ flex: 1, pt: 1, px: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.3 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  px: 1.5,
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'white' : 'text.primary',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'rgba(21, 101, 192, 0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{
                  color: isActive ? 'white' : 'text.secondary',
                  minWidth: 38,
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <Typography
          variant="caption"
          color="text.disabled"
          display="block"
          textAlign="center"
          sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          onClick={() => setChangelogOpen(true)}
        >
          v{APP_VERSION} — Release Notes
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'white',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontSize: '1.1rem' }}>
            {menuItems.find(i => i.path === location.pathname)?.text || 'My Team Budget'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              border: 'none',
              bgcolor: '#fafbfc',
              borderRight: '1px solid rgba(0,0,0,0.06)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: 1400,
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <Dialog open={changelogOpen} onClose={() => setChangelogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NewReleasesIcon color="primary" />
          Release Notes — My Team Budget
        </DialogTitle>
        <DialogContent dividers>
          {CHANGELOG.map((release, idx) => (
            <Box key={release.version} sx={{ mb: idx < CHANGELOG.length - 1 ? 2.5 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  label={`v${release.version}`}
                  color={idx === 0 ? 'primary' : 'default'}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" color="text.secondary">{release.date}</Typography>
                {idx === 0 && <Chip label="Dernière" size="small" color="success" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
              </Box>
              <List dense disablePadding sx={{ pl: 1 }}>
                {release.features.map((f, i) => (
                  <ListItem key={i} disablePadding sx={{ py: 0.2 }}>
                    <ListItemText
                      primary={`• ${f}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangelogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
