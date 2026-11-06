/* ═══════════════════════════════════════════
   INFINITE VYBEFLIX PORTFOLIO
   ═══════════════════════════════════════════ */

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const CONFIG = {
  WHATSAPP_NUMBER: '254116903500',
  WHATSAPP_CHANNEL: 'https://whatsapp.com/channel/0029Vb7IABxCXC3J7ZFFsk2h',
  EMAIL: 'aevibron@gmail.com',
  GITHUB: 'https://github.com/InfiniteVybeflix',
  LOTTIE_PATH: 'Coding.json',
  PARTICLE_COUNT: 80,
  IS_TOUCH: window.matchMedia('(pointer: coarse)').matches,

  /* ── FORTPESA DONATIONS ─────────────────────────────────────
     Backend deployed on Render: server/ folder
     Health check: https://infinite-vybeflix.onrender.com/api/health
     (no trailing slash — never put any API key in this file) */
  DONATE_API_BASE: 'https://infinite-vybeflix.onrender.com',

  // Donation animation — plain Lottie JSON (no manifest needed)
  DONATE_LOTTIE_PATH: 'lottie/donation.json',
  DONATE_MIN_AMOUNT: 1,
  DONATE_MAX_AMOUNT: 1000000
};

// ═══════════════════════════════════════════
// DOM READY
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initScrollProgress();
  initNav();
  initParticles();
  initTypingEffect();
  initCounters();
  initScrollReveal();
  initTiltCards();
  initLottie();
  initDonateLottie();
  initMagneticButtons();
  initParallax();
  initScrambleText();
});

// ═══════════════════════════════════════════
// CUSTOM CURSOR
// ═══════════════════════════════════════════
function initCursor() {
  if (CONFIG.IS_TOUCH) return;

  const cursor = document.getElementById('cursor');
  const trail = document.getElementById('cursor-trail');
  if (!cursor || !trail) return;

  let mx = 0, my = 0, tx = 0, ty = 0;
  let tmx = 0, tmy = 0, ttx = 0, tty = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
  });

  document.addEventListener('mousedown', () => cursor.classList.add('click'));
  document.addEventListener('mouseup', () => cursor.classList.remove('click'));

  const hoverTargets = document.querySelectorAll('a, button, .magnetic-btn, .tilt-card, input, textarea');
  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });

  function animateCursor() {
    tx += (mx - tx) * 0.15;
    ty += (my - ty) * 0.15;
    cursor.style.left = tx + 'px';
    cursor.style.top = ty + 'px';

    ttx += (mx - ttx) * 0.08;
    tty += (my - tty) * 0.08;
    trail.style.left = ttx + 'px';
    trail.style.top = tty + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();
}

// ═══════════════════════════════════════════
// SCROLL PROGRESS
// ═══════════════════════════════════════════
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = progress + '%';
  }, { passive: true });
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
      document.body.style.overflow = links.classList.contains('active') ? 'hidden' : '';
    });

    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        links.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ═══════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;
  let isVisible = true;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const count = CONFIG.IS_TOUCH ? 30 : CONFIG.PARTICLE_COUNT;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1
    });
  }

  function draw() {
    if (!isVisible) { animationId = requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${p.opacity})`;
      ctx.fill();

      // Connect nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(212,175,55,${0.05 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    });

    animationId = requestAnimationFrame(draw);
  }

  // Visibility check
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
  });

  draw();
}

// ═══════════════════════════════════════════
// TYPING EFFECT
// ═══════════════════════════════════════════
function initTypingEffect() {
  const el = document.getElementById('hero-subtitle');
  if (!el) return;

  const phrases = [
    'AI Architect & Full-Stack Developer',
    'Building the impossible as my default branch',
    'Designing intelligence, engineering reality',
    'Founder of Aevibron',
    'Aevibron — where the impossible ships'
  ];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let pause = 0;

  function type() {
    const current = phrases[phraseIndex];

    if (isDeleting) {
      el.textContent = current.substring(0, charIndex - 1);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex + 1);
      charIndex++;
    }

    let speed = isDeleting ? 30 : 60;

    if (!isDeleting && charIndex === current.length) {
      speed = 2000;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      speed = 500;
    }

    setTimeout(type, speed);
  }

  setTimeout(type, 800);
}

// ═══════════════════════════════════════════
// COUNTERS
// ═══════════════════════════════════════════
function initCounters() {
  const counters = document.querySelectorAll('.hero-stat-num[data-target]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

function animateCounter(el, target) {
  let current = 0;
  const increment = target / 60;
  const duration = 2000;
  const stepTime = duration / 60;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current) + (target >= 100 ? '+' : '');
  }, stepTime);
}

// ═══════════════════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════════════════
function initScrollReveal() {
  const revealElements = document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-scale,' +
    '.reveal-3d-up, .reveal-3d-left, .reveal-3d-right, .reveal-3d-scale'
  );

  if (!revealElements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════
// 3D TILT CARDS
// ═══════════════════════════════════════════
function initTiltCards() {
  if (CONFIG.IS_TOUCH) return;

  const cards = document.querySelectorAll('[data-tilt]');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / centerY * -8;
      const rotateY = (x - centerX) / centerX * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;

      // Update CSS variables for radial gradient
      card.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    });
  });
}

// ═══════════════════════════════════════════
// LOTTIE
// ═══════════════════════════════════════════
function initLottie() {
  const container = document.getElementById('lottie-coding');
  if (!container || typeof lottie === 'undefined') return;

  try {
    lottie.loadAnimation({
      container: container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: CONFIG.LOTTIE_PATH
    });
  } catch (e) {
    console.warn('Lottie failed to load:', e);
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gold);font-size:48px;"><i class="fas fa-code"></i></div>';
  }
}

// ═══════════════════════════════════════════
// MAGNETIC BUTTONS
// ═══════════════════════════════════════════
function initMagneticButtons() {
  if (CONFIG.IS_TOUCH) return;

  const buttons = document.querySelectorAll('.magnetic-btn');

  buttons.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
}

// ═══════════════════════════════════════════
// PARALLAX
// ═══════════════════════════════════════════
function initParallax() {
  if (CONFIG.IS_TOUCH) return;

  const elements = document.querySelectorAll('[data-parallax]');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    elements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      el.style.transform = `translateY(${scrollY * speed * 0.1}px)`;
    });
  }, { passive: true });
}

// ═══════════════════════════════════════════
// SCRAMBLE TEXT
// ═══════════════════════════════════════════
function initScrambleText() {
  const elements = document.querySelectorAll('.scramble-text');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  elements.forEach(el => {
    const original = el.dataset.text || el.textContent;
    let iteration = 0;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const interval = setInterval(() => {
          el.textContent = original
            .split('')
            .map((char, index) => {
              if (index < iteration) return original[index];
              if (char === ' ') return ' ';
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

          if (iteration >= original.length) {
            clearInterval(interval);
          }
          iteration += 1 / 3;
        }, 30);
        observer.unobserve(el);
      }
    });

    observer.observe(el);
  });
}

// ═══════════════════════════════════════════
// LIGHTBOX
// ═══════════════════════════════════════════
function openLightbox(src, caption) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');

  if (!lightbox || !img) return;

  img.src = src;
  img.alt = caption || '';
  if (cap) cap.textContent = caption || '';

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

// Close lightbox on Escape
 document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeApiModal();
    closeDonateModal();
  }
});

// ═══════════════════════════════════════════
// API MODAL
// ═══════════════════════════════════════════
function openApiModal() {
  const modal = document.getElementById('api-modal');
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeApiModal() {
  const modal = document.getElementById('api-modal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function requestApiKey() {
  const textarea = document.getElementById('api-usecase');
  const usecase = textarea ? textarea.value.trim() : '';

  const message = usecase
    ? `Hi Aevibron, I would like to request an API key for the Aevibron Gateway.\n\nMy use case: ${usecase}`
    : `Hi Aevibron, I would like to request an API key for the Aevibron Gateway.`;

  const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  closeApiModal();
  showToast('Redirecting to WhatsApp...');
}

// ═══════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════
function sendMessage() {
  const name = document.getElementById('form-name')?.value.trim() || '';
  const email = document.getElementById('form-email')?.value.trim() || '';
  const message = document.getElementById('form-message')?.value.trim() || '';

  if (!name && !email && !message) {
    showToast('Please fill in at least one field');
    return;
  }

  const text = `Hi Aevibron, I visited your portfolio and wanted to connect!\n\nName: ${name || 'Not provided'}\nEmail: ${email || 'Not provided'}\nMessage: ${message || 'No message'}`;
  const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  showToast('Opening WhatsApp...');
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ═══════════════════════════════════════════
// DONATE — FORTPESA M-PESA STK PUSH
// ═══════════════════════════════════════════
let donatePollTimer = null;

function initDonateLottie() {
  const container = document.getElementById('support-lottie-player');
  if (!container || typeof lottie === 'undefined') return;

  // Plays the plain Lottie JSON (lottie/donation.json) with the lottie-web
  // library already loaded for Coding.json — no dotLottie packaging,
  // no manifest, no fallback needed.
  lottie.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: CONFIG.DONATE_LOTTIE_PATH
  });
}

/** Header "Donate" button — glide down to the Support section and pulse it. */
function goToSupport(e) {
  if (e) e.preventDefault();
  const sec = document.getElementById('support');
  if (!sec) return;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const card = sec.querySelector('.support-card');
  if (card) {
    card.classList.remove('support-attention');
    void card.offsetWidth; // restart the animation
    card.classList.add('support-attention');
    setTimeout(() => card.classList.remove('support-attention'), 2600);
  }
}

function openDonateModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('donate-modal');
  if (!modal) return;

  resetDonateUI();
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('donate-amount')?.focus(), 300);
}

function closeDonateModal() {
  const modal = document.getElementById('donate-modal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  stopDonatePolling();
}

function resetDonateUI() {
  stopDonatePolling();
  const form = document.getElementById('donate-form');
  const status = document.getElementById('donate-status');
  if (form) { form.style.display = ''; form.reset(); }
  if (status) status.hidden = true;
  setDonateSubmitting(false);
}

function setDonateSubmitting(busy) {
  const btn = document.getElementById('donate-submit');
  const icon = document.getElementById('donate-submit-icon');
  const text = document.getElementById('donate-submit-text');
  if (!btn) return;
  btn.disabled = busy;
  if (icon) icon.className = busy ? 'fas fa-circle-notch fa-spin' : 'fas fa-bolt';
  if (text) text.textContent = busy ? 'Sending prompt…' : 'Send STK Push';
}

/** Accepts 07.., 7.., +254.., 254.. → returns 2547XXXXXXXX / 2541XXXXXXXX or null */
function normalizeKenyanPhone(input) {
  let d = String(input || '').replace(/\D+/g, '');
  if (d.startsWith('0')) d = '254' + d.slice(1);
  else if ((d.startsWith('7') || d.startsWith('1')) && d.length === 9) d = '254' + d;
  if (!/^254(7\d{8}|1\d{8})$/.test(d)) return null;
  return d;
}

function showDonateStatus(kind, title, detail) {
  const form = document.getElementById('donate-form');
  const status = document.getElementById('donate-status');
  const icon = document.getElementById('donate-status-icon');
  const glyph = document.getElementById('donate-status-glyph');
  const titleEl = document.getElementById('donate-status-title');
  const detailEl = document.getElementById('donate-status-detail');
  const timebar = document.getElementById('donate-timebar');
  if (!status || !icon || !titleEl || !detailEl) return;

  if (form) form.style.display = 'none';
  status.hidden = false;
  status.dataset.state = kind;   // drives the step timeline via CSS

  const glyphs = {
    pending: '',
    success: '<i class="fas fa-check"></i>',
    failed: '<i class="fas fa-xmark"></i>'
  };
  icon.className = 'donate-status-icon ' + kind;
  if (glyph) glyph.innerHTML = glyphs[kind] ?? '';
  titleEl.textContent = title;
  detailEl.textContent = detail;

  // restart the 2-minute prompt window bar on each new pending state
  if (timebar) {
    timebar.classList.remove('run');
    if (kind === 'pending') { void timebar.offsetWidth; timebar.classList.add('run'); }
  }
}

function stopDonatePolling() {
  if (donatePollTimer) { clearInterval(donatePollTimer); donatePollTimer = null; }
}

function startDonatePolling(uuid, amount) {
  stopDonatePolling();
  const INTERVAL = 3000;
  const TIMEOUT = 120000; // M-Pesa prompts expire well before this
  let elapsed = 0;

  donatePollTimer = setInterval(async () => {
    elapsed += INTERVAL;

    if (elapsed > TIMEOUT) {
      stopDonatePolling();
      showDonateStatus('failed', 'Prompt expired',
        'No payment was received in time. Open the donate button to try again.');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.DONATE_API_BASE}/api/donate/status/${encodeURIComponent(uuid)}`);
      if (!res.ok) return; // transient error — keep polling
      const body = await res.json().catch(() => ({}));

      if (body.status === 'success') {
        stopDonatePolling();
        showDonateStatus('success', 'Asante sana!',
          `KES ${amount} received — you just fueled the vision. Nothing is impossible.`);
      } else if (body.status === 'failed') {
        stopDonatePolling();
        const reasons = {
          cancelled: 'You cancelled the M-Pesa prompt. Open the donate button to try again.',
          expired: 'The M-Pesa prompt expired before it was completed. Please try again.',
          failed: 'The payment did not go through. Please try again.'
        };
        showDonateStatus('failed', 'Payment not completed',
          reasons[body.raw_status] || 'The payment did not go through. Please try again.');
      }
      // still pending → keep polling
    } catch (e) {
      /* network hiccup — keep polling */
    }
  }, INTERVAL);
}

async function submitDonation() {
  const amountEl = document.getElementById('donate-amount');
  const phoneEl = document.getElementById('donate-phone');

  if (!CONFIG.DONATE_API_BASE) {
    showToast('Online donations are being set up — check back soon.');
    return;
  }

  const amount = Number(amountEl ? amountEl.value : NaN);
  if (!Number.isInteger(amount) || amount < CONFIG.DONATE_MIN_AMOUNT || amount > CONFIG.DONATE_MAX_AMOUNT) {
    showToast(`Enter a whole amount between KES ${CONFIG.DONATE_MIN_AMOUNT} and KES ${CONFIG.DONATE_MAX_AMOUNT}.`);
    amountEl?.focus();
    return;
  }

  const phone = normalizeKenyanPhone(phoneEl ? phoneEl.value : '');
  if (!phone) {
    showToast('Enter a valid Kenyan number, e.g. 0712 345 678.');
    phoneEl?.focus();
    return;
  }

  setDonateSubmitting(true);

  try {
    const res = await fetch(`${CONFIG.DONATE_API_BASE}/api/donate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone })
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body?.error?.message || 'Could not send the STK push. Please try again.');
    }

    showDonateStatus('pending', 'Check your phone…',
      `M-Pesa prompt sent for KES ${amount} to ${body.phone || phone}. Enter your PIN to complete the donation.`);
    startDonatePolling(body.uuid, amount);
  } catch (err) {
    showToast(err.message || 'Something went wrong. Please try again.');
  } finally {
    setDonateSubmitting(false);
  }
}
