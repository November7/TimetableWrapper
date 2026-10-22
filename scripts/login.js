window.TimetableTheme.setup();
document.getElementById("theme-toggle").addEventListener("click", window.TimetableTheme.toggle);

// Illuminate only the logo's cut-out edges; native form submission is preserved.
(() => {
  const button = document.querySelector('.login-microsoft');
  if (!button) return;
  const tiles = [...button.querySelectorAll('.login-microsoft-tile')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function moveLight(x, y) {
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      tile.style.setProperty('--light-x', `${x - rect.left}px`);
      tile.style.setProperty('--light-y', `${y - rect.top}px`);
    }
  }
  function centerLight() {
    const rect = button.getBoundingClientRect();
    moveLight(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  button.addEventListener('pointermove', event => {
    if (!button.disabled && !reducedMotion.matches) moveLight(event.clientX, event.clientY);
  });
  button.addEventListener('pointerleave', centerLight);
  button.addEventListener('focus', centerLight);
  window.addEventListener('resize', centerLight);
  centerLight();
})();
