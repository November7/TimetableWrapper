<?php
declare(strict_types=1);
require __DIR__ . '/../auth/bootstrap.php';
require __DIR__ . '/../auth/source.php';

$checks = 0;
function check(bool $condition, string $description): void {
    global $checks;
    if (!$condition) throw new RuntimeException($description);
    $checks++;
}
function rejected(callable $fn, string $description): void {
    try { $fn(); } catch (RuntimeException $error) { check(true, $description); return; }
    check(false, $description);
}

$config = [
    'tenant_id' => '11111111-1111-1111-1111-111111111111',
    'client_id' => '22222222-2222-2222-2222-222222222222',
    'client_secret' => 'test-only', 'app_url' => 'https://example.org/plan/index.php',
    'plan_dir' => __DIR__, 'archive_dir' => __DIR__,
    'session_seconds' => 3600, 'required_role' => 'Plan.Read',
];
$claims = (object) ['tid' => $config['tenant_id'], 'sub' => 'test-user', 'exp' => time() + 1800, 'nonce' => 'expected', 'roles' => ['Plan.Read']];
$user = tt_user_from_claims($claims, $config, 'expected');
check($user['expires'] === $claims->exp, 'Session must not outlive the token');
check(!isset($user['token']), 'Do not store access tokens in app session');
foreach (['tid' => 'other-tenant', 'nonce' => 'wrong', 'exp' => time() - 1, 'roles' => []] as $property => $value) {
    $invalid = clone $claims;
    $invalid->$property = $value;
    rejected(fn () => tt_user_from_claims($invalid, $config, 'expected'), 'Reject invalid ' . $property);
}
$invalid = clone $claims;
unset($invalid->nonce);
rejected(fn () => tt_user_from_claims($invalid, $config, 'expected'), 'Nonce is mandatory');
rejected(fn () => tt_user_from_claims($claims, $config, ''), 'Expected nonce is mandatory');

$_SESSION = ['tt_user' => $user, 'tt_csrf' => 'test-csrf'];
check(tt_has_access($config), 'Authorized session accepted');
check(!tt_has_access(null), 'Missing configuration never allows access');
$changed = $config;
$changed['required_role'] = 'OtherRole';
check(!tt_has_access($changed), 'Role change applies to existing sessions');
$changed = $config;
$changed['client_id'] = 'another-app';
check(!tt_has_access($changed), 'Session cannot be reused for another app');
$_SESSION['tt_user']['expires'] = time() - 1;
check(!tt_has_access($config), 'Expired session rejected');
$_SERVER['REQUEST_METHOD'] = 'GET';
$_POST['csrf'] = 'test-csrf';
check(!tt_csrf_valid(), 'GET cannot mutate the session');
$_SERVER['REQUEST_METHOD'] = 'POST';
check(tt_csrf_valid(), 'Matching POST CSRF token accepted');
$_POST['csrf'] = ['test-csrf'];
check(!tt_csrf_valid(), 'Array CSRF token rejected');

check(tt_source_path('plan/auth-test.php', $config) === realpath(__FILE__), 'Valid path resolves');
foreach (['plan/../index.php', 'plan/.hidden', 'plan/%2e%2e/index.php', 'plan/..\\index.php', 'plan/C:/Windows/file', 'unknown/file.html', "plan/a\0.html", 'plan//auth-test.php'] as $path) {
    check(tt_source_path($path, $config) === null, 'Reject unsafe path: ' . $path);
}

$oidc = tt_oidc($config);
check($oidc->getRedirectURL() === $config['app_url'] . '?auth=callback', 'Fixed callback URI');
check($oidc->getCodeChallengeMethod() === 'S256', 'PKCE S256 enabled');
check($oidc->getVerifyPeer() && $oidc->getVerifyHost(), 'TLS verification enabled');
$issuerValidator = $oidc->getIssuerValidator();
check($issuerValidator('https://login.microsoftonline.com/' . $config['tenant_id'] . '/v2.0'), 'Expected issuer accepted');
check(!$issuerValidator('https://login.microsoftonline.com/other/v2.0'), 'Foreign issuer rejected');

echo "PASS: $checks authentication and source boundary checks.\n";
