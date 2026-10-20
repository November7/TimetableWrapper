<?php
declare(strict_types=1);

function tt_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function tt_config(): ?array
{
    $path = getenv('TIMETABLE_AUTH_CONFIG') ?: __DIR__ . '/config.php';
    if (!is_file($path)) {
        return null;
    }
    $config = require $path;
    if (!is_array($config)) {
        throw new RuntimeException('Invalid auth configuration.');
    }
    $uuid = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
    foreach (['tenant_id', 'client_id'] as $key) {
        if (!is_string($config[$key] ?? null) || !preg_match($uuid, $config[$key])) {
            throw new RuntimeException('Missing or invalid ' . $key);
        }
    }
    if (!is_string($config['client_secret'] ?? null) || $config['client_secret'] === '') {
        throw new RuntimeException('Missing client secret.');
    }
    $url = is_string($config['app_url'] ?? null) ? parse_url($config['app_url']) : false;
    if (!$url || ($url['scheme'] ?? '') !== 'https' || empty($url['host'])
        || !str_ends_with($url['path'] ?? '', '/index.php')
        || isset($url['query']) || isset($url['fragment']) || isset($url['user']) || isset($url['pass'])) {
        throw new RuntimeException('app_url must be the HTTPS URL of index.php.');
    }
    foreach (['plan_dir', 'archive_dir'] as $key) {
        if (!is_string($config[$key] ?? null) || $config[$key] === '') {
            throw new RuntimeException('Missing source directory: ' . $key);
        }
    }
    $config['tenant_id'] = strtolower($config['tenant_id']);
    $config['session_seconds'] = max(300, min(28800, (int) ($config['session_seconds'] ?? 3600)));
    $config['required_role'] = (string) ($config['required_role'] ?? '');
    return $config;
}

function tt_start_session(string $cookiePath): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('tt_' . substr(hash('sha256', __DIR__), 0, 16));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $cookiePath,
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax', // OIDC returns via a top-level GET.
    ]);
    if (!session_start()) {
        throw new RuntimeException('Session could not be started.');
    }
    $_SESSION['tt_csrf'] ??= bin2hex(random_bytes(32));
}

function tt_csrf_valid(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
        && is_string($_POST['csrf'] ?? null)
        && hash_equals($_SESSION['tt_csrf'], $_POST['csrf']);
}

function tt_has_access(?array $config): bool
{
    $user = $_SESSION['tt_user'] ?? null;
    return $config !== null && is_array($user)
        && ($user['expires'] ?? 0) > time()
        && ($user['tenant'] ?? '') === $config['tenant_id']
        && ($user['client'] ?? '') === $config['client_id']
        && ($config['required_role'] === '' || in_array($config['required_role'], $user['roles'] ?? [], true));
}

function tt_oidc(array $config): \Jumbojett\OpenIDConnectClient
{
    require_once __DIR__ . '/vendor/autoload.php';
    $issuer = 'https://login.microsoftonline.com/' . $config['tenant_id'] . '/v2.0';
    $oidc = new \Jumbojett\OpenIDConnectClient($issuer, $config['client_id'], $config['client_secret']);
    $oidc->setRedirectURL($config['app_url'] . '?auth=callback');
    $oidc->setCodeChallengeMethod('S256');
    // Microsoft's metadata may omit PKCE despite supporting S256.
    $oidc->providerConfigParam(['code_challenge_methods_supported' => ['S256']]);
    $oidc->setTokenEndpointAuthMethodsSupported(['client_secret_post']);
    $oidc->addScope(['openid', 'profile']);
    $oidc->addAuthParam(['response_mode' => 'query', 'prompt' => 'select_account']);
    $oidc->setIssuerValidator(static fn (string $value): bool => $value === $issuer);
    $oidc->setTimeout(20);
    return $oidc;
}

/** Called only with claims already cryptographically verified by the OIDC library. */
function tt_user_from_claims(object $claims, array $config, string $expectedNonce): array
{
    $roles = is_array($claims->roles ?? null) ? $claims->roles : [];
    if (($claims->tid ?? '') !== $config['tenant_id'] || empty($claims->sub)
        || $expectedNonce === '' || !is_string($claims->nonce ?? null) || !hash_equals($expectedNonce, $claims->nonce)
        || !is_int($claims->exp ?? null)
        || ($claims->exp ?? 0) <= time()
        || ($config['required_role'] !== '' && !in_array($config['required_role'], $roles, true))) {
        throw new RuntimeException('Account is not authorized for this timetable.');
    }
    return [
        'subject' => $claims->sub,
        'tenant' => $config['tenant_id'],
        'client' => $config['client_id'],
        'roles' => $roles,
        'expires' => min((int) $claims->exp, time() + $config['session_seconds']),
    ];
}

function tt_redirect(string $url): never
{
    header('Location: ' . $url, true, 303);
    exit;
}

function tt_error(int $status, string $message): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}
