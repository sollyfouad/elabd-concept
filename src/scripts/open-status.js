// Home only: turns each [data-open-status] label from the static opening hours into a live
// "Open now · 10:42 PM in Cairo". Without JS the static hours text stays.
import { isOpenInCairo, cairoClock } from '../lib/open-hours.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
const labels = [...document.querySelectorAll('[data-open-status]')];

function render() {
  const now = new Date();
  for (const el of labels) {
    const hours = JSON.parse(el.dataset.hours);
    const open = isOpenInCairo(now, hours);
    const state = open ? el.dataset.open : el.dataset.closed;
    const time = el.dataset.time.replace('{time}', cairoClock(now, lang));
    el.dataset.state = open ? 'open' : 'closed';
    el.querySelector('[data-open-text]').textContent = `${state} · ${time}`;
  }
}

if (labels.length) {
  render();
  setInterval(render, 30_000);
}
