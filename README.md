# Chess Opening Trainer

A web-based interactive tool for building, saving, and studying chess opening lines. Play moves on a drag-and-drop chessboard and the app automatically identifies known openings from a database of 380+ named variations.

**[Try it live](https://mglass222.github.io/ChessOpeningTrainer/)**

## Features

- **Interactive Chessboard** - Drag-and-drop piece movement with full move validation
- **Opening Recognition** - Automatically detects and names openings as you play (Sicilian Defense, Ruy Lopez, Queen's Gambit, and many more)
- **Save & Organize** - Save openings and variations in a hierarchical tree structure
- **Move Navigation** - Step through move history with arrow keys or click on individual moves
- **Persistent Storage** - All saved openings are stored locally in your browser
- **Dark Theme** - Clean, modern dark UI

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- [Chess.js](https://github.com/jhlywa/chess.js) for game logic and move validation
- [Chessboard.js](https://chessboardjs.com/) for the interactive board UI
- jQuery

## Usage

Open `index.html` in a browser or visit the [live site](https://mglass222.github.io/ChessOpeningTrainer/). No build step or server required.

1. Play moves on the board to build an opening line
2. The app will identify the opening name as you play
3. Click **Save Opening** to store it, or **Save Variation** to nest it under an existing opening
4. Load any saved opening from the sidebar to review it
