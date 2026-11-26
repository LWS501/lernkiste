# Änderungsprotokoll Lernkiste

Versionsschema **Hauptversion.Unterversion**: Die Hauptversion steigt bei neuen Lernfunktionen oder größeren Umbauten, die Unterversion bei neuen Lernstapeln und kleinen Korrekturen. Jede Version liegt als Kopie in `versions/lernkiste-vX.Y.html`. Live ist immer `index.html`.

## 4.1 – 26.11.2026
- **Vokabeltest prüft jetzt sofort:** Nach jedem Wort erscheint richtig/falsch mit Lösung, dann geht es weiter. Zähler der richtigen Antworten läuft oben mit
- Neue Einstellung **„Rückmeldung“**: „Sofort nach jedem Wort“ (Standard) oder „Erst am Ende (wie im Test)“; die Wahl wird gemerkt
- Im Sofort-Modus gibt es kein „Zurück“, damit eine geprüfte Antwort nicht nachträglich geändert wird
- Punktzahl, Fehlerliste, „Fehler üben“ und „War doch richtig“ am Ende bleiben; im Lernstand steht je Test „sofort geprüft“ oder „wie im Test“
- Abnahmetests erweitert (78 Tests)

## 4.0 – 26.11.2026
- **Prüfungsart je Stapel:** Stapel mit `kind: "vocab"` verhalten sich als Vokabeltest; alle anderen Stapel (Geschichte) bleiben unverändert
- **Tippen statt Aufdecken:** In Vokabel-Stapeln wird die Antwort eingetippt und automatisch geprüft (Karteikarten, Tagesrunde). Richtig = Stufe steigt, falsch = Karte kommt in der Runde wieder
- **Prüfregeln:** Groß-/Kleinschreibung egal, Klammerzusätze und „to“/Artikel optional, britische und amerikanische Schreibweise, ß/ss und Umlaute als ae/oe/ue; Einträge mit mehreren Begriffen verlangen die angegebene Anzahl. Ein Buchstabe daneben = „fast richtig“ mit Korrektur, zählt aber als Fehler
- **Neuer Modus „Vokabeltest“** (ersetzt dort die Probeklausur): 10/20/alle Wörter am Stück, Richtung wählbar, Rückmeldung erst am Ende mit Fehlerliste und „Fehler üben“; Ergebnis steht im Lernstand
- **„War doch richtig“** für richtige Übersetzungen, die die App nicht kennt – wird im Lernstand vermerkt
- Englisch-Stapel umgestellt (86 Karten mit hinterlegten Antworten) und um **14 Lückensätze** ergänzt (als „Zusatz, nicht vom Lehrer“ gekennzeichnet, nicht Teil des Vokabeltests)
- Korrektur: Ergebnisboxen sind jetzt wirklich grün/rot umrandet (vorher immer blau)
- Stapelformat: neue Felder `kind`, `ok`, `need`, `all`, `lang`, `add`; `tools/lk_deck.py` und Abnahmetests erweitert (70 Tests)
- Zurückgestellt: automatische Prüfung frei geschriebener Texte in anderen Klausuren

## 3.1 – 26.11.2026
- Neuer Lernstapel **Englisch – Geography vocabulary: Population** (90 Karten: 40 Vokabeln in beide Richtungen, Abkürzungen LEDC/NIC/MEDC, Formel zum Bevölkerungswachstum, 3 Rechenkarten; 5 Zuordnen-Sets, 6 Probeklausur-Aufgaben), Test am 26.11.
- Abnahmetests wählen den Geschichte-Stapel fest aus (unabhängig von weiteren Stapeln)

## 3.0 – 24.11.2026
- **Tagesrunde:** fällige Karten und Fehler-Revanchen als kurze Runde, danach Anzeige der nächsten Übung
- **Fehler-Revanche:** Quizfehler kommen am Folgetag ohne Auswahl wieder (freier Abruf)
- **Quiz verdeckt:** erst frei antworten, dann die Auswahl aufdecken (abschaltbar; Lernstand-Test bleibt offen)
- Audit-Korrekturen: vollständig geprüfter Import, Erkennen beschädigter Daten, sichtbare Speicherfehler, Sicherung und Wiederherstellung
- Stufe steigt nur bei fälligem, selbstständigem Abruf; Quiz wird getrennt erfasst
- Quizfeedback passend zur Frage, Lernstand-Test wird genau einmal gespeichert
- Probeklausur: Entwurf fortsetzen, Antwort festhalten, bestanden ab 50 %
- Termin: aus dem Stapel / eigenes Datum / ohne Termin; „Noch keine Einschätzung“
- VoiceOver-Verbesserungen, besserer Kontrast der Bewertungsknöpfe, Offline-Start (`sw.js`)
- Versionsnummer unter „Mehr“, einmaliger Hinweis „Neu in Version …“, Trophäe „Drache“

## 2.0 – 23.11.2026
- Mehrere Lernstapel als JSON-Blöcke, Stapelwahl auf der Startseite
- Vorlesen standardmäßig aus
- Rechenkarten mit Toleranz und Lösungsweg, Formeln mit Hoch- und Tiefstellung

## 1.0 – 23.11.2026
- Erste Version: Karteikarten, Quiz, Zuordnen, Probeklausur, Lernstand-Test, Trophäen; Stapel Geschichte (47 Karten)
