// Pauses the best-sellers marquee on touch, since iOS does not apply :active reliably.
let timer = null;

function resume(shelf) {
  clearTimeout(timer);
  timer = setTimeout(() => shelf.removeAttribute('data-paused'), 3000);
}

document.querySelectorAll('[data-shelf]').forEach((shelf) => {
  shelf.addEventListener('touchstart', () => {
    clearTimeout(timer);
    shelf.setAttribute('data-paused', '');
  }, { passive: true });
  shelf.addEventListener('touchend', () => resume(shelf), { passive: true });
  shelf.addEventListener('touchcancel', () => resume(shelf), { passive: true });
});
