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

Zurückrollen: gewünschte Datei aus `versions/` als `index.html` hochladen.

## Prüfungsart „Vokabeltest“ (ab 4.0)

Ein Stapel mit `"kind": "vocab"` wird getippt und automatisch geprüft. Felder je Karte:

| Feld | Bedeutung |
|---|---|
| `ok` | Liste der verlangten Begriffe; gleichwertige Schreibweisen je Eintrag mit `|` trennen, Klammern sind optional: `["(slum) dweller|(slum) dwellers"]` |
| `need` | wie viele Einträge aus `ok` verlangt sind (Standard 1), z. B. `["stationary","constant","steady"], "need": 3` |
| `all` | zusätzliche vollständige Antworten, die als Ganzes gelten (die Musterantwort `a` gilt immer) |
| `lang` | Sprache der Antwort: `en` oder `de` (steuert Tastatur und Testrichtung) |
| `add` | `true` = Zusatzkarte, nicht vom Lehrer (z. B. Lückensatz); nicht Teil des Vokabeltests |

Karten ohne `ok` werden wie bisher aufgedeckt und selbst bewertet.

## Prüfungsart „Mathe“ mit Rechentraining (ab 5.0)

Ein Stapel mit `"kind": "math"` und `tasks` zeigt statt der Probeklausur das **Rechentraining**. Jede Aufgabe ist eine Vorlage:

| Feld | Bedeutung |
|---|---|
| `id`, `t`, `n` | eindeutige id, Thema, Name des Aufgabentyps (steht im Lernstand) |
| `q` | Aufgabentext mit Platzhaltern in eckigen Klammern: `Ein Kegel hat den Radius r = [r] cm …` |
| `sets` | Zahlensätze, z. B. `[{"r": 3, "h": 4}, {"r": 5, "h": 12}]` – der erste Satz sind die Zahlen vom Blatt |
| `steps` | Rechenschritte in Reihenfolge (siehe unten) |
| `g`, `tip` | Skizze (Grafik-id) und Merksatz nach der Aufgabe |

Schritte: `{"k": "pick", "q": …, "o": [richtige Formel, falsche …]}` oder `{"k": "num", "q": …, "f": "pi*r^2*h/3", "u": "cm³"}`. Bei `num` zusätzlich: `as` (Name des Zwischenwerts für spätere Schritte), `w` (Rechenzeile mit Platzhaltern, die App hängt „= Ergebnis“ an), `final: true` (wird auch „wie in der Arbeit“ gefragt), `err` (typische Fehler `[{"f": "pi*r^2*h", "m": "⅓ vergessen …"}]`), `uo` (eigene Einheiten-Auswahl, sonst cm/cm²/cm³), `n` (Kurzname). Rechenausdrücke: Zahlen mit Punkt, Namen, `+ - * / ^`, Klammern, `sqrt()`, `cbrt()`, `pi`.

Weitere Felder: Grafik `{"k": "shape", "s": "kegel"}` (quader, zylinder, kegel, pyramide, kugel, prisma, netz-zylinder, netz-kegel, netz-pyramide, eiswaffel, turm), Kartenfeld `gq: true` (Skizze schon auf der Vorderseite) und `checklist: [{"n": "Ich kann …", "tasks": [ids], "cards": [ids]}]` für die Ampel im Lernstand.
