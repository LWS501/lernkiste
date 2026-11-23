# Lernkiste

Lernkarten-App als **eine** statische `index.html` (immer die aktuelle Version; der Name bleibt fest, damit Link und Home-Bildschirm-Symbol gleich bleiben) (GitHub Pages), genutzt als Web-App auf dem iPhone. Keine KI und kein Server im Betrieb; der Fortschritt liegt in `localStorage` auf dem Gerät.

| Datei | Zweck |
|---|---|
| `index.html` | App; Lernstapel als JSON-Blöcke zwischen `@@LK-DECKS-START@@` und `@@LK-DECKS-END@@` |
| `CHANGELOG.md` | Änderungsprotokoll mit Versionsschema |
| `versions/` | Archiv aller Versionen (`lernkiste-vX.Y.html`) – nur zum Nachsehen und Zurückrollen, nicht zum Lernen öffnen (gleicher Speicher wie die Live-App) |
| `sw.js` | Offline-Zwischenspeicher (nur auf github.io aktiv) |
| `tools/lk_deck.py` | Stapel prüfen und einbauen: `python3 tools/lk_deck.py validate|list|add|remove …` |
| `tools/lk_smoke.js` | Rauchtest: klickt alle Modi durch |
| `tests/abnahme.js` | Abnahmetests (Import, Speicher, Stufenlogik, Quiz, Test, Klausurentwurf, Termin, VoiceOver, Sicherung) |

Tests: `npm i jsdom@24`, dann `node tools/lk_smoke.js index.html` und `node tests/abnahme.js index.html`.

Zurückrollen: gewünschte Datei aus `versions/` als `index.html` hochladen (oder `git checkout vX.Y -- index.html`).
