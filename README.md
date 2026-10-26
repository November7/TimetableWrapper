# Timetable Wrapper

[![Release](https://img.shields.io/github/v/release/November7/TimetableWrapper?display_name=tag)](https://github.com/November7/TimetableWrapper/releases)
[![Last commit](https://img.shields.io/github/last-commit/November7/TimetableWrapper)](https://github.com/November7/TimetableWrapper/commits/main)

Wrapper planu lekcji oparty o dane z oryginalnego folderu wygenerowanego przez program **Plan Lekcji firmy Vulcan**. Aplikacja pobiera i parsuje oryginalne pliki HTML, a następnie renderuje plan w przejrzystym widoku bez ramek.

Aktualna wersja: **1.5.5**. Dostępne są dwa osobne warianty wdrożenia:

| Wariant | Plik wejściowy | Dostęp do planu | Przyciski w nagłówku |
| --- | --- | --- | --- |
| Publiczny | `index.html` | Bez logowania; pliki planu dostępne przez HTTP | Oryginalny plan, wydruk, rozmiar tekstu, motyw |
| Microsoft 365 | `index.php` | Sesja PHP po logowaniu do wskazanego katalogu Entra ID | Wylogowanie, wydruk, rozmiar tekstu, motyw; bez przycisku oryginalnego planu |

Usunięcie przycisku oryginalnego planu nie blokuje odczytu danych przez zalogowanego użytkownika: przeglądarka pobiera je przez chroniony endpoint PHP. Ochrona przed dostępem bez logowania działa na serwerze.

## Wymagania

- Folder z planem wygenerowanym przez Vulcan (domyślnie katalog `plan` obok folderu projektu).
- Plan jest poprawnie parsowany pod warunkiem, że został wyeksportowany z zaznaczoną opcją „drzewko z lewej strony”, a pozostałe opcje eksportu pozostawiono jako domyślne.
- Folder `stareplany` obok folderu `plan` (opcjonalnie) z podfolderami archiwalnych wersji planu.
- Lokalny serwer HTTP — aplikacja korzysta z `fetch()`, który nie działa przy otwarciu pliku bezpośrednio z dysku (`file://`) lub  publiczny serwer produkcyjny.
- Wariant z logowaniem: Apache 2.4 z `mod_rewrite`, PHP 8.3 lub nowszy z rozszerzeniami cURL i OpenSSL, Composer 2 oraz HTTPS. Serwer musi obsługiwać sesje PHP i mieć dostęp HTTPS do usług logowania Microsoft.
- Node.js i npm są potrzebne wyłącznie do przebudowania plików `.min`; nie są potrzebne na serwerze produkcyjnym.

## Uruchomienie

### Produkcja: Apache + PHP bez Dockera

1. Skonfiguruj aplikację Entra ID zgodnie z [instrukcją Microsoft 365](microsoft-365.md). Użyj rejestracji **Single tenant** i adresu callback zakończonego `index.php?auth=callback`.
2. Zainstaluj zależności z pliku blokady, w katalogu projektu:

   ```sh
   composer install --working-dir=auth --no-dev --prefer-dist --optimize-autoloader
   composer audit --working-dir=auth --locked
   ```

   Jeżeli hosting nie udostępnia Composera, wykonaj instalację w zgodnym środowisku PHP i wyślij również wygenerowany katalog `auth/vendor/`.

3. Wyślij do katalogu aplikacji wyłącznie `index.php`, pliki PHP z `auth/`, `auth/.htaccess`, `auth/vendor/`, `css/`, pliki `scripts/*.js` i `images/`. Skopiuj **`deploy/php-app.htaccess` jako główny `.htaccess` obok `index.php`**. Nie wysyłaj `index.html`, repozytorium `.git`, `.tools`, `.test-output`, `node_modules`, plików Docker, kopii zapasowych ani logów.
4. Utwórz na serwerze `auth/config.php` na podstawie `auth/config.example.php`. Ustaw identyfikatory, sekret, produkcyjny `app_url` z HTTPS i ścieżki do danych. Alternatywnie umieść konfigurację poza katalogiem WWW i wskaż ją zmienną środowiskową `TIMETABLE_AUTH_CONFIG` dostępną dla PHP. Sekret nie trafia do Git.
5. Umieść `plan/` i `stareplany/` **poza DocumentRoot serwera**, z prawem odczytu dla PHP. Samo umieszczenie ich poza katalogiem aplikacji nie wystarcza, jeśli nadal są publiczne. Jeżeli muszą pozostać w przestrzeni WWW, skopiuj `deploy/deny-direct-access.htaccess` jako `.htaccess` do obu katalogów i sprawdź blokadę HTTP.
6. Włącz obsługę `.htaccess`. Przykładowa sekcja konfiguracji Apache dla katalogu aplikacji:

   ```apache
   <Directory "/var/www/html/TimetableWrapper">
       AllowOverride All
       Require all granted
   </Directory>
   ```

   Główny `.htaccess` dopuszcza jedynie kontroler `index.php` i zasoby CSS/JS/obrazów; blokuje m.in. `index.html`, `auth/` oraz katalogi ukryte. Jeśli hosting ignoruje `.htaccess` lub zwraca błąd 500, popraw konfigurację przed udostępnieniem aplikacji.

7. Wymuś HTTPS w konfiguracji hostingu/VirtualHost. Ustaw `display_errors=Off`, `log_errors=On`, zapis sesji poza DocumentRoot i brak prawa zapisu procesu PHP do kodu aplikacji. W logach dostępu nie zapisuj parametrów query callback — mogą zawierać jednorazowy kod OAuth. Przykład formatu logów Apache z samą ścieżką znajduje się w [instrukcji Microsoft 365](microsoft-365.md).
8. Przed udostępnieniem sprawdź wdrożenie w prywatnym oknie przeglądarki:
   - `index.php` wyświetla wyłącznie logowanie, także po dopisaniu `?preview=1` lub `?auth=callback&code=test&state=test`.
   - `index.php/source/plan/lista.html` i `index.php/source/stareplany/` zwracają **401** bez sesji.
   - `index.html`, `auth/config.php`, `.git/config`, `.tools/preview-server.cjs` oraz bezpośrednie adresy danych są niedostępne (**403/404**).
   - Po prawdziwym logowaniu Microsoft plan się ładuje; po wylogowaniu chronione dane ponownie zwracają **401**.

Brak konfiguracji lub zależności nie uruchamia publicznego planu — pokazuje niedostępne logowanie. Aplikacja nie zawiera produkcyjnego przełącznika pomijającego uwierzytelnianie. Lokalne narzędzia podglądu w ignorowanym `.tools/` nie są częścią wydania.

### Lokalny wariant PHP przez Docker

Docker uruchamia Apache z PHP i instaluje zależności logowania podczas budowania obrazu — nie musisz instalować PHP ani Composer lokalnie. Wymagany jest Docker Desktop z Compose. Compose montuje pliki projektu, więc lokalne zmiany są widoczne w kontenerze bez ponownego budowania obrazu. To ustawienie służy do lokalnego testowania; na serwer wdrażaj gotowe pliki zgodnie z instrukcją wdrożenia.

Skopiuj przykładową konfigurację i uzupełnij dane aplikacji Entra ID:

```powershell
Copy-Item auth\config.example.php auth\config.php
```

W `auth/config.php` ustaw `tenant_id`, `client_id`, `client_secret` i `app_url` zgodnie z [instrukcją Microsoft 365](microsoft-365.md). Domyślne ścieżki planów w tej konfiguracji odpowiadają wolumenom Compose: `../plan` i `../stareplany` względem katalogu projektu.

Uruchom kontener z katalogu projektu:

```powershell
docker compose up --build
```

Otwórz `http://localhost:8080/index.php`, aby sprawdzić ekran logowania. Port jest przypięty wyłącznie do `127.0.0.1`; można go zmienić zmienną `TIMETABLE_PORT`, np. `$env:TIMETABLE_PORT = "8081"`. Kontener korzysta z blokad wariantu PHP, więc nie służy do uruchamiania publicznego `index.html`. Zmiana konfiguracji Apache lub Dockerfile wymaga ponownego `docker compose up --build`.

Po zmianie `auth/composer.json` lub `auth/composer.lock` przebuduj obraz i odtwórz wolumen zależności poleceniem `docker compose down -v`, a następnie `docker compose up --build`.

Logowanie Microsoft 365 wymaga adresu HTTPS zgodnego z `app_url` i zarejestrowanym URI przekierowania. Sam kontener udostępnia HTTP; aby się zalogować, skieruj skonfigurowany terminator HTTPS na kontener i otwórz aplikację pod adresem `app_url`. Nie wyłączaj bezpiecznych ustawień sesji w celu uruchomienia logowania przez HTTP.

### Zasady dostępu Microsoft 365

Wariant PHP ma niezależny widok aplikacji, chroni też źródła planu i archiwów oraz współdzieli motyw z ekranem logowania. Domyślnie dopuszcza konta wskazanego katalogu Entra ID, również konta gości tego katalogu. Aby ograniczyć dostęp, ustaw `required_role` i przypisz odpowiednią rolę aplikacji w Entra ID. Wylogowanie kończy sesję planu, ale nie wylogowuje ze wszystkich usług Microsoft.

Konfiguracja aplikacji Entra ID, pliku `auth/config.php` i plików `.htaccess`: **[instrukcja Microsoft 365](microsoft-365.md)**.

Logowanie jest zapamiętywane także po zamknięciu przeglądarki, domyślnie przez 7 dni od zalogowania. W istniejącym `auth/config.php` zmień `session_seconds` z `3600` na `604800`, aby korzystać z tego okresu. Zakres ustawienia wynosi od 300 sekund do 30 dni; aktywność nie przedłuża sesji. Nowe ustawienie obowiązuje po ponownym zalogowaniu. Wylogowanie usuwa sesję od razu. Usunięcie ciasteczek lub zamknięcie okna prywatnego wymaga ponownego logowania.

Sesja aplikacji ma własny termin ważności, niezależny od terminu tokenu ID Microsoft, który jest weryfikowany podczas logowania. Zmiany uprawnień w Entra ID są sprawdzane przy kolejnym logowaniu; dobierz czas sesji do potrzeb organizacji. Dla plikowych sesji PHP aplikacja używa własnego katalogu `timetable-sessions-*` w katalogu tymczasowym systemu, z prawem zapisu dla PHP. Hosting musi zachowywać te pliki przez wybrany czas sesji (również przy zewnętrznym sprzątaniu plików tymczasowych); dla innych mechanizmów zapisu sesji trzeba odpowiednio ustawić retencję po stronie serwera. Zmiana katalogu sesji wymaga jednorazowego ponownego logowania dotychczasowych użytkowników.

### Wariant publiczny HTML

Uruchom serwer HTTP z katalogu **nadrzędnego** względem projektu, tak aby foldery `plan`, `stareplany` i `TimetableWrapper` były dostępne obok siebie:

```powershell
cd "path_to_directory_containing_local_repo"
npx serve . --listen 5500
```

Następnie otwórz w przeglądarce:

```
http://localhost:5500/TimetableWrapper/
```

Na produkcję publiczną wyślij `index.html`, `css/`, pliki `scripts/*.js` oraz dostępne przez HTTP dane `plan/` i `stareplany/`. Nie instaluj blokad `.htaccess` przeznaczonych dla wariantu PHP. Lokalny serwer z katalogu nadrzędnego służy wyłącznie do testów — nie udostępniaj przez niego całego katalogu roboczego w Internecie.

### Konfiguracja ścieżki do planu

Poniższe ścieżki URL dotyczą wariantu publicznego. W wariancie PHP ustaw `plan_dir` i `archive_dir` w konfiguracji serwera; widok automatycznie kieruje żądania przez `index.php/source/...`.

Domyślna ścieżka to `../plan`. Można ją nadpisać, dodając przed dołączeniem skryptu:

```html
<script>window.TIMETABLE_PLAN_ROOT = "../inna-sciezka";</script>
```

### Konfiguracja ścieżki do archiwum

Domyślna ścieżka do archiwum to folder `../stareplany` (czyli folder obok `../plan`). Można ją nadpisać:

```html
<script>window.TIMETABLE_ARCHIVE_ROOT = "../inna-sciezka-do-archiwum";</script>
```

Lista archiwów domyślnie ograniczona jest do 24 wpisów. Limit można zmienić:

```html
<script>window.TIMETABLE_ARCHIVE_MAX_ENTRIES = 10;</script>
```

### Konfiguracja progu zwijania panelu bocznego

Można ustawić szerokość (w pikselach), poniżej której aplikacja przełączy się na układ ze zwijanym panelem bocznym (tryb mobilny/overlay):

```html
<script>window.TIMETABLE_SIDEBAR_COLLAPSE_WIDTH = 1200;</script>
```

Ważne:
- Skrypt konfiguracyjny dodaj przed dołączeniem `scripts/app.min.js`.
- Domyślna wartość to `1000`.
- Większa wartość (np. `1200`) spowoduje wcześniejsze przejście na układ ze zwijanym panelem.

### Konfiguracja mapy nazw przedmiotów

Można opcjonalnie podmienić nazwy przedmiotów podczas parsowania planu, przekazując mapę `stara_nazwa -> nowa_nazwa` przed dołączeniem skryptu:

```html
<script>
    window.TIMETABLE_SUBJECT_NAME_MAP = {
        "Jezyk polski": "J. polski",
        "Wychowanie fizyczne": "WF",
        "Matematyka rozszerzona": "Matematyka R"
    };
</script>
```

Podmiana działa na zasadzie dokładnego dopasowania po znormalizowaniu spacji.
Jeśli nazwa przedmiotu zawiera zapis grupy w formacie `przedmiot-2/2`, aplikacja najpierw zamieni go na `przedmiot 2/2`, a potem spróbuje wykonać mapowanie całej nazwy albo samej bazowej nazwy przedmiotu z zachowaniem oznaczenia grupy.
Dodatkowo finalna nazwa przedmiotu jest automatycznie kapitalizowana (pierwsza litera wielka), niezależnie od mapowania.

### Konfiguracja mapy wpisów międzyoddziałowych

Można podmienić kody wpisów międzyoddziałowych, np. `#w1`, przekazując mapę przed dołączeniem skryptu:

```html
<script>
    window.TIMETABLE_INTERCLASS_SUBJECT_MAP = {
        "#w1": "wf. dz."
    };
</script>
```

### Konfiguracja mapy skrótów wyrazów w nazwie przedmiotu

Można opcjonalnie skracać wybrane wyrazy w nazwie przedmiotu, przekazując mapę `wyraz -> skrót` przed dołączeniem skryptu:

```html
<script>
    window.TIMETABLE_SUBJECT_WORD_ABBREVIATION_MAP = {
        "komputerowych": "komp.",
        "operacyjne": "op.",
        "elektryczne": "el."
    };
</script>
```

Przetwarzanie nazwy przedmiotu wykonywane jest w kolejności: `mapowanie nazwy` -> `kapitalizacja` -> `mapowanie wyrazów na skróty`.

## Funkcje

- **Trzy kategorie** — oddziały, nauczyciele, sale; przełączane zakładkami.
- **Wyszukiwanie** — filtrowanie listy w czasie rzeczywistym.
- **Etykiety w komórkach** — przełączniki widoczności linków do nauczyciela, sali i oddziału (osobno dla każdej kategorii).
- **Rozmiar czcionki** — przyciski A− / A+ skalują treść planu (zakres 80–130%, zapisywany lokalnie).
- **Motyw jasny/ciemny** — przełącznik z automatycznym wykrywaniem preferencji systemowych; wybór zapisywany lokalnie.
- **Oryginalny plan** — przycisk otwierający plik źródłowy występuje wyłącznie w publicznym `index.html`.
- **Wylogowanie** — przycisk w wariancie PHP kończy sesję planu; operacja wymaga POST i tokena CSRF.
- **Wydruk** — przycisk w nagłówku drukuje prawy panel bez nawigacji (na komputerze).
- **Ekran logowania** — logo szkoły, logowanie Microsoft 365, komunikaty błędów oraz wspólny przełącznik jasnego/ciemnego motywu. Odświeżony wygląd łączy wgłębione logo i tekst z wypukłą kartą oraz przyciskiem logowania; efekt dopasowuje się do jasnego i ciemnego motywu, a kolorowe pola przycisku podświetlają się po najechaniu lub ustawieniu fokusu.
- **Widok mobilny** —  poniżej 860 px tabela zostaje zastąpiona widokiem "akordeon" z podziałem na dni tygodnia. Panel boczny wysuwa się po naciśnięciu przycisku Menu.
- **Podział grup w komórkach** — gdy w danej lekcji występuje tylko jedna grupa w formacie `X/N` (np. `1/2`, `2/2`, `1/3`), aplikacja automatycznie dokłada pusty slot po przeciwnej stronie, aby zachować czytelny podział. Grupa `1/N` jest po lewej, a `X/N` dla `X>1` po prawej.
- **Równe kolumny wpisów** — wpisy lekcji w jednej komórce mają zawsze taką samą szerokość.
- **Informacje o planie** — data obowiązywania i data wygenerowania wyświetlane pod planem.
- **Historia nawigacji** — przyciski przeglądarki Wstecz/Dalej przełączają wcześniej otwierane plany (także między wersjami archiwalnymi).

## Struktura projektu

```
TimetableWrapper/
├── index.html          # Publiczny wariant bez logowania
├── index.php           # Kontroler uwierzytelniania i chronionych danych
├── auth/               # Widoki PHP, sesje, OIDC, odczyt danych, Composer
│   ├── config.example.php # Przykład konfiguracji bez sekretów
│   ├── config.php      # Konfiguracja lokalna/serwera, ignorowana przez Git
│   └── vendor/         # Zależności generowane przez Composer, poza Git
├── css/                # app.css, app.min.css, login.css
├── scripts/            # app.js, app.min.js, map.js, theme.js, login.js
├── images/             # Logo ekranu logowania
├── deploy/             # Blokady .htaccess dla wdrożenia PHP
├── docker/             # Konfiguracja lokalnego Apache
├── Dockerfile
└── docker-compose.yml  # Lokalne środowisko PHP

../plan/                # Folder z plikami Vulcan (poza projektem)
    lista.html
    ...

../stareplany/          # Folder archiwalnych planow (poza projektem)
    2025-09-01/
        lista.html
        ...
    2025-10-01/
        lista.html
        ...
```

## Motywy

Aplikacja obsługuje motywy jasny i ciemny. Przy pierwszym uruchomieniu wybierany jest motyw zgodny z ustawieniami systemu operacyjnego. Wybór użytkownika zapisywany jest w `localStorage`.

## Budowanie i przygotowanie commita

```sh
npm ci
npm run min
npm audit
git diff --check
git status --short
```

Po zmianie `scripts/app.js` lub `css/app.css` przebuduj i dodaj do commita także odpowiedni plik `.min`. `css/login.css` jest używany bez minifikacji. Wersja wydania jest zapisana w `package.json`, `package-lock.json`, `APP_VERSION` w `scripts/app.js` oraz parametrach `?v=` zasobów w widokach HTML/PHP.

Do Git trafiają `auth/composer.json` i `auth/composer.lock`; nie trafiają `auth/config.php`, `auth/vendor/`, `.env`, klucze, logi, pliki planów, `.tools/` ani `.test-output/`. `.gitignore` nie zabezpiecza serwera WWW i nie usuwa plików już śledzonych — przed commitem sprawdź również `git diff --cached`.

---

## Historia wersji

### 1.5.5 (2026-10-26)

- Dodano zapamiętywanie logowania Microsoft 365 po zamknięciu przeglądarki, domyślnie przez 7 dni od zalogowania. Czas można ustawić przez `session_seconds`; w istniejącej konfiguracji należy zmienić `3600` na `604800`, aby korzystać z okresu 7 dni.
- Uniezależniono czas sesji aplikacji od ważności tokenu ID Microsoft i wydzielono katalog plikowych sesji PHP. Wylogowanie nadal natychmiast kończy sesję.

### 1.5.4 (2026-10-23)

- Dodano opcję „Tylko obecny rok szkolny” (domyślnie włączona). Po wyłączeniu lista wersji planów zawiera pełną historię archiwum, bez limitu roku szkolnego i liczby pozycji. Ustawienie jest zapamiętywane.

### 1.5.3 (2026-10-23)

- Opcja „Filtrowanie w kategoriach”: po włączeniu wyszukiwanie działa osobno w każdej kategorii (nauczyciele/sale/oddziały) i pamięta ostatnio wpisany tekst.
- Po wyłączeniu opcji wyszukiwanie jest wspólne dla wszystkich kategorii niezależnie od aktywnej zakładki (np. „1” pokaże klasy 1ta, 1tp oraz sale 11, 12, 31); wyniki z bieżącej kategorii są na początku listy.
- Przełączenie opcji od razu odświeża listę wyników.

### 1.5.2 (2026-10-22)

- Odświeżono wizualnie ekran logowania: dodano subtelne tło z poświatą, większe wgłębione logo i tekst oraz wypukłe elementy interfejsu dopasowane do jasnego i ciemnego motywu.
- Dopracowano przycisk logowania Microsoft 365 — kolorowe pola podświetlają się po najechaniu lub ustawieniu fokusu.

### 1.5.0 (2026-10-21)

- Dodano wariant PHP z logowaniem Microsoft 365, walidacją sesji i chronionym dostępem do planów oraz archiwów.
- Dodano wylogowanie z ochroną CSRF; przycisk oryginalnego planu pozostawiono tylko w publicznym `index.html`.
- Odświeżono ekran logowania, ujednolicono przełączniki motywu i dopracowano wypukły wygląd przycisków.
- Dodano konfigurację Apache z listą dozwolonych zasobów oraz instrukcję wdrożenia bez Dockera.
- Dodano lokalne środowisko Docker z blokadą plików roboczych i portem dostępnym tylko lokalnie.
- Zastąpiono narzędzie CLI minifikacji CSS bezpośrednim użyciem `clean-css`, usuwając podatne zależności narzędziowe.

### 1.4.8 (2026-09-22)
- Dodano mapowanie kodów wpisów międzyoddziałowych, np. `#W1`, z możliwością konfiguracji przez `TIMETABLE_INTERCLASS_SUBJECT_MAP`.
- Pomijane są fikcyjne oznaczenia grup, np. `3/3`, przy wpisach z kodem międzyoddziałowym.
- Przywrócono mapowanie nazwy przedmiotu, np. `wf` na `Wychowanie fizyczne`, również gdy wpis zawiera opis międzyoddziałowy.
- W widokach sal i nauczycieli obsłużono wiele oddziałów w jednym wpisie; na komputerze dostępna jest lista oddziałów w tooltipie.

### 1.4.7 (2026-09-12)
- Dodano pionowe linie oddzielające dni tygodnia w pełnoekranowym widoku desktopowym.
- Ustawiono szerokie grupy nauczycieli i sal jako domyślnie włączone.

### 1.4.6 (2026-09-10)
- W trybie mobilnym informacja o wyświetlanym planie (oddział/nauczyciel/sala) przeniesiona do osobnego wiersza nagłówka, nad przyciskiem menu i pozostałymi akcjami, aby nie była przez nie zasłaniana.
- Układ nagłówka w trybach innych niż mobilny pozostał bez zmian.

### 1.4.5 (2026-08-31)
- Dodano obsługę grup w planach nauczycieli i sal: wpisy typu `3TP-1/2` są poprawnie układane w połowach komórki.
- Skrócono odnośniki do oddziałów dla grup z formatu `1TP-1/2` do `1TP/1`.
- Dodano niezależne opcje `Szerokie grupy nauczyciela` i `Szerokie grup sali`, które wyświetlają pojedynczą grupę na pełnej szerokości kolumny.
- Ułożono opcje wyświetlania planu w dwóch kolumnach na komputerach, przy zachowaniu jednej kolumny w widoku mobilnym.

### 1.4.2 (2026-08-31)
- Usunięto przycisk drukowania w widoku mobilnym, aby lepiej dopasować układ i ograniczyć zbędne akcje na małych ekranach.
- Zostawił przycisk drukowania w wersji desktopowej bez wpływu na pozostałe funkcje widoku.

### 1.4.1 (2026-08-31)
- Ujednolicono styl przycisków w trybie ciemnym z pokrętłem przełącznika motywu (`theme-toggle-knob`).
- Dostosowano gradient, cienie i obramowania przycisków, aby były spójne z resztą interfejsu w motywie dark.
- Poprawiono wizualną równowagę między pokrętłem a innymi kontrolkami bez zmiany ich funkcjonalności.

### 1.4 (2026-08-26)
- Dodano ikonowe przyciski otwierające oryginalny plik planu i drukujące aktualnie wyświetlany prawy panel.
- Odnośnik do oryginalnego planu korzysta z aktywnego źródła, w tym skonfigurowanej ścieżki i wybranego archiwum.
- Dodano dedykowany układ wydruku: tabela z pięcioma dniami, klasyczną siatką, ciemnym nagłówkiem oraz ciemnym tekstem.
- Wydruk zawiera numer i zakres godzin każdej lekcji w jednej lewej kolumnie; szerokość i wysokość wierszy są dostosowane do czytelnego wydruku.

### 1.3.18 (2026-05-20)
- Naprawiono błąd przewijania: kliknięcie linku w panelu lewym przy włączonym przewijaniu niezależnym paneli nie przewija już panelu lewego (pozostaje na tym samym miejscu).

### 1.3.17 (2026-05-16)
- Dodano opcję `Filtrowanie w kategoriach` (checkbox w panelu ustawień na dole).
- Wprowadzono zapamiętywanie ostatniego słowa kluczowego filtrowania osobno dla kategorii oddziałów, nauczycieli i sal.
- Przełączanie zakładek kategorii zachowuje i przywraca ostatnio użyty filtr dla danej kategorii.

### 1.3.16 (2026-05-16)
- Zwiększono wartość zmiennej CSS `--sidebar-collapse-width` do `1000px`, aby poprawić zachowanie szerokości układu przy rozwiniętym panelu bocznym.

### 1.3.14 (2026-05-06)
- Zaktualizowano dokumentację: sekcja struktury projektu uwzględnia pliki zminifikowane (`app.min.js`, `app.min.css`).

### 1.3.13 (2026-05-06)
- Naprawiono zachowanie widoku mobilnego po rozwinięciu dnia: usunięto wymuszone przewijanie/fokus na aktywny dzień, dzięki czemu plan można swobodnie przewijać także do góry.
- Dodano odstęp między belką dnia a pierwszą lekcją w mobilnym akordeonie, co poprawia czytelność sekcji dnia.

### 1.3.11 (2026-05-05)
- Naprawiono skalowanie czcionki odnośników w komórkach planu: przyciski `A+` i `A-` zmieniają teraz rozmiar także dla linków oraz detali wpisów.
- Poprawiono responsywność mobilną: usunięto wymuszanie zbyt szerokiego układu i ograniczono poziome przewijanie na małych ekranach.
- Zwiększono użyteczność panelu bocznego na urządzeniach mobilnych przez poprawkę wysokości (fallback `100vh` + `100dvh`).

### 1.3.10 (2026-05-05)
- Dodano opcjonalny przełącznik `Ukryj dni bez zajęć` w panelu ustawień planu (na dole, razem z pozostałymi opcjami).
- Dodano filtrowanie dni bez wpisów: po włączeniu opcji ukrywane są kolumny/sekcje dni, w których nie ma żadnych zajęć.
- Ustawienie ukrywania pustych dni jest zapisywane lokalnie i przywracane przy kolejnym uruchomieniu.
- Rozszerzono obsługę komórek komentarzy w planie: gdy brak standardowego znacznika `.p`, treść komentarza jest parsowana jako nazwa przedmiotu.

### 1.3.8 (2026-05-05)
- Dodano przełącznik trybu przewijania `Przewijaj panele osobno` do panelu ustawień planu (razem z pozostałymi checkboxami widoczności linków).
- Ujednolicono generowanie checkboxów w panelu ustawień: wszystkie kontrolki są tworzone tym samym mechanizmem i mają spójne `id/for` oraz układ.
- W trybie `Przewijaj panele osobno` ukryto pasek przewijania prawego panelu planu przy zachowaniu pełnej obsługi przewijania.
- Wygładzono przewijanie prawego panelu w trybie `Przewijaj panele osobno` (animacja oparta o `requestAnimationFrame`).

### 1.3.7 (2026-05-02)
- Dodano konfigurowalną mapę `window.TIMETABLE_SUBJECT_WORD_ABBREVIATION_MAP` do zamiany wyrazów na skróty (np. `komputerowych -> komp.`).
- Uporządkowano pipeline przetwarzania nazwy przedmiotu do stałej kolejności: mapowanie nazwy -> kapitalizacja -> mapowanie wyrazów na skróty.

### 1.3.6 (2026-05-01)
- Dodano automatyczne skracanie długich nazw przedmiotów w komórkach planu . wyrazy są przycinane z kropką, gdy nazwa nie mieści się w limicie znaków; pełna nazwa widoczna jest po najechaniu kursorem (wersja zakomentowana do dalszych zmian).
- Dodano reguły CSS zapobiegające wychodzeniu tekstu poza tło komórki lekcji (`overflow: hidden`, `word-break: break-word`).

### 1.3.5 (2026-04-30)
- Zmieniono kolorystykę motywu jasnego na szaroniebieską z czarnymi czcionkami.
- Zmieniono kolorystykę motywu ciemnego na grafitową.
- Zmieniono akcenty na zimny niebieski, dostosowany do obu motywów.
- Dostosowano tło komórek lekcji w motywie ciemnym do reszty palety kolorów.
- Link do repozytorium GitHub wyświetlany jest teraz w osobnej linii poniżej informacji o generatorze planu.

### 1.3.4 (2026-04-30)
- Naprawiono błąd `ReferenceError: ARCHIVE_RECENT_YEARS is not defined` uniemożliwiający ładowanie listy archiwalnych planów.
- Zmieniono filtrowanie archiwów: lista wyświetla wyłącznie plany z bieżącego roku szkolnego (od 1 września), zamiast okna ostatnich N lat kalendarzowych.
- Dodano opcję konfiguracji limitu liczby wpisów archiwalnych przez `window.TIMETABLE_ARCHIVE_MAX_ENTRIES` (domyślnie 24).

### 1.3.3 (2026-04-29)
- Dodano automatyczną kapitalizację nazwy przedmiotu (pierwsza litera wielka) po mapowaniu i normalizacji nazw.
- Ujednolicono szerokości wpisów lekcji w komórkach planu (równe kolumny dla równoległych grup).
- Dodano automatyczne wstawianie pustego slotu dla brakującej grupy przy pojedynczym wpisie typu `X/N`, aby podział grup był zawsze widoczny.
- Dla pustych slotów usunięto tło i obramowanie, dzięki czemu nie są wizualnie widoczne.

### 1.3.2 (2026-04-29)
- Dodano obsługę mapy `window.TIMETABLE_SUBJECT_NAME_MAP`, pozwalającej podmieniać nazwy przedmiotów według reguły `stara_nazwa -> nowa_nazwa` podczas parsowania planu.
- Dodano normalizację nazw z oznaczeniem grupy w formacie `przedmiot-2/2` do `przedmiot 2/2` przed mapowaniem oraz obsługę mapowania bazowej nazwy z zachowaniem sufiksu grupy.

### 1.3.1 (2026-04-24)
- Naprawiono przewijanie wysuwanego panelu bocznego w widoku mobilnym. Lista oddziałów, nauczycieli i sal ma teraz własny pionowy scroll i pozostaje używalna przy dłuższych zestawieniach.

### 1.3.0 (2026-04-23)
- Ulepszono styl kontrolki wyboru wersji planu (`select`) tak, aby spójnie działał w motywie jasnym i ciemnym (kolory tła, obramowania, focus, lista opcji).
- Dodano logiczny separator `Archiwalne:` po pozycji `Aktualny` w liście źródeł planu (pozycja nieaktywna, tylko informacyjna).
- Zmieniono kolejność archiwalnych folderów planu na malejącą po dacie (`do RRRR.MM.DD`) — od najnowszych do najstarszych.
- Ograniczono listę archiwów do wpisów z bieżącego roku szkolnego (od 1 września) z limitem liczby pozycji (domyślnie 24, konfigurowalny przez `window.TIMETABLE_ARCHIVE_MAX_ENTRIES`).
- Dodano dynamiczny opis pozycji aktualnego planu w selekcie: `Aktualny: (RRRR - MM - DD)` na podstawie pola `Obowiazuje od`; jeśli brak daty, pozostaje `Aktualny`.
- Ujednolicono kolor linku do repozytorium GitHub w stopce, tak aby zawsze był taki sam jak kolor otaczającego tekstu.

### 1.2.0 (2026-04-23)
- Poprawka wyświetlania kolumny godzin przy węższym oknie przeglądarki — usunięto `white-space: nowrap`, zwiększono minimalną szerokość kolumny.
- Usunięto pogrubienia z czcionek w całej aplikacji.

### 1.1.0 (2026-04-23)
- Dodano obsługę konfigurowalnej ścieżki do folderu planu przez zmienną `window.TIMETABLE_PLAN_ROOT`.
- Dodano plik `.vscode/settings.json` z konfiguracją Live Server.
- Dodano instrukcję uruchamiania przez `npx serve` z katalogu nadrzędnego.

### 1.0.0 (wersja początkowa)
- Odczyt listy oddziałów, nauczycieli i sal z pliku `lista.html`.
- Parsowanie i renderowanie tabeli planu z plików Vulcan.
- Wyszukiwanie i filtrowanie pozycji na liście bocznej.
- Zakładki kategorii z zachowaniem aktywnego widoku.
- Przełączniki widoczności etykiet (nauczyciel, sala, oddział) per kategoria.
- Regulacja rozmiaru czcionki planu (A− / A+) z zapisem w `localStorage`.
- Motyw jasny/ciemny z wykrywaniem preferencji systemowych i zapisem w `localStorage`.
- Responsywny widok mobilny z akordeonem dni i wysuwanym panelem bocznym.
