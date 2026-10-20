<?php
declare(strict_types=1);

require_once __DIR__ . '/auth/bootstrap.php';
header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: SAMEORIGIN');

$config = null;
try {
    $config = tt_config();
} catch (Throwable $error) {
    error_log('Timetable configuration: ' . $error->getMessage());
}
// A missing config shows the login screen, never the timetable.
$scriptPath = preg_replace('~index\.php.*$~', 'index.php', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
$appUrl = $config['app_url'] ?? $scriptPath;
$basePath = rtrim(str_replace('\\', '/', dirname(parse_url($appUrl, PHP_URL_PATH))), '/') . '/';
$assetBase = $basePath;
$pathInfo = $_SERVER['PATH_INFO'] ?? '';
$sourceRequest = str_starts_with($pathInfo, '/source/');
$ready = $config !== null && is_file(__DIR__ . '/auth/vendor/autoload.php') && extension_loaded('curl') && extension_loaded('openssl');

try {
    tt_start_session($basePath);
} catch (Throwable $error) {
    error_log('Timetable session unavailable.');
    tt_error(503, 'Logowanie jest chwilowo niedostępne.');
}

if ($sourceRequest) {
    if (!tt_has_access($config)) {
        tt_error(401, 'Zaloguj się do planu kontem Microsoft 365.');
    }
    session_write_close();
    require_once __DIR__ . '/auth/source.php';
    tt_serve_source(substr($pathInfo, strlen('/source/')), $config);
}
if ($pathInfo !== '' && $pathInfo !== '/') tt_error(404, 'Nie znaleziono strony.');

$action = is_string($_GET['auth'] ?? null) ? $_GET['auth'] : '';
$message = '';
if ($action === 'logout') {
    if (!tt_csrf_valid()) tt_error(403, 'Odśwież stronę i spróbuj ponownie.');
    $_SESSION = [];
    session_destroy();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $basePath, 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    // End only this app's session; do not sign the user out of other Microsoft apps.
    tt_redirect($appUrl);
}
if ($action === 'login' || $action === 'callback') {
    if (!$ready) {
        http_response_code(503);
        $message = 'Logowanie jest chwilowo niedostępne. Spróbuj ponownie później.';
    } else {
        $stage = 'callback';
        try {
            if ($action === 'login') {
                if (!tt_csrf_valid()) tt_error(403, 'Odśwież stronę i spróbuj ponownie.');
                // Ignore injected OAuth parameters on the initial POST.
                $_REQUEST = [];
                $_SESSION['tt_login_started'] = time();
            } else {
                // Check state BEFORE any token request; accept only the expected GET callback.
                tt_validate_callback($_GET, $_SERVER['REQUEST_METHOD'], $_SESSION);
                $_REQUEST = $_GET;
            }
            $expectedNonce = (string) ($_SESSION['openid_connect_nonce'] ?? '');
            $stage = $action === 'login' ? 'authorize' : 'token';
            $oidc = tt_oidc($config);
            if (!$oidc->authenticate() || $action !== 'callback') {
                throw new RuntimeException('Authentication was not completed.');
            }
            $stage = 'claims';
            $user = tt_user_from_claims($oidc->getVerifiedClaims(), $config, $expectedNonce);
            $stage = 'session';
            if (!session_regenerate_id(true)) throw new RuntimeException('TT_SESSION_SAVE');
            $_SESSION = ['tt_user' => $user, 'tt_csrf' => bin2hex(random_bytes(32))];
            tt_redirect($appUrl);
        } catch (Throwable $error) {
            // Never expose/log raw exception messages, tokens, OAuth codes or secrets.
            $failure = tt_auth_failure($error);
            $reference = bin2hex(random_bytes(6));
            error_log('Timetable sign-in failed: reference=' . $reference . ' stage=' . $stage . ' reason=' . $failure['code']);
            unset($_SESSION['tt_user'], $_SESSION['tt_login_started'], $_SESSION['openid_connect_state'], $_SESSION['openid_connect_nonce'], $_SESSION['openid_connect_code_verifier']);
            $message = $failure['message'] . ' Kod: ' . $failure['code'] . '. Numer zgłoszenia: ' . $reference . '.';
            http_response_code(401);
        }
    }
}

$csrf = $_SESSION['tt_csrf'];
$authenticated = tt_has_access($config);
session_write_close();
define('TIMETABLE_AUTH_VIEW', true);
if ($authenticated) {
    require __DIR__ . '/auth/app-view.php';
} else {
    require __DIR__ . '/auth/login-view.php';
}
