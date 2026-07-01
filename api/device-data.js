const {json, requireSignedInUser, supabaseFetch} = require("./_shared");

function isoDate(value) {
  const text = String(value || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
}

function normalizeDeviceData(body = {}) {
  const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics : {};
  const data = {
    source: String(body.source || "Health Connect"),
    provider: String(body.provider || body.source || "Health Connect"),
    collectedAt: body.collectedAt || body.updatedAt || new Date().toISOString(),
    metrics,
    workouts: Array.isArray(body.workouts) ? body.workouts.slice(0, 20) : [],
    sleep: body.sleep && typeof body.sleep === "object" ? body.sleep : null,
    rawSummary: body.rawSummary || ""
  };
  return data;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, {error:"지원하지 않는 요청입니다."});
  const gate = await requireSignedInUser(req, res);
  if (!gate) return;
  const userId = gate.user.id;

  if (req.method === "GET") {
    const date = isoDate(req.query?.date);
    const rows = await supabaseFetch(`/rest/v1/device_daily_metrics?user_id=eq.${encodeURIComponent(userId)}&record_date=eq.${encodeURIComponent(date)}&select=record_date,data,updated_at&limit=1`);
    const row = rows?.[0] || null;
    return json(res, 200, {date, data:row?.data || null, updatedAt:row?.updated_at || null});
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const date = isoDate(body.date || body.recordDate);
  const data = normalizeDeviceData(body.data && typeof body.data === "object" ? body.data : body);
  if (JSON.stringify(data).length > Number(process.env.MAX_DEVICE_DATA_BYTES || 250000)) {
    return json(res, 413, {error:"기기 데이터가 너무 큽니다. 하루 요약 데이터만 업로드해 주세요."});
  }
  const rows = await supabaseFetch("/rest/v1/device_daily_metrics?on_conflict=user_id,record_date&select=record_date,data,updated_at", {
    method:"POST",
    prefer:"return=representation,resolution=merge-duplicates",
    body:JSON.stringify({
      user_id:userId,
      record_date:date,
      data,
      updated_at:data.collectedAt || new Date().toISOString()
    })
  });
  const row = rows?.[0] || {record_date:date, data};
  return json(res, 200, {date:row.record_date, data:row.data, updatedAt:row.updated_at || data.collectedAt});
};
