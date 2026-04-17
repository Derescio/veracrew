/* ============================================================
   VeraCrew Homepage — script.js
   Sticky nav · Pricing toggle · Counter animation · Scroll fade-in
   ============================================================ */

(function () {
  'use strict';

  /* ---- Sticky nav ---- */
  const nav = document.getElementById('main-nav');

  function updateNav() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ---- Mobile hamburger ---- */
  const hamburger = document.getElementById('nav-hamburger');

  hamburger.addEventListener('click', function () {
    const isOpen = document.body.classList.toggle('nav-mobile-open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile nav when a link is clicked
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      document.body.classList.remove('nav-mobile-open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---- Pricing toggle ---- */
  const pricingSection = document.getElementById('pricing');
  const billingToggle = document.getElementById('billing-toggle');

  billingToggle.addEventListener('click', function () {
    const isYearly = billingToggle.getAttribute('aria-checked') === 'true';
    const next = isYearly ? 'monthly' : 'yearly';
    billingToggle.setAttribute('aria-checked', String(!isYearly));
    pricingSection.setAttribute('data-billing', next);
  });

  /* ---- Counter animation ---- */
  // Fires once per element when it enters the viewport.
  const counters = document.querySelectorAll('.stat-number[data-target]');
  const counterSeen = new Set();

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const duration = 1600; // ms
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !counterSeen.has(entry.target)) {
          counterSeen.add(entry.target);
          animateCounter(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  counters.forEach(function (el) {
    counterObserver.observe(el);
  });

  /* ---- Scroll fade-in ---- */
  const fadeEls = document.querySelectorAll('.fade-in');

  const fadeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Stop observing once visible — animation fires once
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  fadeEls.forEach(function (el) {
    fadeObserver.observe(el);
  });

  // Elements already in view on load (above the fold)
  // Trigger immediately without waiting for scroll
  fadeEls.forEach(function (el) {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.classList.add('visible');
      fadeObserver.unobserve(el);
    }
  });
})();
