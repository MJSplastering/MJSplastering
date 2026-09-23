// MJS Gyprock & Plastering: shared site behaviour

(function () {
  // ---------- Mobile menu ----------
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      menu.hidden = open;
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
