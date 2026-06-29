const {json, requireApprovedUser, supabaseFetch} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, {error:"POST 요청만 지원합니다."});
  const gate = await requireApprovedUser(req, res, {adminOnly:true});
  if (!gate) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const userId = String(body.userId || "");
  if (!userId) return json(res, 400, {error:"userId가 필요합니다."});
  const allowedStatuses = new Set(["pending", "approved", "blocked"]);
  const allowedRoles = new Set(["user", "admin"]);
  const patch = {};
  if (allowedStatuses.has(body.status)) {
    patch.status = body.status;
    if (body.status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = gate.user.id;
    }
  }
  if (allowedRoles.has(body.role)) patch.role = body.role;
  if (Number.isFinite(Number(body.dailyLimit))) patch.daily_limit = Math.max(0, Math.min(100, Number(body.dailyLimit)));
  if (Number.isFinite(Number(body.profileMonthlyLimit))) patch.profile_monthly_limit = Math.max(0, Math.min(12, Number(body.profileMonthlyLimit)));
  if (!Object.keys(patch).length) return json(res, 400, {error:"변경할 값이 없습니다."});
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {
    method:"PATCH",
    prefer:"return=representation",
    body:JSON.stringify(patch)
  });
  return json(res, 200, {profile:rows?.[0] || null});
};
