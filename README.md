# Ormee Energy — Solar Solutions Landing Page

Landing page for **Ormee Energy** ([@ormeenergy](https://www.instagram.com/ormeenergy)) — a premium solar solutions company delivering residential, commercial and industrial installations.

## Highlights

- **Three.js hero scene** — a daylight solar farm rendered in WebGL: a red-orange sun with layered corona sprites over a custom gradient sky dome, an instanced field of 126 tilted solar panels that shimmer in a slow wave, drifting light motes and pointer-driven camera parallax.
- **Light design system** — warm white palette with red/orange brand accents matching the Ormee logo, Fraunces display serif paired with Inter, gradient text.
- **Scroll choreography** — staggered section reveals, animated stat counters, an infinite services marquee and a sticky blur navigation bar.
- **Sections** — hero, solutions (residential / commercial / industrial), impact stats, 4-step process, project showcase, testimonials, contact form and footer.
- **Responsive & accessible** — mobile menu, fluid typography via `clamp()`, semantic markup, and a static-frame fallback under `prefers-reduced-motion`. The 3D scene pauses when off-screen or when the tab is hidden, and degrades gracefully without WebGL.

## Stack

- Vanilla HTML / CSS / JavaScript — no build step.
- [Three.js](https://threejs.org) r160, vendored locally at `js/vendor/three.module.min.js`.

## Run locally

Serve the folder with any static server (ES modules require http, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html        # Single-page site
css/style.css     # Design system + layout
js/main.js        # Three.js scene + page interactions
js/vendor/        # Vendored Three.js module
```
