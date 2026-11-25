/**
 * app.js — Al-Madinah Al-Munawwarah School v2 frontend logic.
 *
 * - Bilingual EN/AR toggle (persisted in localStorage), RTL/LTR switching
 * - Dynamic sections (stats, teachers, news, events, gallery) loaded from the
 *   /api endpoints, with window.FALLBACK data if the API is unreachable
 *   (e.g. the page is opened as a static file)
 * - 3D tilt cards, scroll-reveal, animated counters, parallax hero
 * - Academics tabs, testimonials carousel, FAQ accordion, gallery lightbox
 * - Multi-step admissions form -> POST /api/admissions (shows reference code)
 * - Contact form -> POST /api/contact
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'alm-lang';
  var lang = 'ar';
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') lang = saved;
  } catch (e) { /* localStorage unavailable (file:// in some browsers) */ }

  var data = {
    stats: window.FALLBACK.stats,
    teachers: window.FALLBACK.teachers,
    news: window.FALLBACK.news,
    events: window.FALLBACK.events,
    gallery: window.FALLBACK.gallery,
  };

  function S() { return window.I18N[lang]; }
  function field(item, base) { return item[base + '_' + lang] || item[base + '_en'] || ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- Language ---------------- */
  function applyLang() {
    var s = S();
    document.documentElement.lang = lang;
    document.documentElement.dir = s._dir;
    document.title = s.title;
    document.getElementById('langBtn').textContent = s._label;
    var backTopBtn = document.getElementById('backTop');
    if (backTopBtn && s.back_top) backTopBtn.setAttribute('aria-label', s.back_top);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = s[el.getAttribute('data-i18n')];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = s[el.getAttribute('data-i18n-html')];
      if (typeof v === 'string') el.innerHTML = v;
    });
    renderAll();
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyLang();
  }

  document.getElementById('langBtn').addEventListener('click', function () {
    setLang(lang === 'ar' ? 'en' : 'ar');
  });

  /* ---------------- Data loading (API + fallback) ---------------- */
  function fetchJson(url) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 3500) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (timer) clearTimeout(timer); return j; });
  }

  function loadData() {
    var jobs = ['stats', 'teachers', 'news', 'events', 'gallery'].map(function (name) {
      return fetchJson('/api/' + name)
        .then(function (j) { if (Array.isArray(j) && j.length) data[name] = j; })
        .catch(function () { /* keep fallback data */ });
    });
    return Promise.all(jobs).then(renderAll);
  }

  /* ---------------- Rendering ---------------- */
  function renderStats() {
    var wrap = document.getElementById('statsBar');
    wrap.innerHTML = data.stats.map(function (st) {
      return '<div class="stat"><b><span class="count" data-target="' + Number(st.value || 0) + '">0</span>' +
        esc(st.suffix || '') + '</b><span>' + esc(field(st, 'label')) + '</span></div>';
    }).join('');
    observeCounters();
  }

  function renderTeachers() {
    document.getElementById('teachersGrid').innerHTML = data.teachers.map(function (t) {
      return '<article class="card tilt"><div class="icon">' + esc(t.icon || '👩‍🏫') + '</div>' +
        '<h3>' + esc(field(t, 'name')) + '</h3><p class="role">' + esc(field(t, 'role')) + '</p>' +
        '<p>' + esc(field(t, 'bio')) + '</p></article>';
    }).join('');
    bindTilt();
  }

  function renderNews() {
    document.getElementById('newsList').innerHTML = data.news.map(function (n) {
      return '<article class="news"><small>📅 ' + esc(n.date || '') + ' • ' + esc(field(n, 'tag')) + '</small>' +
        '<h3>' + esc(field(n, 'title')) + '</h3><p>' + esc(field(n, 'body')) + '</p></article>';
    }).join('');
    document.getElementById('eventsGrid').innerHTML = data.events.map(function (ev) {
      return '<article class="card tilt"><span class="date-pill">📅 ' + esc(field(ev, 'date_label')) + '</span>' +
        '<h3>' + esc(field(ev, 'title')) + '</h3><p>' + esc(field(ev, 'body')) + '</p></article>';
    }).join('');
    bindTilt();
  }

  function renderGallery() {
    document.getElementById('galleryGrid').innerHTML = data.gallery.map(function (g, i) {
      return '<button type="button" class="tile" data-idx="' + i + '" style="background:' + esc(g.color || '#0b6b3a') + '">' +
        '<span>' + esc(g.icon || '🏫') + '</span><small>' + esc(field(g, 'caption')) + '</small></button>';
    }).join('');
    document.querySelectorAll('.tile').forEach(function (tile) {
      tile.addEventListener('click', function () { openLightbox(Number(tile.getAttribute('data-idx'))); });
    });
  }

  function renderAll() {
    renderStats();
    renderTeachers();
    renderNews();
    renderGallery();
    renderTestimonial();
  }

  /* ---------------- Lightbox ---------------- */
  var lightbox = document.getElementById('lightbox');
  function openLightbox(i) {
    var g = data.gallery[i];
    if (!g) return;
    var tile = document.getElementById('lbTile');
    tile.style.background = g.color || '#0b6b3a';
    tile.textContent = g.icon || '🏫';
    document.getElementById('lbCaption').textContent = field(g, 'caption');
    lightbox.classList.remove('hidden');
  }
  function closeLightbox() { lightbox.classList.add('hidden'); }
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  /* ---------------- Testimonials carousel ---------------- */
  var tIndex = 0, tTimer = null;
  function renderTestimonial() {
    var t = window.TESTIMONIALS[tIndex];
    var slide = document.getElementById('carSlide');
    slide.style.opacity = '0';
    setTimeout(function () {
      slide.innerHTML = '<div class="q-icon">' + esc(t.icon) + '</div><blockquote>“' +
        esc(field(t, 'quote')) + '”</blockquote><cite>' + esc(field(t, 'name')) + '</cite>';
      slide.style.opacity = '1';
    }, 180);
    document.getElementById('carDots').innerHTML = window.TESTIMONIALS.map(function (_, i) {
      return '<button type="button" data-dot="' + i + '" class="' + (i === tIndex ? 'active' : '') + '" aria-label="Testimonial ' + (i + 1) + '"></button>';
    }).join('');
    document.querySelectorAll('[data-dot]').forEach(function (d) {
      d.addEventListener('click', function () { tIndex = Number(d.getAttribute('data-dot')); renderTestimonial(); restartAuto(); });
    });
  }
  function stepTestimonial(dir) {
    tIndex = (tIndex + dir + window.TESTIMONIALS.length) % window.TESTIMONIALS.length;
    renderTestimonial();
  }
  function restartAuto() { clearInterval(tTimer); tTimer = setInterval(function () { stepTestimonial(1); }, 6000); }
  document.getElementById('carPrev').addEventListener('click', function () { stepTestimonial(-1); restartAuto(); });
  document.getElementById('carNext').addEventListener('click', function () { stepTestimonial(1); restartAuto(); });

  /* ---------------- Academics tabs ---------------- */
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) {
        x.classList.remove('active');
        x.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      var which = tab.getAttribute('data-tab');
      document.getElementById('panel-primary').classList.toggle('hidden', which !== 'primary');
      document.getElementById('panel-secondary').classList.toggle('hidden', which !== 'secondary');
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0px';
    });
  });

  /* ---------------- Mobile menu / navbar / back-to-top ---------------- */
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  var backTop = document.getElementById('backTop');
  backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  var scene = document.getElementById('scene');
  window.addEventListener('scroll', function () {
    document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 10);
    backTop.classList.toggle('show', window.scrollY > 500);
    if (scene && window.scrollY < 900) {
      scene.style.transform = 'translateY(' + window.scrollY * 0.05 + 'px)';
    }
    document.querySelectorAll('.blob').forEach(function (b, i) {
      b.style.transform = 'translateY(' + window.scrollY * (0.03 + i * 0.02) + 'px)';
    });
    revealInOrAboveViewport();
  }, { passive: true });

  /* ---------------- Reveal + counters ---------------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.02 });
  function revealInOrAboveViewport() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
      if (el.getBoundingClientRect().top <= vh * 0.96) {
        el.classList.add('visible');
        revealIO.unobserve(el);
      }
    });
  }
  document.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });
  window.addEventListener('hashchange', function () { setTimeout(revealInOrAboveViewport, 60); });
  revealInOrAboveViewport();

  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, target = Number(el.getAttribute('data-target')) || 0, n = 0;
      var timer = setInterval(function () {
        n += Math.max(1, Math.ceil(target / 40));
        if (n >= target) { n = target; clearInterval(timer); }
        el.textContent = n;
      }, 28);
      counterIO.unobserve(el);
    });
  }, { threshold: 0.5 });
  function observeCounters() {
    document.querySelectorAll('.count').forEach(function (el) { counterIO.observe(el); });
  }

  /* ---------------- 3D tilt cards ---------------- */
  function bindTilt() {
    document.querySelectorAll('.tilt').forEach(function (card) {
      if (card._tiltBound) return;
      card._tiltBound = true;
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(750px) rotateY(' + (x * 13) + 'deg) rotateX(' + (-y * 13) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------------- Forms: shared helpers ---------------- */
  function postJson(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) { var err = new Error('Request failed'); err.body = body; err.status = r.status; throw err; }
        return body;
      });
    });
  }
  function markInvalid(input, bad) { input.classList.toggle('invalid', !!bad); }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------------- Contact form ---------------- */
  document.getElementById('contactForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = S();
    var name = document.getElementById('cfName');
    var email = document.getElementById('cfEmail');
    var phone = document.getElementById('cfPhone');
    var message = document.getElementById('cfMessage');
    var ok = true;
    markInvalid(name, !(ok = !!name.value.trim() && ok));
    var emailOk = EMAIL_RE.test(email.value.trim());
    markInvalid(email, !emailOk); if (!emailOk) ok = false;
    markInvalid(message, !message.value.trim()); if (!message.value.trim()) ok = false;

    var errBox = document.getElementById('cfError');
    var okBox = document.getElementById('cfSuccess');
    errBox.classList.add('hidden'); okBox.classList.add('hidden');
    if (!ok) { errBox.textContent = s.err_required; errBox.classList.remove('hidden'); return; }

    postJson('/api/contact', { name: name.value.trim(), email: email.value.trim(), phone: phone.value.trim(), message: message.value.trim() })
      .then(function () {
        okBox.classList.remove('hidden');
        e.target.reset();
      })
      .catch(function () {
        errBox.textContent = s.err_server;
        errBox.classList.remove('hidden');
      });
  });

  /* ---------------- Admissions multi-step form ---------------- */
  var afStep = 1;
  var afForm = document.getElementById('admissionsForm');

  function afShowStep() {
    document.querySelectorAll('.form-step').forEach(function (st) {
      st.classList.toggle('hidden', Number(st.getAttribute('data-step')) !== afStep);
    });
    document.querySelectorAll('[data-step-dot]').forEach(function (dot) {
      var d = Number(dot.getAttribute('data-step-dot'));
      dot.classList.toggle('active', d === afStep);
      dot.classList.toggle('done', d < afStep);
    });
    document.getElementById('afBack').classList.toggle('hidden', afStep === 1);
    document.getElementById('afNext').classList.toggle('hidden', afStep === 3);
    document.getElementById('afSubmit').classList.toggle('hidden', afStep !== 3);
    if (afStep === 3) afRenderReview();
  }

  function afValues() {
    return {
      studentName: document.getElementById('afStudentName').value.trim(),
      dob: document.getElementById('afDob').value,
      level: document.getElementById('afLevel').value,
      guardianName: document.getElementById('afGuardianName').value.trim(),
      guardianPhone: document.getElementById('afPhone').value.trim(),
      guardianEmail: document.getElementById('afEmail').value.trim(),
      notes: document.getElementById('afNotes').value.trim(),
    };
  }

  function afValidateStep() {
    var s = S(), v = afValues(), ok = true;
    var errBox = document.getElementById('afError');
    if (afStep === 1) {
      var sn = document.getElementById('afStudentName');
      markInvalid(sn, !v.studentName); if (!v.studentName) ok = false;
      markInvalid(document.getElementById('afLevel'), !v.level); if (!v.level) ok = false;
    }
    if (afStep === 2) {
      var gn = document.getElementById('afGuardianName');
      markInvalid(gn, !v.guardianName); if (!v.guardianName) ok = false;
      var contactOk = !!v.guardianPhone || EMAIL_RE.test(v.guardianEmail);
      markInvalid(document.getElementById('afPhone'), !contactOk);
      markInvalid(document.getElementById('afEmail'), !contactOk || (!!v.guardianEmail && !EMAIL_RE.test(v.guardianEmail)));
      if (!contactOk || (!!v.guardianEmail && !EMAIL_RE.test(v.guardianEmail))) ok = false;
    }
    errBox.classList.toggle('hidden', ok);
    if (!ok) errBox.textContent = s.err_required;
    return ok;
  }

  function afRenderReview() {
    var s = S(), v = afValues();
    var rows = [
      [s.f_student_name, v.studentName],
      [s.f_level, v.level === 'primary' ? s.f_level_primary : s.f_level_secondary],
      [s.f_guardian_name, v.guardianName],
      [s.f_phone, v.guardianPhone || '—'],
      [s.f_email, v.guardianEmail || '—'],
    ];
    if (v.dob) rows.splice(1, 0, [s.f_dob, v.dob]);
    if (v.notes) rows.push([s.f_notes, v.notes]);
    document.getElementById('afReview').innerHTML = rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
    }).join('');
  }

  document.getElementById('afNext').addEventListener('click', function () {
    if (afValidateStep() && afStep < 3) { afStep += 1; afShowStep(); }
  });
  document.getElementById('afBack').addEventListener('click', function () {
    if (afStep > 1) { afStep -= 1; afShowStep(); }
  });

  afForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var s = S();
    var errBox = document.getElementById('afError');
    errBox.classList.add('hidden');
    postJson('/api/admissions', afValues())
      .then(function (res) {
        afForm.classList.add('hidden');
        document.getElementById('stepper').classList.add('hidden');
        document.getElementById('afRefCode').textContent = res.reference || '';
        document.getElementById('afSuccess').classList.remove('hidden');
      })
      .catch(function (err) {
        errBox.textContent = (err && err.status === 400) ? s.err_required : s.err_server;
        errBox.classList.remove('hidden');
      });
  });

  document.getElementById('afAgain').addEventListener('click', function () {
    afForm.reset();
    afForm.classList.remove('hidden');
    document.getElementById('stepper').classList.remove('hidden');
    document.getElementById('afSuccess').classList.add('hidden');
    afStep = 1;
    afShowStep();
  });

  /* ---------------- Init ---------------- */
  applyLang();
  afShowStep();
  bindTilt();
  restartAuto();
  loadData();
})();
