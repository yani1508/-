export default async function handler(req: any, res: any) {
  // Config CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let targetUrl = '';

  if (req.url) {
    try {
      // Find '?url=' or '&url=' in raw req.url
      const urlIndicator = req.url.includes('?url=') ? '?url=' : (req.url.includes('&url=') ? '&url=' : '');
      if (urlIndicator) {
        const index = req.url.indexOf(urlIndicator);
        targetUrl = decodeURIComponent(req.url.substring(index + urlIndicator.length));
      }
    } catch (e) {
      console.error("[Vercel Proxy] Error parsing URL manually:", e);
    }
  }

  // Backup fallback using standard URL parser
  if (!targetUrl && req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const urlParam = parsedUrl.searchParams.get('url');
      if (urlParam) {
        targetUrl = urlParam;
      }
    } catch (e) {
      console.error("[Vercel Proxy] URL parsing fallback failed:", e);
    }
  }

  // Double backup check query (Vercel automatic parse helper)
  if (!targetUrl && req.query?.url) {
    targetUrl = req.query.url;
  }

  if (!targetUrl) {
    return res.status(400).json({ 
      status: "error", 
      error: "Missing url parameter", 
      debug: {
        url: req.url || null,
        query: req.query || null,
        method: req.method || null
      }
    });
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

    console.log(`[Vercel Serverless Proxy] Routing ${req.method} to: ${targetUrl}`);
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";
    
    // Set response status & headers
    res.status(response.status);
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    if (contentType.includes("application/json")) {
      const json = await response.json();
      res.json(json);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error: any) {
    console.error("[Vercel Proxy Serverless Error] Failed to proxy:", error);
    res.status(500).json({ status: "error", error: "Failed to proxy request", details: error.message });
  }
}
