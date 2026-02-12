# MiniGolf Tour — Scoreboard (Walter vs Erik)

Una mini web-app **statica** (HTML/CSS/JS) per tracciare le partite di minigolf tra Walter ed Erik.

## Funzionalità
- Aggiungi / modifica / elimina partite
- Statistiche: partite totali, vittorie, winrate, streak attuale e streak massima
- Persistenza in `localStorage` (funziona offline)
- Export / Import JSON per backup e migrazione
- Seed iniziale con 4 partite (Tirana, London Swingers, Tenerife, Dubai Swingers)

## Avvio
1. Apri `index.html` con un browser (Chrome/Safari/Firefox).
2. Fine. Non serve server.

Percorso (Mac mini):
`/Users/Mike/.openclaw/workspace/projects/minigolf-scoreboard/index.html`

## Backup / Restore
- **Export JSON**: copia il JSON e salvalo in un file.
- **Import JSON**: carica quel file per ripristinare i dati.

## Note
- Il campo **strokes** è opzionale.
- Se le date non sono note puoi lasciarle vuote e aggiungerle più avanti.
