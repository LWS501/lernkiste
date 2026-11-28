# Lernkiste – Arbeitsanweisung für Claude

Lernkarten-Web-App für eine Schülerin (9. Klasse Gymnasium). Sie läuft als Web-App auf dem Home-Bildschirm, **gleichwertig auf iPhone (Safari) und Android (Chrome)**. Die Eltern sehen im Lernstand, wie weit sie ist.
Live: https://lws501.github.io/lernkiste/ · Repo: LWS501/lernkiste · Konzept und Entscheidungen: claude.ai-Projekt „Lernapp“, Dokument `claude/lernkiste-konzept.md`.

## Feste Regeln (nicht verhandelbar)
- **IMPORTANT: Der Lernfortschritt darf nie verloren gehen.** Folgende Namen nie umbenennen: die localStorage-Schlüssel `lernkiste-v1`, `lernkiste-decks` und `lernkiste-sicherung-*` sowie Stapel-ids und Karten-ids. Ändert sich das Format des Speicherstands: Migration schreiben und mit einem alten Speicherstand testen.
- Kein Server, keine KI, kein Konto, kein Tracking im Betrieb. Kein Build-Schritt. Keine npm-Pakete zur Laufzeit (jsdom nur für Tests).
- Der Einstieg bleibt `index.html`, damit Link und Home-Bildschirm-Symbol gleich bleiben.
- Jede Version ändert diese vier Stellen gemeinsam: `APP_VERSION` in `index.html`, `CACHE` in `sw.js` (`lernkiste-vX-Y`), einen Eintrag in `CHANGELOG.md` und die Kopie `versions/lernkiste-vX.Y.html`. Git-Tags sind über den Claude-Zugang gesperrt (403), deshalb gibt es das Archiv.
- Versionsschema: neuer Stapel, Korrektur oder Bugfix = +0.1. Neue Lernfunktion oder Umbau = neue Hauptversion.

## Befehle
```bash
npm i --no-save jsdom@24                  # einmalig (oder JSDOM_PATH=/pfad/node_modules/jsdom)
bash tools/lk_test.sh                     # ALLE Prüfungen: Rauchtest, Abnahme, Prüfregeln, Stapel, Versionen
python3 tools/lk_deck.py validate deck.json
python3 tools/lk_deck.py add index.html deck.json      # gleiche id = ersetzen
python3 tools/lk_deck.py list index.html
```
Einzeltests während der Arbeit: `node tests/abnahme.js index.html` usw. Vor jedem Commit läuft immer `bash tools/lk_test.sh`.

## Kontext sparen (Effizienz)
- **`index.html` nie ganz lesen.** Die Datei hat 230 KB, jeder Stapel steht in einer einzigen Zeile mit bis zu 48 KB. Stattdessen mit `grep -n` die Stelle suchen und dann `Read` mit `offset`/`limit` nutzen.
- Stapel nie von Hand im HTML bearbeiten. Immer `deck.json` schreiben, dann `lk_deck.py validate` und danach `add` ausführen.
- Kleine, gezielte `Edit`-Änderungen. Keinen fremden Code umformatieren, keine Nebenbei-Refactorings, keine ganzen Dateien im Chat ausgeben.
- Breite Suche oder Analyse im Subagent ausführen, im Hauptkontext nur das Ergebnis behalten.
- Berichte enthalten das Ergebnis, die Belege (Testausgabe, geänderte Dateien) und offene Annahmen. Keine nacherzählten Arbeitsschritte.
- Beim Komprimieren des Kontexts erhalten: geänderte Dateien, Zielversion, Testbefehle und offene Annahmen.

## Ablauf je Änderungsart
| Art | Ablauf | Live-Freigabe |
|---|---|---|
| Neuer Stapel / Inhaltskorrektur | Skill `lernkiste-update`: Fotos → `deck.json` → validate → add → Version +0.1 → `lk_test.sh` → Push `main` | direkt, wenn alles grün ist |
| Bugfix | 1. Test schreiben, der den Fehler zeigt (rot) → 2. Ursache beheben → grün → Version +0.1 → Push `main` | direkt, wenn alles grün ist |
| Neue Lernfunktion / Umbau (Hauptversion) | Interview mit `AskUserQuestion` → Konzept im Projekt-Dokument → Freigabe → Branch `feature/<name>` → Test-first → unabhängiges Review → PR | **Merge nur nach ausdrücklicher Freigabe** |

Das Konzept für eine Hauptversion ist ein eigenes Dokument und nennt: Ziel, Nicht-Ziele, Varianten A/B(/C) mit Bewertung, Datenformat, Prüfregeln, Annahmen (als solche markiert) und Abnahmekriterien als überprüfbare Liste.

**Unabhängiges Review (nur bei Hauptversionen):** Ein Subagent bekommt nur den Diff, das Konzept und diese Datei, nicht den Verlauf. Er meldet nur Fehler, die Korrektheit, Datenverlust, Sicherheit oder Abnahmekriterien betreffen. Stilfragen sind optional und werden nicht abgearbeitet.

## Test-first und „fertig“
- Neues Verhalten: zuerst einen Abnahmetest in `tests/abnahme.js` schreiben und rot sehen, dann programmieren.
- Prüflogik (Vokabeln, Mathe): Fälle als Tabelle in `tests/pruefregeln.js`. Rechenaufgaben unabhängig nachrechnen, nicht mit der Formel aus dem Stapel.
- **Fertig** heißt: `lk_test.sh` meldet „ALLE PRÜFUNGEN GRÜN“, die GitHub Action ist grün und nach dem Push zeigt die Live-Seite die neue `APP_VERSION` (`curl -s https://lws501.github.io/lernkiste/ | grep -o 'APP_VERSION="[^"]*"'`). Ohne diese Belege nicht „fertig“ melden.
- Tests nie abschwächen, auskommentieren oder löschen, nur damit sie grün werden. Wenn ein Test falsch ist: begründen und offen ansprechen.

## Code-Regeln
- Vanilla JavaScript. Zielplattformen: aktuelles iOS-Safari **und** aktuelles Chrome auf Android. Nur Web-Standards nutzen, die beide können. Funktionen, die nur ein System kennt, brauchen einen Ersatzweg. Die vorhandenen Muster übernehmen (Klick-Behandlung über `data-act`/`data-v`) und keine zweite Architektur daneben bauen.
- Inhalte aus Stapeln und Importen nie ungeprüft über `innerHTML` einsetzen. Text maskieren oder `textContent` nutzen. Importierte Dateien vor dem Speichern prüfen.
- Jeder Zugriff auf `localStorage` steht in `try/catch`. Ein voller oder gesperrter Speicher führt zu einem Hinweis, nicht zum Absturz.
- Beide Systeme: Tippziele ≥ 44 px, `font-size` ≥ 16 px in Eingabefeldern (sonst zoomt Safari), Eingabefelder mit `autocapitalize="off" autocorrect="off" spellcheck="false"` und passendem `inputmode`/`enterkeyhint`, `env(safe-area-inset-*)` beachten, `dvh` statt `vh` für volle Höhe (Bildschirmtastatur).
- Nur Android: Die Zurück-Taste bzw. -Geste schließt zuerst den offenen Dialog bzw. führt zum vorherigen Bildschirm und beendet die App nicht sofort (`history.pushState` + `popstate`). Die Installation als App läuft über das Web-App-Manifest (`manifest.webmanifest`, Icons 192/512 px, `display: standalone`, `theme-color`). Vorlese-Stimmen sind auf jedem Gerät anders, deshalb muss Vorlesen auch ohne deutsche Stimme sauber abbrechen.
- **Zurück-Taste (ab 5.1):** Außerhalb der Startseite oder bei offenem Dialog liegt genau ein Verlaufseintrag `lk-back` (`backGuard()`/`dropGuard()`, `popstate`). Deshalb: Ansichten nur über `go(v)` wechseln, Dialoge nur als `.modal` über `showTro()`/`closeTro()` oder mit `backGuard()` öffnen. `#view` trägt `data-view` für die Tests.
- Barrierefreiheit: Bedienbar mit VoiceOver (iPhone) und TalkBack (Android) (Rollen, Beschriftungen, Fokus nach Moduswechsel), ausreichender Kontrast, `prefers-reduced-motion` respektieren.
- Leistung: Kein Startruckeln. Große Listen nicht bei jeder Eingabe neu aufbauen, keine Bibliotheken für Kleinigkeiten.
- App-Texte: Deutsch, kurz, Du-Form, ermutigend. Kommentare und Bezeichner wie im Bestand.

## Zielbild Version 6.0 (beschlossen, Konzept folgt)
Code und Stapel werden getrennt: Stapel kommen als eigene Dateien nach `decks/`, die App bleibt ohne Build-Schritt und offline nutzbar. Ladeweg (`fetch` von JSON oder Skriptdateien), Offline-Zwischenspeicher in `sw.js`, Anpassung der Tests und von `lk_deck.py` sowie die Übernahme alter Speicherstände entscheidet das 6.0-Konzept. Bis 6.0 live ist, gelten die Regeln oben.

## Git und Deploy
- Commit-Nachricht: `Lernkiste X.Y: <was sich für die Nutzerin ändert>`.
- GitHub Pages braucht nach dem Push einige Minuten. Danach die App auf dem Handy (iPhone oder Android) ganz schließen und neu öffnen.
- Zurückrollen: die gewünschte Datei aus `versions/` als `index.html` übernehmen, dann neue Unterversion.

## Abschluss jeder Aufgabe
1. Projekt-Dokument `claude/lernkiste-konzept.md` aktualisieren: Versionstabelle, Stapel, Offen.
2. Kurze Prüfliste für die Eltern: Was auf iPhone **und** Android ausprobieren?
3. Annahmen und nicht Bestätigtes ausdrücklich nennen.
