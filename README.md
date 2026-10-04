# Josh Chua

A single-page personal website built with Hugo. No JavaScript packages or CSS framework are required.

## Development

Use Hugo 0.166.0 (the version pinned in CI), then run `hugo server` and open
http://localhost:1313. Run `node --test tests/*.test.cjs` with Node.js 18 or newer.
Build for production with `hugo --minify --cleanDestinationDir`.
Generated output in `public/` and Hugo caches are ignored by Git.

## Site

- `layouts/index.html`: homepage text and accessible social links.
- `assets/css/home.css`: responsive card, circular links, and CSS background fallback.
- `assets/js/triangles.js`: animated triangle background.
- `assets/icons/bootstrap/`: inline Bootstrap SVG icons.
- `static/licenses/`: third-party attribution and licenses.

Only the homepage is generated. Legacy content, blog pages, taxonomies, feeds,
and other generated routes are disabled. Unknown URLs use GitHub Pages' default 404.

The animation prefers WebGPU, falls back to WebGL 2, and uses an OffscreenCanvas
worker when supported. If neither GPU backend is available, the CSS background
remains. It targets 60 fps, with at most 0.75 render pixels per CSS pixel and a
500,000-pixel budget. Idle motion runs at 40% speed; cursor easing and interaction
waves use real time. Reduced-motion preferences and hidden pages suspend animation.
There are no diagnostic URL overrides or animation controls.

## Deployment

The GitHub Actions workflow tests and builds pull requests and pushes to `main`.
Only pushes to `main` publish `public/` to the `gh-pages` branch using the repository's
`GITHUB_TOKEN`. Configure GitHub Pages to deploy from the root of that branch.
`static/CNAME` preserves the existing `joshchua.com` custom domain; the Hugo base URL
and canonical URL use that domain as well. DNS and Pages HTTPS settings are managed
outside this repository.

## Attribution

Icons: [Bootstrap Icons](https://icons.getbootstrap.com/), MIT.
Noise: value-only, non-tiling [PSRDnoise](https://github.com/stegu/psrdnoise/)
by Stefan Gustavson and Ian McEwan, MIT, adapted into the shared GPU shaders.
