const RAW_SCRIPT_URL = "https://raw.githubusercontent.com/AKIVC/GKCProxy/main/script.js";

async function fetchScript() {
  const r = await fetch(RAW_SCRIPT_URL, {
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`
    }
  });
  return await r.text();
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // Serve script.js
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
        const { path } = JSON.parse(e.data);
        const r = await fetch("https://www.gimkit.com" + path);
        server.send(await r.text());
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Forward request
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.set("host", "www.gimkit.com");
    forwardHeaders.set("origin", "https://www.gimkit.com");

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

    // Only rewrite HTML
    if ((headers.get("content-type") || "").includes("text/html")) {
      const rewriter = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`<script src="/script.js"></script>`, { html: true });
          }
        });

      return rewriter.transform(new Response(gim.body, { headers }));
    }

    return new Response(gim.body, { status: gim.status, headers });
  }
};
