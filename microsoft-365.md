# Logowanie Microsoft 365

## Utworzenie aplikacji Entra ID

1. W **App registrations** wybierz **New registration** i nazwij aplikację.
2. Wybierz **Accounts in this organizational directory only (Single tenant)**.
3. W **Authentication** dodaj platformę **Web** i ustaw URI przekierowania na adres aplikacji z `?auth=callback`, np.:

   ```text
   https://twoja-domena.pl/TimetableWrapper/index.php?auth=callback
   ```

4. Zapisz **Directory (tenant) ID** oraz **Application (client) ID**.
5. W **Certificates & secrets** utwórz client secret i skopiuj jego **Value** (nie Secret ID).

## Konfiguracja `auth/config.php`

Skopiuj `auth/config.example.php` do `auth/config.php` i uzupełnij:

```php
'tenant_id' => 'Directory (tenant) ID',
'client_id' => 'Application (client) ID',
'client_secret' => 'Secret Value',
'app_url' => 'https://twoja-domena.pl/TimetableWrapper/index.php',
'plan_dir' => '/absolutna/sciezka/na/serwerze/plan',
'archive_dir' => '/absolutna/sciezka/na/serwerze/stareplany',
```

`app_url` musi być adresem HTTPS użytym w URI przekierowania, bez `?auth=callback`. `plan_dir` i `archive_dir` to ścieżki na serwerze, nie adresy WWW; ustaw je zgodnie z położeniem katalogów. Nie publikuj `config.php` ani nie umieszczaj sekretu w kodzie.

## Pliki `.htaccess`

- `deploy/php-app.htaccess` skopiuj jako **`.htaccess` obok `index.php`**. Wymaga Apache 2.4, `mod_rewrite` i obsługi wskazanych dyrektyw przez `AllowOverride` (np. `AllowOverride All` dla katalogu aplikacji). Dopuszcza kontroler PHP i zasoby interfejsu, blokuje publiczny `index.html`, pliki robocze i konfigurację. Nie stosuj go w wariancie publicznym.
- `auth/.htaccess` blokuje bezpośredni dostęp HTTP do plików uwierzytelniania. Umieść go w katalogu `auth/` na serwerze.
- Jeśli `plan/` i `stareplany/` pozostają w katalogu dostępnym przez WWW, skopiuj `deploy/deny-direct-access.htaccess` jako `.htaccess` **osobno do każdego z tych katalogów**. Blokada nie przeszkadza PHP w odczytywaniu plików z dysku.
- Nie dodawaj tej blokady do katalogów danych wariantu publicznego `index.html` — przeglądarka musi mieć do nich dostęp.

## Zależności i sesje

Wymagane są PHP 8.3 lub nowszy, rozszerzenia cURL i OpenSSL oraz zależności z `auth/composer.lock`:

```sh
composer install --working-dir=auth --no-dev --prefer-dist --optimize-autoloader
composer audit --working-dir=auth --locked
```

Proces PHP musi móc zapisywać sesje poza katalogiem WWW. Ciasteczko sesji ma flagi `Secure`, `HttpOnly` i `SameSite=Lax`, dlatego produkcyjne logowanie wymaga HTTPS. Nie wyłączaj tych flag. Wylogowanie niszczy sesję aplikacji, ale nie kończy sesji Microsoft 365 w innych usługach.

Puste `required_role` dopuszcza konta wskazanego katalogu Entra ID, także jego gości. Aby ograniczyć dostęp, zdefiniuj rolę aplikacji (np. `Plan.Read`), przypisz ją uprawnionym użytkownikom i wpisz tę wartość w `required_role`. Zmiana roli w konfiguracji aplikacji jest sprawdzana również dla istniejących sesji; zmiana przypisań w Entra ID będzie widoczna po ponownym logowaniu lub wygaśnięciu sesji.

## Logi Apache

Kod OAuth i `state` wracają w query string callback. Standardowy format logowania żądania może je zapisywać. Administrator VirtualHost powinien zastosować format z `%U` (ścieżka bez query), bez `%r`, `%q` i nagłówka Referer:

```apache
LogFormat "%h %l %u %t \"%m %U %H\" %>s %b" timetable
CustomLog ${APACHE_LOG_DIR}/timetable-access.log timetable
```

Analogicznie skonfiguruj logi reverse proxy, jeśli występuje przed Apache. W PHP wyłącz wyświetlanie błędów (`display_errors=Off`); logi przechowuj poza katalogiem WWW.

Pełna lista plików do wysłania oraz kontrola wdrożenia: [README — produkcja Apache + PHP](README.md#produkcja-apache--php-bez-dockera).
