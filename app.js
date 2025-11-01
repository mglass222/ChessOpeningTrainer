// Custom centered alert and confirm dialogs
function showAlert(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const modal = document.getElementById('custom-modal');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        messageEl.textContent = message;
        confirmBtn.textContent = 'OK';
        cancelBtn.style.display = 'none';

        overlay.classList.add('show');

        const handleConfirm = () => {
            overlay.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            resolve();
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const modal = document.getElementById('custom-modal');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        messageEl.textContent = message;
        confirmBtn.textContent = 'Confirm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.display = 'inline-block';

        overlay.classList.add('show');

        const handleConfirm = () => {
            overlay.classList.remove('show');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            overlay.classList.remove('show');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// Migrate old data structure to new hierarchical structure with nested variations
function migrateOpenings() {
    let openings = JSON.parse(localStorage.getItem('openings')) || [];

    // Add variations array to any object that doesn't have it (recursive)
    function addVariationsRecursive(obj) {
        if (!obj.hasOwnProperty('variations')) {
            obj.variations = [];
        }
        // Recursively process existing variations
        if (obj.variations && obj.variations.length > 0) {
            obj.variations = obj.variations.map(v => {
                addVariationsRecursive(v);
                return v;
            });
        }
        return obj;
    }

    // Check if migration is needed
    if (openings.length > 0) {
        openings = openings.map(opening => addVariationsRecursive(opening));
        localStorage.setItem('openings', JSON.stringify(openings));
    }

    return openings;
}

let openings = migrateOpenings();
let game = null;
let board = null;
let moveHistory = []; // Full move history for navigation
let currentMoveIndex = -1; // Current position in move history (-1 = at start)

// Chess opening theory database
const openingTheory = {
    // King's Pawn Openings
    'e4': 'King\'s Pawn Opening',
    'e4 e5': 'Open Game',
    'e4 e5 Nf3': 'King\'s Knight Opening',
    'e4 e5 Nf3 Nc6': 'King\'s Knight Opening',
    'e4 e5 Nf3 Nc6 Bb5': 'Ruy Lopez',
    'e4 e5 Nf3 Nc6 Bb5 a6': 'Ruy Lopez: Morphy Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4': 'Ruy Lopez: Morphy Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6': 'Ruy Lopez: Morphy Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O': 'Ruy Lopez: Closed',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6': 'Ruy Lopez: Closed, Chigorin Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3': 'Ruy Lopez: Closed, Chigorin Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6': 'Ruy Lopez: Closed, Chigorin Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4': 'Ruy Lopez: Open Variation',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4': 'Ruy Lopez: Open Variation',
    'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6': 'Ruy Lopez: Exchange Variation',
    'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6': 'Ruy Lopez: Exchange Variation',
    'e4 e5 Nf3 Nc6 Bb5 Nf6': 'Ruy Lopez: Berlin Defense',
    'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O': 'Ruy Lopez: Berlin Defense',
    'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4': 'Ruy Lopez: Berlin Defense',
    'e4 e5 Nf3 Nc6 Bb5 Nf6 d3': 'Ruy Lopez: Berlin Defense, Closed Variation',
    'e4 e5 Nf3 Nc6 Bb5 Bc5': 'Ruy Lopez: Classical Variation',
    'e4 e5 Nf3 Nc6 Bb5 Nd4': 'Ruy Lopez: Bird Variation',
    'e4 e5 Nf3 Nc6 Bb5 f5': 'Ruy Lopez: Schliemann Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5': 'Ruy Lopez: Marshall Attack',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5': 'Ruy Lopez: Marshall Attack',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5': 'Ruy Lopez: Marshall Attack',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5': 'Ruy Lopez: Marshall Attack',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3': 'Ruy Lopez: Closed, Breyer Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3 Nb8': 'Ruy Lopez: Closed, Breyer Defense',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3 Na5': 'Ruy Lopez: Closed, Chigorin Variation',
    'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3 Bb7': 'Ruy Lopez: Closed, Zaitsev Variation',
    'e4 e5 Nf3 Nc6 Bc4': 'Italian Game',
    'e4 e5 Nf3 Nc6 Bc4 Bc5': 'Italian Game: Giuoco Piano',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 c3': 'Italian Game: Giuoco Piano',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6': 'Italian Game: Giuoco Piano',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4': 'Italian Game: Giuoco Piano, Main Line',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3': 'Italian Game: Giuoco Pianissimo',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 b4': 'Italian Game: Evans Gambit',
    'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4': 'Italian Game: Evans Gambit Accepted',
    'e4 e5 Nf3 Nc6 Bc4 Nf6': 'Italian Game: Two Knights Defense',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5': 'Italian Game: Two Knights Defense, Fried Liver Attack',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5': 'Italian Game: Two Knights Defense, Fried Liver Attack',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5': 'Italian Game: Two Knights Defense, Fried Liver Attack',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5': 'Italian Game: Two Knights Defense, Fried Liver Attack',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5': 'Italian Game: Two Knights Defense, Polerio Defense',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 d4': 'Italian Game: Scotch Gambit',
    'e4 e5 Nf3 Nc6 Bc4 Nf6 d3': 'Italian Game: Giuoco Pianissimo',
    'e4 e5 Nf3 Nc6 d4': 'Scotch Game',
    'e4 e5 Nf3 Nc6 d4 exd4': 'Scotch Game',
    'e4 e5 Nf3 Nc6 d4 exd4 Nxd4': 'Scotch Game',
    'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6': 'Scotch Game',
    'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5': 'Scotch Game: Classical Variation',
    'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4': 'Scotch Game: Steinitz Variation',
    'e4 e5 Nf3 Nc6 d4 exd4 c3': 'Scotch Game: Göring Gambit',
    'e4 e5 Nf3 Nc6 d4 exd4 c3 dxc3': 'Scotch Game: Göring Gambit Accepted',
    'e4 e5 Nf3 Nc6 d4 exd4 c3 d5': 'Scotch Game: Göring Gambit Declined',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4': 'Scotch Gambit',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6': 'Scotch Gambit',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bc5': 'Scotch Gambit: Classical Variation',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bb4+': 'Scotch Gambit: Dubois-Réti Defense',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bb4+ c3': 'Scotch Gambit: Dubois-Réti Defense',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bb4+ c3 dxc3': 'Scotch Gambit: Dubois-Réti Defense',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 e5': 'Scotch Gambit: Advance Variation',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 O-O': 'Scotch Gambit',
    'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 O-O Nxe4': 'Scotch Gambit',
    'e4 e5 Nf3 Nf6': 'Petrov\'s Defense',
    'e4 e5 Nf3 Nf6 Nxe5': 'Petrov\'s Defense',
    'e4 e5 Nf3 Nf6 Nxe5 d6': 'Petrov\'s Defense',
    'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3': 'Petrov\'s Defense',
    'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4': 'Petrov\'s Defense',
    'e4 e5 Nf3 d6': 'Philidor Defense',
    'e4 e5 Nf3 d6 d4': 'Philidor Defense',
    'e4 e5 Nf3 d6 d4 exd4': 'Philidor Defense',
    'e4 e5 f4': 'King\'s Gambit',
    'e4 e5 f4 exf4': 'King\'s Gambit Accepted',
    'e4 e5 f4 d5': 'King\'s Gambit Declined: Falkbeer Counter Gambit',
    'e4 e5 f4 Bc5': 'King\'s Gambit Declined: Classical Variation',
    'e4 e5 Nc3': 'Vienna Game',
    'e4 e5 Nc3 Nf6': 'Vienna Game',
    'e4 e5 Nc3 Nf6 f4': 'Vienna Gambit',
    'e4 e5 Nc3 Nf6 f4 exf4': 'Vienna Gambit Accepted',
    'e4 e5 Nc3 Nf6 f4 d5': 'Vienna Gambit Declined',
    'e4 e5 Nc3 Nf6 f4 d5 fxe5': 'Vienna Gambit Declined',
    'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4': 'Vienna Gambit Declined',
    'e4 e5 Nc3 Nf6 f4 exf4 e5': 'Vienna Gambit Accepted',
    'e4 e5 Nc3 Nf6 f4 exf4 e5 Ng4': 'Vienna Gambit: Steinitz Gambit',
    'e4 e5 Nc3 Nf6 f4 exf4 Nf3': 'Vienna Gambit: Hamppe-Allgaier Gambit',
    'e4 e5 Nc3 Nf6 Bc4': 'Vienna Game',
    'e4 e5 Nc3 Nf6 Bc4 Nxe4': 'Vienna Game: Frankenstein-Dracula Variation',
    'e4 e5 Nc3 Nf6 Bc4 Nc6': 'Vienna Game',
    'e4 e5 Nc3 Nc6': 'Vienna Game',
    'e4 e5 Nc3 Nc6 f4': 'Vienna Gambit',
    'e4 e5 Nc3 Nc6 f4 exf4': 'Vienna Gambit Accepted',
    'e4 e5 Nc3 Nc6 f4 exf4 Nf3': 'Vienna Gambit Accepted',
    'e4 e5 Nc3 Nc6 f4 exf4 Nf3 g5': 'Vienna Gambit Accepted',
    'e4 e5 Nc3 Nc6 Bc4': 'Vienna Game',
    'e4 e5 Nc3 Nc6 Bc4 Nf6': 'Vienna Game',
    'e4 e5 Nc3 Nc6 Bc4 Bc5': 'Vienna Game',
    'e4 e5 Nc3 Nc6 g3': 'Vienna Game: Mieses Variation',
    'e4 e5 Nc3 Nc6 Nf3': 'Vienna Game',
    'e4 e5 Nc3 Bc5': 'Vienna Game',

    // Sicilian Defense
    'e4 c5': 'Sicilian Defense',
    'e4 c5 Nf3': 'Sicilian Defense',
    'e4 c5 Nf3 d6': 'Sicilian Defense',
    'e4 c5 Nf3 d6 d4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 d6 d4 cxd4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6': 'Sicilian Defense: Open',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3': 'Sicilian Defense: Classical',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6': 'Sicilian Defense: Najdorf Variation',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5': 'Sicilian Defense: Najdorf, Main Line',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3': 'Sicilian Defense: Najdorf, English Attack',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 f3': 'Sicilian Defense: Najdorf, English Attack',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2': 'Sicilian Defense: Najdorf, Opocensky Variation',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6': 'Sicilian Defense: Dragon Variation',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3': 'Sicilian Defense: Dragon, Classical',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7': 'Sicilian Defense: Dragon, Classical',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3': 'Sicilian Defense: Dragon, Yugoslav Attack',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6': 'Sicilian Defense: Scheveningen Variation',
    'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6': 'Sicilian Defense: Classical Variation',
    'e4 c5 Nf3 Nc6': 'Sicilian Defense',
    'e4 c5 Nf3 Nc6 d4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 Nc6 d4 cxd4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6': 'Sicilian Defense: Old Sicilian',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3': 'Sicilian Defense: Old Sicilian',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5': 'Sicilian Defense: Sveshnikov Variation',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5': 'Sicilian Defense: Sveshnikov Variation',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6': 'Sicilian Defense: Sveshnikov Variation',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6': 'Sicilian Defense: Accelerated Dragon',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3': 'Sicilian Defense: Accelerated Dragon',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7': 'Sicilian Defense: Accelerated Dragon',
    'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4': 'Sicilian Defense: Accelerated Dragon, Maroczy Bind',
    'e4 c5 Nf3 e6': 'Sicilian Defense',
    'e4 c5 Nf3 e6 d4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 e6 d4 cxd4': 'Sicilian Defense: Open',
    'e4 c5 Nf3 e6 d4 cxd4 Nxd4': 'Sicilian Defense: Taimanov Variation',
    'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6': 'Sicilian Defense: Taimanov Variation',
    'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6': 'Sicilian Defense: Kan Variation',
    'e4 c5 c3': 'Sicilian Defense: Alapin Variation',
    'e4 c5 c3 Nf6': 'Sicilian Defense: Alapin Variation',
    'e4 c5 c3 d5': 'Sicilian Defense: Alapin Variation',
    'e4 c5 Nc3': 'Sicilian Defense: Closed Variation',
    'e4 c5 Nc3 Nc6': 'Sicilian Defense: Closed Variation',
    'e4 c5 Nc3 Nc6 g3': 'Sicilian Defense: Closed Variation, Fianchetto',

    // French Defense
    'e4 e6': 'French Defense',
    'e4 e6 d4': 'French Defense',
    'e4 e6 d4 d5': 'French Defense',
    'e4 e6 d4 d5 Nc3': 'French Defense: Classical',
    'e4 e6 d4 d5 Nc3 Nf6': 'French Defense: Classical',
    'e4 e6 d4 d5 Nc3 Bb4': 'French Defense: Winawer Variation',
    'e4 e6 d4 d5 Nc3 Bb4 e5': 'French Defense: Winawer Variation',
    'e4 e6 d4 d5 Nc3 Bb4 e5 c5': 'French Defense: Winawer Variation',
    'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3': 'French Defense: Winawer Variation',
    'e4 e6 d4 d5 Nc3 dxe4': 'French Defense: Rubinstein Variation',
    'e4 e6 d4 d5 Nd2': 'French Defense: Tarrasch Variation',
    'e4 e6 d4 d5 Nd2 Nf6': 'French Defense: Tarrasch Variation',
    'e4 e6 d4 d5 Nd2 c5': 'French Defense: Tarrasch Variation',
    'e4 e6 d4 d5 exd5': 'French Defense: Exchange Variation',
    'e4 e6 d4 d5 exd5 exd5': 'French Defense: Exchange Variation',
    'e4 e6 d4 d5 e5': 'French Defense: Advance Variation',
    'e4 e6 d4 d5 e5 c5': 'French Defense: Advance Variation',
    'e4 e6 d4 d5 e5 c5 c3': 'French Defense: Advance Variation',
    'e4 e6 d4 d5 e5 c5 Nf3': 'French Defense: Advance Variation',

    // Caro-Kann Defense
    'e4 c6': 'Caro-Kann Defense',
    'e4 c6 d4': 'Caro-Kann Defense',
    'e4 c6 d4 d5': 'Caro-Kann Defense',
    'e4 c6 d4 d5 Nc3': 'Caro-Kann Defense: Classical',
    'e4 c6 d4 d5 Nc3 dxe4': 'Caro-Kann Defense: Classical',
    'e4 c6 d4 d5 Nc3 dxe4 Nxe4': 'Caro-Kann Defense: Classical',
    'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5': 'Caro-Kann Defense: Classical Variation',
    'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6': 'Caro-Kann Defense: Classical, Main Line',
    'e4 c6 d4 d5 exd5': 'Caro-Kann Defense: Exchange Variation',
    'e4 c6 d4 d5 exd5 cxd5': 'Caro-Kann Defense: Exchange Variation',
    'e4 c6 d4 d5 e5': 'Caro-Kann Defense: Advance Variation',
    'e4 c6 d4 d5 e5 Bf5': 'Caro-Kann Defense: Advance Variation',
    'e4 c6 d4 d5 e5 c5': 'Caro-Kann Defense: Advance Variation',
    'e4 c6 d4 d5 Nd2': 'Caro-Kann Defense: Two Knights Variation',
    'e4 c6 Nc3': 'Caro-Kann Defense: Two Knights Attack',

    // Pirc Defense
    'e4 d6': 'Pirc Defense',
    'e4 d6 d4 Nf6': 'Pirc Defense',
    'e4 d6 d4 Nf6 Nc3': 'Pirc Defense',
    'e4 d6 d4 Nf6 Nc3 g6': 'Pirc Defense',

    // Alekhine's Defense
    'e4 Nf6': 'Alekhine\'s Defense',
    'e4 Nf6 e5': 'Alekhine\'s Defense',

    // Queen's Pawn Openings
    'd4': 'Queen\'s Pawn Opening',
    'd4 d5': 'Queen\'s Pawn Game',
    'd4 d5 c4': 'Queen\'s Gambit',
    'd4 d5 c4 e6': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nc3': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nc3 Nf6': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nc3 Nf6 Bg5': 'Queen\'s Gambit Declined: Orthodox Defense',
    'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7': 'Queen\'s Gambit Declined: Orthodox Defense',
    'd4 d5 c4 e6 Nc3 Nf6 Nf3': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nc3 Be7': 'Queen\'s Gambit Declined: Alatortsev Variation',
    'd4 d5 c4 e6 Nf3': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nf3 Nf6': 'Queen\'s Gambit Declined',
    'd4 d5 c4 e6 Nf3 Nf6 Nc3': 'Queen\'s Gambit Declined',
    'd4 d5 c4 c6': 'Queen\'s Gambit Declined: Slav Defense',
    'd4 d5 c4 c6 Nf3': 'Slav Defense',
    'd4 d5 c4 c6 Nf3 Nf6': 'Slav Defense',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3': 'Slav Defense: Main Line',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4': 'Slav Defense: Main Line',
    'd4 d5 c4 c6 Nc3': 'Slav Defense',
    'd4 d5 c4 c6 Nc3 Nf6': 'Slav Defense',
    'd4 d5 c4 c6 Nc3 Nf6 Nf3': 'Slav Defense',
    'd4 d5 c4 c6 Nc3 Nf6 e3': 'Slav Defense: Meran Variation',
    'd4 d5 c4 c6 Nc3 Nf6 e3 e6': 'Slav Defense: Meran Variation',
    'd4 d5 c4 c6 Nc3 e6': 'Semi-Slav Defense',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6': 'Semi-Slav Defense',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3': 'Semi-Slav Defense: Meran Variation',
    'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5': 'Semi-Slav Defense: Botvinnik Variation',
    'd4 d5 c4 dxc4': 'Queen\'s Gambit Accepted',
    'd4 d5 c4 dxc4 Nf3': 'Queen\'s Gambit Accepted',
    'd4 d5 c4 dxc4 Nf3 Nf6': 'Queen\'s Gambit Accepted',
    'd4 d5 c4 dxc4 e4': 'Queen\'s Gambit Accepted: Showalter Variation',
    'd4 d5 Nf3': 'Queen\'s Pawn Game',
    'd4 d5 Nf3 Nf6': 'Queen\'s Pawn Game',
    'd4 d5 Nf3 Nf6 c4': 'Queen\'s Gambit',
    'd4 d5 Nf3 Nf6 c4 e6': 'Queen\'s Gambit Declined',
    'd4 d5 Nf3 Nf6 c4 c6': 'Slav Defense',
    'd4 d5 Bf4': 'London System',
    'd4 d5 Bf4 Nf6': 'London System',
    'd4 d5 Bf4 c5': 'London System',

    // Indian Defenses
    'd4 Nf6': 'Indian Defense',
    'd4 Nf6 c4': 'Indian Defense',
    'd4 Nf6 c4 e6': 'Indian Defense',
    'd4 Nf6 c4 e6 Nc3': 'Indian Defense',
    'd4 Nf6 c4 e6 Nc3 Bb4': 'Nimzo-Indian Defense',
    'd4 Nf6 c4 e6 Nc3 Bb4 Qc2': 'Nimzo-Indian Defense: Classical Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 e3': 'Nimzo-Indian Defense: Rubinstein Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O': 'Nimzo-Indian Defense: Rubinstein Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 Bg5': 'Nimzo-Indian Defense: Leningrad Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 Nf3': 'Nimzo-Indian Defense: Kasparov Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 a3': 'Nimzo-Indian Defense: Sämisch Variation',
    'd4 Nf6 c4 e6 Nc3 Bb4 f3': 'Nimzo-Indian Defense: Sämisch Variation',
    'd4 Nf6 c4 e6 Nf3': 'Queen\'s Indian Defense',
    'd4 Nf6 c4 e6 Nf3 b6': 'Queen\'s Indian Defense',
    'd4 Nf6 c4 e6 Nf3 b6 g3': 'Queen\'s Indian Defense: Fianchetto Variation',
    'd4 Nf6 c4 e6 Nf3 b6 Nc3': 'Queen\'s Indian Defense',
    'd4 Nf6 c4 e6 Nf3 Bb4+': 'Bogo-Indian Defense',
    'd4 Nf6 c4 e6 Nf3 Bb4+ Bd2': 'Bogo-Indian Defense',
    'd4 Nf6 c4 e6 Nf3 Bb4+ Nbd2': 'Bogo-Indian Defense',
    'd4 Nf6 c4 g6': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 Nc3': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 Nc3 Bg7': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4': 'King\'s Indian Defense: Classical Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6': 'King\'s Indian Defense: Classical Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3': 'King\'s Indian Defense: Classical Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O': 'King\'s Indian Defense: Classical Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2': 'King\'s Indian Defense: Classical Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3': 'King\'s Indian Defense: Sämisch Variation',
    'd4 Nf6 c4 g6 Nc3 Bg7 Nf3': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 Nc3 Bg7 Nf3 O-O': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 Nc3 Bg7 Nf3 d6': 'King\'s Indian Defense',
    'd4 Nf6 c4 g6 g3': 'King\'s Indian Defense: Fianchetto Variation',
    'd4 Nf6 c4 g6 g3 Bg7': 'King\'s Indian Defense: Fianchetto Variation',
    'd4 Nf6 c4 g6 g3 Bg7 Bg2': 'King\'s Indian Defense: Fianchetto Variation',
    'd4 Nf6 c4 c5': 'Benoni Defense',
    'd4 Nf6 c4 c5 d5': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 c5 d5 e6': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 c5 d5 e6 Nc3': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 c5 d5 e6 Nc3 exd5': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6': 'Benoni Defense: Modern Benoni',
    'd4 Nf6 c4 e5': 'Budapest Gambit',
    'd4 Nf6 c4 e5 dxe5': 'Budapest Gambit',
    'd4 Nf6 c4 e5 dxe5 Ng4': 'Budapest Gambit',
    'd4 Nf6 Nf3': 'Indian Defense',
    'd4 Nf6 Nf3 e6': 'Indian Defense',
    'd4 Nf6 Nf3 e6 c4': 'Indian Defense',
    'd4 Nf6 Nf3 g6': 'King\'s Indian Defense',
    'd4 Nf6 Nf3 g6 c4': 'King\'s Indian Defense',
    'd4 Nf6 Nf3 g6 g3': 'King\'s Indian Defense: Fianchetto Variation',
    'd4 Nf6 Nf3 c5': 'Benoni Defense',
    'd4 Nf6 Bg5': 'Trompowsky Attack',
    'd4 Nf6 Bg5 Ne4': 'Trompowsky Attack',
    'd4 Nf6 Bg5 e6': 'Trompowsky Attack',
    'd4 Nf6 Bg5 d5': 'Trompowsky Attack',

    // Dutch Defense
    'd4 f5': 'Dutch Defense',
    'd4 f5 c4': 'Dutch Defense',
    'd4 f5 c4 Nf6': 'Dutch Defense',
    'd4 f5 c4 Nf6 g3': 'Dutch Defense',
    'd4 f5 c4 e6': 'Dutch Defense',
    'd4 f5 g3': 'Dutch Defense: Leningrad Variation',
    'd4 f5 g3 Nf6': 'Dutch Defense: Leningrad Variation',
    'd4 f5 g3 Nf6 Bg2': 'Dutch Defense: Leningrad Variation',
    'd4 f5 Nf3': 'Dutch Defense',

    // English Opening
    'c4': 'English Opening',
    'c4 e5': 'English Opening: Reversed Sicilian',
    'c4 e5 Nc3': 'English Opening: Reversed Sicilian',
    'c4 e5 Nc3 Nf6': 'English Opening: Reversed Sicilian',
    'c4 e5 Nc3 Nc6': 'English Opening: Reversed Sicilian',
    'c4 e5 g3': 'English Opening: King\'s English Variation',
    'c4 Nf6': 'English Opening',
    'c4 Nf6 Nc3': 'English Opening',
    'c4 Nf6 Nc3 e6': 'English Opening',
    'c4 Nf6 Nc3 g6': 'English Opening',
    'c4 Nf6 g3': 'English Opening',
    'c4 c5': 'English Opening: Symmetrical Variation',
    'c4 c5 Nc3': 'English Opening: Symmetrical Variation',
    'c4 c5 Nf3': 'English Opening: Symmetrical Variation',
    'c4 c5 g3': 'English Opening: Symmetrical Variation',
    'c4 e6': 'English Opening',
    'c4 e6 Nc3': 'English Opening',
    'c4 e6 Nf3': 'English Opening',
    'c4 g6': 'English Opening: King\'s English Variation',
    'c4 c6': 'English Opening',

    // Reti Opening
    'Nf3': 'Reti Opening',
    'Nf3 d5': 'Reti Opening',
    'Nf3 d5 c4': 'Reti Opening',
    'Nf3 d5 c4 d4': 'Reti Opening',
    'Nf3 d5 c4 e6': 'Reti Opening',
    'Nf3 d5 c4 c6': 'Reti Opening',
    'Nf3 d5 g3': 'Reti Opening: King\'s Indian Attack',
    'Nf3 Nf6': 'Reti Opening',
    'Nf3 Nf6 c4': 'Reti Opening',
    'Nf3 Nf6 g3': 'Reti Opening',
    'Nf3 c5': 'Reti Opening',
    'Nf3 c5 c4': 'English Opening: Symmetrical Variation',
    'Nf3 g6': 'King\'s Indian Attack',

    // Bird's Opening
    'f4': 'Bird\'s Opening',
    'f4 d5': 'Bird\'s Opening',
    'f4 Nf6': 'Bird\'s Opening',
    'f4 e5': 'Bird\'s Opening: From\'s Gambit',

    // Other
    'e3': 'Van\'t Kruijs Opening',
    'b3': 'Nimzowitsch-Larsen Attack',
    'b3 e5': 'Nimzowitsch-Larsen Attack',
    'b3 d5': 'Nimzowitsch-Larsen Attack',
    'b3 Nf6': 'Nimzowitsch-Larsen Attack',
    'g3': 'King\'s Fianchetto Opening',
    'g3 e5': 'King\'s Fianchetto Opening',
    'g3 d5': 'King\'s Fianchetto Opening',
    'Nc3': 'Dunst Opening',
    'Nc3 d5': 'Dunst Opening',
    'Nc3 e5': 'Dunst Opening',
    'd4 d6': 'Old Indian Defense',
    'd4 d6 c4': 'Old Indian Defense',
    'd4 d6 c4 Nf6': 'Old Indian Defense',
    'd4 d6 Nf3': 'Old Indian Defense',
    'd4 c6': 'Slav Defense',
    'e4 g6': 'Modern Defense',
    'e4 g6 d4': 'Modern Defense',
    'e4 g6 d4 Bg7': 'Modern Defense',
    'e4 b6': 'Owen\'s Defense',
    'e4 Nc6': 'Nimzowitsch Defense',
    'e4 Nc6 d4': 'Nimzowitsch Defense',
    'e4 a6': 'St. George Defense',
    'e4 g5': 'Borg Defense',
    'd4 g6': 'Grünfeld Defense',
    'd4 Nf6 c4 g6 Nc3 d5': 'Grünfeld Defense',
    'd4 Nf6 Nf3 d5': 'Queen\'s Pawn Game',
    'd4 Nf6 c4 d6': 'Old Indian Defense'
};

// Function to detect opening from moves
function detectOpening(moves) {
    const moveString = moves.join(' ');

    // Try to find exact match first
    if (openingTheory[moveString]) {
        return openingTheory[moveString];
    }

    // Try to find longest partial match
    let longestMatch = '';
    let longestMatchName = '';

    for (let opening in openingTheory) {
        if (moveString.startsWith(opening) && opening.length > longestMatch.length) {
            longestMatch = opening;
            longestMatchName = openingTheory[opening];
        }
    }

    return longestMatchName || '';
}

// Initialize board
function initBoard() {
    game = new Chess();
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onDrop: onDrop
    };
    board = ChessBoard('board', config);
}

// Handle piece drop
function onDrop(source, target) {
    // If we're in the middle of history, truncate future moves
    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
        // Rebuild game state from history
        game.reset();
        for (let i = 0; i < moveHistory.length; i++) {
            game.move(moveHistory[i]);
        }
    }

    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // always promote to queen for simplicity
    });

    if (move === null) return 'snapback';

    // Add move to history
    moveHistory.push(move.san);
    currentMoveIndex = moveHistory.length - 1;

    updateMoveHistory();
}

// Refresh parent opening detection if in variation mode
function refreshParentDetection() {
    const saveType = document.querySelector('input[name="save-type"]:checked');
    if (saveType && saveType.value === 'variation') {
        const detected = detectParentOpening();
        const openingNameField = document.getElementById('opening-name');

        if (detected) {
            populateParentSelect(detected);

            // Get the main opening name for display
            const mainOpening = openings[detected.mainOpeningIndex];
            openingNameField.value = mainOpening.name;

            // Update detection message
            const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);
            const variationMoves = currentMoves.slice(detected.matchLength);

            if (variationMoves.length > 0) {
                const detectionMsg = document.createElement('div');
                detectionMsg.id = 'detection-message';
                detectionMsg.style.cssText = 'color: #2196F3; font-size: 13px; margin: 5px auto; max-width: 600px; text-align: center;';

                const parentType = detected.isMainOpening ? 'opening' : 'variation';
                detectionMsg.innerHTML = `✓ Detected parent ${parentType}: <strong>${detected.opening.name}</strong> (${detected.matchLength} moves)<br>This will add: ${variationMoves.join(' ')}`;

                const existing = document.getElementById('detection-message');
                if (existing) existing.remove();

                const variationSection = document.getElementById('variation-section');
                variationSection.parentNode.insertBefore(detectionMsg, variationSection);
            } else {
                const existing = document.getElementById('detection-message');
                if (existing) existing.remove();
            }
        } else {
            populateParentSelect();
            document.getElementById('parent-opening').value = '';

            // Update message
            const detectionMsg = document.createElement('div');
            detectionMsg.id = 'detection-message';
            detectionMsg.style.cssText = 'color: #FF5722; font-size: 13px; margin: 5px auto; max-width: 600px; text-align: center;';
            detectionMsg.innerHTML = '⚠ No matching parent opening found. Please select manually or save as main opening first.';

            const existing = document.getElementById('detection-message');
            if (existing) existing.remove();

            const variationSection = document.getElementById('variation-section');
            variationSection.parentNode.insertBefore(detectionMsg, variationSection);
        }
    }
}

// Update move history display and textarea
function updateMoveHistory() {
    if (!game) return;
    const detectedName = detectOpening(moveHistory);

    // Create move display with current position highlighted
    let movesHTML = '<strong>Moves:</strong> ';

    if (moveHistory.length === 0) {
        movesHTML += 'No moves yet';
    } else {
        // Build move pairs (1. e4 e5, 2. Nf3 Nc6, etc.)
        for (let i = 0; i < moveHistory.length; i++) {
            // Add move number for white moves
            if (i % 2 === 0) {
                movesHTML += `<span class="move-number">${Math.floor(i / 2) + 1}.</span> `;
            }

            // Highlight current move
            const isCurrentMove = i === currentMoveIndex;
            const moveClass = isCurrentMove ? 'current-move' : 'history-move';

            movesHTML += `<span class="${moveClass}" data-move-index="${i}">${moveHistory[i]}</span> `;
        }
    }

    // Show detected opening if found
    if (detectedName) {
        movesHTML += '<br><strong style="color: #2196F3;">Detected Opening:</strong> ' + detectedName;

        // Auto-populate opening name field if it's empty (only in main mode)
        const saveType = document.querySelector('input[name="save-type"]:checked');
        const nameField = document.getElementById('opening-name');
        if (saveType && saveType.value === 'main') {
            if (!nameField.value || nameField.value === nameField.dataset.lastDetected) {
                nameField.value = detectedName;
                nameField.dataset.lastDetected = detectedName;
            }
        }
    }

    // Add navigation hint
    if (moveHistory.length > 0) {
        const notAtEnd = currentMoveIndex < moveHistory.length - 1;
        const savedMoveCount = Math.max(0, currentMoveIndex + 1);

        if (notAtEnd) {
            if (currentMoveIndex === -1) {
                movesHTML += `<br><strong style="color: #FF5722;">⚠ At starting position - no moves to save</strong>`;
            } else {
                movesHTML += `<br><strong style="color: #FF5722;">⚠ Saving will only include ${savedMoveCount} of ${moveHistory.length} moves</strong>`;
            }
        }

        movesHTML += '<br><small style="color: #999;">Click on moves or use ← → arrow keys to navigate | Home/End for start/finish</small>';
    }

    const historyDiv = document.getElementById('move-history');
    historyDiv.innerHTML = movesHTML;

    // Add click handlers to moves
    historyDiv.querySelectorAll('.history-move, .current-move').forEach(moveSpan => {
        moveSpan.addEventListener('click', () => {
            const moveIndex = parseInt(moveSpan.dataset.moveIndex);
            goToMove(moveIndex);
        });
    });

    // Update textarea to show only moves up to current position
    const movesToSave = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);
    document.getElementById('opening-moves').value = movesToSave.join(' ');

    // Refresh parent detection if in variation mode
    refreshParentDetection();
}

// Navigate to a specific move in history
function goToMove(index) {
    if (!game || !board) return;
    if (index < -1 || index >= moveHistory.length) return;

    currentMoveIndex = index;

    // Rebuild game state up to this move
    game.reset();
    for (let i = 0; i <= currentMoveIndex; i++) {
        game.move(moveHistory[i]);
    }

    board.position(game.fen());
    updateMoveHistory();
}

// Navigate forward one move
function nextMove() {
    if (currentMoveIndex < moveHistory.length - 1) {
        goToMove(currentMoveIndex + 1);
    }
}

// Navigate backward one move
function previousMove() {
    if (currentMoveIndex >= 0) {
        goToMove(currentMoveIndex - 1);
    }
}

// Go to start
function goToStart() {
    goToMove(-1);
}

// Go to end
function goToEnd() {
    goToMove(moveHistory.length - 1);
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    // Only navigate if not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            previousMove();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextMove();
            break;
        case 'Home':
            e.preventDefault();
            goToStart();
            break;
        case 'End':
            e.preventDefault();
            goToEnd();
            break;
    }
});

// Allow user to manually override the detected opening name
document.getElementById('opening-name').addEventListener('input', (e) => {
    const detectedName = e.target.dataset.lastDetected || '';
    // If user manually changes it, clear the auto-detection flag
    if (e.target.value !== detectedName) {
        e.target.dataset.lastDetected = '';
    }
});

// Toggle variation section based on save type
document.querySelectorAll('input[name="save-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const variationSection = document.getElementById('variation-section');
        const openingNameField = document.getElementById('opening-name');

        if (e.target.value === 'variation') {
            variationSection.style.display = 'block';
            openingNameField.placeholder = 'Parent Opening Name (auto-detected)';

            // Auto-detect parent opening
            const detected = detectParentOpening();

            if (detected) {
                populateParentSelect(detected);

                // Get the main opening name for display
                const mainOpening = openings[detected.mainOpeningIndex];
                openingNameField.value = mainOpening.name;

                // Show detection message
                const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);
                const variationMoves = currentMoves.slice(detected.matchLength);

                if (variationMoves.length > 0) {
                    const detectionMsg = document.createElement('div');
                    detectionMsg.id = 'detection-message';
                    detectionMsg.style.cssText = 'color: #2196F3; font-size: 13px; margin: 5px auto; max-width: 600px; text-align: center;';

                    const parentType = detected.isMainOpening ? 'opening' : 'variation';
                    detectionMsg.innerHTML = `✓ Detected parent ${parentType}: <strong>${detected.opening.name}</strong> (${detected.matchLength} moves)<br>This will add: ${variationMoves.join(' ')}`;

                    const existing = document.getElementById('detection-message');
                    if (existing) existing.remove();

                    variationSection.parentNode.insertBefore(detectionMsg, variationSection);
                } else {
                    const existing = document.getElementById('detection-message');
                    if (existing) existing.remove();
                }
            } else {
                populateParentSelect();
                // Show message if no parent detected
                const detectionMsg = document.createElement('div');
                detectionMsg.id = 'detection-message';
                detectionMsg.style.cssText = 'color: #FF5722; font-size: 13px; margin: 5px auto; max-width: 600px; text-align: center;';
                detectionMsg.innerHTML = '⚠ No matching parent opening found. Please select manually or save as main opening first.';

                const existing = document.getElementById('detection-message');
                if (existing) existing.remove();

                variationSection.parentNode.insertBefore(detectionMsg, variationSection);
            }
        } else {
            variationSection.style.display = 'none';
            openingNameField.placeholder = 'Opening Name (auto-detected or enter custom name)';

            // Remove detection message when switching back to main opening
            const existing = document.getElementById('detection-message');
            if (existing) existing.remove();
        }
    });
});


// Detect parent opening based on current moves (searches recursively through variations)
function detectParentOpening() {
    const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);

    if (currentMoves.length === 0) {
        return null;
    }

    let bestMatch = null;
    let longestMatchLength = 0;

    // Recursive function to search through opening and all its variations
    function searchOpening(opening, openingIndex, path = []) {
        // Check if current moves start with this opening's moves
        if (opening.moves.length <= currentMoves.length && opening.moves.length > longestMatchLength) {
            let matches = true;
            for (let i = 0; i < opening.moves.length; i++) {
                if (opening.moves[i] !== currentMoves[i]) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                bestMatch = {
                    opening,
                    matchLength: opening.moves.length,
                    path: [...path],
                    isMainOpening: path.length === 0,
                    mainOpeningIndex: openingIndex
                };
                longestMatchLength = opening.moves.length;
            }
        }

        // Search through variations recursively
        if (opening.variations && opening.variations.length > 0) {
            opening.variations.forEach((variation, varIndex) => {
                searchOpening(variation, openingIndex, [...path, varIndex]);
            });
        }
    }

    // Search all main openings and their variations
    openings.forEach((opening, index) => {
        searchOpening(opening, index);
    });

    return bestMatch;
}

// Populate parent opening select (includes all variations)
function populateParentSelect(autoSelectPath = null) {
    const select = document.getElementById('parent-opening');
    select.innerHTML = '<option value="">Select Parent Opening</option>';

    let optionIndex = 0;
    const pathMap = {}; // Maps option values to paths

    // Recursive function to add opening and all variations to select
    function addToSelect(opening, openingIndex, path = [], depth = 0) {
        const option = document.createElement('option');
        const pathKey = JSON.stringify({ mainIndex: openingIndex, path });
        option.value = pathKey;

        const indent = '　'.repeat(depth); // Use full-width space for indentation
        const prefix = depth > 0 ? '└─ ' : '';
        option.textContent = `${indent}${prefix}${opening.name} (${opening.moves.length} moves)`;

        // Check if this should be auto-selected
        if (autoSelectPath &&
            autoSelectPath.mainOpeningIndex === openingIndex &&
            JSON.stringify(autoSelectPath.path) === JSON.stringify(path)) {
            option.selected = true;
        }

        select.appendChild(option);

        // Add variations recursively
        if (opening.variations && opening.variations.length > 0) {
            opening.variations.forEach((variation, varIndex) => {
                addToSelect(variation, openingIndex, [...path, varIndex], depth + 1);
            });
        }
    }

    // Add all main openings and their variations
    openings.forEach((opening, index) => {
        addToSelect(opening, index);
    });
}

// Save opening
document.getElementById('save-opening').addEventListener('click', async () => {
    const saveType = document.querySelector('input[name="save-type"]:checked').value;
    const name = document.getElementById('opening-name').value.trim();

    // Only save moves up to current position in history
    const moves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);

    if (moves.length === 0) {
        await showAlert('Please make some moves on the board first.');
        return;
    }

    if (saveType === 'main') {
        // Save as main opening
        if (!name) {
            await showAlert('Please enter an opening name.');
            return;
        }

        openings.push({ name, moves, variations: [] });
        localStorage.setItem('openings', JSON.stringify(openings));
        displayOpenings();
        populateParentSelect();
        await showAlert('Opening saved successfully!');
    } else {
        // Save as variation (or sub-variation)
        const variationName = document.getElementById('variation-name').value.trim();
        const parentValue = document.getElementById('parent-opening').value;

        if (!variationName) {
            await showAlert('Please enter a variation name.');
            return;
        }

        if (parentValue === '') {
            await showAlert('Please select a parent opening. If no parent was auto-detected, save this as a main opening first.');
            return;
        }

        // Parse the parent path
        const parentInfo = JSON.parse(parentValue);
        const mainIndex = parentInfo.mainIndex;
        const path = parentInfo.path;

        // Navigate to the parent opening/variation
        let parentOpening = openings[mainIndex];
        for (let i = 0; i < path.length; i++) {
            parentOpening = parentOpening.variations[path[i]];
        }

        // Check that the variation actually extends the parent
        if (moves.length <= parentOpening.moves.length) {
            await showAlert(`This variation (${moves.length} moves) must extend beyond "${parentOpening.name}" (${parentOpening.moves.length} moves).`);
            return;
        }

        // Verify that moves match the parent
        let movesMatch = true;
        for (let i = 0; i < parentOpening.moves.length; i++) {
            if (parentOpening.moves[i] !== moves[i]) {
                movesMatch = false;
                break;
            }
        }

        if (!movesMatch) {
            await showAlert(`The moves don't match "${parentOpening.name}". Please check your selection.`);
            return;
        }

        // Add the new variation to the parent
        if (!parentOpening.variations) {
            parentOpening.variations = [];
        }
        parentOpening.variations.push({ name: variationName, moves, variations: [] });

        localStorage.setItem('openings', JSON.stringify(openings));
        displayOpenings();

        const parentType = path.length === 0 ? 'variation' : 'sub-variation';
        await showAlert(`${parentType.charAt(0).toUpperCase() + parentType.slice(1)} saved successfully!`);
    }

    // Clear name fields but keep the board position for continued work
    document.getElementById('variation-name').value = '';
    // Keep the main opening name visible for context when saving variations
});

// Reset board
document.getElementById('reset-board').addEventListener('click', async () => {
    if (moveHistory.length > 0) {
        const confirmed = await showConfirm('Are you sure you want to reset the board? This will clear all moves.');
        if (!confirmed) return;
    }

    if (!game || !board) return;

    game.reset();
    board.position('start');
    moveHistory = [];
    currentMoveIndex = -1;

    updateMoveHistory();

    // Clear input fields
    document.getElementById('opening-name').value = '';
    document.getElementById('variation-name').value = '';
    document.getElementById('opening-moves').value = '';

    // Reset to main opening mode
    document.querySelector('input[name="save-type"][value="main"]').checked = true;
    document.getElementById('variation-section').style.display = 'none';

    // Clear detection message
    const existing = document.getElementById('detection-message');
    if (existing) existing.remove();
});

// Counter for unique IDs
let variationIdCounter = 0;

// Display openings with hierarchical structure (supports unlimited nesting)
function displayOpenings() {
    const ul = document.getElementById('openings');
    ul.innerHTML = '';
    variationIdCounter = 0;

    if (openings.length === 0) {
        ul.innerHTML = '<li style="list-style: none; color: #999;">No openings saved yet. Create one above!</li>';
        return;
    }

    openings.forEach((opening, openingIndex) => {
        const li = createOpeningElement(opening, openingIndex, [], true);
        ul.appendChild(li);
    });
}

// Recursively create opening/variation element
function createOpeningElement(item, mainOpeningIndex, path, isMainOpening) {
    const li = document.createElement('li');
    li.className = isMainOpening ? 'main-opening' : 'variation-item';

    const headerDiv = document.createElement('div');
    headerDiv.className = isMainOpening ? 'opening-header' : 'variation-header';

    // Expand/collapse icon (only if variations exist)
    const hasVariations = item.variations && item.variations.length > 0;
    if (hasVariations) {
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = '▶'; // Default to collapsed
        const uniqueId = `var-${variationIdCounter++}`;
        expandIcon.onclick = () => toggleVariationsById(uniqueId);
        expandIcon.dataset.targetId = uniqueId;
        headerDiv.appendChild(expandIcon);
    } else {
        const spacer = document.createElement('span');
        spacer.className = 'expand-spacer';
        headerDiv.appendChild(spacer);
    }

    // Opening/variation name
    const nameSpan = document.createElement('span');
    nameSpan.className = isMainOpening ? 'opening-name' : 'variation-name';
    nameSpan.textContent = `${item.name} (${item.moves.length} moves)`;
    if (hasVariations) {
        const totalVariations = countAllVariations(item);
        nameSpan.textContent += ` - ${totalVariations} sub-variation${totalVariations > 1 ? 's' : ''}`;
    }
    headerDiv.appendChild(nameSpan);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
        loadOpening(item);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = async () => {
        const totalVariations = item.variations ? countAllVariations(item) : 0;
        const itemType = isMainOpening ? 'opening' : 'variation';

        let confirmMsg;
        if (totalVariations > 0) {
            confirmMsg = `Are you sure you want to delete the ${itemType} "${item.name}" and all ${totalVariations} sub-variation(s)?\n\nThis action cannot be undone.`;
        } else {
            confirmMsg = `Are you sure you want to delete the ${itemType} "${item.name}"?\n\nThis action cannot be undone.`;
        }

        if (await showConfirm(confirmMsg)) {
            if (isMainOpening) {
                openings.splice(mainOpeningIndex, 1);
            } else {
                // Navigate to parent and remove this variation
                let parent = openings[mainOpeningIndex];
                for (let i = 0; i < path.length - 1; i++) {
                    parent = parent.variations[path[i]];
                }
                parent.variations.splice(path[path.length - 1], 1);
            }
            localStorage.setItem('openings', JSON.stringify(openings));
            displayOpenings();
            populateParentSelect();

            await showAlert(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} "${item.name}" has been deleted.`);
        }
    };

    buttonContainer.appendChild(loadBtn);
    buttonContainer.appendChild(deleteBtn);
    headerDiv.appendChild(buttonContainer);

    li.appendChild(headerDiv);

    // Recursively add nested variations
    if (hasVariations) {
        const variationsUl = document.createElement('ul');
        variationsUl.className = 'variations-list';
        variationsUl.id = `var-${variationIdCounter - 1}`;
        variationsUl.style.display = 'none'; // Default to collapsed

        item.variations.forEach((variation, varIndex) => {
            const varLi = createOpeningElement(variation, mainOpeningIndex, [...path, varIndex], false);
            variationsUl.appendChild(varLi);
        });

        li.appendChild(variationsUl);
    }

    return li;
}

// Count all variations recursively
function countAllVariations(item) {
    if (!item.variations || item.variations.length === 0) return 0;
    let count = item.variations.length;
    item.variations.forEach(v => {
        count += countAllVariations(v);
    });
    return count;
}

// Toggle variations visibility by ID
function toggleVariationsById(id) {
    const variationsList = document.getElementById(id);
    const expandIcon = document.querySelector(`[data-target-id="${id}"]`);

    if (variationsList && expandIcon) {
        if (variationsList.style.display === 'none') {
            variationsList.style.display = 'block';
            expandIcon.textContent = '▼';
        } else {
            variationsList.style.display = 'none';
            expandIcon.textContent = '▶';
        }
    }
}

// Load opening onto board
async function loadOpening(opening) {
    if (!game || !board) return;

    game.reset();
    board.position('start');
    moveHistory = [];

    // Play through the moves and build history
    for (let i = 0; i < opening.moves.length; i++) {
        const move = game.move(opening.moves[i]);
        if (!move) {
            await showAlert(`Invalid move encountered: ${opening.moves[i]}`);
            break;
        }
        moveHistory.push(move.san);
    }

    currentMoveIndex = moveHistory.length - 1;
    board.position(game.fen());
    updateMoveHistory();

    // Default to main opening mode when loading
    document.querySelector('input[name="save-type"][value="main"]').checked = true;
    document.getElementById('variation-section').style.display = 'none';
    document.getElementById('opening-name').value = opening.name;

    // Clear detection message
    const existing = document.getElementById('detection-message');
    if (existing) existing.remove();
}

// Initialize
window.onload = () => {
    initBoard();
    displayOpenings();
    populateParentSelect();
    updateMoveHistory();
};
