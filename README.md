# ObliqCloud — Landing Page

Award-winning-style landing page for [obliqcloud.com](https://obliqcloud.com) — a multi-disciplinary agency offering DevOps consultancy, cloud infrastructure, social media marketing, web engineering, brand/content production and growth analytics.

## Highlights

- **Three.js hero scene** — an interactive particle nebula with a wireframe "cloud core", orbiting rings, mouse parallax and scroll-driven camera movement (rendered on a fixed full-page canvas behind all content).
- **Custom cursor**, film-grain noise overlay, animated gradient text and glassmorphism cards.
- **Scroll choreography** — staggered reveals, word-by-word statement highlighting, animated stat counters and an infinite skills marquee.
- **Responsive** — mobile menu, fluid typography via `clamp()`, and reduced particle counts + disabled animation under `prefers-reduced-motion`.
- **Zero build step** — plain HTML/CSS/JS with Three.js loaded from a CDN via an import map. Deploy to GitHub Pages, Netlify, Vercel, S3, or any static host.

## Structure

```
index.html        # Page markup (hero, services, stats, process, testimonials, contact)
css/style.css     # All styles
js/main.js        # Three.js scene + interactions (cursor, reveals, counters, nav)
```

## Run locally

Any static server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(A server is needed because `js/main.js` is an ES module; opening `index.html` directly via `file://` will block it.)

## Customising

- **Copy & sections** — edit `index.html` directly; each section is labelled with an HTML comment.
- **Colors** — change the CSS variables at the top of `css/style.css` (`--accent`, `--accent-2`, `--accent-3`).
- **Three.js scene** — tweak `PARTICLE_COUNT`, the color `palette`, or the core/ring geometry near the top of `js/main.js`.
- **Contact form** — currently uses a `mailto:` fallback to `hello@obliqcloud.com`. Swap the form `action` for a Formspree/Basin/own-API endpoint for real submissions.
