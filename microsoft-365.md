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

- `auth/.htaccess` blokuje bezpośredni dostęp HTTP do plików uwierzytelniania. Umieść go w katalogu `auth/` na serwerze.
- Jeśli `plan/` i `stareplany/` pozostają w katalogu dostępnym przez WWW, skopiuj `deploy/deny-direct-access.htaccess` jako `.htaccess` **osobno do każdego z tych katalogów**. Blokada nie przeszkadza PHP w odczytywaniu plików z dysku.
- Nie dodawaj tej blokady do katalogów danych wariantu publicznego `index.html` — przeglądarka musi mieć do nich dostęp.
