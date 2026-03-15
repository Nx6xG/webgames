# Patch Notes

## 2026-03-15

### Neue Features
- **Turnier-System** — Erstelle Single-Elimination-Turniere (4/8/16 Spieler) für alle Multiplayer-Spiele! Bracket-Visualisierung, automatisches Matchmaking und Champion-Krönung
- **Spiele-Favoriten** — Markiere Spiele mit einem Stern als Favorit, sie erscheinen dann ganz oben auf der Startseite
- **Sound-Lautstärke** — Neuer Lautstärke-Regler (0-100%) statt nur Stumm-Schalten, erreichbar über das Lautsprecher-Symbol
- **Replay für alle Multiplayer-Spiele** — Jedes Multiplayer-Spiel hat jetzt einen Replay-Modus nach Spielende (RPS, Battleship, Liar's Deck, Curve Fever, UNO)
- **Spectator-Chat** — Zuschauer können jetzt chatten, mit einem "Zuschauer"-Badge neben ihrem Namen

### Curve Fever
- **Neues Item: Wandportal 🌀** — Durchdringe Wände und erscheine auf der gegenüberliegenden Seite (3 Sekunden)
- **Geist-Buff** — Geist-Dauer von 1 auf 2 Sekunden verdoppelt
- **Bessere Bots** — Bots erkennen jetzt Wände zuverlässig und weichen rechtzeitig aus
- **Durchsichtiges Scoreboard** — Das Scoreboard wird transparent, wenn dein Spieler dahinter ist

### Asteroids
- **Boss-Kämpfe** — Alle 5 Wellen erscheint ein Boss-Schiff (10 HP, schießt zurück, 500 Punkte)
- **3 neue Power-Ups** — Homing-Raketen (lila), Multishot 5-fach (pink) und Zeitlupe (weiß)
- **Mehr Items** — 25% Drop-Chance bei großen und 10% bei mittleren Asteroiden

### Whack-a-Mole
- **Wellen-System** — 6 thematische Wellen in 60 Sekunden: Normal → Schneller → Goldrausch → Bombenalarm → Speed-Runde → CHAOS

### Geometry Dash
- **10 handdesignte Level** — Von "Stereo Madness" bis "xStep" mit steigender Schwierigkeit
- **Level-Auswahl** — Wähle dein Level, schalte neue frei (80%+ zum Freischalten), sammle Sterne
- **Endlos-Modus** — Klassischer prozeduraler Modus weiterhin verfügbar

### UNO
- **Gleiche Karten stapeln** — Neue Hausregel: Spiele mehrere identische Karten gleichzeitig (z.B. zwei rote 7)
- **Bessere Farbwahl** — Farbauswahl schwebt jetzt über der Hand, sodass die eigenen Karten sichtbar bleiben
- **Scoring-Fix** — Wenn eine Runde mit einer +2/+4 Karte endet, zieht der nächste Spieler die Karten bevor die Punkte gezählt werden

### Fruit Ninja
- **Bessere Balance** — Größere Früchte (+30-40%), weniger Obst pro Welle, langsamere Schwierigkeitssteigerung

### Sonstiges
- **Streak-XP-Bonus** — Tägliche Streak gibt jetzt Bonus-XP: 3+ Tage = +10, 7+ = +20, 14+ = +30, 30+ = +50 XP (Hover für Details)
- **Shop-Preise angepasst** — Kosmetics kosten jetzt 8-35 Tokens je nach Seltenheit (vorher 2-6)
- **Bessere Spielbeschreibungen** — Alle 27 Spiele haben jetzt ausführliche Beschreibungen mit Mechanik-Details
- **Pac-Man: Level-Anzeige** — Level-Nummer wird nicht mehr am Canvas-Rand abgeschnitten
- **Typing Test** — Wörter werden nicht mehr mitten im Wort umgebrochen
- **Lazy Loading** — Spielkomponenten werden erst bei Bedarf geladen (schnellere Startseite)
- **Code-Cleanup** — Duplizierter Code in Hooks und Server-Logik bereinigt

---

## 2026-03-14

- **Curve Fever: Bots** — Spiele mit KI-Gegnern (Leicht / Mittel / Schwer), auch zusammen mit anderen Spielern
- **Curve Fever: Kartengrößen** — Wähle zwischen Klein, Normal, Groß und Riesig
- **Curve Fever: Flüssigeres Gameplay** — Höhere Tickrate (30 TPS) und clientseitige Interpolation für butterweiche Bewegungen
- **Schiffe Versenken: vs Bot** — Spiele gegen eine KI mit 3 Schwierigkeitsstufen (Leicht: Zufallsschüsse, Mittel: Hunt/Target, Schwer: Wahrscheinlichkeitsberechnung)
- **Tägliche Herausforderungen: XP-Update** — 10 XP pro Challenge, +50 XP Bonus fürs Abschließen aller Dailys
- **Täglicher Streak** — Streak zählt jetzt nur hoch, wenn alle täglichen Herausforderungen abgeschlossen wurden
- **Neues Spiel: Elfmeterschießen** — Schieß Elfmeter und halte als Torwart gegen die KI (3 Schwierigkeiten, Sudden Death)
- **Neue Spiele: Doodle Jump, Crossy Road & Mahjong** — Drei neue Singleplayer-Spiele
- **Neue Spiele: Pac-Man, Asteroids, Geometry Dash, Fruit Ninja, Whack-a-Mole & Typing Test** — Sechs neue Singleplayer-Spiele
- **Asteroids: Power-ups** — Doppelschuss, Dreifachschuss, Schnellfeuer, Schild und Große Kugeln spawnen beim Zerstören von Asteroiden
- **Typing Test: Deutsch & Englisch** — Wörter passen sich automatisch der Spracheinstellung an
- **Singleplayer-Shops** — Einige Singleplayer-Spiele haben jetzt eigenständige Shops mit spielspezifischen Items

---

## 2026-03-12

- **Profil-Showcase** — Stelle dein Mini-Profil zusammen: Lieblingsspiel, 3 Stats und 3 Achievements, sichtbar für alle in der Online-Liste
- **Auto-Showcase** — Wer sein Showcase nicht konfiguriert hat, bekommt automatisch die besten Stats angezeigt
- **Reconnect-System** — Verbesserte Reconnect-Erkennung: Countdown-Banner bei Gegner-Disconnect, Overlay bei eigenem Verbindungsverlust
- **Achievement-Fix** — Kein doppeltes XP mehr bei Seiten-Neuladen während einer Runde
- **Curve Fever: Bugfix** — Kritischen Kollisions-Bug behoben, der Spieler zufällig explodieren ließ

---

## 2026-03-05

- **Kosmetik-System** — Discord-inspiriertes Anpassungssystem: Avatar, Rahmen, Kopf, Portal, Aura, Banner, Kartenfarbe, Namensfarbe und Abzeichen
- **Kosmetik-Studio** — Neues Modal mit Live-Vorschau, Tabs, Seltenheitsstufen (Common / Epic / Rare / Legendary) und Vorschau gesperrter Items
- **Abzeichen** — Sammelbare Badges mit Tooltips (Name, Beschreibung, Freischaltbedingung, Seltenheit), sichtbar in Chat und Online-Liste
- **Animierte Kosmetik** — Feuer-Rahmen mit SVG-Flammeneffekt, animierte Portale und Auren (Conic Gradients, Glühen, Elektro)
- **Profile** — Profilkarte mit Banner, Kartenfarbe und Abzeichen-Reihe
- **Profil-Viewer** — Klicke auf einen Nickname im Chat oder der Online-Liste, um das Profil anderer Spieler zu sehen
- **"NEU"-Markierung** — Neu freigeschaltete Kosmetik-Items werden mit einem Punkt markiert, bis sie angesehen wurden
- **Liar's Deck: Eigene Revolver** — Im Roulette-Modus hat jeder Spieler seinen eigenen Revolver statt eines geteilten
- **Sudoku: 3 Leben** — Falsche Eingaben kosten ein Leben (3 Herzen). Bei 0 Leben: Game Over mit Neustart-Option
- **Projekt unterstützen** — Buy Me A Coffee Button auf der Startseite und im Profilmenü

---

## 2026-03-01

- **i18n System** — Vollständige Übersetzung aller Spieloberflächen (Deutsch / Englisch)
- **Chess: Castling** — König- und Damenseite korrekt implementiert
- **Chess: En Passant** — Sonderregel für Bauernschlag korrekt implementiert
- **Chess: Bauernumwandlung** — Auswahl zwischen Dame, Turm, Läufer, Springer
- **Chess: 50-Züge-Regel & Dreifachwiederholung** — Automatische Remiserkennung
- **Chess: Replay** — Partie-Wiedergabe Zug für Zug mit Vor/Zurück-Navigation
- **Chess: PGN Export** — Partien als PGN in die Zwischenablage kopieren
- **Quick Play** — Schnelles Matchmaking für alle Spiele
- **Öffentliche Räume** — Raum-Browser mit Beitreten / Zuschauen
- **Globaler Chat** — Echtzeit-Chat über alle Räume hinweg
- **Spielstatistiken** — Gewinn/Verlust/Unentschieden-Tracking pro Spiel
