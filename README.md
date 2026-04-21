# Timetable Wrapper

Nowoczesny wrapper planu lekcji oparty o dane z folderu `src`.

## Co robi aplikacja

- Odczytuje listę pozycji z `src/lista.html` (oddziały, nauczyciele, sale).
- Po wyborze pozycji pobiera odpowiedni plik z `src/plany/*.html`.
- Parsuje oryginalną tabelę planu i renderuje ją w nowym widoku bez ramek.
- Działa responsywnie na desktopie i urządzeniach mobilnych.

## Struktura

- `index.html` - punkt wejscia aplikacji (poza `src`).
- `scripts/app.js` - logika odczytu i renderowania planu (poza `src`).
- `css/app.css` - nowy, responsywny styl (poza `src`).
- `src/` - dane z generatora (folder moze byc podmieniany w calosci).

## Motywy

- Aplikacja ma przelacznik jasny/ciemny (ikona slonce/ksiezyc).
- Wybrany motyw jest zapisywany lokalnie w przegladarce.

## Uruchomienie

Ponieważ aplikacja korzysta z `fetch`, uruchamiaj ją przez lokalny serwer HTTP (a nie bezpośrednio przez `file:///`).

Przyklad (Python):

```bash
cd .
python -m http.server 8000
```

Następnie otwórz: `http://localhost:8000`.
