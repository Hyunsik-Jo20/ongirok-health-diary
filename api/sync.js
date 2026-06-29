const {json, requireApprovedUser, supabaseFetch} = require("./_shared");

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, {error:"지원하지 않는 요청입니다."});
  const gate = await requireApprovedUser(req, res);
  if (!gate) return;
  const userId = gate.user.id;

  if (req.method === "GET") {
    const rows = await supabaseFetch(`/rest/v1/user_data_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=data,updated_at&limit=1`);
    return json(res, 200, {snapshot:rows?.[0] || null});
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const data = body.data || {};
  if (data.app !== "ongirok-health-diary") return json(res, 400, {error:"온기록 백업 데이터 형식이 아닙니다."});
  if (JSON.stringify(data).length > Number(process.env.MAX_SYNC_BYTES || 900000)) {
    return json(res, 413, {error:"클라우드 백업 데이터가 너무 큽니다. 첨부 파일을 줄인 뒤 다시 시도해 주세요."});
  }
  const updatedAt = body.updatedAt || data.updatedAt || new Date().toISOString();
  const rows = await supabaseFetch("/rest/v1/user_data_snapshots?on_conflict=user_id&select=data,updated_at", {
    method:"POST",
    prefer:"return=representation,resolution=merge-duplicates",
    body:JSON.stringify({
      user_id:userId,
      data,
      updated_at:updatedAt
    })
  });
  return json(res, 200, {snapshot:rows?.[0] || {data, updated_at:updatedAt}});
};
