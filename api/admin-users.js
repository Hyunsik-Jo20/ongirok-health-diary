const {json, requireApprovedUser, supabaseFetch, usageCount, startOfKstDay, startOfKstMonth} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, {error:"GET 요청만 지원합니다."});
  const gate = await requireApprovedUser(req, res, {adminOnly:true});
  if (!gate) return;
  const profiles = await supabaseFetch("/rest/v1/profiles?select=*&order=created_at.desc&limit=200");
  const users = [];
  for (const profile of profiles) {
    const todayAiUsed = await usageCount(profile.id, ["analyze_daily_health"], startOfKstDay());
    const monthProfileUsed = await usageCount(profile.id, ["extract_health_profile"], startOfKstMonth());
    users.push({...profile, today_ai_used:todayAiUsed, month_profile_used:monthProfileUsed});
  }
  return json(res, 200, {users});
};
