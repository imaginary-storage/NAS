# Imaginary Storage — landing page

Static marketing site, deployed to GitHub Pages by
`.github/workflows/landing-pages.yml` (added in a separate branch).

```bash
npm install
npm run dev      # local preview at http://localhost:5173/
npm run build    # produces dist/ (with /imaginary-storage-nas/ base for Pages)
```

For preview from a non-Pages root, override the base:

```bash
VITE_BASE=/ npm run build
```
