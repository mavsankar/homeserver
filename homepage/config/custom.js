// ===== Sankar's Homelab — Dashboard Enhancements =====

(function() {
  // ---- Time-based greeting ----
  const hour = new Date().getHours();
  let greeting;
  if (hour < 6) greeting = "Burning the midnight oil, Sankar?";
  else if (hour < 12) greeting = "Good morning, Sankar";
  else if (hour < 17) greeting = "Good afternoon, Sankar";
  else if (hour < 21) greeting = "Good evening, Sankar";
  else greeting = "Good night, Sankar";

  function applyGreeting(el) {
    if (el.textContent === greeting) return;
    el.textContent = greeting;
  }

  const GREETING_SELECTOR = '.information-widget-greeting span';

  function watchGreeting() {
    const container = document.querySelector('.information-widget-greeting');
    if (!container) return false;

    const span = container.querySelector('span');
    if (span && span.textContent.includes('Hey')) {
      applyGreeting(span);
    }

    const observer = new MutationObserver(() => {
      const s = container.querySelector('span');
      if (s && s.textContent.includes('Hey')) {
        applyGreeting(s);
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return true;
  }

  const poll = setInterval(() => {
    if (watchGreeting()) clearInterval(poll);
  }, 200);
  setTimeout(() => clearInterval(poll), 15000);

  // ---- Smooth entrance for service cards ----
  function initEntrance() {
    const services = document.querySelectorAll(".service");
    if (services.length === 0) return false;

    services.forEach((svc, i) => {
      svc.style.opacity = "0";
      svc.style.transform = "translateY(12px)";
      setTimeout(() => {
        svc.style.transition = "opacity 0.4s ease, transform 0.4s ease";
        svc.style.opacity = "1";
        svc.style.transform = "translateY(0)";
      }, 60 + i * 50);
    });
    return true;
  }

  const servicePoll = setInterval(() => {
    if (initEntrance()) clearInterval(servicePoll);
  }, 200);
  setTimeout(() => clearInterval(servicePoll), 15000);
})();
