# Imaginary Storage — landing page

Static marketing site, deployed to GitHub Pages on every push to `main`
that touches `landing/**` by `.github/workflows/landing-pages.yml`.

Lives at **https://nas.imaginarystorage.com** (custom domain — see
`public/CNAME`).

```bash
npm install
npm run dev      # local preview at http://localhost:5173/
npm run build    # produces dist/
```

The build base is `/` (custom domain serves at the root).  Override
with `VITE_BASE=/some/sub/path/ npm run build` if previewing under a
sub-path.

## Custom domain — DNS

For `nas.imaginarystorage.com` to resolve, the DNS provider needs:

```
Type   Name   Value
CNAME  nas    imaginary-storage.github.io.
```

Once DNS resolves and the CNAME file is published with the next deploy,
GitHub auto-issues a Let's Encrypt cert.  The custom domain also needs
to be set in **Settings → Pages → Custom domain** (filled in
automatically when the workflow uploads an artifact containing
`CNAME`).
