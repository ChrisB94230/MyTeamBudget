const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ds = require('./dataService');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// Multer for file upload (import Excel)
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// ==================== RESOURCES ====================

app.get('/api/resources', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getResources(year));
});

app.post('/api/resources', (req, res) => {
  const resource = ds.addResource(req.body);
  res.status(201).json(resource);
});

app.put('/api/resources/:id', (req, res) => {
  const resource = ds.updateResource(parseInt(req.params.id), req.body);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  res.json(resource);
});

app.delete('/api/resources/:id', (req, res) => {
  const ok = ds.deleteResource(parseInt(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Resource not found' });
  res.status(204).send();
});

// ==================== IMPORT ====================

app.post('/api/resources/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const year = req.body.year ? parseInt(req.body.year) : null;
  const result = ds.previewImport(req.file.path, year);
  // Cleanup temp file
  try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/resources/import/confirm', (req, res) => {
  const rows = req.body.rows || [];
  const result = ds.bulkAddResources(rows);
  res.status(201).json(result);
});

app.get('/api/resources/import/template', (req, res) => {
  const filePath = ds.generateImportTemplate();
  res.download(filePath, 'template_import_ressources.xlsx');
});

// ==================== PRESENCE ====================

app.get('/api/presence', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getPresence(year));
});

app.post('/api/presence', (req, res) => {
  if (Array.isArray(req.body)) {
    ds.bulkUpdatePresence(req.body);
  } else {
    ds.updatePresence(req.body);
  }
  res.json({ status: 'ok' });
});

app.get('/api/presence/dashboard', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getPresenceDashboard(year));
});

// ==================== CONSUMPTION ====================

app.get('/api/consumption', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getConsumption(year));
});

app.post('/api/consumption', (req, res) => {
  ds.updateConsumption(req.body);
  res.json({ status: 'ok' });
});

// ==================== PREVISIONS ====================

app.get('/api/previsions', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getPrevisions(year));
});

app.post('/api/previsions', (req, res) => {
  const prev = ds.addPrevision(req.body);
  res.status(201).json(prev);
});

app.put('/api/previsions/:id', (req, res) => {
  const prev = ds.updatePrevision(parseInt(req.params.id), req.body);
  if (!prev) return res.status(404).json({ error: 'Prevision not found' });
  res.json(prev);
});

app.delete('/api/previsions/:id', (req, res) => {
  const ok = ds.deletePrevision(parseInt(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Prevision not found' });
  res.status(204).send();
});

// ==================== SETTINGS ====================

app.get('/api/settings', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getSettings(year));
});

app.post('/api/settings', (req, res) => {
  res.json(ds.updateSettings(req.body));
});

app.get('/api/settings/all', (req, res) => {
  res.json(ds.getAllSettings());
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;
  res.json(ds.getDashboard(year));
});

// ==================== YEARS ====================

app.get('/api/years', (req, res) => {
  res.json(ds.getYears());
});

// ==================== COMPARISON ====================

app.get('/api/comparison', (req, res) => {
  const yearsParam = req.query.years || '';
  let selected;
  try {
    selected = yearsParam.split(',').filter(y => y.trim()).map(y => parseInt(y.trim()));
    if (selected.some(isNaN)) throw new Error('Invalid');
  } catch (e) {
    return res.status(400).json({ error: 'Invalid years parameter' });
  }
  if (!selected.length) selected = ds.getYears();
  res.json(ds.getComparison(selected));
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
