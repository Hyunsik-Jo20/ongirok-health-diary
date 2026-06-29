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

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(prefer) {
  return {
    apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type":"application/json",
    ...(prefer ? {Prefer:prefer} : {})
  };
}

async function supabaseFetch(path, options = {}) {
  if (!supabaseConfigured()) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, "")}${path}`;
  const {prefer, ...fetchOptions} = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers:{...supabaseHeaders(prefer), ...(options.headers || {})}
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || `Supabase ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function getAuthUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`;
  const response = await fetch(url, {
    headers:{
      apikey:process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function getProfile(user) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`);
  if (rows?.[0]) return rows[0];
  const displayName = user.user_metadata?.display_name || user.user_metadata?.name || "";
  const purpose = user.user_metadata?.purpose || "";
  const inserted = await supabaseFetch("/rest/v1/profiles?select=*", {
    method:"POST",
    prefer:"return=representation,resolution=merge-duplicates",
    body:JSON.stringify({
      id:user.id,
      email:user.email,
      display_name:displayName,
      purpose,
      role:"user",
      status:"pending"
    })
  });
  return inserted?.[0] || {id:user.id, email:user.email, role:"user", status:"pending"};
}

function startOfKstDay() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000;
  return new Date(startKst).toISOString();
}

function startOfKstMonth() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000;
  return new Date(startKst).toISOString();
}

async function usageCount(userId, kinds, sinceIso) {
  const kindList = kinds.map(kind => `"${kind}"`).join(",");
  const rows = await supabaseFetch(`/rest/v1/usage_logs?user_id=eq.${encodeURIComponent(userId)}&kind=in.(${kindList})&used_at=gte.${encodeURIComponent(sinceIso)}&select=id`);
  return rows.length;
}

async function logUsage(userId, kind, meta = {}) {
  await supabaseFetch("/rest/v1/usage_logs", {
    method:"POST",
    prefer:"return=minimal",
    body:JSON.stringify({user_id:userId, kind, meta})
  });
}

async function requireApprovedUser(req, res, options = {}) {
  if (!supabaseConfigured()) {
    if (!authorize(req, res)) return null;
    return {bypass:true, user:null, profile:{role:"admin", status:"approved"}};
  }
  const user = await getAuthUser(req);
  if (!user) {
    json(res, 401, {error:"로그인이 필요합니다. 이메일 매직링크로 로그인해 주세요."});
    return null;
  }
  const profile = await getProfile(user);
  if (profile.status !== "approved" && profile.role !== "admin") {
    json(res, 403, {error:"관리자 승인 후 사용할 수 있습니다. 승인 전에는 일기 작성과 백업은 가능합니다.", status:profile.status || "pending"});
    return null;
  }
  if (options.adminOnly && profile.role !== "admin") {
    json(res, 403, {error:"관리자 권한이 필요합니다."});
    return null;
  }
  return {user, profile};
}

async function enforceQuota(req, res, body) {
  const gate = await requireApprovedUser(req, res);
  if (!gate || gate.bypass) return gate;
  const {user, profile} = gate;
  const task = body.task || "analyze_daily_health";
  const images = Array.isArray(body.images) ? body.images : [];
  const maxImages = Number(process.env.MAX_IMAGES_PER_REQUEST || 5);
  if (images.length > maxImages) {
    json(res, 413, {error:`한 번에 업로드 가능한 이미지는 최대 ${maxImages}장입니다.`});
    return null;
  }
  if (task === "extract_health_profile") {
    const monthlyLimit = Number(profile.profile_monthly_limit || process.env.PROFILE_MONTHLY_LIMIT || 1);
    const used = await usageCount(user.id, ["extract_health_profile"], startOfKstMonth());
    if (used >= monthlyLimit) {
      json(res, 429, {error:`기본 자료 AI 등록은 월 ${monthlyLimit}회까지 사용할 수 있습니다.`});
      return null;
    }
  }
  if (task === "analyze_daily_health") {
    const dailyLimit = Number(profile.daily_limit || process.env.DAILY_AI_LIMIT || 2);
    const used = await usageCount(user.id, ["analyze_daily_health"], startOfKstDay());
    if (used >= dailyLimit) {
      json(res, 429, {error:`하루 일반 분석은 최대 ${dailyLimit}회까지 사용할 수 있습니다.`});
      return null;
    }
  }
  return gate;
}

module.exports = {
  json, authorize, extractOutputText, parseModelJson, requestBody,
  supabaseConfigured, supabaseFetch, getAuthUser, getProfile,
  requireApprovedUser, enforceQuota, logUsage, usageCount, startOfKstDay, startOfKstMonth
};
