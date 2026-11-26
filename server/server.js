/**
 * Al-Madinah Al-Munawwarah School — API + static server
 *
 * Express app that:
 *  - serves the frontend from ../public
 *  - serves bilingual seed content (news, events, teachers, gallery, stats)
 *  - accepts contact messages and admission applications (stored as JSON)
 *  - exposes token-protected admin endpoints to review submissions and to
 *    add news / events (used by the admin dashboard in public/admin.html)
 *
 * Run:  npm install && npm start        (http://localhost:3000)
 * Env:  PORT         — port to listen on (default 3000)
 *       ADMIN_TOKEN  — token required by the /api/admin/* endpoints
 *                      (demo default below — CHANGE IT in production!)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-demo-token';
const UPLOADS_DIR = path.join(__dirname, 'data', 'runtime', 'uploads');

// ---------- Middleware ----------
app.use('/api/admin/teachers', express.json({ limit: '5mb' }));
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

// Static frontend and uploaded teacher media
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function makeReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ADM-${new Date().getFullYear()}-${rand}`;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const IMAGE_MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function resolveTeacherImage(imageData, imageUrl) {
  const rawData = typeof imageData === 'string' ? imageData.trim() : '';
  if (rawData) {
    const match = rawData.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return { error: 'Image must be a PNG, JPG, WEBP, or GIF file.' };
    const ext = IMAGE_MIME_EXT[match[1].toLowerCase()];
    const buf = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buf.length || buf.length > 3 * 1024 * 1024) {
      return { error: 'Image file must be non-empty and under 3 MB.' };
    }
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const filename = `${makeId('teacher')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
    return { url: `/uploads/${filename}` };
  }
  const url = clean(imageUrl, 1000);
  if (url) {
    if (!/^(https?:\/\/|\/uploads\/)/i.test(url)) {
      return { error: 'Image URL must start with http://, https://, or /uploads/.' };
    }
    return { url };
  }
  return { url: '' };
}

function formatEventDateLabels(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const en = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  const ar = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  return { en, ar };
}

// Constant-time token comparison, so response timing does not leak how much
// of the token was correct. timingSafeEqual throws when the buffers differ in
// length, so guard that first and treat a length mismatch as a plain failure.
function tokenMatches(provided) {
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Admin guard: the caller must send the ADMIN_TOKEN in the x-admin-token header.
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token');
  if (!token || !tokenMatches(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized — missing or invalid x-admin-token header.' });
  }
  return next();
}

// Basic in-memory rate limiting (per IP, fixed window) — no external deps.
// Counters live in process memory only, which is fine for a small school site.
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, windowStart }
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let entry = hits.get(ip);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ ok: false, error: 'Too many requests — please try again later.' });
    }
    return next();
  };
}

const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }); // contact + admissions posts
const adminLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 }); // dashboard polls several endpoints

// ---------- Public content API (seed data) ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'al-madinah-school-website', time: new Date().toISOString() });
});

// News / events / teachers = items added from the admin dashboard (newest first) + seed content
app.get('/api/news', (req, res) => res.json([...store.readRuntime('added-news').slice().reverse(), ...store.readSeed('news')]));
app.get('/api/events', (req, res) => res.json([...store.readRuntime('added-events').slice().reverse(), ...store.readSeed('events')]));
app.get('/api/teachers', (req, res) => res.json([...store.readRuntime('added-teachers').slice().reverse(), ...store.readSeed('teachers')]));
app.get('/api/gallery', (req, res) => res.json(store.readSeed('gallery')));
app.get('/api/stats', (req, res) => res.json(store.readSeed('stats')));

// ---------- Contact form ----------
app.post('/api/contact', formLimiter, (req, res) => {
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
app.post('/api/admissions', formLimiter, (req, res) => {
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

// ---------- Admin (token protected, used by public/admin.html) ----------
app.use('/api/admin', adminLimiter);

// Review form submissions
app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    contactMessages: store.readRuntime('contact-messages'),
    applications: store.readRuntime('applications'),
  });
});

// Add a news item — appears at the top of GET /api/news and on the website
app.post('/api/admin/news', requireAdmin, (req, res) => {
  const item = {
    title_en: clean(req.body.title_en, 200),
    title_ar: clean(req.body.title_ar, 200),
    body_en: clean(req.body.body_en, 4000),
    body_ar: clean(req.body.body_ar, 4000),
    date: clean(req.body.date, 20) || new Date().toISOString().slice(0, 10),
    tag_en: clean(req.body.tag_en, 60) || 'News',
    tag_ar: clean(req.body.tag_ar, 60) || 'أخبار',
  };

  const errors = {};
  if (!item.title_en) errors.title_en = 'English title is required.';
  if (!item.title_ar) errors.title_ar = 'Arabic title is required.';
  if (!item.body_en) errors.body_en = 'English body text is required.';
  if (!item.body_ar) errors.body_ar = 'Arabic body text is required.';
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const record = { id: makeId('news'), ...item, addedAt: new Date().toISOString() };
  store.appendRuntime('added-news', record);
  return res.status(201).json({ ok: true, item: record });
});

// Add an event — appears at the top of GET /api/events and on the website
app.post('/api/admin/events', requireAdmin, (req, res) => {
  const rawDate = clean(req.body.date, 20);
  const formatted = rawDate ? formatEventDateLabels(rawDate) : null;
  const item = {
    title_en: clean(req.body.title_en, 200),
    title_ar: clean(req.body.title_ar, 200),
    body_en: clean(req.body.body_en, 4000),
    body_ar: clean(req.body.body_ar, 4000),
    date: formatted ? rawDate : '',
    date_label_en: clean(req.body.date_label_en, 120) || (formatted ? formatted.en : 'Date to be added'),
    date_label_ar: clean(req.body.date_label_ar, 120) || (formatted ? formatted.ar : 'يُحدد التاريخ لاحقاً'),
  };

  const errors = {};
  if (!item.title_en) errors.title_en = 'English title is required.';
  if (!item.title_ar) errors.title_ar = 'Arabic title is required.';
  if (!item.body_en) errors.body_en = 'English body text is required.';
  if (!item.body_ar) errors.body_ar = 'Arabic body text is required.';
  if (rawDate && !formatted) errors.date = 'Invalid calendar date.';
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const record = { id: makeId('event'), ...item, addedAt: new Date().toISOString() };
  store.appendRuntime('added-events', record);
  return res.status(201).json({ ok: true, item: record });
});

// Add a teacher — appears at the top of GET /api/teachers and on the website
app.post('/api/admin/teachers', requireAdmin, (req, res) => {
  const item = {
    name_en: clean(req.body.name_en, 160),
    name_ar: clean(req.body.name_ar, 160),
    role_en: clean(req.body.role_en, 160),
    role_ar: clean(req.body.role_ar, 160),
    bio_en: clean(req.body.bio_en, 2000),
    bio_ar: clean(req.body.bio_ar, 2000),
    icon: clean(req.body.icon, 16) || '👩‍🏫',
  };

  const errors = {};
  if (!item.name_en) errors.name_en = 'English name is required.';
  if (!item.name_ar) errors.name_ar = 'Arabic name is required.';
  if (!item.role_en) errors.role_en = 'English role is required.';
  if (!item.role_ar) errors.role_ar = 'Arabic role is required.';
  if (!item.bio_en) errors.bio_en = 'English bio is required.';
  if (!item.bio_ar) errors.bio_ar = 'Arabic bio is required.';

  const imgResult = Object.keys(errors).length ? { url: '' } : resolveTeacherImage(req.body.imageData, req.body.imageUrl);
  if (imgResult.error) errors.image = imgResult.error;

  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const record = { id: makeId('teacher'), ...item, image: imgResult.url, addedAt: new Date().toISOString() };
  store.appendRuntime('added-teachers', record);
  return res.status(201).json({ ok: true, item: record });
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

// Only start listening when run directly (`npm start`). Tests and tooling can
// require() this file to get the app without opening a port.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Al-Madinah School website running at http://localhost:${PORT}`);
    if (!process.env.ADMIN_TOKEN) {
      console.warn('');
      console.warn('============================================================');
      console.warn('  WARNING: ADMIN_TOKEN is not set.');
      console.warn('  The DEMO admin token is active — anyone who knows it can');
      console.warn('  use the admin endpoints. Set a private ADMIN_TOKEN');
      console.warn('  environment variable before using this in production.');
      console.warn('============================================================');
      console.warn('');
    }
  });
}

module.exports = app;
