import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, Typography, Paper, Chip, Alert,
  FormControl, InputLabel, Select, MenuItem, Button, CircularProgress,
  IconButton, Tooltip as MuiTooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import FlightLandIcon from '@mui/icons-material/FlightLand';
import { getDashboard, getYears, getPresenceDashboard, getResources, getConsumption } from '../services/api';
import * as XLSX from 'xlsx';

const COLORS = ['#1565c0', '#2e7d32', '#ff8f00', '#6a1b9a', '#c62828', '#00695c',
  '#ef6c00', '#283593', '#ad1457', '#4e342e', '#37474f', '#827717'];

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function InfoTip({ text }) {
  return (
    <MuiTooltip
      title={<Typography variant="body2" sx={{ p: 0.5 }}>{text}</Typography>}
      arrow
      placement="top"
      enterTouchDelay={0}
    >
      <IconButton size="small" sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
        <InfoOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </MuiTooltip>
  );
}

function KpiCard({ title, value, subtitle, icon, color, tooltip }) {
  return (
    <Card sx={{ height: '100%', borderTop: `3px solid ${color}`, position: 'relative' }}>
      {tooltip && (
        <Box sx={{ position: 'absolute', top: 2, right: 2 }}>
          <InfoTip text={tooltip} />
        </Box>
      )}
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
  const [exportingXls, setExportingXls] = useState(false);

  const handleExportExcel = useCallback(async () => {
    if (!year || !data) return;
    setExportingXls(true);
    try {
      const [resRes, consRes] = await Promise.all([
        getResources(year),
        getConsumption(year),
      ]);
      const wb = XLSX.utils.book_new();

      const synthRows = MONTH_SHORT.map((m, i) => ({
        'Mois': MONTH_FULL[i],
        'Budget (j)': data.monthly_budget[i],
        'Consommé (j)': data.monthly_consumed[i],
        'Écart (j)': Math.round((data.monthly_budget[i] - data.monthly_consumed[i]) * 100) / 100,
      }));
      synthRows.push({
        'Mois': 'TOTAL',
        'Budget (j)': Math.round(data.budget_total * 100) / 100,
        'Consommé (j)': Math.round(data.total_consumed * 100) / 100,
        'Écart (j)': Math.round(data.budget_restant * 100) / 100,
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(synthRows), 'Synthèse Mensuelle');

      const resources = resRes.data || [];
      const resRows = resources.map(r => ({
        'Nom': r.name,
        'Statut': r.statut,
        'Activité': r.activite,
        'Nb Jours Total': r.nb_jours_total,
        ...Object.fromEntries(MONTH_FULL.map((m, i) => [m, r[`m${i + 1}`] || 0])),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resRows), 'Ressources');

      const consumption = consRes.data || [];
      const consRows = consumption.map(r => ({
        'Nom': r.name,
        'Statut': r.statut,
        'Activité': r.activite,
        ...Object.fromEntries(MONTH_FULL.map((m, i) => [m, r[`m${i + 1}`] || 0])),
        'Total': r.total || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consRows), 'Consommation');

      const kpiRows = [
        { 'Indicateur': 'Budget Total (j)', 'Valeur': Math.round(data.budget_total * 100) / 100 },
        { 'Indicateur': 'Consommé (j)', 'Valeur': Math.round(data.total_consumed * 100) / 100 },
        { 'Indicateur': 'Restant (j)', 'Valeur': Math.round(data.budget_restant * 100) / 100 },
        { 'Indicateur': 'Nb Ressources', 'Valeur': data.nb_resources },
        { 'Indicateur': 'ETP Interne', 'Valeur': Math.round(data.nb_etp_interne * 10) / 10 },
        { 'Indicateur': 'ETP Externe', 'Valeur': Math.round(data.nb_etp_externe * 10) / 10 },
        { 'Indicateur': 'Enveloppe allouée (j)', 'Valeur': data.budget_global_alloue || '' },
        { 'Indicateur': 'Budget net enveloppe (j)', 'Valeur': data.budget_enveloppe ? Math.round(data.budget_enveloppe * 100) / 100 : '' },
        { 'Indicateur': 'Écart enveloppe (j)', 'Valeur': data.ecart_enveloppe != null ? Math.round(data.ecart_enveloppe * 100) / 100 : '' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs');

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      XLSX.writeFile(wb, `Dashboard_Budget_RUN_${year}_${dateStr}.xlsx`);
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setExportingXls(false);
    }
  }, [year, data]);

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

  const fc = data.forecast || {};
  const cumulData = MONTH_SHORT.map((m, i) => {
    const budgetCum = data.monthly_budget.slice(0, i + 1).reduce((a, b) => a + b, 0);
    const consCum = data.monthly_consumed.slice(0, i + 1).reduce((a, b) => a + b, 0);
    const row = { name: m, 'Budget cumulé': Math.round(budgetCum * 100) / 100 };
    if (i < (fc.current_month || 12)) {
      row['Consommé cumulé'] = Math.round(consCum * 100) / 100;
    }
    if (fc.forecast_monthly && fc.forecast_total && i >= (fc.current_month || 12) - 1) {
      const fcCum = fc.forecast_monthly.slice(0, i + 1).reduce((a, b) => a + b, 0);
      row['Projection (moy.)'] = Math.round(fcCum * 100) / 100;
    }
    if (fc.forecast_trend_monthly && fc.forecast_trend_total && i >= (fc.current_month || 12) - 1) {
      const trCum = fc.forecast_trend_monthly.slice(0, i + 1).reduce((a, b) => a + b, 0);
      row['Projection (tendance)'] = Math.round(trCum * 100) / 100;
    }
    return row;
  });

  // Per-person presence chart data split by statut
  const buildPresenceData = (statut) => {
    if (!presenceData || !presenceData.resources) return [];
    return presenceData.resources
      .filter(r => r.limite_annuelle > 0 && r.statut === statut)
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
      .sort((a, b) => b.joursMax - a.joursMax);
  };
  const presenceInternes = buildPresenceData('Interne');
  const presenceExternes = buildPresenceData('Externe');

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
            startIcon={exportingXls ? <CircularProgress size={16} /> : <TableChartIcon />}
            onClick={handleExportExcel}
            disabled={exportingXls}
          >
            {exportingXls ? 'Export...' : 'Excel'}
          </Button>
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
        <Paper sx={{ p: 2, mb: 3, bgcolor: data.ecart_enveloppe > 0 ? '#fff3e0' : '#e8f5e9', border: '1px solid', borderColor: data.ecart_enveloppe > 0 ? '#ff8f00' : '#1b5e20', position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <InfoTip text="Comparaison entre le budget réel calculé (somme des ressources) et l'enveloppe budgétaire allouée. Un écart positif signifie un dépassement." />
          </Box>
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
            tooltip="Somme des jours budgétés pour toutes les ressources de l'année (internes + externes)."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Consommé"
            value={`${Math.round(data.total_consumed * 100) / 100} j`}
            subtitle={`${pctConsumed}% du budget`}
            icon={<TrendingDownIcon sx={{ color: '#ff8f00' }} />}
            color="#ff8f00"
            tooltip="Total des jours réellement consommés (saisis dans la page Consommation) depuis le début de l'année."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Budget Restant"
            value={`${Math.round(data.budget_restant * 100) / 100} j`}
            subtitle={data.budget_restant < 0 ? 'DÉPASSEMENT' : ''}
            icon={<CalendarTodayIcon sx={{ color: data.budget_restant < 0 ? '#c62828' : '#1565c0' }} />}
            color={data.budget_restant < 0 ? '#c62828' : '#1565c0'}
            tooltip="Différence entre le budget total et la consommation réelle. Un chiffre négatif indique un dépassement."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="ETP"
            value={`${Math.round((data.nb_etp_interne + data.nb_etp_externe) * 10) / 10}`}
            subtitle={`${Math.round(data.nb_etp_interne * 10) / 10} Int. / ${Math.round(data.nb_etp_externe * 10) / 10} Ext.`}
            icon={<PeopleIcon sx={{ color: '#6a1b9a' }} />}
            color="#6a1b9a"
            tooltip="Équivalent Temps Plein : nombre de ressources rapporté à un temps plein annuel. Réparti entre internes et externes."
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <InfoTip text="Budget mensuel prévu (bleu) comparé à la consommation réelle saisie (orange) pour chaque mois de l'année." />
            </Box>
            <Typography variant="h6" gutterBottom>Budget vs Consommation</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Budget" fill="#1565c0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Consommé" fill="#ff8f00" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <InfoTip text="Répartition du temps des ressources internes : jours de présence, absences posées et jours restants sur leur limite annuelle." />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h6">Présence Internes</Typography>
              <Chip label={presenceInternes.length} size="small" color="primary" variant="outlined" />
            </Box>
            {presenceInternes.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(380, presenceInternes.length * 36 + 60)}>
                <BarChart data={presenceInternes} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" unit=" j" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => {
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
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Présence" stackId="a" fill="#2e7d32" barSize={18} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="Absences" stackId="a" fill="#ff8f00" barSize={18} />
                  <Bar dataKey="Restant" stackId="a" fill="#e8e8e8" barSize={18} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Aucun interne
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <InfoTip text="Répartition du temps des ressources externes (prestataires) : jours de présence, absences et jours restants." />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h6">Présence Externes</Typography>
              <Chip label={presenceExternes.length} size="small" color="secondary" variant="outlined" />
            </Box>
            {presenceExternes.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(380, presenceExternes.length * 36 + 60)}>
                <BarChart data={presenceExternes} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" unit=" j" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => {
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
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Présence" stackId="a" fill="#2e7d32" barSize={18} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="Absences" stackId="a" fill="#ff8f00" barSize={18} />
                  <Bar dataKey="Restant" stackId="a" fill="#e8e8e8" barSize={18} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Aucun externe
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <InfoTip text="Évolution cumulée du budget et de la consommation. Les lignes en pointillés projettent l'atterrissage de fin d'année selon la moyenne globale et la tendance récente (3 derniers mois)." />
            </Box>
            <Typography variant="h6" gutterBottom>Courbe Cumulée & Forecast</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={cumulData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v} j`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Budget cumulé" stroke="#1565c0" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Consommé cumulé" stroke="#ff8f00" strokeWidth={2} dot={{ r: 3 }} />
                {fc.forecast_total && (
                  <Line type="monotone" dataKey="Projection (moy.)" stroke="#ff8f00" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 2 }} connectNulls={false} />
                )}
                {fc.forecast_trend_total && (
                  <Line type="monotone" dataKey="Projection (tendance)" stroke="#c62828" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <InfoTip text="Proportion du budget entre ressources internes et externes en jours. Utile pour piloter le ratio d'externalisation." />
            </Box>
            <Typography variant="h6" gutterBottom sx={{ alignSelf: 'flex-start' }}>Répartition Interne / Externe</Typography>
            <ResponsiveContainer width="100%" height={380}>
              <PieChart>
                <Pie
                  data={pieStatut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius="40%"
                  label={({ name, value, percent }) => `${name}: ${value}j (${Math.round(percent * 100)}%)`}
                  fontSize={12}
                >
                  <Cell fill="#1565c0" />
                  <Cell fill="#ff8f00" />
                </Pie>
                <Tooltip formatter={(value) => `${value} j`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {fc.forecast_total && (
        <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: '#1565c0', position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <InfoTip text="Projection de l'atterrissage en fin d'année. 'Moyenne globale' utilise la consommation moyenne de tous les mois écoulés. 'Tendance récente' utilise les 3 derniers mois pour capter l'accélération ou le ralentissement." />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FlightLandIcon color="primary" />
            <Typography variant="h6">Forecast — Atterrissage {data.year}</Typography>
            <Chip label={`${fc.nb_months_data} mois de données`} size="small" variant="outlined" />
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Projection (moy. globale)</Typography>
                <Typography variant="h5" fontWeight="bold" color={fc.forecast_restant < 0 ? 'error.main' : 'primary.main'}>
                  {fc.forecast_total} j
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fc.forecast_restant >= 0 ? `${fc.forecast_restant} j restants` : `Dépassement de ${Math.abs(fc.forecast_restant)} j`}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Projection (tendance 3 mois)</Typography>
                <Typography variant="h5" fontWeight="bold" color={
                  fc.forecast_trend_total > data.budget_total ? 'error.main' : 'primary.main'
                }>
                  {fc.forecast_trend_total} j
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fc.forecast_trend_total <= data.budget_total
                    ? `${Math.round((data.budget_total - fc.forecast_trend_total) * 100) / 100} j restants`
                    : `Dépassement de ${Math.round((fc.forecast_trend_total - data.budget_total) * 100) / 100} j`
                  }
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Budget total</Typography>
                <Typography variant="h5" fontWeight="bold" color="#1b5e20">
                  {Math.round(data.budget_total * 100) / 100} j
                </Typography>
                {fc.forecast_ecart_enveloppe != null && (
                  <Typography variant="body2" color={fc.forecast_ecart_enveloppe > 0 ? 'error.main' : 'text.secondary'}>
                    {fc.forecast_ecart_enveloppe > 0
                      ? `Enveloppe dépassée de ${fc.forecast_ecart_enveloppe} j`
                      : `${Math.abs(fc.forecast_ecart_enveloppe)} j sous l'enveloppe`
                    }
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}

      {data.budget_alerts && data.budget_alerts.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, border: '1px solid',
          borderColor: data.budget_alerts.some(a => a.level === 'critical') ? '#c62828' : '#ff8f00',
          position: 'relative',
        }}>
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <InfoTip text="Alertes déclenchées quand la consommation dépasse les seuils configurés dans les Paramètres (par défaut 80% warning, 95% critique)." />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningIcon color={data.budget_alerts.some(a => a.level === 'critical') ? 'error' : 'warning'} />
            <Typography variant="h6">Alertes Budget</Typography>
          </Box>
          {data.budget_alerts.map((a, i) => (
            <Alert key={i} severity={a.level === 'critical' ? 'error' : 'warning'} sx={{ mb: 0.5 }}>
              {a.message}
            </Alert>
          ))}
        </Paper>
      )}

      {data.presence_alerts && (data.presence_alerts.nb_critical > 0 || data.presence_alerts.nb_warning > 0) && (
        <Paper sx={{ p: 2, mb: 3, border: '1px solid', borderColor: data.presence_alerts.nb_critical > 0 ? '#c62828' : '#ff8f00', position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <InfoTip text="Alertes sur les ressources dont le temps de présence réel s'écarte significativement du budget prévu, en tenant compte des entrées/sorties." />
          </Box>
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
        <Paper sx={{ p: 2, position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <InfoTip text="Liste des entrées et sorties de ressources prévues mais pas encore appliquées. Utilisez la page Prévisions pour les valider." />
          </Box>
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
