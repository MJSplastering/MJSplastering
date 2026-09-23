// MJS Gyprock & Plastering: shared site behaviour

(function () {
  // ---------- Mobile menu ----------
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      menu.classList.toggle('is-open', !open);
      toggle.setAttribute('aria-expanded', String(!open));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function (mq) {
      if (mq.matches) closeMenu();
    });
  }

  // ---------- One-time photo reveal (progressive enhancement) ----------
  // Only photos that start below the fold are dimmed, and only when motion is allowed.
  // Without JavaScript, or with reduced motion, every photo simply shows as normal.
  // A photo is revealed once its top has reached the lower part of the viewport, including
  // when the visitor has already scrolled or jumped past it, so nothing stays dimmed.
  var motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pending = [];
  if (motionOK) {
    document.querySelectorAll('[data-reveal] img').forEach(function (img) {
      if (img.getBoundingClientRect().top > window.innerHeight) {
        img.classList.add('pre-reveal');
        pending.push(img);
      }
    });
  }

  if (pending.length) {
    var sweep = function () {
      var limit = window.innerHeight * 0.92;
      pending = pending.filter(function (img) {
        if (img.getBoundingClientRect().top >= limit) return true;
        img.classList.add('revealed');
        void img.offsetWidth; // commit the dimmed state so the change below transitions
        img.classList.remove('pre-reveal');
        return false;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', sweep);
        window.removeEventListener('resize', sweep);
      }
    };
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    sweep();
  }

  // ---------- GA4 conversion click tracking ----------
  // Only two events exist:
  //   phone_click {phone_number, location}  on tel: links that carry data-location
  //   cta_click   {cta_name, location}      on elements that carry data-cta
  // Nothing here prevents or delays the click's default action.
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a[href^="tel:"][data-location], [data-cta]');
    if (!el || typeof window.gtag !== 'function') return;

    var location = el.getAttribute('data-location') || 'unknown';

    if (el.matches('a[href^="tel:"]')) {
      window.gtag('event', 'phone_click', {
        phone_number: el.getAttribute('href').slice(4),
        location: location
      });
    }
    if (el.hasAttribute('data-cta')) {
      window.gtag('event', 'cta_click', {
        cta_name: el.getAttribute('data-cta'),
        location: location
      });
    }
  });
})();
