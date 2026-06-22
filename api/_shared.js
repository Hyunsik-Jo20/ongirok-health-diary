function json(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(data));
}

function authorize(req, res) {
  if (process.env.APP_ACCESS_CODE && req.headers["x-app-code"] !== process.env.APP_ACCESS_CODE) {
    json(res, 401, {error:"앱 접근 코드가 올바르지 않습니다."});
    return false;
  }
  return true;
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

function requestBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

module.exports = {json, authorize, extractOutputText, parseModelJson, requestBody};
