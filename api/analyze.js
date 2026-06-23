const {json, authorize, extractOutputText, parseModelJson, requestBody} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, {error:"POST 요청만 지원합니다."});
  const provider = String(req.headers["x-ai-provider"] || "openai").toLowerCase();
  const userApiKey = provider === "gemini"
    ? String(req.headers["x-gemini-key"] || "").trim()
    : String(req.headers["x-openai-key"] || "").trim();
  if (!userApiKey && !authorize(req, res)) return;
  const apiKey = userApiKey || (provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);
  if (!apiKey) return json(res, 503, {error:`${provider === "gemini" ? "Gemini" : "OpenAI"} API 키를 앱 설정창에 입력해 주세요.`});

  try {
    const body = requestBody(req);
    if (provider === "gemini") {
      const parts = [{
        text:JSON.stringify({
          task:body.task || "analyze_daily_health",
          ...Object.fromEntries(Object.entries(body).filter(([key]) => !["systemPrompt", "images"].includes(key)))
        })
      }];
      for (const image of body.images || []) {
        if (!image.dataUrl || !String(image.mimeType || "").startsWith("image/")) continue;
        const match = String(image.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
        if (match) parts.push({inlineData:{mimeType:match[1], data:match[2]}});
      }
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method:"POST",
        headers:{"x-goog-api-key":apiKey, "Content-Type":"application/json"},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:body.systemPrompt || "Return valid JSON only."}]},
          contents:[{role:"user", parts}],
          generationConfig:{responseMimeType:"application/json"}
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, response.status, {error:result.error?.message || `Gemini API 요청 실패 (${response.status})`});
      const text = (result.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join("\n");
      return json(res, 200, parseModelJson(text));
    }
    const content = [{
      type:"input_text",
      text:JSON.stringify({
        task:body.task || "analyze_daily_health",
        ...Object.fromEntries(Object.entries(body).filter(([key]) => !["systemPrompt", "images"].includes(key)))
      })
    }];
    for (const image of body.images || []) {
      if (!image.dataUrl || !String(image.mimeType || "").startsWith("image/")) continue;
      content.push({type:"input_image", image_url:image.dataUrl, detail:"high"});
    }

    const response = await fetch(process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions:body.systemPrompt || "Return valid JSON only.",
        input:[{role:"user", content}]
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, response.status, {
        error:result.error?.message || `OpenAI API 요청 실패 (${response.status})`,
        type:result.error?.type,
        code:result.error?.code
      });
    }
    return json(res, 200, parseModelJson(extractOutputText(result)));
  } catch (error) {
    return json(res, 500, {error:error.message || "분석 서버 오류"});
  }
};
