# Timetable Wrapper

Wrapper planu lekcji oparty o dane z oryginalnego folderu wygenerowanego przez program **Plan Lekcji firmy Vulcan**. Aplikacja pobiera i parsuje oryginalne pliki HTML, a następnie renderuje plan w przejrzystym widoku bez ramek.

## Wymagania

- Folder z planem wygenerowany przez Vulcan (domyślnie katalog `plan` obok folderu projektu).
- Folder `stareplany` obok folderu `plan` (opcjonalnie) z podfolderami archiwalnych wersji planu.
- Lokalny serwer HTTP — aplikacja korzysta z `fetch()`, który nie działa przy otwarciu pliku bezpośrednio z dysku (`file://`).

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

## Funkcje

- **Trzy kategorie** — oddziały, nauczyciele, sale; przełączane zakładkami.
- **Wyszukiwanie** — filtrowanie listy w czasie rzeczywistym.
- **Etykiety w komórkach** — przełączniki widoczności linków do nauczyciela, sali i oddziału (osobno dla każdej kategorii).
- **Rozmiar czcionki** — przyciski A− / A+ skalują treść planu (zakres 80–130%, zapisywany lokalnie).
- **Motyw jasny/ciemny** — przełącznik z automatycznym wykrywaniem preferencji systemowych; wybór zapisywany lokalnie.
- **Widok mobilny** —  poniżej 860 px tabela zostaje zastąpiona widokiem "akordeon" z podziałem na dni tygodnia. Panel boczny wysuwa się po naciśnięciu przycisku Menu.
- **Informacje o planie** — data obowiązywania i data wygenerowania wyświetlane pod planem.
- **Historia nawigacji** — przyciski przeglądarki Wstecz/Dalej przełączają wcześniej otwierane plany (także między wersjami archiwalnymi).

## Struktura projektu

```
TimetableWrapper/
├── index.html          # Główny plik aplikacji
├── css/
│   └── app.css         # Style (motywy, układ, tabela, widok mobilny)
└── scripts/
    └── app.js          # Logika aplikacji (fetch, parsowanie, renderowanie)

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

### 1.3.1 (2026-04-24)
- Naprawiono przewijanie wysuwanego panelu bocznego w widoku mobilnym. Lista oddziałów, nauczycieli i sal ma teraz własny pionowy scroll i pozostaje używalna przy dłuższych zestawieniach.

### 1.3.0 (2026-04-23)
- Ulepszono styl kontrolki wyboru wersji planu (`select`) tak, aby spójnie działał w motywie jasnym i ciemnym (kolory tła, obramowania, focus, lista opcji).
- Dodano logiczny separator `Archiwalne:` po pozycji `Aktualny` w liście źródeł planu (pozycja nieaktywna, tylko informacyjna).
- Zmieniono kolejność archiwalnych folderów planu na malejącą po dacie (`do RRRR.MM.DD`) — od najnowszych do najstarszych.
- Ograniczono listę archiwów do ostatnich wpisów z bieżącego i poprzedniego roku (z limitem liczby pozycji).
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
