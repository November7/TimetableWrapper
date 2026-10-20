"""Isolated deployment tests. Uses synthetic data and CLI-created test sessions only."""
import argparse
import base64
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--php', default='php')
    parser.add_argument('--browser', action='store_true')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    output = repo / '.test-output'
    output.mkdir(exist_ok=True)
    fixture = Path(tempfile.mkdtemp(prefix='auth-', dir=output)).resolve()
    assert fixture.is_relative_to(output.resolve())
    public = fixture / 'public'
    app = public / 'TimetableWrapper'
    app.mkdir(parents=True)
    for directory in ('auth', 'css', 'scripts'):
        shutil.copytree(repo / directory, app / directory, ignore=shutil.ignore_patterns('config.php'))
    shutil.copy2(repo / 'index.php', app / 'index.php')
    sessions = fixture / 'sessions'
    sessions.mkdir()
    private = fixture / 'private'
    (private / 'plan' / 'plany').mkdir(parents=True)
    (private / 'plan' / 'css').mkdir()
    year = time.localtime().tm_year
    archive_name = f'do {year}.12.01'
    (private / 'stareplany' / archive_name / 'plany').mkdir(parents=True)
    listing = '<meta charset="utf-8"><div id="oddzialy"><a href="plany/o1.html">1A</a></div><div id="nauczyciele"></div><div id="sale"></div>'
    plan = '''<meta charset="utf-8"><link rel="stylesheet" href="../css/plan.css"><span class="tytulnapis">1A — test</span>
<table class="tabela"><tr><th>Nr</th><th>Godz</th><th>Poniedziałek</th></tr><tr><td class="nr">1</td><td class="g">8:00-8:45</td><td class="l"><span class="p">Matematyka</span></td></tr></table>'''
    for target in (private / 'plan', private / 'stareplany' / archive_name):
        (target / 'lista.html').write_text(listing, encoding='utf-8')
        (target / 'plany' / 'o1.html').write_text(plan, encoding='utf-8')
    (private / 'plan' / 'css' / 'plan.css').write_text('body { color: rgb(40, 50, 60); }', encoding='utf-8')
    (private / 'plan' / 'secret.php').write_text('<?php echo "DO NOT SERVE";', encoding='utf-8')
    (private / 'outside.html').write_text('OUTSIDE PRIVATE ROOT', encoding='utf-8')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    config = {
        'tenant_id': '11111111-1111-1111-1111-111111111111',
        'client_id': '22222222-2222-2222-2222-222222222222',
        'client_secret': 'local-fixture-only',
        'app_url': f'https://localhost:{port}/TimetableWrapper/index.php',
        'plan_dir': str(private / 'plan'), 'archive_dir': str(private / 'stareplany'),
        'session_seconds': 3600, 'required_role': '',
    }
    encoded = base64.b64encode(json.dumps(config).encode()).decode()
    config_file = fixture / 'config.php'
    config_file.write_text(f"<?php return json_decode(base64_decode('{encoded}'), true);", encoding='utf-8')
    env = dict(os.environ, TIMETABLE_AUTH_CONFIG=str(config_file))
    php = [args.php, '-d', f'session.save_path={sessions}']
    log = open(fixture / 'server.log', 'w', encoding='utf-8')
    server = subprocess.Popen(php + ['-S', f'localhost:{port}', '-t', str(public)], env=env, stdout=log, stderr=log)
    count = 0

    def request(path, cookie=None, method='GET', body=None):
        conn = http.client.HTTPConnection('localhost', port, timeout=5)
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        if cookie:
            headers['Cookie'] = cookie
        conn.request(method, '/TimetableWrapper/' + path, body, headers)
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read().decode('utf-8', errors='replace')
        conn.close()
        return result

    def check(condition, message):
        nonlocal count
        assert condition, message
        count += 1

    def make_session(expired=False):
        code = '''require $argv[1]; $config = tt_config(); tt_start_session('/TimetableWrapper/');
$_SESSION['tt_user'] = ['subject' => 'fixture', 'tenant' => $config['tenant_id'], 'client' => $config['client_id'], 'roles' => [], 'expires' => time() + (int)$argv[2]];
$value = ['name' => session_name(), 'value' => session_id(), 'csrf' => $_SESSION['tt_csrf']]; session_write_close(); echo json_encode($value);'''
        result = subprocess.check_output(php + ['-r', code, str(app / 'auth' / 'bootstrap.php'), '-1' if expired else '1800'], env=env)
        return json.loads(result)

    try:
        for _ in range(50):
            try:
                request('index.php')
                break
            except OSError:
                time.sleep(.1)
        status, headers, html = request('index.php')
        check(status == 200 and 'Zaloguj przez Microsoft 365' in html and 'id="schedule"' not in html, 'Login only without session')
        check('Secure' in headers.get('Set-Cookie', '') or 'secure' in headers.get('Set-Cookie', ''), 'Secure session cookie')
        check('HttpOnly' in headers.get('Set-Cookie', '') or 'HttpOnly'.lower() in headers.get('Set-Cookie', '').lower(), 'HttpOnly cookie')
        check('no-store' in headers.get('Cache-Control', ''), 'No caching of protected responses')
        check(request('index.html')[0] == 404, 'PHP deployment contains no index.html')
        check(request('index.php/source/plan/lista.html')[0] == 401, 'Direct source denied anonymously')
        check(request('index.php/source/stareplany/')[0] == 401, 'Archive denied anonymously')
        check(request('index.php?auth=login')[0] == 403, 'Login requires POST and CSRF')
        check(request('index.php?auth=callback&code=fake&state=wrong')[0] == 401, 'Forged OAuth callback rejected before exchange')
        check(request('index.php?auth=callback&code[]=fake&state[]=wrong')[0] == 401, 'Malformed callback rejected')
        session = make_session()
        cookie = session['name'] + '=' + session['value']
        status, _, html = request('index.php', cookie)
        check(status == 200 and 'id="schedule"' in html and 'Wyloguj' in html, 'Independent PHP app loads after session')
        script_html = html.replace('\\/', '/')
        check('index.php/source/plan' in script_html and 'index.php/source/stareplany' in script_html, 'Both roots use protected controller')
        check(request('index.php/source/plan/lista.html', cookie)[0] == 200, 'Authorized source readable')
        status, headers, body = request('index.php/source/plan/plany/o1.html', cookie)
        check(status == 200 and 'Matematyka' in body, 'Authorized original readable')
        check("default-src 'none'" in headers.get('Content-Security-Policy', ''), 'Original scripts constrained')
        check(request('index.php/source/plan/css/plan.css', cookie)[0] == 200, 'Original stylesheet readable')
        check(request('index.php/source/plan', cookie)[0] == 303, 'Directory URL canonicalized for relative assets')
        status, _, body = request('index.php/source/stareplany/', cookie)
        check(status == 200 and archive_name in body, 'Authorized archive listing generated')
        from urllib.parse import quote
        check(request('index.php/source/stareplany/' + quote(archive_name) + '/lista.html', cookie)[0] == 200, 'Archive with spaces readable')
        for path in ('plan/../outside.html', 'plan/%2e%2e/outside.html', 'plan/%252e%252e/outside.html', 'plan/..%5Coutside.html', 'plan/secret.php', 'plan/.htaccess', 'other/lista.html'):
            check(request('index.php/source/' + path, cookie)[0] == 404, 'Reject unsafe source ' + path)
        check(request('index.php/source/plan/lista.html', cookie, 'POST', '')[0] == 405, 'Source endpoint is read-only')
        check(request('index.php/source/plan/lista.html', cookie, 'HEAD')[2] == '', 'HEAD has no body')
        expired = make_session(True)
        check(request('index.php/source/plan/lista.html', expired['name'] + '=' + expired['value'])[0] == 401, 'Expired session denied')
        check(request('index.php?auth=logout', cookie)[0] == 403, 'GET logout denied')
        check(request('index.php?auth=logout', cookie, 'POST', 'csrf=wrong')[0] == 403, 'CSRF logout denied')
        if args.browser:
            static_app = public / 'static' / 'TimetableWrapper'
            static_app.mkdir(parents=True)
            for directory in ('css', 'scripts'):
                shutil.copytree(repo / directory, static_app / directory)
            shutil.copy2(repo / 'index.html', static_app / 'index.html')
            shutil.copytree(private / 'plan', static_app.parent / 'plan')
            (static_app.parent / 'stareplany').mkdir()
            (static_app.parent / 'stareplany' / 'index.html').write_text('<html></html>', encoding='utf-8')
            metadata = dict(url=f'http://localhost:{port}/TimetableWrapper/', session=session, output=str(fixture), app=str(app), public=str(public))
            metadata_file = fixture / 'browser.json'
            metadata_file.write_text(json.dumps(metadata), encoding='utf-8')
            subprocess.run(['node', str(repo / 'tests' / 'auth-browser-test.cjs'), str(metadata_file)], check=True)
        check(request('index.php?auth=logout', cookie, 'POST', 'csrf=' + session['csrf'])[0] == 303, 'Valid logout redirects')
        check(request('index.php/source/plan/lista.html', cookie)[0] == 401, 'Session destroyed after logout')
        config_file.write_text('<?php return [];', encoding='utf-8')
        check('disabled' in request('index.php')[2], 'Invalid config disables login')
        check(request('index.php/source/plan/lista.html', cookie)[0] == 401, 'Invalid config never exposes sources')
        # Exercise the alternative deployment: no index.php, only public HTML.
        assert (app / 'index.php').resolve().is_relative_to(fixture)
        (app / 'index.php').rename(fixture / 'saved-index.php')
        shutil.copy2(repo / 'index.html', app / 'index.html')
        check(request('index.html')[0] == 200 and 'id="schedule"' in request('index.html')[2], 'Public HTML works without PHP entry point')
        print(f'PASS: {count} isolated HTTP/deployment checks. Artifacts: {fixture}')
    finally:
        server.terminate()
        server.wait(timeout=10)
        log.close()


if __name__ == '__main__':
    main()
