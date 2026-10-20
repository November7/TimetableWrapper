# Opcjonalne logowanie Microsoft 365 na hostingu PHP

Projekt ma dwa niezależne wejścia. **Na serwer wgraj tylko jedno z nich:**

| Wariant | Plik wejściowy | Dane planu |
| --- | --- | --- |
| Publiczny | `index.html`, bez `index.php` | Dotychczasowe publiczne foldery `plan` i `stareplany` |
| Microsoft 365 | `index.php`, bez `index.html` | Foldery prywatne lub z zablokowanym dostępem HTTP |

Oba warianty używają `css/` i `scripts/`. Wariant PHP dodatkowo wymaga `auth/` z zainstalowanymi zależnościami. Nie odczytuje `index.html`: jego widok aplikacji znajduje się w `auth/app-view.php`. Zmiany układu aplikacji należy nanosić w obu widokach. Motyw jest wspólny, zapisywany w `localStorage` pod kluczem `theme` dla danej domeny i protokołu, również między otwartymi kartami.

## Wymagania hostingu

- PHP 8.2 lub nowsze, rozszerzenia cURL, OpenSSL i sesje PHP.
- HTTPS i połączenia wychodzące HTTPS z PHP do Microsoft.
- Obsługa `PATH_INFO`, czyli adresów `index.php/source/plan/lista.html`.
- Możliwość zarejestrowania aplikacji w katalogu Microsoft Entra ID organizacji.

Composer może działać na komputerze lokalnym: na hosting wysyłasz gotowy folder `auth/vendor`. Nie trzeba instalować Composera na home.pl.

## 1. Rejestracja w Microsoft Entra ID

1. Otwórz **App registrations → New registration**. Nazwij aplikację np. „Plan lekcji”.
2. Wybierz **Accounts in this organizational directory only (Single tenant)**.
3. Dodaj platformę **Web** i dokładny adres powrotu, np.:

   ```text
   https://twoja-domena.pl/TimetableWrapper/index.php?auth=callback
   ```

4. Zapisz **Directory (tenant) ID** i **Application (client) ID**.
5. W **Certificates & secrets** utwórz sekret i zapisz jego **Value**, nie Secret ID. Zapisz termin ważności; przed jego upływem trzeba podmienić sekret w konfiguracji.
6. Aplikacja żąda tylko `openid` i `profile`, bez dostępu do poczty lub plików. Używa kodu autoryzacyjnego z PKCE, nie wymaga włączania implicit grant. Polityka organizacji może wymagać zgody administratora.

Domyślnie dostęp mają użytkownicy tego katalogu, także dopuszczeni do niego goście. Jeśli dostęp ma mieć wybrana grupa osób, w **Enterprise applications** włącz wymagane przypisanie użytkowników i przypisz uprawnione osoby. Alternatywnie zdefiniuj rolę aplikacji (np. `Plan.Read`), przypisz ją użytkownikom i wpisz tę wartość do `required_role`. Sprawdzanie odbywa się po stronie PHP, nie na podstawie końcówki adresu e-mail.

## 2. Zależności i konfiguracja

W katalogu projektu wykonaj:

```sh
composer install --no-dev --prefer-dist --optimize-autoloader
```

Kopiuj `auth/config.example.php` do `auth/config.php` i uzupełnij:

```php
'tenant_id' => 'UUID katalogu organizacji',
'client_id' => 'UUID aplikacji',
'client_secret' => 'wartość sekretu',
'app_url' => 'https://twoja-domena.pl/TimetableWrapper/index.php',
'plan_dir' => '/absolutna/sciezka/na/serwerze/plan',
'archive_dir' => '/absolutna/sciezka/na/serwerze/stareplany',
```

`plan_dir` i `archive_dir` są ścieżkami na dysku serwera, nie adresami WWW. Brak archiwum jest dopuszczalny — aplikacja pokaże tylko bieżący plan.

Plik `auth/config.php` jest ignorowany przez Git. Cały katalog `auth` ma `.htaccess` blokujący bezpośredni dostęp HTTP. Możesz zamiast tego umieścić konfigurację poza katalogiem publicznym i wskazać ją zmienną środowiskową `TIMETABLE_AUTH_CONFIG`; wtedy popraw ścieżki źródeł na absolutne. Nie wpisuj sekretu w HTML, JavaScript ani w repozytorium.

### Publiczne repozytorium

Publikuj kod i pusty `auth/config.example.php`. Właściwą konfigurację uzupełniaj wyłącznie w ignorowanym `auth/config.php` lub poza repozytorium. Reguły `.gitignore` obejmują również typowe kopie konfiguracji, `.env`, `plan/`, `stareplany/`, prywatne klucze, logi i artefakty testowe. Dane w testach są fikcyjne; `composer.lock` i `package-lock.json` można publikować.

`.htaccess` chroni dostęp HTTP na hostingu, **nie publikację na GitHubie**. `.gitignore` nie chroni pliku już śledzonego przez Git i można go ominąć przez `git add -f`. Przed commitem sprawdź `git status` i `git diff --cached`; nie wysyłaj ZIP-a całego katalogu roboczego jako wydania. Jeśli prawdziwy sekret trafi do commita, należy go unieważnić i zastąpić nowym — samo usunięcie pliku nie usuwa go z historii.

Bez poprawnej konfiguracji lub biblioteki PHP pokazuje ekran logowania z nieaktywnym przyciskiem. Nigdy nie przełącza się automatycznie w tryb publiczny. Pełne logowanie wymaga rzeczywistej konfiguracji organizacji.

## 3. Ochrona katalogów przez .htaccess

**Tak: blokada HTTP przez `.htaccess` pozwala PHP nadal czytać pliki z dysku. Samo wyłączenie listowania katalogu (`Options -Indexes`) nie zabezpiecza plików.**

Najlepiej trzymać źródła poza katalogami udostępnianymi przez WWW. Jeśli pozostawiasz je pod dotychczasowymi adresami, skopiuj `deploy/deny-direct-access.htaccess` jako `.htaccess` osobno do folderów `plan/` i `stareplany/`:

```apache
Require all denied
```

Jest to konfiguracja Apache 2.4 / zgodnego serwera. Na home.pl sposób interpretacji zależy od rodzaju usługi. Jeśli serwer zwraca 500 lub ignoruje regułę, dopasuj ją z pomocą hostingu albo przenieś źródła poza katalog publiczny. Nie uznawaj samego istnienia pliku `.htaccess` za potwierdzenie ochrony.

Sprawdź w oknie prywatnym **konkretne pliki**, np. `/plan/lista.html`, `/plan/plany/o1.html` i plik z `/stareplany/.../`. Mają zwracać **403 lub 404**, także przez inne domeny, aliasy i adres techniczny hostingu. Zweryfikuj, że żaden podkatalog nie nadpisuje blokady, i usuń publiczne kopie eksportu.

Nie dodawaj tej blokady do folderów danych w wariancie publicznym `index.html`, bo przeglądarka musi wtedy pobierać je bezpośrednio. Blokady folderów będących obok repozytorium nie są instalowane automatycznie.

## 4. Wgranie i sprawdzenie

1. Wgraj `index.php`, `auth/` (łącznie z ukrytym `.htaccess` i `vendor/`), `css/`, `scripts/`. Nie wgrywaj `index.html`, plików testów ani narzędzi deweloperskich.
2. Ustaw HTTPS i przekierowanie HTTP → HTTPS w hostingu. Ciastko sesji ma `Secure`, `HttpOnly` i `SameSite=Lax`.
3. Zablokuj bezpośrednie adresy źródeł zgodnie z poprzednią sekcją.
4. Otwórz `index.php`: zobaczysz tylko przycisk Microsoft 365 i przełącznik motywu.
5. Bez logowania otwórz `index.php/source/plan/lista.html`: powinien zwrócić **401**. Jeśli otrzymujesz 404 z serwera, sprawdź obsługę `PATH_INFO` (na Apache może być potrzebne `AcceptPathInfo On` w `.htaccess` katalogu aplikacji).
6. Zaloguj się kontem organizacji. Sprawdź aktualny plan, wybór archiwum, link do oryginału i jego style. Logowanie kontem spoza katalogu albo bez wymaganej roli ma się nie powieść.
7. Przełącz motyw na logowaniu i sprawdź go po wejściu do aplikacji. Po wylogowaniu ustawienie ma pozostać.
8. Kliknij „Wyloguj”, a następnie ponownie otwórz chroniony adres pliku: ma zwrócić **401**.

Sesja trwa maksymalnie `session_seconds` (domyślnie godzinę), nie dłużej niż ważność tokenu logowania. Po jej wygaśnięciu pobieranie danych w aplikacji kieruje do ekranu logowania. Wylogowanie dotyczy tylko tej aplikacji; nie wylogowuje poczty ani innych usług Microsoft. Ponowne logowanie może wykorzystać istniejącą sesję Microsoft zamiast ponownie pytać o hasło.

Źródła są udostępniane jako statyczne HTML, CSS i obrazy. Skrypty z oryginalnego eksportu Vulcan nie są wykonywane; podgląd tabel i ich stylów działa, ale starsze funkcje JavaScript eksportu, np. zwijanie drzewka, nie są dostępne. Oryginalne kodowanie plików jest zachowane. Autoryzowany użytkownik może odczytać i zapisać plan — logowanie ogranicza dostęp, nie możliwość kopiowania.

## Powrót do wariantu publicznego

Usuń z wdrożenia `index.php` oraz niepotrzebne pliki `auth/`, wgraj `index.html` i przywróć publiczny dostęp do katalogów danych. W razie innych ścieżek ustaw `TIMETABLE_PLAN_ROOT` i `TIMETABLE_ARCHIVE_ROOT` w HTML jak dotychczas. Publiczny wariant nie wymaga PHP, Composera ani ustawień Entra ID.

## Testy lokalne

```sh
php tests/auth-test.php
python tests/auth-http-test.py --php /sciezka/do/php
npm run min:js
```

Test HTTP tworzy odizolowaną kopię witryny bez `index.html`, sztuczne dane i testowe sesje poza publicznym katalogiem. Sprawdza m.in. odmowę dostępu bez sesji, dostęp po sesji, archiwa, próby wyjścia poza katalogi, wygaśnięcie i wylogowanie. Nie zastępuje testu prawdziwego logowania Entra ID ani weryfikacji `.htaccess` na docelowym hostingu.

Opcjonalne testy przeglądarkowe: zainstaluj `npm install --prefix .tools playwright` i dodaj `--browser` do polecenia testu HTTP. Domyślnie używany jest zainstalowany Edge; zmienna `TEST_BROWSER_CHANNEL` pozwala wskazać np. `chrome`. Zrzuty ekranu i dane testowe trafiają do ignorowanego katalogu `.test-output/`.

Dokumentacja: [Microsoft — Authorization Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [biblioteka OpenID Connect PHP](https://github.com/jumbojett/OpenID-Connect-PHP), [home.pl — uprawnienia do katalogów](https://pomoc.home.pl/baza-wiedzy/jak-skonfigurowac-ukryty-katalog-na-serwerze).
