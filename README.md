# Timetable Wrapper

Nowoczesny wrapper planu lekcji oparty o dane z oryginalnego folderu wygenerowanego przez program **Plan Lekcji firmy Vulcan**. Aplikacja pobiera i parsuje oryginalne pliki HTML, a następnie renderuje plan w przejrzystym widoku bez ramek.

## Wymagania

- Folder z planem wygenerowany przez Vulcan (domyślnie katalog `plan` obok folderu projektu).
- Lokalny serwer HTTP — aplikacja korzysta z `fetch()`, który nie działa przy otwarciu pliku bezpośrednio z dysku (`file://`).

## Uruchomienie

Uruchom serwer HTTP z katalogu **nadrzędnego** względem projektu, tak aby folder `plan` i folder `TimetableWrapper` były dostępne obok siebie:

```powershell
cd "c:\Dane lokalne\Source"
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

## Funkcje

- **Trzy kategorie** — oddziały, nauczyciele, sale; przełączane zakładkami.
- **Wyszukiwanie** — filtrowanie listy w czasie rzeczywistym.
- **Etykiety w komórkach** — przełączniki widoczności linków do nauczyciela, sali i oddziału (osobno dla każdej kategorii).
- **Rozmiar czcionki** — przyciski A− / A+ skalują treść planu (zakres 80–130%, zapisywany lokalnie).
- **Motyw jasny/ciemny** — przełącznik z automatycznym wykrywaniem preferencji systemowych; wybór zapisywany lokalnie.
- **Widok mobilny** —  poniżej 860 px tabela zostaje zastąpiona widokiem "akordeon" z podziałem na dni tygodnia. Panel boczny wysuwa się po naciśnięciu przycisku Menu.
- **Informacje o planie** — data obowiązywania i data wygenerowania wyświetlane pod planem.

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
```

## Motywy

Aplikacja obsługuje motywy jasny i ciemny. Przy pierwszym uruchomieniu wybierany jest motyw zgodny z ustawieniami systemu operacyjnego. Wybór użytkownika zapisywany jest w `localStorage`.

---

## Historia wersji

### 1.2.0 — 2026-04-23
- Poprawka wyświetlania kolumny godzin przy węższym oknie przeglądarki — usunięto `white-space: nowrap`, zwiększono minimalną szerokość kolumny.
- Usunięto pogrubienia z czcionek w całej aplikacji.

### 1.1.0 — 2026-04-23
- Dodano obsługę konfigurowalnej ścieżki do folderu planu przez zmienną `window.TIMETABLE_PLAN_ROOT`.
- Dodano plik `.vscode/settings.json` z konfiguracją Live Server.
- Dodano instrukcję uruchamiania przez `npx serve` z katalogu nadrzędnego.

### 1.0.0 — wersja początkowa
- Odczyt listy oddziałów, nauczycieli i sal z pliku `lista.html`.
- Parsowanie i renderowanie tabeli planu z plików Vulcan.
- Wyszukiwanie i filtrowanie pozycji na liście bocznej.
- Zakładki kategorii z zachowaniem aktywnego widoku.
- Przełączniki widoczności etykiet (nauczyciel, sala, oddział) per kategoria.
- Regulacja rozmiaru czcionki planu (A− / A+) z zapisem w `localStorage`.
- Motyw jasny/ciemny z wykrywaniem preferencji systemowych i zapisem w `localStorage`.
- Responsywny widok mobilny z akordeonem dni i wysuwanym panelem bocznym.
