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
        // Add isFromDatabase flag if it doesn't exist (default to false for old user entries)
        if (!obj.hasOwnProperty('isFromDatabase')) {
            obj.isFromDatabase = false;
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

// Pre-populate openings from theory database
// COMPLETELY REDESIGNED for Lichess Database (3,590 openings)
function prePopulateOpenings() {
    const CURRENT_VERSION = 7; // v7 = New flat structure for Lichess
    const storedVersion = parseInt(localStorage.getItem('openings_version')) || 0;

    // Clean up old flag-based system
    localStorage.removeItem('openings_prepopulated');

    // If we're already at the current version, just return existing data
    if (storedVersion >= CURRENT_VERSION) {
        return JSON.parse(localStorage.getItem('openings')) || [];
    }

    // Preserve user-added openings
    let existingUserOpenings = [];
    if (storedVersion > 0) {
        const existing = JSON.parse(localStorage.getItem('openings')) || [];
        existingUserOpenings = existing.filter(o => o.isFromDatabase !== true);
    }

    // Convert Lichess database to flat array structure (simpler, faster)
    // No complex hierarchy - just a searchable/filterable list
    const theoryEntries = Object.entries(openingTheory).map(([movesStr, openingData]) => {
        const moves = movesStr.split(' ');
        return {
            name: openingData.name,
            eco: openingData.eco,
            moves: moves,
            moveCount: moves.length,
            isFromDatabase: true,
            // Add first move for grouping
            firstMove: moves[0] || '',
            // Add search text for filtering
            searchText: `${openingData.eco} ${openingData.name}`.toLowerCase()
        };
    });

    // Sort by ECO code, then by move count
    theoryEntries.sort((a, b) => {
        if (a.eco !== b.eco) return a.eco.localeCompare(b.eco);
        return a.moveCount - b.moveCount;
    });

    // Combine Lichess database openings with user openings
    const allOpenings = [...theoryEntries, ...existingUserOpenings];

    // Save to localStorage with version number
    localStorage.setItem('openings', JSON.stringify(allOpenings));
    localStorage.setItem('openings_version', CURRENT_VERSION.toString());

    return allOpenings;
}

let openings = [];
let game = null;
let board = null;
let moveHistory = []; // Full move history for navigation
let currentMoveIndex = -1; // Current position in move history (-1 = at start)
let loadedOpening = null; // Track the currently loaded opening/variation for updates
let currentDatabase = 'masters'; // Track which database to query: 'masters' or 'lichess'

// Chess opening theory database - REPLACED WITH LICHESS DATABASE
// The comprehensive Lichess opening database is now loaded from lichess-openings.js
// This provides 3,590+ openings with ECO codes instead of the original ~170 hardcoded entries
// New structure: { 'e4 e5': { eco: 'C20', name: 'King\'s Pawn Game' }, ... }
// Reference the Lichess opening database (loaded from lichess-openings.js)
const openingTheory = LICHESS_OPENINGS;

// Initialize openings from migration and pre-population
openings = migrateOpenings();
openings = prePopulateOpenings();

// Function to detect opening from moves
// Now returns {eco, name, matchedMoves} object instead of just a string
function detectOpening(moves) {
    if (!moves || moves.length === 0) {
        return null;
    }

    // Try to find the longest matching sequence (most specific opening)
    for (let i = moves.length; i > 0; i--) {
        const key = moves.slice(0, i).join(' ');
        if (openingTheory[key]) {
            return {
                eco: openingTheory[key].eco,
                name: openingTheory[key].name,
                matchedMoves: i
            };
        }
    }

    return null;
}

// ========== API Integration Functions ==========

// Fetch and display position statistics and popular moves
async function fetchAndDisplayPositionData() {
    if (!lichessAPI.isEnabled() || moveHistory.length === 0) {
        hidePositionStats();
        hidePopularMoves();
        return;
    }

    try {
        // Show loading indicators
        showStatsLoading();
        showMovesLoading();

        // Fetch data from Lichess API
        // For lichess database, we need to specify rating ranges and speeds
        const options = {
            endpoint: currentDatabase
        };

        // Add parameters for lichess database (requires ratings)
        if (currentDatabase === 'lichess') {
            options.ratings = '1600,1800,2000,2200,2500'; // Common rating ranges
            options.speeds = 'blitz,rapid,classical'; // Common time controls
        }

        console.log('Fetching data from:', currentDatabase, 'with options:', options);
        const data = await lichessAPI.getPositionData(moveHistory, options);

        if (data) {
            // Display statistics
            displayPositionStats(data.stats);

            // Display popular moves
            displayPopularMoves(data.moves);
        } else {
            hidePositionStats();
            hidePopularMoves();
        }
    } catch (error) {
        console.error('Failed to fetch position data:', error);
        hidePositionStats();
        hidePopularMoves();

        // Show error message if it's a rate limit issue
        if (error.message.includes('Rate limited')) {
            showApiStatus(error.message, 'error');
        }
    }
}

// Display position statistics
function displayPositionStats(stats) {
    const statsEl = document.getElementById('position-stats');
    const contentEl = statsEl.querySelector('.stats-content');

    if (!stats || stats.total === 0) {
        hidePositionStats();
        return;
    }

    // Build stats HTML
    const html = `
        <div class="stats-bar-container">
            <div class="stats-bar-white" style="width: ${stats.whitePercent}%">
                ${stats.whitePercent}%
            </div>
            <div class="stats-bar-draws" style="width: ${stats.drawsPercent}%">
                ${stats.drawsPercent}%
            </div>
            <div class="stats-bar-black" style="width: ${stats.blackPercent}%">
                ${stats.blackPercent}%
            </div>
        </div>
        <div class="stats-summary">
            ${stats.total.toLocaleString()} games:
            White ${stats.white.toLocaleString()},
            Draws ${stats.draws.toLocaleString()},
            Black ${stats.black.toLocaleString()}
        </div>
    `;

    contentEl.innerHTML = html;
    statsEl.querySelector('.stats-loading').style.display = 'none';
    statsEl.style.display = 'block';
}

// Display popular next moves
function displayPopularMoves(moves) {
    const movesEl = document.getElementById('popular-moves');
    const contentEl = movesEl.querySelector('.moves-content');

    if (!moves || moves.length === 0) {
        hidePopularMoves();
        return;
    }

    // Show top 5 moves
    const topMoves = moves.slice(0, 5);

    const html = topMoves.map(move => `
        <div class="move-row" data-move="${move.san}">
            <span class="move-san">${move.san}</span>
            <div class="move-bar">
                <div class="move-bar-fill" style="width: ${move.frequency}%">
                    <span class="move-frequency">${move.frequency}%</span>
                </div>
            </div>
            <span class="move-stats">
                ${move.total.toLocaleString()} games
            </span>
        </div>
    `).join('');

    contentEl.innerHTML = html;
    movesEl.querySelector('.moves-loading').style.display = 'none';
    movesEl.style.display = 'block';

    // Add click handlers to make moves
    contentEl.querySelectorAll('.move-row').forEach(row => {
        row.addEventListener('click', () => {
            const moveSan = row.getAttribute('data-move');
            makeMove(moveSan);
        });
    });
}

// Helper functions to show/hide UI elements
function showStatsLoading() {
    const statsEl = document.getElementById('position-stats');
    statsEl.querySelector('.stats-loading').style.display = 'block';
    statsEl.querySelector('.stats-content').innerHTML = '';
    statsEl.style.display = 'block';
}

function showMovesLoading() {
    const movesEl = document.getElementById('popular-moves');
    movesEl.querySelector('.moves-loading').style.display = 'block';
    movesEl.querySelector('.moves-content').innerHTML = '';
    movesEl.style.display = 'block';
}

function hidePositionStats() {
    document.getElementById('position-stats').style.display = 'none';
}

function hidePopularMoves() {
    document.getElementById('popular-moves').style.display = 'none';
}

// Make a move programmatically
function makeMove(san) {
    if (currentMoveIndex !== moveHistory.length - 1) {
        // If not at the end, navigate to end first
        goToMove(moveHistory.length - 1);
    }

    const move = game.move(san);
    if (move) {
        moveHistory.push(san);
        currentMoveIndex = moveHistory.length - 1;
        board.position(game.fen());
        updateMoveHistory();
    }
}

// ========== Settings UI Handlers ==========

// Initialize settings UI
function initSettings() {
    // Settings panel has been removed - API token now comes from config.js only
    // Just log the API status
    if (lichessAPI.isEnabled()) {
        console.log('✓ Lichess API is enabled (token loaded from config.js)');
    } else {
        console.log('⚠ Lichess API is not enabled - add token to config.js');
    }
}

// Show API status message
function showApiStatus(message, type = 'info') {
    const statusEl = document.getElementById('api-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = type; // success, error, or info
        statusEl.style.display = 'block';
    }
}

// Initialize database toggle buttons
function initDatabaseToggle() {
    const mastersBtn = document.getElementById('db-toggle-masters');
    const lichessBtn = document.getElementById('db-toggle-lichess');

    if (!mastersBtn || !lichessBtn) return;

    // Handle masters button click
    mastersBtn.addEventListener('click', () => {
        console.log('Masters button clicked, current database:', currentDatabase);
        if (currentDatabase === 'masters') return; // Already selected

        currentDatabase = 'masters';
        mastersBtn.classList.add('active');
        lichessBtn.classList.remove('active');
        console.log('Switched to masters database');

        // Refresh data if we have moves
        if (moveHistory.length > 0 && lichessAPI.isEnabled()) {
            console.log('Refreshing data for masters...');
            fetchAndDisplayPositionData();
        }
    });

    // Handle lichess button click
    lichessBtn.addEventListener('click', () => {
        console.log('Lichess button clicked, current database:', currentDatabase);
        if (currentDatabase === 'lichess') return; // Already selected

        currentDatabase = 'lichess';
        lichessBtn.classList.add('active');
        mastersBtn.classList.remove('active');
        console.log('Switched to lichess database');

        // Refresh data if we have moves
        if (moveHistory.length > 0 && lichessAPI.isEnabled()) {
            console.log('Refreshing data for lichess...');
            fetchAndDisplayPositionData();
        } else {
            console.log('Not refreshing: moveHistory.length =', moveHistory.length, 'API enabled =', lichessAPI.isEnabled());
        }
    });
}

// Initialize board
function initBoard() {
    game = new Chess();
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
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

    // Try to make the move
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // always promote to queen for simplicity
    });

    // If move is illegal, snap back
    if (move === null) {
        return 'snapback';
    }

    // Add move to history
    moveHistory.push(move.san);
    currentMoveIndex = moveHistory.length - 1;

    // Don't return anything - the piece will stay at the dropped position
}

// Called after the piece snap animation is complete
function onSnapEnd() {
    // Update board position to match game state (handles castling, en passant, etc.)
    board.position(game.fen());

    // Update the UI (move history, opening detection, library highlighting)
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
    const opening = detectOpening(moveHistory);

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

    // Show detected opening if found - NEW STRUCTURE WITH ECO
    if (opening) {
        movesHTML += `<br><strong style="color: #2196F3;">Detected Opening:</strong> ${opening.name}`;
        if (opening.eco) {
            movesHTML += ` <span style="background-color: #4e5058; color: #e4e4e7; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: 600;">${opening.eco}</span>`;
        }

        // Auto-populate opening name field if it's empty (only in main mode)
        const saveType = document.querySelector('input[name="save-type"]:checked');
        const nameField = document.getElementById('opening-name');
        if (saveType && saveType.value === 'main') {
            if (!nameField.value || nameField.value === nameField.dataset.lastDetected) {
                nameField.value = opening.name;
                nameField.dataset.lastDetected = opening.name;
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

    // Highlight matching opening in the list
    highlightMatchingOpening();

    // Show/hide Quick Add button based on current state
    updateQuickAddButton();

    // Refresh parent detection if in variation mode
    refreshParentDetection();

    // Fetch and display API data (stats and popular moves)
    fetchAndDisplayPositionData();

    // Highlight matching opening in library - NEW
    highlightOpeningInLibrary();
}

// Show or hide the Quick Add button based on whether we're in update mode with new moves
function updateQuickAddButton() {
    const quickAddBtn = document.getElementById('quick-add');
    const saveType = document.querySelector('input[name="save-type"]:checked');

    // Only show in update mode when there are new moves
    if (saveType && saveType.value === 'update' && loadedOpening) {
        const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);
        if (currentMoves.length > loadedOpening.opening.moves.length) {
            const newMoves = currentMoves.slice(loadedOpening.opening.moves.length);
            quickAddBtn.style.display = 'inline-block';
            quickAddBtn.title = `Quick add: ${newMoves.join(' ')}`;
        } else {
            quickAddBtn.style.display = 'none';
        }
    } else {
        quickAddBtn.style.display = 'none';
    }
}

// Highlight the opening/variation that matches the current board position
function highlightMatchingOpening() {
    // Remove all existing highlights
    document.querySelectorAll('.opening-header.highlighted, .variation-header.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });

    // Find the matching opening
    const match = findMatchingOpening();
    if (match) {
        // Build the ID from the match info
        const uniqueId = `opening-${match.mainOpeningIndex}-${match.path.join('-')}`;
        const element = document.getElementById(uniqueId);

        if (element) {
            element.classList.add('highlighted');

            // Auto-expand parent variations to make the highlighted item visible
            expandParentVariations(match.mainOpeningIndex, match.path);
        }
    }
}

// Expand all parent variations to make a specific opening visible
function expandParentVariations(mainOpeningIndex, path) {
    // Start from the top level and expand each nested level
    for (let i = 0; i <= path.length; i++) {
        const currentPath = path.slice(0, i);
        const parentId = `opening-${mainOpeningIndex}-${currentPath.join('-')}`;
        const parentElement = document.getElementById(parentId);

        if (parentElement) {
            // Find the expand icon
            const expandIcon = parentElement.querySelector('.expand-icon');
            if (expandIcon) {
                const targetId = expandIcon.dataset.targetId;
                const variationsList = document.getElementById(targetId);

                // Expand if currently collapsed
                if (variationsList && variationsList.style.display === 'none') {
                    variationsList.style.display = 'block';
                    expandIcon.textContent = '▼';
                }
            }
        }
    }
}

// Show options to extend an existing variation or create a new sub-variation
function showExtendVariationOptions() {
    // Remove existing extend options
    const existingOptions = document.getElementById('extend-variation-options');
    if (existingOptions) existingOptions.remove();

    // Don't show options if user is already in variation or update mode
    const saveType = document.querySelector('input[name="save-type"]:checked');
    if (saveType && (saveType.value === 'variation' || saveType.value === 'update')) {
        return;
    }

    const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);

    if (currentMoves.length === 0) {
        return;
    }

    // Find the best matching opening (longest prefix)
    const match = findMatchingOpening();

    if (match && currentMoves.length > match.matchLength) {
        // We have moves that extend beyond the matched opening
        const extraMoves = currentMoves.slice(match.matchLength);

        // Create the extend options UI
        const optionsDiv = document.createElement('div');
        optionsDiv.id = 'extend-variation-options';
        optionsDiv.className = 'extend-options';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'extend-message';
        messageDiv.innerHTML = `
            <strong style="color: #2196F3;">✓ Found matching ${match.isMainOpening ? 'opening' : 'variation'}:</strong> "${match.opening.name}"<br>
            <span style="color: #b5bac1;">New moves to add: ${extraMoves.join(' ')}</span>
        `;

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'extend-buttons';

        // Only show extend button for user-created openings (not database ones)
        if (match.opening.isFromDatabase !== true) {
            // Button to extend the existing variation
            const extendBtn = document.createElement('button');
            extendBtn.textContent = `Extend "${match.opening.name}"`;
            extendBtn.className = 'extend-btn';
            extendBtn.onclick = async () => {
                await extendExistingVariation(match, currentMoves);
            };
            buttonsDiv.appendChild(extendBtn);
        }

        // Button to create new sub-variation (switches to variation mode)
        const newSubBtn = document.createElement('button');
        newSubBtn.textContent = match.opening.isFromDatabase === true ? 'Create Sub-Variation' : 'Create New Sub-Variation';
        newSubBtn.className = 'new-sub-btn';
        newSubBtn.onclick = () => {
            // Switch to variation mode
            document.querySelector('input[name="save-type"][value="variation"]').checked = true;
            document.getElementById('variation-section').style.display = 'block';

            // Pre-select the parent
            const detected = detectParentOpening();
            if (detected) {
                populateParentSelect(detected);
                const mainOpening = openings[detected.mainOpeningIndex];
                document.getElementById('opening-name').value = mainOpening.name;
            }

            // Focus on variation name field
            document.getElementById('variation-name').focus();
        };

        buttonsDiv.appendChild(newSubBtn);

        optionsDiv.appendChild(messageDiv);
        optionsDiv.appendChild(buttonsDiv);

        // Insert before the save section
        const saveSection = document.querySelector('.save-section');
        saveSection.parentNode.insertBefore(optionsDiv, saveSection);
    }
}

// Extend an existing opening/variation with new moves
async function extendExistingVariation(match, newMoves) {
    const confirmed = await showConfirm(
        `Extend "${match.opening.name}" from ${match.opening.moves.length} to ${newMoves.length} moves?\n\nThis will update the existing ${match.isMainOpening ? 'opening' : 'variation'}.`
    );

    if (!confirmed) return;

    // Navigate to the opening/variation and update its moves
    let targetOpening = openings[match.mainOpeningIndex];
    for (let i = 0; i < match.path.length; i++) {
        targetOpening = targetOpening.variations[match.path[i]];
    }

    // Update the moves
    targetOpening.moves = [...newMoves];

    // Save to localStorage
    localStorage.setItem('openings', JSON.stringify(openings));

    // Refresh the display and highlight
    displayOpenings();
    highlightMatchingOpening();

    await showAlert(`Successfully extended "${match.opening.name}" to ${newMoves.length} moves!`);
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

        // Hide extend options when manually switching modes
        const extendOptions = document.getElementById('extend-variation-options');
        if (extendOptions) extendOptions.remove();

        if (e.target.value === 'update') {
            // Update mode - keep name read-only
            variationSection.style.display = 'none';
            openingNameField.readOnly = true;

            // Update button text
            const saveButton = document.getElementById('save-opening');
            saveButton.textContent = 'Update Variation';

            // Show/hide Quick Add button
            updateQuickAddButton();

            // Clear detection message
            const existing = document.getElementById('detection-message');
            if (existing) existing.remove();
        } else if (e.target.value === 'variation') {
            variationSection.style.display = 'block';
            openingNameField.placeholder = 'Parent Opening Name (auto-detected)';
            openingNameField.readOnly = false; // Make name editable

            // Reset button text
            const saveButton = document.getElementById('save-opening');
            saveButton.textContent = 'Save Opening';

            // Hide Quick Add button
            document.getElementById('quick-add').style.display = 'none';

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
            // Main opening mode
            variationSection.style.display = 'none';
            openingNameField.placeholder = 'Opening Name (auto-detected or enter custom name)';
            openingNameField.readOnly = false; // Make name editable

            // Reset button text
            const saveButton = document.getElementById('save-opening');
            saveButton.textContent = 'Save Opening';

            // Hide Quick Add button
            document.getElementById('quick-add').style.display = 'none';

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

// Find exact matching opening/variation for current board position
function findMatchingOpening() {
    const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);

    if (currentMoves.length === 0) {
        return null;
    }

    let bestMatch = null;
    let longestMatchLength = 0;

    // Recursive function to search through opening and all its variations
    function searchOpening(opening, openingIndex, path = []) {
        // Check if current moves match this opening's moves (either exact or prefix)
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

        openings.push({ name, moves, variations: [], isFromDatabase: false });
        localStorage.setItem('openings', JSON.stringify(openings));
        displayOpenings();
        populateParentSelect();
        await showAlert('Opening saved successfully!');
    } else if (saveType === 'update') {
        // Update existing opening/variation
        if (!loadedOpening) {
            await showAlert('No opening loaded to update. Please load an opening first.');
            return;
        }

        // Check if trying to update a database opening
        if (loadedOpening.opening.isFromDatabase === true) {
            await showAlert('Cannot update database openings. Please create a variation instead.');
            return;
        }

        const confirmed = await showConfirm(
            `Update "${loadedOpening.opening.name}" from ${loadedOpening.opening.moves.length} to ${moves.length} moves?\n\nThis will update the existing ${loadedOpening.isMainOpening ? 'opening' : 'variation'}.`
        );

        if (!confirmed) return;

        // Navigate to the opening/variation and update its moves
        let targetOpening = openings[loadedOpening.mainOpeningIndex];
        for (let i = 0; i < loadedOpening.path.length; i++) {
            targetOpening = targetOpening.variations[loadedOpening.path[i]];
        }

        // Update the moves
        targetOpening.moves = [...moves];

        // Update the loadedOpening reference to keep it in sync
        loadedOpening.opening = targetOpening;

        // Save to localStorage
        localStorage.setItem('openings', JSON.stringify(openings));

        // Refresh the display and highlight
        displayOpenings();
        highlightMatchingOpening();
        updateQuickAddButton(); // Hide Quick Add button since no new moves now

        await showAlert(`Successfully updated "${loadedOpening.opening.name}" to ${moves.length} moves!`);
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

        // Add the new variation to the parent (mark as user-added)
        if (!parentOpening.variations) {
            parentOpening.variations = [];
        }
        parentOpening.variations.push({ name: variationName, moves, variations: [], isFromDatabase: false });

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
    const openingNameField = document.getElementById('opening-name');
    openingNameField.value = '';
    openingNameField.readOnly = false;
    document.getElementById('variation-name').value = '';
    document.getElementById('opening-moves').value = '';

    // Reset to main opening mode
    document.querySelector('input[name="save-type"][value="main"]').checked = true;
    document.getElementById('variation-section').style.display = 'none';

    // Clear loaded opening and disable update mode
    loadedOpening = null;
    const updateRadio = document.querySelector('input[name="save-type"][value="update"]');
    updateRadio.disabled = true;

    // Hide Quick Add button
    document.getElementById('quick-add').style.display = 'none';

    // Clear detection message
    const existing = document.getElementById('detection-message');
    if (existing) existing.remove();

    // Clear extend options
    const extendOptions = document.getElementById('extend-variation-options');
    if (extendOptions) extendOptions.remove();
});

// Quick Add button handler
document.getElementById('quick-add').addEventListener('click', async () => {
    if (!loadedOpening) {
        await showAlert('No opening loaded. Please load an opening first.');
        return;
    }

    const currentMoves = currentMoveIndex === -1 ? [] : moveHistory.slice(0, currentMoveIndex + 1);

    // Check if there are new moves beyond the loaded variation
    if (currentMoves.length <= loadedOpening.opening.moves.length) {
        await showAlert('No new moves to add. Please add moves beyond the current variation.');
        return;
    }

    const newMoves = currentMoves.slice(loadedOpening.opening.moves.length);
    const newMovesStr = newMoves.join(' ');

    // Create auto-generated variation name
    const variationName = `${loadedOpening.opening.name} (${newMovesStr})`;

    const confirmed = await showConfirm(
        `Create new sub-variation:\n"${variationName}"\n\nwith ${currentMoves.length} moves under "${loadedOpening.opening.name}"?`
    );

    if (!confirmed) return;

    // Navigate to the loaded opening/variation
    let parentOpening = openings[loadedOpening.mainOpeningIndex];
    for (let i = 0; i < loadedOpening.path.length; i++) {
        parentOpening = parentOpening.variations[loadedOpening.path[i]];
    }

    // Add the new variation to the parent
    if (!parentOpening.variations) {
        parentOpening.variations = [];
    }
    parentOpening.variations.push({
        name: variationName,
        moves: [...currentMoves],
        variations: [],
        isFromDatabase: false
    });

    // Save to localStorage
    localStorage.setItem('openings', JSON.stringify(openings));

    // Refresh the display
    displayOpenings();
    highlightMatchingOpening();

    await showAlert(`Successfully created sub-variation:\n"${variationName}"!`);
});

// Counter for unique IDs
let variationIdCounter = 0;

// Display openings with hierarchical structure (supports unlimited nesting)
// NEW: Display openings with filtering and search
let currentEcoFilter = 'ALL';
let currentSearchTerm = '';
let currentlyHighlightedOpening = null;
let autoFilterActive = false;
let autoFilterMoves = [];

function displayOpenings(filterEco = currentEcoFilter, searchTerm = currentSearchTerm, autoFilter = null) {
    const ul = document.getElementById('openings');
    ul.innerHTML = '';

    if (!openings || openings.length === 0) {
        ul.innerHTML = '<li style="list-style: none; color: #999;">Loading openings...</li>';
        return;
    }

    // Debug logging (simplified to avoid recursion)
    if (autoFilter && autoFilter.length > 0) {
        console.log('Auto-filter:', autoFilter.join(' '));
    }

    // Filter openings
    let filtered = openings.filter(opening => {
        // Auto-filter by current position (overrides other filters when active)
        if (autoFilter && autoFilter.length > 0) {
            // Show openings that match the current move sequence
            if (!opening.moves || opening.moves.length < autoFilter.length) {
                return false;
            }
            // Check if opening starts with the same moves
            for (let i = 0; i < autoFilter.length; i++) {
                if (opening.moves[i] !== autoFilter[i]) {
                    return false;
                }
            }
            return true;
        }

        // ECO category filter
        if (filterEco === 'USER') {
            return opening.isFromDatabase !== true;
        } else if (filterEco !== 'ALL') {
            if (!opening.eco || !opening.eco.startsWith(filterEco)) return false;
        }

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return opening.searchText && opening.searchText.includes(search);
        }

        return true;
    });

    console.log(`Filtered ${filtered.length} / ${openings.length} openings`);

    // Update search stats
    const statsEl = document.getElementById('search-stats');

    if (!statsEl) {
        console.error('Missing search-stats element');
        return;
    }

    if (autoFilter && autoFilter.length > 0) {
        // Show auto-filter status
        statsEl.innerHTML = `Showing ${filtered.length} continuations after: <strong>${autoFilter.join(' ')}</strong>
            <button class="clear-auto-filter-btn" style="margin-left: 10px; padding: 4px 8px; background-color: #4e5058; color: #dbdee1; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">✕ Show All</button>`;

        // Re-attach clear button handler (remove old listeners first)
        const clearBtn = statsEl.querySelector('.clear-auto-filter-btn');
        if (clearBtn) {
            clearBtn.onclick = () => {
                autoFilterActive = false;
                autoFilterMoves = [];
                displayOpenings(currentEcoFilter, currentSearchTerm, null);
            };
        }
    } else {
        if (searchTerm || filterEco !== 'ALL') {
            statsEl.textContent = `Showing ${filtered.length} of ${openings.length} openings`;
        } else {
            statsEl.textContent = `${openings.length} total openings`;
        }
    }

    // Display openings (limit to first 100 for performance)
    const displayLimit = 100;
    const toDisplay = filtered.slice(0, displayLimit);

    if (toDisplay.length === 0) {
        let message = 'No openings match your filters';
        if (autoFilter && autoFilter.length > 0) {
            message = `No openings found starting with: ${autoFilter.join(' ')}<br><small>Total openings in database: ${openings.length}</small>`;
        }
        ul.innerHTML = `<li style="list-style: none; color: #999;">${message}</li>`;
        return;
    }

    toDisplay.forEach((opening, index) => {
        const li = createSimpleOpeningElement(opening, index);
        // Add unique ID for later highlighting
        li.id = `opening-${opening.eco}-${index}`;
        li.dataset.moves = opening.moves.join(' ');
        ul.appendChild(li);
    });

    // Show "load more" if there are more results
    if (filtered.length > displayLimit) {
        const li = document.createElement('li');
        li.style.listStyle = 'none';
        li.style.textAlign = 'center';
        li.style.padding = '15px';
        li.style.color = '#949ba4';
        li.innerHTML = `Showing ${displayLimit} of ${filtered.length} results. Use search to narrow down.`;
        ul.appendChild(li);
    }
}

// NEW: Highlight and scroll to the currently played opening in the library
function highlightOpeningInLibrary() {
    // Remove previous highlight
    const previousHighlight = document.querySelector('.opening-highlighted');
    if (previousHighlight) {
        previousHighlight.classList.remove('opening-highlighted');
    }

    // If no moves, show all openings (don't filter)
    if (moveHistory.length === 0) {
        currentlyHighlightedOpening = null;
        const wasFiltering = autoFilterActive;
        autoFilterActive = false;
        autoFilterMoves = [];
        // Only re-display if we were previously filtering
        if (wasFiltering) {
            displayOpenings(currentEcoFilter, currentSearchTerm, null);
        }
        return;
    }

    // Detect current opening (might be null if position not in database yet)
    const opening = detectOpening(moveHistory);
    currentlyHighlightedOpening = opening;

    // Always enable auto-filter to show possible continuations from current position
    autoFilterActive = true;
    autoFilterMoves = [...moveHistory];

    // Re-display with auto-filter (shows all openings that start with current moves)
    displayOpenings(currentEcoFilter, currentSearchTerm, autoFilterMoves);

    // Find matching opening in the displayed list
    const openingsList = document.getElementById('openings');
    const items = openingsList.querySelectorAll('.simple-opening-item');

    let bestMatch = null;
    let bestMatchLength = 0;

    items.forEach(item => {
        const itemMoves = item.dataset.moves ? item.dataset.moves.split(' ') : [];

        // Check if this opening matches our current moves
        if (itemMoves.length <= moveHistory.length) {
            let isMatch = true;
            for (let i = 0; i < itemMoves.length; i++) {
                if (itemMoves[i] !== moveHistory[i]) {
                    isMatch = false;
                    break;
                }
            }

            // Find the longest (most specific) match
            if (isMatch && itemMoves.length > bestMatchLength) {
                bestMatch = item;
                bestMatchLength = itemMoves.length;
            }
        }
    });

    if (bestMatch) {
        // Highlight the opening
        bestMatch.classList.add('opening-highlighted');

        // Scroll into view (smooth, centered)
        bestMatch.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
}

// NEW: Create simple opening element (no complex nesting)
function createSimpleOpeningElement(opening, index) {
    const li = document.createElement('li');
    li.className = 'simple-opening-item';
    li.style.listStyle = 'none';
    li.style.padding = '10px';
    li.style.borderBottom = '1px solid #1e1f22';
    li.style.cursor = 'pointer';
    li.style.transition = 'background-color 0.2s';

    // Hover effect
    li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#36393f';
    });
    li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = 'transparent';
    });

    // ECO code badge
    const ecoSpan = document.createElement('span');
    ecoSpan.className = 'eco-badge';
    ecoSpan.textContent = opening.eco || '???';
    li.appendChild(ecoSpan);

    // Opening name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = opening.name;
    nameSpan.style.color = '#e4e4e7';
    nameSpan.style.fontWeight = '500';
    li.appendChild(nameSpan);

    // Move count
    const movesSpan = document.createElement('span');
    movesSpan.textContent = ` (${opening.moveCount || opening.moves.length} moves)`;
    movesSpan.style.color = '#949ba4';
    movesSpan.style.fontSize = '12px';
    movesSpan.style.marginLeft = '8px';
    li.appendChild(movesSpan);

    // Click to load
    li.addEventListener('click', () => {
        loadSimpleOpening(opening);
    });

    return li;
}

// Load opening onto board (simplified version)
function loadSimpleOpening(opening) {
    resetBoard();
    game = new Chess();

    // Play all moves
    for (let i = 0; i < opening.moves.length; i++) {
        const move = game.move(opening.moves[i]);
        if (!move) {
            console.error(`Invalid move: ${opening.moves[i]} at position ${i}`);
            break;
        }
        moveHistory.push(opening.moves[i]);
    }

    currentMoveIndex = moveHistory.length - 1;
    board.position(game.fen());
    updateMoveHistory();

    // Scroll board into view
    document.getElementById('board').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// OLD: Recursively create opening/variation element (DEPRECATED - kept for user openings)
function createOpeningElement(item, mainOpeningIndex, path, isMainOpening) {
    const li = document.createElement('li');
    li.className = isMainOpening ? 'main-opening' : 'variation-item';

    const headerDiv = document.createElement('div');
    headerDiv.className = isMainOpening ? 'opening-header' : 'variation-header';

    // Add unique ID based on path for highlighting
    const uniqueId = `opening-${mainOpeningIndex}-${path.join('-')}`;
    headerDiv.id = uniqueId;
    headerDiv.setAttribute('data-main-index', mainOpeningIndex);
    headerDiv.setAttribute('data-path', JSON.stringify(path));

    // Add nesting level data attribute for CSS styling
    if (!isMainOpening) {
        const nestingLevel = path.length;
        headerDiv.setAttribute('data-level', nestingLevel);
    }

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

    // Opening/variation name (clickable to load)
    const nameSpan = document.createElement('span');
    nameSpan.className = isMainOpening ? 'opening-name' : 'variation-name';

    // NEW: Display ECO code if available
    let displayText = item.eco ? `${item.eco} ` : '';
    displayText += `${item.name} (${item.moves.length} moves)`;

    if (hasVariations) {
        const totalVariations = countAllVariations(item);
        displayText += ` - ${totalVariations} sub-variation${totalVariations > 1 ? 's' : ''}`;
    }
    nameSpan.textContent = displayText;

    nameSpan.style.cursor = 'pointer';
    nameSpan.onclick = (e) => {
        e.stopPropagation();
        loadOpening(item, mainOpeningIndex, path);
    };
    headerDiv.appendChild(nameSpan);

    // Delete trash icon (only for user-added openings/variations, not database ones)
    if (item.isFromDatabase !== true) {
        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'delete-icon';
        deleteIcon.innerHTML = '🗑️';
        deleteIcon.style.cursor = 'pointer';
        deleteIcon.style.fontSize = '16px';
        deleteIcon.style.marginLeft = '10px';
        deleteIcon.title = 'Delete';
        deleteIcon.onclick = async (e) => {
            e.stopPropagation();
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
        headerDiv.appendChild(deleteIcon);
    }

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
async function loadOpening(opening, mainOpeningIndex, path) {
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

    // Track what was loaded for the Update Variation option
    loadedOpening = {
        opening: opening,
        mainOpeningIndex: mainOpeningIndex,
        path: path,
        isMainOpening: path.length === 0
    };

    // Enable and switch to "Update Variation" mode
    const updateRadio = document.querySelector('input[name="save-type"][value="update"]');
    updateRadio.disabled = false;
    updateRadio.checked = true;

    document.getElementById('variation-section').style.display = 'none';
    document.getElementById('opening-name').value = opening.name;
    document.getElementById('opening-name').readOnly = true; // Make name read-only in update mode

    // Update button text
    document.getElementById('save-opening').textContent = 'Update Variation';

    updateMoveHistory();

    // Clear detection message
    const existing = document.getElementById('detection-message');
    if (existing) existing.remove();

    // Clear extend options
    const extendOptions = document.getElementById('extend-variation-options');
    if (extendOptions) extendOptions.remove();
}

// Resizer functionality
function initResizer() {
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('opening-builder');
    const rightPanel = document.getElementById('opening-list');

    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPanel.getBoundingClientRect().width;

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerWidth = document.getElementById('app').getBoundingClientRect().width;
        const resizerWidth = resizer.getBoundingClientRect().width;
        const delta = e.clientX - startX;
        const newLeftWidth = startLeftWidth + delta;

        // Calculate percentages
        const leftPercent = (newLeftWidth / containerWidth) * 100;
        const rightPercent = 100 - leftPercent - ((resizerWidth / containerWidth) * 100);

        // Enforce minimum widths (20% each side)
        if (leftPercent >= 20 && rightPercent >= 20) {
            leftPanel.style.flex = `0 0 ${leftPercent}%`;
            rightPanel.style.flex = `0 0 ${rightPercent}%`;

            // Resize the chess board
            if (board) {
                board.resize();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    });
}

// Initialize
window.onload = () => {
    initBoard();
    initSettings(); // Initialize API settings UI
    initDatabaseToggle(); // Initialize database toggle buttons
    initOpeningLibrary(); // NEW: Initialize search and filters
    displayOpenings(); // Show all openings initially
    populateParentSelect();
    // Don't call updateMoveHistory on init - no moves yet
    // updateMoveHistory();
    initResizer();
};

// NEW: Initialize opening library search and filters
function initOpeningLibrary() {
    // Search functionality
    const searchInput = document.getElementById('opening-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            // Disable auto-filter when manually searching
            autoFilterActive = false;
            autoFilterMoves = [];
            displayOpenings(currentEcoFilter, currentSearchTerm, null);
        });
    }

    // ECO category tabs
    const ecoTabs = document.querySelectorAll('.eco-tab');
    ecoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            ecoTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update filter and display
            currentEcoFilter = tab.getAttribute('data-eco');
            // Disable auto-filter when manually selecting category
            autoFilterActive = false;
            autoFilterMoves = [];
            displayOpenings(currentEcoFilter, currentSearchTerm, null);
        });
    });

    // Clear auto-filter button
    const clearFilterBtn = document.getElementById('clear-auto-filter');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
            autoFilterActive = false;
            autoFilterMoves = [];
            displayOpenings(currentEcoFilter, currentSearchTerm, null);
        });
    }
}
