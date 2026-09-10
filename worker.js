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
  async fetch(req, env) {
    const url = new URL(req.url);

    // Serve script.js from GitHub
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

    // Forward request to Gimkit
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.set("host", "www.gimkit.com");
    forwardHeaders.set("origin", "https://www.gimkit.com");

    // Remove headers that break proxying
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
    let body = await gim.text();

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

    // Inject script + rewrite absolute URLs
    if ((headers.get("content-type") || "").includes("text/html")) {
      body = body
        .replace("<head>", `<head><script src="/script.js"></script>`)
        .replaceAll("https://www.gimkit.com", "https://" + url.hostname);
    }

    return new Response(body, {
      status: gim.status,
      headers
    });
  }
};
