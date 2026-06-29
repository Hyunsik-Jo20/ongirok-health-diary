const {json, supabaseConfigured, getAuthUser, getProfile, supabaseFetch, usageCount, startOfKstDay, startOfKstMonth} = require("./_shared");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, {error:"지원하지 않는 요청입니다."});
  if (!supabaseConfigured()) return json(res, 503, {error:"Supabase가 설정되지 않았습니다."});
  const user = await getAuthUser(req);
  if (!user) return json(res, 401, {error:"로그인이 필요합니다."});

  let profile = await getProfile(user);
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const patch = {
      display_name:String(body.displayName || profile.display_name || "").slice(0, 80),
      purpose:String(body.purpose || profile.purpose || "").slice(0, 500)
    };
    const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`, {
      method:"PATCH",
      prefer:"return=representation",
      body:JSON.stringify(patch)
    });
    profile = rows?.[0] || {...profile, ...patch};
  }

  const todayAiUsed = await usageCount(user.id, ["analyze_daily_health"], startOfKstDay());
  const monthProfileUsed = await usageCount(user.id, ["extract_health_profile"], startOfKstMonth());
  return json(res, 200, {
    user:{id:user.id, email:user.email},
    profile,
    usage:{
      todayAiUsed,
      monthProfileUsed,
      dailyLimit:Number(profile.daily_limit || process.env.DAILY_AI_LIMIT || 2),
      profileMonthlyLimit:Number(profile.profile_monthly_limit || process.env.PROFILE_MONTHLY_LIMIT || 1)
    }
  });
};
