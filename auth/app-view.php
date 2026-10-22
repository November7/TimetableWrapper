<?php
if (!defined('TIMETABLE_AUTH_VIEW')) { http_response_code(404); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="Nowoczesny podgląd planu lekcji bez ramek.">
  <title>Plan lekcji</title>
  <script src="<?= tt_escape($assetBase) ?>scripts/theme.js?v=1.5.2"></script>
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/app.min.css?v=1.5.2" type="text/css">
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/login.css?v=1.5.2" type="text/css">
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h1>Plan lekcji</h1>
        <label class="plan-select-wrap" for="plan-source-select">
          <span>Wersja planu</span>
          <select id="plan-source-select" aria-label="Wybierz wersję planu"></select>
        </label>
      </div>
      <label class="search-wrap" for="search-input">
        <span>Szukaj</span>
        <input id="search-input" type="search" placeholder="np. 1TA, SG, 41" autocomplete="off">
      </label>
      <div class="tabs" role="tablist" aria-label="Kategorie planów">
        <button class="tab active" data-category="oddzialy" role="tab" aria-selected="true">Oddziały</button>
        <button class="tab" data-category="nauczyciele" role="tab" aria-selected="false">Nauczyciele</button>
        <button class="tab" data-category="sale" role="tab" aria-selected="false">Sale</button>
      </div>
      <ul id="item-list" class="item-list" aria-live="polite"></ul>
    </aside>
    <main class="content">
      <header class="content-header">
        <button id="menu-toggle" class="menu-toggle" type="button" aria-expanded="false" aria-controls="sidebar" aria-label="Pokaż menu">☰</button>
        <div class="title-wrap">
          <h2 id="plan-title">Wczytywanie planu...</h2>
          <p id="plan-meta" class="meta">Trwa odczyt danych z plików źródłowych.</p>
        </div>
        <div class="header-actions">
          <div class="font-controls" role="group" aria-label="Rozmiar czcionki planu">
            <button id="font-decrease" class="font-toggle" type="button" aria-label="Zmniejsz czcionkę planu" title="Zmniejsz czcionkę">A</button>
            <button id="font-increase" class="font-toggle" type="button" aria-label="Powiększ czcionkę planu" title="Powiększ czcionkę">A</button>
          </div>
          <button id="print-plan" class="header-icon-button" type="button" aria-label="Drukuj aktualnie wyświetlony plan" title="Drukuj aktualnie wyświetlony plan"><span aria-hidden="true">&#128438;</span></button>
          <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Przełącz motyw" title="Przełącz motyw">
            <span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-knob"><span id="theme-icon" aria-hidden="true">☀</span></span></span>
          </button>
          <form class="auth-logout" method="post" action="<?= tt_escape($appUrl) ?>?auth=logout">
            <input type="hidden" name="csrf" value="<?= tt_escape($csrf) ?>">
            <button class="header-icon-button" type="submit" aria-label="Wyloguj z planu" title="Wyloguj z planu">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 17l5-5-5-5m5 5H3"/>
                <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>
              </svg>
            </button>
          </form>
        </div>
      </header>
      <section id="schedule" class="schedule" aria-live="polite"></section>
      <div class="content-footer">
        <div id="label-controls" class="label-controls" aria-live="polite"></div>
        <footer id="generated-info" class="generated-info" aria-live="polite"></footer>
      </div>
    </main>
  </div>
  <script src="<?= tt_escape($assetBase) ?>scripts/map.js"></script>
  <script>
    window.TIMETABLE_SIDEBAR_COLLAPSE_WIDTH = 1200;
    window.TIMETABLE_PLAN_ROOT = <?= json_encode($basePath . 'index.php/source/plan', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    window.TIMETABLE_ARCHIVE_ROOT = <?= json_encode($basePath . 'index.php/source/stareplany', JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    window.TIMETABLE_LOGIN_URL = <?= json_encode($appUrl, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  </script>
  <script src="<?= tt_escape($assetBase) ?>scripts/app.min.js?v=1.5.2"></script>
</body>
</html>
