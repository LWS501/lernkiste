# Änderungsprotokoll Lernkiste

Versionsschema **Hauptversion.Unterversion**: Die Hauptversion steigt bei neuen Lernfunktionen oder größeren Umbauten, die Unterversion bei neuen Lernstapeln und kleinen Korrekturen. Jede Version liegt als Kopie in `versions/lernkiste-vX.Y.html`. Live ist immer `index.html`.

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
