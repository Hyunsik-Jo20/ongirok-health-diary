const {json, authorize} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, {error:"GET 요청만 지원합니다."});
  if (!authorize(req, res)) return;
  if (!process.env.WEATHER_API_KEY || !process.env.WEATHER_API_URL) {
    return json(res, 503, {error:"날씨 API 환경변수가 설정되지 않았습니다."});
  }

  try {
    const target = new URL(process.env.WEATHER_API_URL);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (value !== undefined) target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
    });
    let weatherKey = process.env.WEATHER_API_KEY;
    try {
      if (weatherKey.includes("%")) weatherKey = decodeURIComponent(weatherKey);
    } catch {}
    target.searchParams.set(process.env.WEATHER_API_KEY_PARAM || "serviceKey", weatherKey);
    new URLSearchParams(process.env.WEATHER_DEFAULT_PARAMS || "").forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    if (/VilageFcstInfoService/i.test(target.pathname)) {
      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
      if (now.getUTCMinutes() < 40) now.setUTCHours(now.getUTCHours() - 1);
      const date = `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,"0")}${String(now.getUTCDate()).padStart(2,"0")}`;
      const time = `${String(now.getUTCHours()).padStart(2,"0")}00`;
      if (!target.searchParams.has("base_date")) target.searchParams.set("base_date", date);
      if (!target.searchParams.has("base_time")) target.searchParams.set("base_time", time);
      if (!target.searchParams.has("nx")) target.searchParams.set("nx", process.env.WEATHER_NX || "60");
      if (!target.searchParams.has("ny")) target.searchParams.set("ny", process.env.WEATHER_NY || "127");
    }
    const response = await fetch(target);
    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(text);
  } catch (error) {
    return json(res, 500, {error:error.message || "날씨 서버 오류"});
  }
};
