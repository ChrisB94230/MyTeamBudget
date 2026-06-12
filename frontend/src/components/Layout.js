import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  Divider, Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

const DRAWER_WIDTH = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Ressources', icon: <PeopleIcon />, path: '/resources' },
  { text: 'Consommation', icon: <BarChartIcon />, path: '/consumption' },
  { text: 'Prévisions', icon: <TrendingUpIcon />, path: '/previsions' },
  { text: 'Temps de Présence', icon: <AccessTimeIcon />, path: '/presence' },
  { text: 'Comparatif', icon: <CompareArrowsIcon />, path: '/comparison' },
  { text: 'Paramètres', icon: <SettingsIcon />, path: '/settings' },
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
        <Typography variant="caption" color="text.disabled" display="block" textAlign="center">
          RUN en Man Days
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
    </Box>
  );
}
