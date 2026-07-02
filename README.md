# Drawoza

A lightweight browser drawing app built with plain HTML, CSS, and JavaScript.

## Features

- Pen, shapes, line, text, and cleaner brush
- Select, move, resize, copy, cut, paste, delete
- Undo/redo, image paste/drop, PNG export
- Local restore for previous drawings

## Controls

- `P` pen, `V` select, `B` cleaner, `R` rectangle, `C` circle, `L` line, `T` text
- `Ctrl+C/X/V` copy, cut, paste
- `Ctrl+Z` undo, `Ctrl+Y` redo
- `Ctrl+S` save PNG
- Text: drag an area, `Enter` places text, `Ctrl+Enter` adds a line

## Files

- `index.html` - app markup
- `style.css` - UI styling
- `scripts/state.js` - shared state and DOM refs
- `scripts/storage.js` - saved project restore
- `scripts/canvas.js` - drawing, objects, history, text, export
- `scripts/events.js` - user input handlers
- `scripts/init.js` - startup

Open `index.html` in a browser. No build step required.
