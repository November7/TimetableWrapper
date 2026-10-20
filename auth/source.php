<?php
declare(strict_types=1);

/** Resolve only allowlisted roots; realpath also prevents escaping via symlinks. */
function tt_source_path(string $path, array $config): ?string
{
    if ($path === '' || preg_match('/[\\\\\x00-\x1f\x7f:%]/', $path)) {
        return null;
    }
    $parts = explode('/', trim($path, '/'));
    $rootKey = array_shift($parts);
    $setting = ['plan' => 'plan_dir', 'stareplany' => 'archive_dir'][$rootKey] ?? null;
    if ($setting === null) {
        return null;
    }
    foreach ($parts as $part) {
        if ($part === '' || str_starts_with($part, '.') || str_ends_with($part, '.') || str_ends_with($part, ' ')) {
            return null;
        }
    }
    $root = realpath($config[$setting]);
    if ($root === false || !is_dir($root)) {
        return null;
    }
    $resolved = realpath($root . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $parts));
    if ($resolved === false || ($resolved !== $root && !str_starts_with($resolved, $root . DIRECTORY_SEPARATOR))) {
        return null;
    }
    return $resolved;
}

function tt_serve_source(string $path, array $config): never
{
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) {
        header('Allow: GET, HEAD');
        tt_error(405, 'Niedozwolona metoda.');
    }
    $file = tt_source_path($path, $config);
    if ($file === null) {
        tt_error(404, 'Nie znaleziono pliku.');
    }
    if (is_dir($file) && !str_ends_with($path, '/')) {
        $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));
        tt_redirect($config['app_url'] . '/source/' . $encodedPath . '/');
    }
    // Original HTML is readable and navigable, but may not execute scripts or submit forms.
    header("Content-Security-Policy: sandbox allow-same-origin; default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
    if (trim($path, '/') === 'stareplany' && is_dir($file)) {
        header('Content-Type: text/html; charset=utf-8');
        if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
        echo '<!doctype html><html lang="pl"><meta charset="utf-8"><title>Archiwum planów</title><ul>';
        foreach (scandir($file) ?: [] as $name) {
            if (str_starts_with($name, '.')) continue;
            $child = tt_source_path('stareplany/' . $name, $config);
            if ($child !== null && is_dir($child)) {
                echo '<li><a href="' . tt_escape(rawurlencode($name)) . '/">' . tt_escape($name) . '</a></li>';
            }
        }
        echo '</ul></html>';
        exit;
    }
    if (is_dir($file)) {
        $file = tt_source_path(rtrim($path, '/') . '/index.html', $config);
    }
    $types = [
        'html' => 'text/html', 'htm' => 'text/html', 'css' => 'text/css',
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
    ];
    $type = $file !== null ? ($types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? null) : null;
    if ($type === null || !is_file($file) || !is_readable($file)) {
        tt_error(404, 'Nie znaleziono pliku.');
    }
    // Preserve the original encoding of Vulcan HTML, declared in its meta tag.
    ini_set('default_charset', '');
    header('Content-Type: ' . $type);
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($file);
    exit;
}
