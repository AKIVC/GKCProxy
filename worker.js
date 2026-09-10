const RAW_SCRIPT_URL = "https://raw.githubusercontent.com/AKIVC/GKCProxy/main/script.js";

async function fetchScript() {
  const r = await fetch(RAW_SCRIPT_URL);
  if (!r.ok) {
    throw new Error(`Failed to fetch script.js: ${r.status}`);
  }
  return await r.text();
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // Serve script.js via Worker
    if (url.pathname === "/script.js") {
      const js = await fetchScript();
      return new Response(js, {
        headers: { "content-type": "text/javascript" }
      });
    }

    // WebSocket proxy
    if (req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();

      server.addEventListener("message", async (e) => {
        try {
          const { path } = JSON.parse(e.data);
          const r = await fetch("https://www.gimkit.com" + path);
          server.send(await r.text());
        } catch (err) {
          server.send(JSON.stringify({ error: err.message }));
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Forward HTTP request to Gimkit
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.set("host", "www.gimkit.com");
    forwardHeaders.set("origin", "https://www.gimkit.com");

    [
      "cf-connecting-ip",
      "cf-ipcountry",
      "cf-ray",
      "cf-visitor",
      "connection",
      "upgrade",
      "sec-websocket-key",
      "sec-websocket-version",
      "sec-websocket-protocol"
    ].forEach(h => forwardHeaders.delete(h));

    const gim = await fetch("https://www.gimkit.com" + url.pathname + url.search, {
      method: req.method,
      headers: forwardHeaders,
      body: req.body
    });

    const headers = new Headers(gim.headers);

    // Strip anti-iframe headers
    headers.delete("x-frame-options");
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");

    // Rewrite redirects
    if (headers.has("location")) {
      headers.set(
        "location",
        headers.get("location").replace("https://www.gimkit.com", "https://" + url.hostname)
      );
    }

    // Inject loader into <body> so React can't wipe it
    if ((headers.get("content-type") || "").includes("text/html")) {
      const rewriter = new HTMLRewriter()
        .on("body", {
          element(el) {
            el.append(
              `<script>
                (function() {
                  try {
                    var s = document.createElement('script');
                    s.src = '/script.js';
                    s.async = true;
                    document.body.appendChild(s);
                  } catch (e) {
                    console.error('Injection bootstrap failed:', e);
                  }
                })();
              </script>`,
              { html: true }
            );
          }
        });

      return rewriter.transform(new Response(gim.body, { status: gim.status, headers }));
    }

    // Non-HTML passthrough
    return new Response(gim.body, { status: gim.status, headers });
  }
};
