const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const envPath = path.join(root, ".env");
const MAX_BODY_BYTES = 50 * 1024 * 1024;
const rateBuckets = new Map();

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, "utf8").split(/\r?\n/).reduce((env, raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return env;
    const index = line.indexOf("=");
    if (index < 1) return env;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\n/g, "\n");
    return env;
  }, {});
}

const env = {...process.env, ...loadEnv(envPath)};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}
function allowRequest(req) {
  const key = clientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key) || {start:now,count:0};
  if (now - bucket.start > 60_000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= Number(env.RATE_LIMIT_PER_MINUTE || 30);
}
function authorizeApi(req, res) {
  if (!allowRequest(req)) {
    sendJson(res, 429, {error:"요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."});
    return false;
  }
  if (env.APP_ACCESS_CODE && req.headers["x-app-code"] !== env.APP_ACCESS_CODE) {
    sendJson(res, 401, {error:"앱 접근코드가 올바르지 않습니다."});
    return false;
  }
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("요청 파일이 50MB 제한을 넘었습니다."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON 요청을 읽을 수 없습니다."));
      }
    });
    req.on("error", reject);
  });
}

function extractOutputText(result) {
  if (result.output_text) return result.output_text;
  return (result.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === "output_text")
    .map(content => content.text || "")
    .join("\n");
}

function parseModelJson(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!cleaned) throw new Error("AI가 빈 응답을 반환했습니다.");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI 응답이 JSON 형식이 아닙니다: ${cleaned.slice(0, 180)}`);
  }
}

async function handleAI(req, res) {
  if (!env.OPENAI_API_KEY) return sendJson(res, 503, {error: "outputs/.env에 OPENAI_API_KEY가 없습니다."});
  const body = await readJson(req);
  const prompt = body.systemPrompt || "Return valid JSON only.";
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const content = [{
    type: "input_text",
    text: JSON.stringify({
      task: body.task || "analyze_daily_health",
      ...Object.fromEntries(Object.entries(body).filter(([key]) => !["systemPrompt", "images"].includes(key)))
    })
  }];
  for (const image of body.images || []) {
    if (!image.dataUrl || !String(image.mimeType || "").startsWith("image/")) continue;
    content.push({type: "input_image", image_url: image.dataUrl, detail: "high"});
  }

  const response = await fetch(env.OPENAI_API_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: prompt,
      input: [{role: "user", content}]
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return sendJson(res, response.status, {
      error: result.error?.message || `OpenAI API 요청 실패 (${response.status})`,
      type: result.error?.type,
      code: result.error?.code,
      parameter: result.error?.param
    });
  }
  try {
    sendJson(res, 200, parseModelJson(extractOutputText(result)));
  } catch (error) {
    sendJson(res, 502, {error: error.message});
  }
}

async function handleWeather(req, res, requestUrl) {
  if (!env.WEATHER_API_KEY) return sendJson(res, 503, {error: "outputs/.env에 WEATHER_API_KEY가 없습니다."});
  if (!env.WEATHER_API_URL) return sendJson(res, 503, {error: "outputs/.env에 WEATHER_API_URL이 없습니다."});

  const target = new URL(env.WEATHER_API_URL);
  requestUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  let weatherKey = env.WEATHER_API_KEY;
  try {
    if (weatherKey.includes("%")) weatherKey = decodeURIComponent(weatherKey);
  } catch {}
  target.searchParams.set(env.WEATHER_API_KEY_PARAM || "serviceKey", weatherKey);
  if (env.WEATHER_DEFAULT_PARAMS) {
    new URLSearchParams(env.WEATHER_DEFAULT_PARAMS).forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
  }
  if (/VilageFcstInfoService/i.test(target.pathname)) {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    if (now.getUTCMinutes() < 40) now.setUTCHours(now.getUTCHours() - 1);
    const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
    const time = `${String(now.getUTCHours()).padStart(2, "0")}00`;
    if (!target.searchParams.has("base_date")) target.searchParams.set("base_date", date);
    if (!target.searchParams.has("base_time")) target.searchParams.set("base_time", time);
    if (!target.searchParams.has("nx")) target.searchParams.set("nx", env.WEATHER_NX || "60");
    if (!target.searchParams.has("ny")) target.searchParams.set("ny", env.WEATHER_NY || "127");
  }
  const response = await fetch(target, {
    headers: env.WEATHER_AUTH_HEADER
      ? {[env.WEATHER_AUTH_HEADER]: `${env.WEATHER_AUTH_PREFIX || ""}${env.WEATHER_API_KEY}`}
      : {}
  });
  const text = await response.text();
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const blocked = new Set([".env", ".env.example", ".gitignore", "server.js", "start-local.bat", "edit-env.bat"]);
  if (requested.split(/[\\/]/).some(part => part.startsWith(".")) || blocked.has(requested)) {
    return sendJson(res, 404, {error: "Not found"});
  }
  const file = path.resolve(root, requested);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return sendJson(res, 404, {error: "Not found"});
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": file.endsWith(".html") ? "no-cache" : "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)"
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, "http://127.0.0.1:4173");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Code",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    return res.end();
  }
  try {
    if (req.method === "POST" && requestUrl.pathname === "/api/analyze") {
      if (!authorizeApi(req, res)) return;
      return await handleAI(req, res);
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/weather") {
      if (!authorizeApi(req, res)) return;
      return await handleWeather(req, res, requestUrl);
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        aiConfigured: Boolean(env.OPENAI_API_KEY),
        weatherConfigured: Boolean(env.WEATHER_API_KEY && env.WEATHER_API_URL),
        accessCodeRequired: Boolean(env.APP_ACCESS_CODE)
      });
    }
    return serveStatic(req, res, requestUrl.pathname);
  } catch (error) {
    sendJson(res, 500, {error: error.message || "서버 오류"});
  }
});

const port = Number(env.PORT || 4173);
const host = env.HOST || "0.0.0.0";
server.listen(port, host, () => {
  console.log(`온기록 서버: http://${host}:${port}`);
  console.log(`AI API: ${env.OPENAI_API_KEY ? "설정됨" : "미설정 (.env 확인)"}`);
  console.log(`날씨 API: ${env.WEATHER_API_KEY && env.WEATHER_API_URL ? "설정됨" : "미설정 (.env 확인)"}`);
});
