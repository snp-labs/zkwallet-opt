export function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1024 * 1024) {
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid json body"));
      }
    });
    req.on("error", reject);
  });
}

export function applyCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
}

export function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

export function writeNotFound(res) {
  writeJson(res, 404, {
    error: {
      code: "not_found",
      message: "resource not found"
    }
  });
}

export function writeMethodNotAllowed(res) {
  writeJson(res, 405, {
    error: {
      code: "method_not_allowed",
      message: "method not allowed"
    }
  });
}

export function writeError(res, statusCode, code, message, details) {
  writeJson(res, statusCode, {
    error: {
      code,
      message,
      details: details || null
    }
  });
}
