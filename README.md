# Lernkiste

Lernkarten-App als **eine** statische `index.html` (GitHub Pages), genutzt als Web-App auf dem iPhone. Keine KI und kein Server im Betrieb; der Fortschritt liegt in `localStorage` auf dem Gerät.

| Datei | Zweck |
|---|---|
| `index.html` | App; Lernstapel als JSON-Blöcke zwischen `@@LK-DECKS-START@@` und `@@LK-DECKS-END@@` |
| `sw.js` | Offline-Zwischenspeicher (nur auf github.io aktiv) |
| `tools/lk_deck.py` | Stapel prüfen und einbauen: `python3 tools/lk_deck.py validate|list|add|remove …` |
| `tools/lk_smoke.js` | Rauchtest: klickt alle Modi durch |
| `tests/abnahme.js` | Abnahmetests (Import, Speicher, Stufenlogik, Quiz, Test, Klausurentwurf, Termin, VoiceOver, Sicherung) |

Tests: `npm i jsdom@24`, dann `node tools/lk_smoke.js index.html` und `node tests/abnahme.js index.html`.
