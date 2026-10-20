(() => {
  "use strict";

  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  const readSaved = () => {
    try { return localStorage.getItem("theme"); } catch { return null; }
  };
  const initial = () => {
    const saved = readSaved();
    return saved === "light" || saved === "dark" ? saved : (preference.matches ? "dark" : "light");
  };
  function apply(theme, persist = true) {
    const dark = theme === "dark";
    theme = dark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    if (persist) {
      try { localStorage.setItem("theme", theme); } catch { /* Storage can be disabled. */ }
    }
    const toggle = document.getElementById("theme-toggle");
    const icon = document.getElementById("theme-icon");
    if (icon) icon.textContent = dark ? "☾" : "☀";
    if (toggle) {
      toggle.setAttribute("aria-label", dark ? "Przełącz na motyw jasny" : "Przełącz na motyw ciemny");
      toggle.title = dark ? "Motyw jasny" : "Motyw ciemny";
      toggle.setAttribute("aria-pressed", String(dark));
    }
  }
  window.TimetableTheme = {
    setup: () => apply(initial(), false),
    apply,
    toggle: () => apply(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark")
  };
  apply(initial(), false);
  window.addEventListener("storage", (event) => {
    if (event.key === "theme" || event.key === null) apply(initial(), false);
  });
  preference.addEventListener("change", () => {
    if (!readSaved()) apply(initial(), false);
  });
})();
