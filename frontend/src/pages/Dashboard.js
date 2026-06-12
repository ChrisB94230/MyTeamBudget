import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, Typography, Paper, Chip, Alert,
  FormControl, InputLabel, Select, MenuItem, Button, CircularProgress,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningIcon from '@mui/icons-material/Warning';
import SavingsIcon from '@mui/icons-material/Savings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { getDashboard, getYears, getPresenceDashboard } from '../services/api';

const COLORS = ['#1565c0', '#2e7d32', '#ff8f00', '#6a1b9a', '#c62828', '#00695c',
  '#ef6c00', '#283593', '#ad1457', '#4e342e', '#37474f', '#827717'];

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function KpiCard({ title, value, subtitle, icon, color }) {
  return (
    <Card sx={{ height: '100%', borderTop: `3px solid ${color}` }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color, mt: 0.5, lineHeight: 1.1 }}>{value}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
          </Box>
          <Box sx={{ bgcolor: `${color}12`, borderRadius: 2.5, p: 1.2, display: 'flex' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const dashRef = useRef(null);
  const [data, setData] = useState(null);
  const [presenceData, setPresenceData] = useState(null);
  const [year, setYear] = useState(null);
  const [years, setYears] = useState([]);
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (!dashRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = dashRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f5f5f5',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('landscape', 'mm', 'a3');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasRatio = canvas.height / canvas.width;
      const imgWidth = pdfWidth - 20;
      const imgHeight = imgWidth * canvasRatio;

      let yPos = 10;
      const pageContentHeight = pdfHeight - 20;

      if (imgHeight <= pageContentHeight) {
        pdf.addImage(imgData, 'JPEG', 10, yPos, imgWidth, imgHeight);
      } else {
        let remainingHeight = canvas.height;
        let sourceY = 0;
        let page = 0;

        while (remainingHeight > 0) {
          if (page > 0) pdf.addPage();

          const sliceHeight = Math.min(
            remainingHeight,
            (pageContentHeight / imgWidth) * canvas.width / (canvas.height / remainingHeight) * remainingHeight
          );

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          const ratio = pageContentHeight / imgWidth;
          pageCanvas.height = Math.min(canvas.width * ratio, remainingHeight);
          const ctx = pageCanvas.getContext('2d');
          ctx.drawImage(
            canvas,
            0, sourceY, canvas.width, pageCanvas.height,
            0, 0, pageCanvas.width, pageCanvas.height
          );

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          const pageImgHeight = (pageCanvas.height / pageCanvas.width) * imgWidth;
          pdf.addImage(pageImgData, 'JPEG', 10, 10, imgWidth, pageImgHeight);

          sourceY += pageCanvas.height;
          remainingHeight -= pageCanvas.height;
          page++;
        }
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      pdf.save(`Dashboard_Budget_RUN_${year}_${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  }, [year]);

  useEffect(() => {
    getYears().then(res => {
      setYears(res.data);
      const y = res.data[res.data.length - 1];
      setYear(y);
    });
  }, []);

  useEffect(() => {
    if (year) {
      getDashboard(year).then(res => setData(res.data));
      getPresenceDashboard(year).then(res => setPresenceData(res.data));
    }
  }, [year]);

  if (!data) return <Typography>Chargement...</Typography>;

  const barData = MONTH_SHORT.map((m, i) => ({
    name: m,
    Budget: data.monthly_budget[i],
    Consommé: data.monthly_consumed[i],
  }));

  const cumulData = MONTH_SHORT.map((m, i) => {
    const budgetCum = data.monthly_budget.slice(0, i + 1).reduce((a, b) => a + b, 0);
    const consCum = data.monthly_consumed.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return { name: m, 'Budget cumulé': Math.round(budgetCum * 100) / 100, 'Consommé cumulé': Math.round(consCum * 100) / 100 };
  });

  // Per-person presence chart data (stacked: Présence + Absences + Non consommé = Jours max)
  const presenceChartData = presenceData && presenceData.resources
    ? presenceData.resources
        .filter(r => r.limite_annuelle > 0)
        .map(r => {
          const reste = Math.max(0, r.limite_annuelle - r.total_travaille - r.conges_pris);
          return {
            name: r.name.length > 14 ? r.name.substring(0, 14) + '…' : r.name,
            fullName: r.name,
            'Présence': r.total_travaille,
            'Absences': r.conges_pris,
            'Restant': Math.round(reste * 100) / 100,
            joursMax: r.limite_annuelle,
          };
        })
        .sort((a, b) => b.joursMax - a.joursMax)
    : [];

  const pieStatut = [
    { name: 'Interne', value: data.by_statut.Interne },
    { name: 'Externe', value: data.by_statut.Externe },
  ].filter(d => d.value > 0);

  const pctConsumed = data.budget_total > 0
    ? Math.round((data.total_consumed / data.budget_total) * 100)
    : 0;

  return (
    <Box ref={dashRef}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Dashboard Budget RUN</Typography>
          <Typography variant="body2" color="text.secondary">Vue d'ensemble de la consommation et du budget</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={exporting ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
            onClick={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? 'Export...' : 'PDF'}
          </Button>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Année</InputLabel>
            <Select value={year || ''} label="Année" onChange={(e) => setYear(e.target.value)}>
              {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {data.budget_global_alloue > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: data.ecart_enveloppe > 0 ? '#fff3e0' : '#e8f5e9', border: '1px solid', borderColor: data.ecart_enveloppe > 0 ? '#ff8f00' : '#1b5e20' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <Typography variant="body2" color="text.secondary">Enveloppe allouée</Typography>
              <Typography variant="h5" fontWeight="bold">{Math.round(data.budget_global_alloue)} j</Typography>
            </Grid>
            {data.reduction_jours > 0 && (
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Réduction {data.label_reduction ? `(${data.label_reduction})` : ''}
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="error">- {Math.round(data.reduction_jours)} j</Typography>
              </Grid>
            )}
            <Grid item xs={12} sm={3}>
              <Typography variant="body2" color="text.secondary">Budget net enveloppe</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary">{Math.round(data.budget_enveloppe * 100) / 100} j</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2" color="text.secondary">Écart (Réel vs Enveloppe)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {data.ecart_enveloppe > 0 ? (
                  <WarningIcon sx={{ color: '#c62828' }} />
                ) : (
                  <SavingsIcon sx={{ color: '#1b5e20' }} />
                )}
                <Typography variant="h5" fontWeight="bold" color={data.ecart_enveloppe > 0 ? 'error' : 'primary'}>
                  {data.ecart_enveloppe > 0 ? '+' : ''}{Math.round(data.ecart_enveloppe * 100) / 100} j
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {data.ecart_enveloppe > 0 ? 'Dépassement de l\'enveloppe' : 'Sous l\'enveloppe'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Budget Total"
            value={`${Math.round(data.budget_total * 100) / 100} j`}
            subtitle={`${data.nb_resources} ressources`}
            icon={<AccountBalanceIcon sx={{ color: '#1b5e20' }} />}
            color="#1b5e20"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Consommé"
            value={`${Math.round(data.total_consumed * 100) / 100} j`}
            subtitle={`${pctConsumed}% du budget`}
            icon={<TrendingDownIcon sx={{ color: '#ff8f00' }} />}
            color="#ff8f00"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Budget Restant"
            value={`${Math.round(data.budget_restant * 100) / 100} j`}
            subtitle={data.budget_restant < 0 ? 'DÉPASSEMENT' : ''}
            icon={<CalendarTodayIcon sx={{ color: data.budget_restant < 0 ? '#c62828' : '#1565c0' }} />}
            color={data.budget_restant < 0 ? '#c62828' : '#1565c0'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="ETP"
            value={`${Math.round((data.nb_etp_interne + data.nb_etp_externe) * 10) / 10}`}
            subtitle={`${Math.round(data.nb_etp_interne * 10) / 10} Int. / ${Math.round(data.nb_etp_externe * 10) / 10} Ext.`}
            icon={<PeopleIcon sx={{ color: '#6a1b9a' }} />}
            color="#6a1b9a"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Budget vs Consommation Mensuelle</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Budget" fill="#1565c0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Consommé" fill="#ff8f00" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Présence par Personne</Typography>
            {presenceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(420, presenceChartData.length * 40 + 80)}>
                <BarChart data={presenceChartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit=" j" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === 'Restant') return [`${value} j`, 'Restant à poser'];
                      return [`${value} j`, name];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        const d = payload[0].payload;
                        return `${d.fullName} — Max: ${d.joursMax} j`;
                      }
                      return label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Présence" stackId="a" fill="#1b5e20" barSize={22} />
                  <Bar dataKey="Absences" stackId="a" fill="#ff8f00" barSize={22} />
                  <Bar dataKey="Restant" stackId="a" fill="#e0e0e0" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Aucune donnée de présence disponible
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Courbe Cumulée</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={cumulData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Budget cumulé" stroke="#1565c0" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Consommé cumulé" stroke="#ff8f00" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Répartition Interne / Externe</Typography>
            <ResponsiveContainer width="100%" height={420}>
              <PieChart>
                <Pie
                  data={pieStatut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  outerRadius="38%"
                  label={({ name, value }) => `${name}: ${value}j`}
                  fontSize={13}
                >
                  <Cell fill="#1565c0" />
                  <Cell fill="#ff8f00" />
                </Pie>
                <Tooltip formatter={(value) => `${value} j`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {data.presence_alerts && (data.presence_alerts.nb_critical > 0 || data.presence_alerts.nb_warning > 0) && (
        <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: data.presence_alerts.nb_critical > 0 ? '#c62828' : '#ff8f00' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon color={data.presence_alerts.nb_critical > 0 ? 'error' : 'warning'} />
              <Typography variant="h6">Alertes Temps de Présence</Typography>
              {data.presence_alerts.nb_critical > 0 && (
                <Chip label={`${data.presence_alerts.nb_critical} critique${data.presence_alerts.nb_critical > 1 ? 's' : ''}`} color="error" size="small" />
              )}
              {data.presence_alerts.nb_warning > 0 && (
                <Chip label={`${data.presence_alerts.nb_warning} attention`} color="warning" size="small" />
              )}
            </Box>
            <Button size="small" variant="outlined" onClick={() => navigate('/presence')}>
              Voir le détail
            </Button>
          </Box>
          {data.presence_alerts.alerts.map((a, i) => (
            <Alert key={i} severity={a.level === 'critical' ? 'error' : 'warning'} sx={{ mb: 0.5 }}>
              <strong>{a.name}</strong> ({a.statut}) — {a.message}
            </Alert>
          ))}
        </Paper>
      )}

      {(data.prevision_entries.length > 0 || data.prevision_exits.length > 0) && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Prévisions d'Entrées / Sorties</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="primary" gutterBottom>Entrées prévues</Typography>
              {data.prevision_entries.length === 0 && <Typography variant="body2">Aucune</Typography>}
              {data.prevision_entries.map((p, i) => (
                <Chip
                  key={i}
                  label={`${p.name} (${p.statut}) — ${p.activite} — ${p.date_effet} — ${p.motif}`}
                  color="success"
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="error" gutterBottom>Sorties prévues</Typography>
              {data.prevision_exits.length === 0 && <Typography variant="body2">Aucune</Typography>}
              {data.prevision_exits.map((p, i) => (
                <Chip
                  key={i}
                  label={`${p.name} (${p.statut}) — ${p.activite} — ${p.date_effet} — ${p.motif}`}
                  color="error"
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}
