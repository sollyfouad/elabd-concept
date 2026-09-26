// Syncs the story <ol>'s --progress CSS var and each dot's data-active to scroll position.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function init() {
  if (reduceMotion.matches) return;

  const ol = document.querySelector('[data-timeline]');
  if (!ol) return;
  ol.dataset.timeline = 'live';

  const dots = [...ol.querySelectorAll('[data-timeline-dot]')];
  let ticking = false;

  function update() {
    ticking = false;
    const rect = ol.getBoundingClientRect();
    const progress = clamp((innerHeight * 0.6 - rect.top) / rect.height, 0, 1);
    ol.style.setProperty('--progress', progress);
    const drawnPx = progress * rect.height;
    for (const dot of dots) {
      const dotCenter = dot.getBoundingClientRect().top - rect.top + dot.offsetHeight / 2;
      if (drawnPx >= dotCenter) dot.setAttribute('data-active', '');
      else dot.removeAttribute('data-active');
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();
}

init();
