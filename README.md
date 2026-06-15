# Scribble ✏️

A clean, fast online sketch pad — but **without the checkered transparency background**. Pick a solid **white, gray, or black** canvas instead.

No build step, no dependencies. Just static HTML/CSS/JS.

## Features

- **Tools:** pen, eraser, line, rectangle, ellipse
- **Solid backgrounds:** white / gray / black (no checkerboard) — eraser reveals the chosen background
- Color picker + quick swatch palette
- Adjustable brush size and opacity
- Undo / redo (up to 50 steps)
- Clear canvas
- Export as PNG (background included)
- High-DPI (retina) rendering
- Pointer events — works with mouse, touch, and stylus

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `B` | Pen |
| `E` | Eraser |
| `L` | Line |
| `R` | Rectangle |
| `O` | Ellipse |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z` / `Ctrl + Y` | Redo |

## Run locally

It's fully static — open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

Drop the folder onto any static host (Cloudflare Pages, Netlify, GitHub Pages, etc.). No configuration required.

## License

MIT
