export type Lang = 'de' | 'en';

export const messages: Record<Lang, Record<string, string>> = {
  de: {
    'nav.home':             'Startseite',
    'nav.rooms':            'Räume',
    'nav.leaderboard':      'Bestenliste',

    'profile.settings':     'Einstellungen',
    'profile.language':     'Sprache',
    'profile.german':       'Deutsch',
    'profile.english':      'Englisch',

    'common.save':          'Speichern',
    'common.cancel':        'Abbrechen',
    'common.close':         'Schließen',

    'status.connecting':    'Verbinde…',
    'status.connected':     'Verbunden',
    'status.disconnected':  'Getrennt',

    // ── Lobby / home page ──────────────────────────────────────────────────
    // hero.title is intentionally identical in de and en: "Play. Together." is
    // the brand slogan and must always appear in English regardless of locale.
    'lobby.hero.title':     'Play. Together.',
    'lobby.hero.subtitle':  'Echtzeit-Mehrspieler direkt im Browser – kein Account erforderlich.',
    'lobby.availableGames': 'Verfügbare Spiele',
    'lobby.quickPlay':      'Schnellspiel',
    'lobby.customGame':     'Benutzerdefiniert',
    'lobby.soon':           'Bald',
    'lobby.comingSoon':     'Demnächst',

    // ── Game titles ────────────────────────────────────────────────────────
    'lobby.games.tictactoe.title': 'Tic-Tac-Toe',
    'lobby.games.connect4.title':  'Vier gewinnt',
    'lobby.games.rps.title':       'Schere Stein Papier',
    'lobby.games.chess.title':     'Schach',

    // ── Game descriptions ──────────────────────────────────────────────────
    'lobby.games.tictactoe.desc':  'Klassisches 3×3 Strategiespiel. Drei in einer Reihe gewinnen!',
    'lobby.games.connect4.desc':   'Steine in das 7×6 Raster fallen lassen. Vier in einer Reihe gewinnen!',
    'lobby.games.rps.desc':        'Wähle deine Waffe im gleichzeitigen Best-of-3-Duell!',
    'lobby.games.chess.desc':      'Klassisches Strategiespiel. Überliste deinen Gegner und setze Schachmatt.',

    // ── Category tags ──────────────────────────────────────────────────────
    'lobby.tags.classic':          'Klassiker',
    'lobby.tags.strategy':         'Strategie',
    'lobby.tags.twoPlayers':       '2 Spieler',
    'lobby.tags.multiplayer':      'Mehrspieler',

    // ── Rooms ──────────────────────────────────────────────────────────────
    'rooms.title':          'Offene Räume',
    'rooms.createRoom':     'Raum erstellen',
    'rooms.joinRoom':       'Raum beitreten',
    'rooms.publicRooms':    'Öffentliche Räume',
    'rooms.privateRoom':    'Privater Raum',

    // ── Leaderboard ────────────────────────────────────────────────────────
    'leaderboard.title':    'Bestenliste',
    'leaderboard.overall':  'Gesamt',
    'leaderboard.wins':     'Siege',
    'leaderboard.games':    'Spiele',
    'leaderboard.winrate':  'Siegrate',
    'leaderboard.streak':   'Serie',

    // ── Chess ──────────────────────────────────────────────────────────────
    'chess.title':          'Schach',
    'chess.yourTurn':       'Du bist dran',
    'chess.waitingOpponent':'Warte auf Gegner…',
    'chess.check':          'Schach!',
    'chess.checkmate':      'Schachmatt',
    'chess.stalemate':      'Patt',
    'chess.resign':         'Aufgeben',
    'chess.exportPgn':      'PGN exportieren',
    'chess.replay':         'Wiedergabe',

    // ── Chat ───────────────────────────────────────────────────────────────
    'chat.title':           'Chat',
    'chat.global':          'Global',
    'chat.room':            'Raum',
    'chat.send':            'Senden',
    'chat.placeholder':     'Nachricht…',
  },

  en: {
    'nav.home':             'Home',
    'nav.rooms':            'Rooms',
    'nav.leaderboard':      'Leaderboard',

    'profile.settings':     'Settings',
    'profile.language':     'Language',
    'profile.german':       'German',
    'profile.english':      'English',

    'common.save':          'Save',
    'common.cancel':        'Cancel',
    'common.close':         'Close',

    'status.connecting':    'Connecting…',
    'status.connected':     'Connected',
    'status.disconnected':  'Disconnected',

    // ── Lobby / home page ──────────────────────────────────────────────────
    // hero.title is intentionally identical in de and en: brand slogan stays English.
    'lobby.hero.title':     'Play. Together.',
    'lobby.hero.subtitle':  'Real-time multiplayer games in your browser — no account required.',
    'lobby.availableGames': 'Available Games',
    'lobby.quickPlay':      'Quick Play',
    'lobby.customGame':     'Custom',
    'lobby.soon':           'Soon',
    'lobby.comingSoon':     'Coming soon',

    // ── Game titles ────────────────────────────────────────────────────────
    'lobby.games.tictactoe.title': 'Tic-Tac-Toe',
    'lobby.games.connect4.title':  'Connect Four',
    'lobby.games.rps.title':       'Rock Paper Scissors',
    'lobby.games.chess.title':     'Chess',

    // ── Game descriptions ──────────────────────────────────────────────────
    'lobby.games.tictactoe.desc':  'Classic 3×3 strategy game. Get three in a row to win!',
    'lobby.games.connect4.desc':   'Drop pieces into a 7×6 grid. First to connect four in a row wins!',
    'lobby.games.rps.desc':        'Choose your weapon in this simultaneous best-of-3 showdown!',
    'lobby.games.chess.desc':      'Classic strategy game. Outthink your opponent and deliver checkmate.',

    // ── Category tags ──────────────────────────────────────────────────────
    'lobby.tags.classic':          'Classic',
    'lobby.tags.strategy':         'Strategy',
    'lobby.tags.twoPlayers':       '2 Players',
    'lobby.tags.multiplayer':      'Multiplayer',

    // ── Rooms ──────────────────────────────────────────────────────────────
    'rooms.title':          'Open Rooms',
    'rooms.createRoom':     'Create Room',
    'rooms.joinRoom':       'Join Room',
    'rooms.publicRooms':    'Public Rooms',
    'rooms.privateRoom':    'Private Room',

    // ── Leaderboard ────────────────────────────────────────────────────────
    'leaderboard.title':    'Leaderboard',
    'leaderboard.overall':  'Overall',
    'leaderboard.wins':     'Wins',
    'leaderboard.games':    'Games',
    'leaderboard.winrate':  'Win %',
    'leaderboard.streak':   'Streak',

    // ── Chess ──────────────────────────────────────────────────────────────
    'chess.title':          'Chess',
    'chess.yourTurn':       'Your turn',
    'chess.waitingOpponent':'Waiting for opponent…',
    'chess.check':          'Check!',
    'chess.checkmate':      'Checkmate',
    'chess.stalemate':      'Stalemate',
    'chess.resign':         'Resign',
    'chess.exportPgn':      'Export PGN',
    'chess.replay':         'Replay',

    // ── Chat ───────────────────────────────────────────────────────────────
    'chat.title':           'Chat',
    'chat.global':          'Global',
    'chat.room':            'Room',
    'chat.send':            'Send',
    'chat.placeholder':     'Message…',
  },
};
