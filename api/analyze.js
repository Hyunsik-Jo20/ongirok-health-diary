const {json, authorize, extractOutputText, parseModelJson, requestBody} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, {error:"POST 요청만 지원합니다."});
  if (!authorize(req, res)) return;
  if (!process.env.OPENAI_API_KEY) return json(res, 503, {error:"OPENAI_API_KEY가 설정되지 않았습니다."});

  try {
    const body = requestBody(req);
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
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
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
