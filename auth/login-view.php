<?php
if (!defined('TIMETABLE_AUTH_VIEW')) { http_response_code(404); exit; }
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Zaloguj się — Plan lekcji</title>
  <script src="<?= tt_escape($assetBase) ?>scripts/theme.js?v=1.0.0"></script>
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/app.min.css?v=1.4.8">
  <link rel="stylesheet" href="<?= tt_escape($assetBase) ?>css/login.css?v=1.0.0">
</head>
<body class="login-page">
  <main class="login-card" aria-labelledby="login-title">
    <div class="login-emblem" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2"/></svg>
    </div>
    <h1 id="login-title">Plan lekcji</h1>
    <p class="login-description">Twój plan w jednym miejscu.<br>Zaloguj się kontem swojej organizacji.</p>
    <form method="post" action="<?= tt_escape($appUrl) ?>?auth=login">
      <input type="hidden" name="csrf" value="<?= tt_escape($csrf) ?>">
      <button class="login-microsoft" type="submit" <?= $ready ? '' : 'disabled' ?>>
        <svg viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#7fba00" d="M11 0h10v10H11z"/><path fill="#00a4ef" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg>
        <span>Zaloguj przez Microsoft 365</span>
      </button>
    </form>
    <div class="login-theme">
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Przełącz motyw" title="Przełącz motyw">
        <span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-knob"><span id="theme-icon" aria-hidden="true">☀</span></span></span>
      </button>
    </div>
    <?php if ($message !== ''): ?>
      <p class="login-message" role="alert"><?= tt_escape($message) ?></p>
    <?php elseif (!$ready): ?>
      <p class="login-message" role="status">Logowanie jest chwilowo niedostępne.</p>
    <?php endif; ?>
    <noscript><p class="login-message">Włącz JavaScript, aby wyświetlać plan i zmieniać motyw.</p></noscript>
  </main>
  <script src="<?= tt_escape($assetBase) ?>scripts/login.js?v=1.0.0"></script>
</body>
</html>
