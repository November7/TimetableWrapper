<?php
if (!defined('TIMETABLE_AUTH_VIEW')) { http_response_code(404); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Zaloguj się - Plan lekcji</title>
  <script src="<?= tt_escape($assetBase) ?>scripts/theme.js?v=1.5.0"></script>
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/app.min.css?v=1.5.0">
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/login.css?v=1.5.3">
</head>
<body class="login-page">
  <main class="login-card" aria-labelledby="login-title">
    <div class="login-emblem">
      <img src="<?= tt_escape($assetBase) ?>images/zmse-logo.png?v=1.5.0" alt="Logo ZSME" width="120" height="120">
    </div>
    <h1 id="login-title">Plan lekcji</h1>
    <p class="login-school">ZSME w Tarnowie</p>
    <p class="login-description">Zaloguj się szkolnym kontem Microsoft 365,<br class="login-line-break"> aby przejść do planu.</p>
    <form method="post" action="<?= tt_escape($appUrl) ?>?auth=login">
      <input type="hidden" name="csrf" value="<?= tt_escape($csrf) ?>">
      <button class="login-microsoft" type="submit" aria-label="Zaloguj przez Microsoft 365" title="Zaloguj przez Microsoft 365" <?= $ready ? '' : 'disabled' ?>>
        <span class="login-microsoft-icon" aria-hidden="true">
          <span class="login-microsoft-tile"></span>
          <span class="login-microsoft-tile"></span>
          <span class="login-microsoft-tile"></span>
          <span class="login-microsoft-tile"></span>
        </span>
      </button>
    </form>
    <?php if ($message !== ''): ?>
      <p class="login-message" role="alert"><?= tt_escape($message) ?></p>
    <?php elseif (!$ready): ?>
      <p class="login-message" role="status">Logowanie jest chwilowo niedostępne.</p>
    <?php endif; ?>
    <noscript><p class="login-message">Włącz JavaScript, aby wyświetlać plan i zmieniać motyw.</p></noscript>
    <div class="login-theme">
      <span>Motyw wyświetlania</span>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Przełącz motyw" title="Przełącz motyw">
        <span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-knob"><span id="theme-icon" aria-hidden="true">☀</span></span></span>
      </button>
    </div>
  </main>
  <script src="<?= tt_escape($assetBase) ?>scripts/login.js?v=1.5.1"></script>
</body>
</html>
