import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Crucial middlewware to parse incoming bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API proxy endpoint to bypass CORS for Google Sheets and Google Apps Script
  app.all("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ status: "error", error: "Missing url parameter" });
    }

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };

      // Forward authorization credentials if provided by the client
      if (req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization;
      }

      // Forward content type if applicable
      if (req.headers["content-type"]) {
        headers["Content-Type"] = req.headers["content-type"] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      // If there is a request body, verify and forward it
      if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
        if (typeof req.body === "object") {
          fetchOptions.body = JSON.stringify(req.body);
        } else {
          fetchOptions.body = req.body;
        }
      }

      console.log(`[Proxy Server] Proxying ${req.method} request to: ${targetUrl}`);
      const response = await fetch(targetUrl, fetchOptions);

      // Handle response content types
      const contentType = response.headers.get("content-type") || "";
      res.status(response.status);

      // Forward core headers
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      // Determine text vs binary stream
      if (contentType.includes("application/json")) {
        const json = await response.json();
        res.json(json);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (error: any) {
      console.error("[Proxy Server] Error proxying request:", error);
      res.status(500).json({ status: "error", error: "Failed to proxy request", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Proxy Server] Mounted Vite development middleware");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("[Proxy Server] Serving static files in production mode");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Proxy Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Proxy Server] Server startup failed:", err);
});
