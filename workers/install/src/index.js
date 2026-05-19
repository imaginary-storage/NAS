/**
 * install.imaginarystorage.com
 *
 * Proxies the latest install.sh from the GitHub Release of imaginary-storage/NAS.
 * Designed so `curl install.imaginarystorage.com | sudo bash` works without
 * needing `curl -L` — we stream the script body back ourselves, not a redirect.
 */

const UPSTREAM =
  "https://github.com/imaginary-storage/NAS/releases/latest/download/install.sh";

/** Short HTML shown when a browser visits the bare domain. */
const HTML_LANDING = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>install.imaginarystorage.com</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 15px/1.6 -apple-system, system-ui, sans-serif;
         background: #0c0f1a; color: #e2e8f0;
         max-width: 640px; margin: 8vh auto; padding: 0 1.5rem; }
  h1   { font-size: 1.4rem; margin-bottom: 0.5rem; }
  p    { color: #94a3b8; }
  pre  { background: #0a0e1a; border: 1px solid rgba(255,255,255,.1);
         border-radius: 10px; padding: 14px 16px; overflow-x: auto;
         color: #6ee7b7; }
  a    { color: #a5b4fc; }
</style>
<h1>Imaginary Storage NAS — installer</h1>
<p>Run this on a Linux box to install the latest release:</p>
<pre>curl -fsSL install.imaginarystorage.com | sudo bash</pre>
<p><a href="https://github.com/imaginary-storage/NAS">Source &amp; releases on GitHub →</a></p>
</html>`;

function isBrowser(req) {
  const accept = req.headers.get("accept") || "";
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (accept.includes("text/html")) return true;
  if (ua.startsWith("curl/") || ua.startsWith("wget/")) return false;
  return false;
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // Browser visits to / get a friendly page.
    if (url.pathname === "/" && req.method === "GET" && isBrowser(req)) {
      return new Response(HTML_LANDING, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Allow / and /install.sh as installer endpoints; everything else 404.
    if (url.pathname !== "/" && url.pathname !== "/install.sh") {
      return new Response("Not Found\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed\n", {
        status: 405,
        headers: { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" },
      });
    }

    const upstream = await fetch(UPSTREAM, { redirect: "follow" });
    if (!upstream.ok) {
      return new Response(`upstream returned ${upstream.status}\n`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/x-shellscript; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  },
};
