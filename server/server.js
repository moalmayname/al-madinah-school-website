/**
 * Al-Madinah Al-Munawwarah School — API + static server
 *
 * Express app that:
 *  - serves the frontend from ../public
 *  - serves bilingual seed content (news, events, teachers, gallery, stats)
 *  - accepts contact messages and admission applications (stored as JSON)
 *  - exposes a token-protected admin endpoint to review submissions
 *
 * Run:  npm install && npm start        (http://localhost:3000)
 * Env:  PORT         — port to listen on (default 3000)
 *       ADMIN_TOKEN  — token required by GET /api/admin/submissions
 *                      (demo default below — CHANGE IT in production!)
 */
const path = require('path');
const express = require('express');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-demo-token';

// ---------- Middleware ----------
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function makeReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ADM-${new Date().getFullYear()}-${rand}`;
}

// ---------- Public content API (seed data) ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'al-madinah-school-website', time: new Date().toISOString() });
});

app.get('/api/news', (req, res) => res.json(store.readSeed('news')));
app.get('/api/events', (req, res) => res.json(store.readSeed('events')));
app.get('/api/teachers', (req, res) => res.json(store.readSeed('teachers')));
app.get('/api/gallery', (req, res) => res.json(store.readSeed('gallery')));
app.get('/api/stats', (req, res) => res.json(store.readSeed('stats')));

// ---------- Contact form ----------
app.post('/api/contact', (req, res) => {
  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 160);
  const phone = clean(req.body.phone, 40);
  const message = clean(req.body.message, 4000);

  const errors = {};
  if (!name) errors.name = 'Name is required.';
  if (!email || !EMAIL_RE.test(email)) errors.email = 'A valid email is required.';
  if (!message) errors.message = 'Message is required.';
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const record = { id: Date.now().toString(36), type: 'contact', name, email, phone, message, receivedAt: new Date().toISOString() };
  store.appendRuntime('contact-messages', record);
  return res.status(201).json({ ok: true, message: 'Thank you — your message has been received.' });
});

// ---------- Admissions form ----------
app.post('/api/admissions', (req, res) => {
  const studentName = clean(req.body.studentName, 120);
  const level = clean(req.body.level, 20);
  const guardianName = clean(req.body.guardianName, 120);
  const guardianPhone = clean(req.body.guardianPhone, 40);
  const guardianEmail = clean(req.body.guardianEmail, 160);
  const notes = clean(req.body.notes, 2000);

  const errors = {};
  if (!studentName) errors.studentName = 'Student name is required.';
  if (!['primary', 'secondary'].includes(level)) errors.level = 'Level must be "primary" or "secondary".';
  if (!guardianName) errors.guardianName = 'Guardian name is required.';
  if (!guardianPhone && !guardianEmail) errors.guardianContact = 'Provide a guardian phone number or email.';
  if (guardianEmail && !EMAIL_RE.test(guardianEmail)) errors.guardianEmail = 'Guardian email is not valid.';
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const reference = makeReference();
  const record = {
    id: Date.now().toString(36),
    type: 'admission',
    reference,
    studentName,
    level,
    guardianName,
    guardianPhone,
    guardianEmail,
    notes,
    receivedAt: new Date().toISOString(),
  };
  store.appendRuntime('applications', record);
  return res.status(201).json({ ok: true, reference, message: 'Application received. Please keep your reference code.' });
});

// ---------- Admin: review submissions (token protected) ----------
app.get('/api/admin/submissions', (req, res) => {
  const token = req.get('x-admin-token');
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — missing or invalid x-admin-token header.' });
  }
  return res.json({
    ok: true,
    contactMessages: store.readRuntime('contact-messages'),
    applications: store.readRuntime('applications'),
  });
});

// ---------- Fallbacks ----------
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'API route not found.' }));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body.' });
  }
  console.error(err);
  return res.status(500).json({ ok: false, error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Al-Madinah School website running at http://localhost:${PORT}`);
});
