# Timetable Wrapper

[![Release](https://img.shields.io/github/v/release/November7/TimetableWrapper?display_name=tag)](https://github.com/November7/TimetableWrapper/releases)
[![Last commit](https://img.shields.io/github/last-commit/November7/TimetableWrapper)](https://github.com/November7/TimetableWrapper/commits/main)

Wrapper planu lekcji oparty o dane z oryginalnego folderu wygenerowanego przez program **Plan Lekcji firmy Vulcan**. Aplikacja pobiera i parsuje oryginalne pliki HTML, a następnie renderuje plan w przejrzystym widoku bez ramek.

## Wymagania

- Folder z planem wygenerowanym przez Vulcan (domyślnie katalog `plan` obok folderu projektu).
- Folder `stareplany` obok folderu `plan` (opcjonalnie) z podfolderami archiwalnych wersji planu.
- Lokalny serwer HTTP — aplikacja korzysta z `fetch()`, który nie działa przy otwarciu pliku bezpośrednio z dysku (`file://`) lub  publiczny serwer produkcyjny.

## Uruchomienie

Uruchom serwer HTTP z katalogu **nadrzędnego** względem projektu, tak aby foldery `plan`, `stareplany` i `TimetableWrapper` były dostępne obok siebie:

```powershell
cd "path_to_directory_containing_local_repo"
npx serve . --listen 5500
```

Następnie otwórz w przeglądarce:

```
http://localhost:5500/TimetableWrapper/
```

### Konfiguracja ścieżki do planu

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
- **Widok mobilny** —  poniżej 860 px tabela zostaje zastąpiona widokiem "akordeon" z podziałem na dni tygodnia. Panel boczny wysuwa się po naciśnięciu przycisku Menu.
- **Podział grup w komórkach** — gdy w danej lekcji występuje tylko jedna grupa w formacie `X/N` (np. `1/2`, `2/2`, `1/3`), aplikacja automatycznie dokłada pusty slot po przeciwnej stronie, aby zachować czytelny podział. Grupa `1/N` jest po lewej, a `X/N` dla `X>1` po prawej.
- **Równe kolumny wpisów** — wpisy lekcji w jednej komórce mają zawsze taką samą szerokość.
- **Informacje o planie** — data obowiązywania i data wygenerowania wyświetlane pod planem.
- **Historia nawigacji** — przyciski przeglądarki Wstecz/Dalej przełączają wcześniej otwierane plany (także między wersjami archiwalnymi).

## Struktura projektu

```
TimetableWrapper/
├── index.html          # Główny plik aplikacji
├── css/
│   ├── app.css         # Style źródłowe (motywy, układ, tabela, widok mobilny)
│   └── app.min.css     # Style zminifikowane
└── scripts/
    ├── app.js          # Logika aplikacji (fetch, parsowanie, renderowanie)
    └── app.min.js      # Logika zminifikowana

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

---

## Historia wersji

### 1.3.17 (2026-05-16)
- Dodano opcję `Pamietaj filtrowania w kategoriach` (checkbox w panelu ustawień na dole).
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
