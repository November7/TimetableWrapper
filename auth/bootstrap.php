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
    $config['session_seconds'] = max(300, min(2592000, (int) ($config['session_seconds'] ?? 604800)));
    $config['required_role'] = (string) ($config['required_role'] ?? '');
    return $config;
}

function tt_start_session(string $cookiePath, int $lifetime = 604800): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    // Isolate file sessions from other apps and host cleanup using shorter lifetimes.
    if (ini_get('session.save_handler') === 'files') {
        $sessionDir = sys_get_temp_dir() . '/timetable-sessions-' . substr(hash('sha256', __DIR__), 0, 16);
        if (!is_dir($sessionDir) && !mkdir($sessionDir, 0700, true) && !is_dir($sessionDir)) {
            throw new RuntimeException('Session directory could not be created.');
        }
        session_save_path($sessionDir);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
    }
    session_name('tt_' . substr(hash('sha256', __DIR__), 0, 16));
    session_set_cookie_params([
        'lifetime' => $lifetime,
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

/** Validate the callback before exchanging a code; never report query values. */
function tt_validate_callback(array $query, string $method, array $session): void
{
    if ($method !== 'GET' || !is_string($query['state'] ?? null) || $query['state'] === '') {
        throw new RuntimeException('TT_CALLBACK');
    }
    if (!is_string($session['openid_connect_state'] ?? null) || $session['openid_connect_state'] === '') {
        throw new RuntimeException('TT_SESSION_MISSING');
    }
    if (!hash_equals($session['openid_connect_state'], $query['state'])) {
        throw new RuntimeException('TT_STATE');
    }
    if (($session['tt_login_started'] ?? 0) < time() - 600) {
        throw new RuntimeException('TT_LOGIN_EXPIRED');
    }
    if (isset($query['error'])) {
        $description = is_string($query['error_description'] ?? null) ? $query['error_description'] : '';
        preg_match('/\bAADSTS[0-9]{4,9}\b/', $description, $matches);
        throw new RuntimeException($matches[0] ?? 'TT_MICROSOFT');
    }
    if (!is_string($query['code'] ?? null) || $query['code'] === '') {
        throw new RuntimeException('TT_CALLBACK');
    }
}

/** Only allowlisted descriptions and numeric provider codes may leave PHP. */
function tt_auth_failure(Throwable $error): array
{
    $messages = [
        'TT_CALLBACK' => 'Odpowiedź logowania jest niekompletna. Rozpocznij logowanie ponownie.',
        'TT_SESSION_MISSING' => 'Nie odnaleziono sesji rozpoczętego logowania. Spróbuj ponownie od strony planu.',
        'TT_STATE' => 'Odpowiedź nie pasuje do rozpoczętego logowania. Spróbuj ponownie w jednej karcie.',
        'TT_LOGIN_EXPIRED' => 'Upłynął czas na dokończenie logowania. Spróbuj ponownie.',
        'TT_MICROSOFT' => 'Microsoft nie zakończył logowania. Spróbuj ponownie lub skontaktuj się z administratorem.',
        'TT_TENANT' => 'To konto nie należy do katalogu organizacji dopuszczonego do planu.',
        'TT_ROLE' => 'Twoje konto nie ma roli wymaganej do dostępu do planu.',
        'TT_NONCE' => 'Nie udało się powiązać potwierdzenia Microsoft z sesją. Rozpocznij logowanie ponownie.',
        'TT_TOKEN_TIME' => 'Potwierdzenie logowania jest nieważne lub wygasło. Spróbuj ponownie.',
        'TT_TOKEN_CLAIMS' => 'Nie udało się zweryfikować danych potwierdzenia logowania.',
        'TT_TOKEN_SIGNATURE' => 'Nie udało się zweryfikować podpisu potwierdzenia logowania.',
        'TT_SESSION_SAVE' => 'Serwer nie mógł zapisać sesji logowania. Skontaktuj się z administratorem.',
        'TT_PHP' => 'Wystąpił błąd po stronie serwera aplikacji. Skontaktuj się z administratorem.',
        'TT_OIDC' => 'Nie udało się dokończyć logowania. Skontaktuj się z administratorem.',
    ];
    $detail = $error->getMessage();
    $code = array_key_exists($detail, $messages) ? $detail : 'TT_OIDC';
    if (preg_match('/\bAADSTS[0-9]{4,9}\b/', $detail, $matches)) {
        return ['code' => $matches[0], 'message' => 'Microsoft zwrócił błąd podczas kończenia logowania. Przekaż kod administratorowi.'];
    }
    if (preg_match('/\ACurl error: \(([0-9]{1,3})\)/', $detail, $matches)) {
        return ['code' => 'TT_CURL_' . $matches[1], 'message' => 'Serwer nie mógł połączyć się z usługą logowania Microsoft. Przekaż kod administratorowi.'];
    }
    if ($detail === 'Unable to verify JWT claims') $code = 'TT_TOKEN_CLAIMS';
    if (str_starts_with($detail, 'Unable to verify signature')) $code = 'TT_TOKEN_SIGNATURE';
    if ($error instanceof Error) $code = 'TT_PHP';
    return ['code' => $code, 'message' => $messages[$code]];
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
    if (($claims->tid ?? '') !== $config['tenant_id']) throw new RuntimeException('TT_TENANT');
    if (empty($claims->sub)) throw new RuntimeException('TT_TOKEN_CLAIMS');
    if ($expectedNonce === '' || !is_string($claims->nonce ?? null) || !hash_equals($expectedNonce, $claims->nonce)) {
        throw new RuntimeException('TT_NONCE');
    }
    if (!is_int($claims->exp ?? null) || $claims->exp <= time()) throw new RuntimeException('TT_TOKEN_TIME');
    if ($config['required_role'] !== '' && !in_array($config['required_role'], $roles, true)) throw new RuntimeException('TT_ROLE');
    return [
        'subject' => $claims->sub,
        'tenant' => $config['tenant_id'],
        'client' => $config['client_id'],
        'roles' => $roles,
        // The verified ID token establishes identity at login; the app session
        // has its own absolute lifetime and does not retain Microsoft tokens.
        'expires' => time() + $config['session_seconds'],
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
