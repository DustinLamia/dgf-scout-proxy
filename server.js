const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 3456;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);

  // Health check
  if (parsed.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DGF Scout proxy is running");
    return;
  }

  // Proxy: /proxy?url=ENCODED_URL
  if (parsed.pathname === "/proxy") {
    const targetUrl = parsed.query.url;
    if (!targetUrl) { res.writeHead(400); res.end("Missing url param"); return; }

    // Only allow X API calls
    if (!targetUrl.startsWith("https://api.twitter.com/") && !targetUrl.startsWith("https://api.x.com/")) {
      res.writeHead(403);
      res.end("Only X API requests allowed");
      return;
    }

    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      const target = new URL(targetUrl);
      const options = {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: req.method,
        headers: {}
      };

      if (req.headers.authorization) options.headers["Authorization"] = req.headers.authorization;
      if (req.headers["content-type"]) options.headers["Content-Type"] = req.headers["content-type"];

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" });
        proxyRes.pipe(res);
      });

      proxyReq.on("error", e => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: e.message }));
      });

      if (body) proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`DGF Scout proxy running on port ${PORT}`);
});
