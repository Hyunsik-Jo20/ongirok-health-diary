const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = "ongirok-state-v2";
const LEGACY_KEY = "ongirok-state";
const defaultPrompt = `당신은 사용자의 건강 기록을 장기적으로 이해하는 신중한 건강관리 코치입니다.

[분석 원칙]
1. 건강 프로필(나이, 키, 체중, 허리둘레, 병력, 병원·건강검진 기록, 약물, 알레르기, 통증, 생활습관, 건강 목표)을 오늘 기록보다 먼저 확인합니다.
2. 오늘의 글, 컨디션, 다짐, 걸음·수면·수분 수치, 운동 데이터, 음식·검진 이미지에서 확인 가능한 사실을 구분해 분석합니다.
3. 운동은 종목, 시간, 거리, 속도/페이스, 심박수, 강도, 칼로리, 빈도, 회복 필요성을 가능한 범위에서 구체적으로 기술합니다. 값이 없으면 추정하지 말고 "확인되지 않음"이라고 씁니다.
4. 식사는 음식 구성, 단백질·채소·탄수화물 균형, 식사 시간, 수분을 분석하되 사진만으로 양이나 영양소를 단정하지 않습니다.
5. 이전 기록과 비교할 수 있으면 추세와 변화량을 제시합니다.
6. 추천은 이유, 구체적 행동, 시간/횟수/강도, 우선순위를 포함하고 사용자의 병력·통증·목표에 맞춥니다.
7. 이상 신호는 겁주지 말고 근거와 함께 표시합니다. 응급 위험 또는 지속되는 증상은 의료기관 상담을 권고합니다.
8. 진단하거나 약물 변경을 지시하지 않습니다.

[반환 형식]
반드시 JSON만 반환합니다.
{
  "score": 0~100,
  "headline": "한 문장 총평",
  "exercise": "구체적인 운동·활동 분석",
  "recovery": "수면·피로·회복 분석",
  "nutrition": "식사·수분 분석",
  "metrics": [{"label":"지표","value":"값","note":"해석"}],
  "evidence": ["관찰 사실과 판단 근거"],
  "actions": [{"priority":"필수|권장","title":"할 일","detail":"언제, 얼마나, 어떻게, 왜"}],
  "weekPlan": [{"day":"요일/빈도","plan":"구체적 계획"}],
  "caution": "주의 신호 또는 없음",
  "missingData": ["더 정확한 분석에 필요한 정보"]
}`;
const defaultProfileExtractionPrompt = `당신은 개인 건강기록 정리 전문가입니다. 업로드된 이미지, PDF, Markdown, 텍스트, CSV, JSON에서 사용자가 명시한 건강정보만 추출하세요.

[원칙]
1. 보이지 않거나 확실하지 않은 값은 추정하지 말고 빈 문자열로 둡니다.
2. 의료적 진단을 새로 만들지 않습니다. 문서에 적힌 진단명, 날짜, 수치, 단위와 상태를 보존합니다.
3. 이름, 나이, 키, 체중, 허리둘레, 성별, 병력, 병원 기록, 검진 결과, 약물·영양제·알레르기, 생활습관, 통증·주의 부위, 기타 정보, 건강 다짐을 찾습니다.
4. 표준 항목에 적합하지 않은 의미 있는 정보는 additionalRecords에 넣습니다. 예: 가족력, 예방접종, 수술별 상세 기록, 검사일별 수치, 담당병원, 운동 성과, 추적검사 일정.
5. 템플릿의 빈 값, null, false, 예시 문구는 실제 사용자 정보로 기록하지 않습니다.
6. 각 추가 기록에는 출처 파일명과 가능한 경우 날짜를 남깁니다.

[반환 형식]
반드시 JSON만 반환합니다.
{
  "fields": {
    "pName":"", "pAge":"", "pHeight":"", "pWeight":"", "pWaist":"", "pSex":"",
    "pHistory":"", "pHospital":"", "pCheckup":"", "pMedication":"",
    "pLifestyle":"", "pConcerns":"", "pNotes":"", "pPledge":""
  },
  "additionalRecords": [
    {"label":"항목명","value":"구체적인 내용","date":"YYYY-MM-DD 또는 빈 문자열","source":"파일명"}
  ],
  "summary":"추출한 내용 요약",
  "warnings":["읽기 어려운 부분 또는 확인이 필요한 내용"]
}`;
const defaultDailyImagePrompt = `당신은 건강 앱 스크린샷과 일일 건강자료를 판독하는 멀티모달 데이터 분석가입니다.

[해야 할 일]
1. 제공된 모든 이미지를 실제로 확인하고 OCR 및 시각 정보를 함께 사용합니다.
2. 같은 날짜·같은 운동의 중복 화면은 하나의 기록으로 합칩니다.
3. 화면에 보이는 값만 기록하고 보이지 않는 값은 추정하지 않습니다.
4. 걸음, 활동시간, 활동 칼로리, 총소모 칼로리, 이동거리, 운동 종류, 운동시간, 거리, 페이스, 속도, 심박수, 케이던스, VO2max, 수면, 혈중산소, 심박수, 호흡수, 대사지표, 음식 정보를 가능한 한 구조화합니다.
5. 이미지별로 읽은 핵심 근거를 남깁니다.
6. 운동 강도와 회복 평가는 사용자의 건강 프로필을 함께 고려하되, 데이터 추출값과 해석을 구분합니다.

[반환 형식]
반드시 JSON만 반환합니다.
{
  "recognized": true,
  "date": "YYYY-MM-DD 또는 빈 문자열",
  "summary": "이미지 전체 요약",
  "dailyMetrics": {
    "steps": null, "activeMinutes": null, "activeCaloriesKcal": null,
    "totalCaloriesKcal": null, "distanceKm": null,
    "sleepHours": null, "sleepScore": null, "waterLiters": null
  },
  "workouts": [{
    "type":"", "duration":"", "distanceKm":null, "caloriesKcal":null,
    "averagePace":"", "bestPace":"", "averageSpeedKmh":null, "maxSpeedKmh":null,
    "averageHeartRateBpm":null, "maxHeartRateBpm":null,
    "averageCadenceSpm":null, "vo2max":null, "elevationGainM":null
  }],
  "sleep": {
    "duration":"", "score":null, "actualSleep":"", "deepSleep":"", "remSleep":"",
    "bloodOxygenAverage":"", "lowestBloodOxygen":"", "skinTemperatureChange":""
  },
  "otherMetrics": [{"label":"","value":"","unit":"","status":""}],
  "imageEvidence": [{"source":"파일명","observations":["판독한 값"]}],
  "warnings": ["가려짐, 해상도 부족, 판독 불확실성"]
}`;

const runtimeOrigin = location.protocol.startsWith("http") ? location.origin : "http://127.0.0.1:4173";
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || "{}");
state.days ||= {};
state.settings ||= {};
state.profile ||= {};
if (!state.settings.aiConnectionMode || (state.settings.aiConnectionMode === "direct" && !state.settings.aiApiKey)) {
  state.settings.aiConnectionMode = "proxy";
}
state.settings.apiEndpoint ||= `${runtimeOrigin}/api/analyze`;
state.settings.weatherEndpoint ||= `${runtimeOrigin}/api/weather`;
if (!["127.0.0.1", "localhost"].includes(location.hostname)) {
  if (/127\.0\.0\.1|localhost/.test(state.settings.apiEndpoint)) state.settings.apiEndpoint = `${location.origin}/api/analyze`;
  if (/127\.0\.0\.1|localhost/.test(state.settings.weatherEndpoint)) state.settings.weatherEndpoint = `${location.origin}/api/weather`;
}
let currentDate = state.currentDate ? new Date(state.currentDate) : new Date();
let pageIndex = 0;
let volatileDayAttachments = [];
let volatileProfileAttachments = [];
state.profile.additionalRecords ||= [];

const profileIds = ["pName","pAge","pHeight","pWeight","pWaist","pSex","pHistory","pHospital","pCheckup","pMedication","pLifestyle","pConcerns","pNotes","pPledge"];
const dayFields = ["entryTitle","entryText","dailyPledge","stepsInput","sleepInput","waterInput"];
const dateKey = () => `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,"0")}-${String(currentDate.getDate()).padStart(2,"0")}`;
const getDay = () => (state.days[dateKey()] ||= {});
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const readAttachment = (file) => new Promise(resolve => {
  const reader = new FileReader();
  const isText = /(^text\/)|json|csv|markdown/.test(file.type) || /\.(md|txt|csv|json)$/i.test(file.name);
  reader.onload = () => resolve({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    encoding: isText ? "utf-8" : "data-url",
    content: reader.result
  });
  reader.onerror = () => resolve({name:file.name,type:file.type,size:file.size,error:"파일 읽기 실패"});
  if (isText) reader.readAsText(file);
  else reader.readAsDataURL(file);
});

const compressImageAttachment = (file) => new Promise(resolve => {
  const reader = new FileReader();
  reader.onerror = () => resolve({name:file.name,type:file.type,size:file.size,error:"이미지 읽기 실패"});
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => resolve({
      name:file.name,type:file.type || "image/jpeg",size:file.size,
      encoding:"data-url",content:reader.result
    });
    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const content = canvas.toDataURL("image/jpeg", 0.78);
      resolve({
        name:file.name.replace(/\.[^.]+$/, "") + ".jpg",
        type:"image/jpeg",
        size:Math.round(content.length * 0.75),
        originalSize:file.size,
        encoding:"data-url",
        content
      });
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
const readUploadAttachment = file =>
  file.type.startsWith("image/") ? compressImageAttachment(file) : readAttachment(file);

const profileLabels = {
  pName: "이름/별명", pAge: "나이", pHeight: "키", pWeight: "체중", pWaist: "허리둘레",
  pSex: "성별/생물학적 특성", pHistory: "병력", pHospital: "병원 기록", pCheckup: "건강검진",
  pMedication: "복용약·알레르기", pLifestyle: "생활습관", pConcerns: "통증·주의 부위",
  pNotes: "기타 건강 정보", pPledge: "건강 다짐"
};
const keyRules = [
  ["pName", /^(이름|별명|성명|name)$/i],
  ["pAge", /^(나이|연령|만\s*나이|age)$/i],
  ["pHeight", /^(키|신장|height)$/i],
  ["pWeight", /^(체중|몸무게|weight)$/i],
  ["pWaist", /^(허리\s*둘레|복부\s*둘레|waist)$/i],
  ["pSex", /^(성별|생물학적\s*성별|생물학적\s*특성|sex|gender)$/i],
  ["pHistory", /^(병력|과거력|진단|진단명|질환|기저\s*질환|medical\s*history)$/i],
  ["pHospital", /^(병원|병원\s*기록|진료|수술|입원|치료|hospital)$/i],
  ["pCheckup", /^(건강\s*검진|검진|혈액\s*검사|검사\s*결과|혈압|혈당|콜레스테롤|checkup)$/i],
  ["pMedication", /^(복용약|약물|처방약|영양제|알레르기|medication|allergy)$/i],
  ["pLifestyle", /^(생활\s*습관|운동|수면|식습관|식사|음주|흡연|lifestyle)$/i],
  ["pConcerns", /^(통증|증상|주의\s*부위|불편|신체\s*부위|concerns?)$/i],
  ["pPledge", /^(건강\s*다짐|다짐|목표|건강\s*목표|pledge|goal)$/i],
  ["pNotes", /^(기타|참고|가족력|예방\s*접종|여성\s*건강|메모|notes?)$/i]
];
function fieldForLabel(label) {
  const clean = label
    .replace(/^\d+\s*[.)-]\s*/, "")
    .replace(/[*`#>|[\]]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const snake = clean.toLowerCase().replace(/[\s-]+/g, "_");
  const snakeRules = {
    name: "pName", nickname: "pName", age: "pAge", age_group: "pAge",
    height: "pHeight", height_cm: "pHeight", weight: "pWeight", weight_kg: "pWeight",
    waist: "pWaist", waist_cm: "pWaist", waist_circumference_cm: "pWaist",
    sex: "pSex", gender: "pSex",
    medical_history: "pHistory", cancer_history: "pHistory",
    medication_status: "pMedication", medications: "pMedication", supplements: "pMedication",
    lifestyle_profile: "pLifestyle", exercise_records: "pLifestyle", exercise: "pLifestyle", sleep: "pLifestyle",
    lab_results: "pCheckup", lab_results_2026_01: "pCheckup", blood_pressure: "pCheckup",
    cancer_followup: "pHospital", hospital_record: "pHospital",
    health_goals: "pPledge", management_priorities: "pPledge", main_health_goal: "pPledge",
    health_assessment: "pNotes", notes: "pNotes"
  };
  if (snakeRules[snake]) return snakeRules[snake];
  const exact = keyRules.find(([, rule]) => rule.test(clean))?.[0];
  if (exact) return exact;
  const compact = clean.replace(/[\s/·,&]+/g, "");
  if (/이름|별명|성명/.test(compact)) return "pName";
  if (/나이|연령/.test(compact)) return "pAge";
  if (/허리둘레|복부둘레/.test(compact)) return "pWaist";
  if (/키|신장/.test(compact)) return "pHeight";
  if (/체중|몸무게/.test(compact)) return "pWeight";
  if (/성별|생물학적특성/.test(compact)) return "pSex";
  if (/병력|과거력|기저질환|진단/.test(compact)) return "pHistory";
  if (/병원|진료|수술|입원|치료/.test(compact)) return "pHospital";
  if (/건강검진|혈액검사|검사결과|혈압|혈당|콜레스테롤/.test(compact)) return "pCheckup";
  if (/복용약|약물|처방약|영양제|알레르기/.test(compact)) return "pMedication";
  if (/생활습관|운동|수면|식습관|음주|흡연/.test(compact)) return "pLifestyle";
  if (/통증|증상|주의부위|불편/.test(compact)) return "pConcerns";
  if (/건강다짐|건강목표|다짐|목표/.test(compact)) return "pPledge";
  if (/기타|참고|가족력|예방접종|여성건강|메모/.test(compact)) return "pNotes";
  return null;
}
function sectionBehavior(label) {
  const normalized = label
    .replace(/^\d+\s*[.)-]\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (/(daily_log_template|weekly_summary_template|lab_result_template|cancer_followup_template|app_feature_ideas|notes_for_development)/.test(normalized)) {
    return "__skip";
  }
  return fieldForLabel(normalized);
}
function cleanImportedValue(value, field) {
  let clean = String(value || "")
    .replace(/^\s*[-*+]\s*/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const ageGroups = {
    early_50s: "50대 초반", mid_50s: "50대 중반", late_50s: "50대 후반",
    early_40s: "40대 초반", mid_40s: "40대 중반", late_40s: "40대 후반",
    early_60s: "60대 초반", mid_60s: "60대 중반", late_60s: "60대 후반"
  };
  if (field === "pAge" && ageGroups[clean.toLowerCase()]) clean = ageGroups[clean.toLowerCase()];
  if (field === "pSex") {
    if (clean.toLowerCase() === "male") clean = "남성";
    if (clean.toLowerCase() === "female") clean = "여성";
  }
  if (["pAge","pHeight","pWeight","pWaist"].includes(field)) {
    const number = clean.match(/\d+(?:\.\d+)?/);
    if (number && !(field === "pAge" && /대\s*(초반|중반|후반)/.test(clean))) clean = number[0];
  }
  return /^(미입력|없음|해당\s*없음|none|null|false|-)?$/i.test(clean) ? "" : clean;
}
function appendUnique(current, incoming) {
  const a = String(current || "").trim();
  const b = String(incoming || "").trim();
  if (!b || a.includes(b)) return a;
  return a ? `${a}\n${b}` : b;
}
function yamlScalar(text, key) {
  const match = String(text).match(new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "mi"));
  if (!match) return "";
  return match[1].replace(/^["']|["']$/g, "").trim();
}
function markdownSection(text, headingName) {
  const escaped = headingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text).match(new RegExp(`^##[ \\t]+(?:\\d+\\.[ \\t]*)?${escaped}[ \\t]*\\n([\\s\\S]*?)(?=^##[ \\t]+|(?![\\s\\S]))`, "mi"));
  return match?.[1] || "";
}
function quotedList(text) {
  return [...String(text).matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map(match => match[1]);
}
function humanBoolean(value, yes, no = "") {
  if (String(value).trim() === "true") return yes;
  if (String(value).trim() === "false") return no;
  return "";
}
function structuredHealthData(markdown) {
  const text = String(markdown || "");
  if (!/```ya?ml|user_profile:|medical_history:|lab_results:/i.test(text)) {
    return {fields:parseHealthMarkdown(text), additionalRecords:[], structured:false};
  }
  const fields = {};
  const records = [];
  const profile = markdownSection(text, "user_profile");
  const history = markdownSection(text, "medical_history");
  const medication = markdownSection(text, "medication_status");
  const lifestyle = markdownSection(text, "lifestyle_profile");
  const exercise = markdownSection(text, "exercise_records");
  const labs = markdownSection(text, "lab_results_2026_01");
  const assessment = markdownSection(text, "health_assessment");
  const goals = markdownSection(text, "health_goals");
  const priorities = markdownSection(text, "management_priorities");

  fields.pSex = cleanImportedValue(yamlScalar(profile, "sex"), "pSex");
  fields.pAge = cleanImportedValue(yamlScalar(profile, "age_group"), "pAge");
  fields.pHeight = cleanImportedValue(yamlScalar(profile, "height_cm"), "pHeight");
  fields.pWeight = cleanImportedValue(yamlScalar(profile, "weight_kg"), "pWeight");

  const diagnosis = yamlScalar(history, "korean_diagnosis") || yamlScalar(history, "diagnosis");
  const surgerySite = yamlScalar(history, "surgery_site");
  const treatmentTime = yamlScalar(history, "treatment_year_relative");
  const historyNotes = quotedList(history);
  fields.pHistory = [
    diagnosis && `진단: ${diagnosis}`,
    treatmentTime && `치료 시점: ${treatmentTime}`,
    surgerySite && `수술 부위: ${surgerySite}`,
    humanBoolean(yamlScalar(history, "recurrence_reported"), "", "현재까지 재발 보고 없음"),
    humanBoolean(yamlScalar(history, "regular_follow_up"), "정기 추적검사 중"),
    ...historyNotes
  ].filter(Boolean).join("\n");
  fields.pHospital = [
    surgerySite && `${surgerySite} 수술 병력`,
    humanBoolean(yamlScalar(history, "regular_follow_up"), "담당 병원 일정에 따라 암 추적검사 지속")
  ].filter(Boolean).join("\n");

  const medLines = [];
  if (yamlScalar(medication, "recommended_by_doctor") === "true") medLines.push("의사로부터 콜레스테롤 약 복용을 권유받음");
  if (yamlScalar(medication, "currently_taking") === "false") medLines.push("현재 콜레스테롤 약은 복용하지 않음");
  const vitaminDose = yamlScalar(medication, "dose");
  if (vitaminDose) medLines.push(`비타민 D3 권장량: ${vitaminDose}`);
  fields.pMedication = medLines.join("\n");

  const activities = [
    yamlScalar(lifestyle, "running") === "true" && "달리기",
    yamlScalar(lifestyle, "cycling") === "true" && "자전거",
    yamlScalar(lifestyle, "swimming") === "true" && "수영",
    yamlScalar(lifestyle, "rowing_machine") === "true" && "로잉머신"
  ].filter(Boolean);
  fields.pLifestyle = [
    yamlScalar(lifestyle, "pattern") && `운동: ${yamlScalar(lifestyle, "pattern")}`,
    yamlScalar(lifestyle, "weekly_duration_hours") && `주간 운동시간: ${yamlScalar(lifestyle, "weekly_duration_hours")}시간`,
    yamlScalar(lifestyle, "weekly_calories_kcal") && `주간 운동량: 약 ${yamlScalar(lifestyle, "weekly_calories_kcal")}kcal`,
    activities.length && `주요 종목: ${activities.join(", ")}`,
    yamlScalar(lifestyle, "current_hours_per_day") && `평균 수면: ${yamlScalar(lifestyle, "current_hours_per_day")}시간`,
    yamlScalar(lifestyle, "target_hours_per_day") && `목표 수면: ${yamlScalar(lifestyle, "target_hours_per_day")}시간`
  ].filter(Boolean).join("\n");

  const labDate = yamlScalar(labs, "date");
  fields.pCheckup = [
    labDate && `검사일: ${labDate}`,
    `혈압 ${yamlScalar(profile, "systolic_mmHg") || "-"} / ${yamlScalar(profile, "diastolic_mmHg") || "-"} mmHg`,
    yamlScalar(labs, "fasting_glucose_mg_dL") && `공복혈당 ${yamlScalar(labs, "fasting_glucose_mg_dL")} mg/dL`,
    yamlScalar(labs, "total_cholesterol_mg_dL") && `총콜레스테롤 ${yamlScalar(labs, "total_cholesterol_mg_dL")} mg/dL`,
    yamlScalar(labs, "HDL_mg_dL") && `HDL ${yamlScalar(labs, "HDL_mg_dL")} mg/dL`,
    yamlScalar(labs, "LDL_mg_dL") && `LDL ${yamlScalar(labs, "LDL_mg_dL")} mg/dL`,
    yamlScalar(labs, "triglyceride_mg_dL") && `중성지방 ${yamlScalar(labs, "triglyceride_mg_dL")} mg/dL`,
    yamlScalar(labs, "vitamin_D_25OH_ng_mL") && `비타민 D ${yamlScalar(labs, "vitamin_D_25OH_ng_mL")} ng/mL`,
    yamlScalar(labs, "PSA_ng_mL") && `PSA ${yamlScalar(labs, "PSA_ng_mL")} ng/mL`
  ].filter(Boolean).join("\n");

  const watchBlock = assessment.match(/watch_points:\s*([\s\S]*?)(?=\n\s*\w[\w_]*:|\s*$)/)?.[1] || "";
  fields.pConcerns = quotedList(watchBlock).join("\n");
  fields.pNotes = [
    yamlScalar(assessment, "overall_status"),
    ...quotedList(assessment.match(/strengths:\s*([\s\S]*?)(?=\n\s*watch_points:|\s*$)/)?.[1] || "")
  ].filter(Boolean).join("\n");
  fields.pPledge = [...quotedList(profile.match(/main_health_goal:\s*([\s\S]*?)(?=\n\s*\w[\w_]*:|\s*$)/)?.[1] || ""), ...quotedList(goals), ...quotedList(priorities)]
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 10)
    .join("\n");

  const runningDistance = yamlScalar(exercise, "distance_km");
  const runDuration = yamlScalar(exercise, "duration");
  if (runningDistance) records.push(normalizeExtraRecord({
    label:"최근 달리기", value:[
      `${runningDistance}km`, runDuration,
      yamlScalar(exercise, "average_pace") && `평균 페이스 ${yamlScalar(exercise, "average_pace")}`,
      yamlScalar(exercise, "average_heart_rate_bpm") && `평균 심박 ${yamlScalar(exercise, "average_heart_rate_bpm")}bpm`,
      yamlScalar(exercise, "max_oxygen_uptake_vo2max") && `VO₂max ${yamlScalar(exercise, "max_oxygen_uptake_vo2max")}`
    ].filter(Boolean).join(" · "), source:"업로드 Markdown"
  }));
  if (labDate) records.push(normalizeExtraRecord({
    label:"혈액검사", value:fields.pCheckup, date:labDate, source:"업로드 Markdown"
  }));
  return {fields, additionalRecords:records, structured:true};
}
function looksMachineFormatted(value) {
  const text = String(value || "");
  const keyCount = (text.match(/\b[a-z][a-z0-9_]{2,}\s*:/gi) || []).length;
  return keyCount >= 2 || /medical_history:|lab_results:|lifestyle_profile:|medication_status:/.test(text);
}
function parseHealthMarkdown(markdown) {
  const result = {};
  const unmatched = [];
  let sectionField = null;
  const sectionBuffer = [];
  const flushSection = () => {
    const text = sectionBuffer.splice(0)
      .filter(line => !/^```/.test(line))
      .join("\n")
      .trim();
    if (!text) return;
    if (sectionField === "__skip") return;
    if (sectionField) result[sectionField] = appendUnique(result[sectionField], text);
    else unmatched.push(text);
  };
  String(markdown || "").replace(/\r\n?/g, "\n").split("\n").forEach(raw => {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushSection();
      sectionField = sectionBehavior(heading[1]);
      return;
    }
    const pair = line.match(/^(?:[-*+]\s*)?([^:：]{1,30})\s*[:：]\s*(.+)$/);
    if (pair) {
      const field = fieldForLabel(pair[1]);
      if (field) {
        const value = cleanImportedValue(pair[2], field);
        if (value) result[field] = appendUnique(result[field], value);
        return;
      }
    }
    if (!line || /^---+$/.test(line) || /^```/.test(line) || /^_마지막\s*수정/.test(line)) return;
    if (sectionField === "__skip") return;
    if (line.startsWith(">")) sectionBuffer.push(line.replace(/^>\s?/, ""));
    else sectionBuffer.push(
      line
        .replace(/^[-*+]\s*/, "• ")
        .replace(/^([a-zA-Z][\w]*):\s*/, "$1: ")
    );
  });
  flushSection();
  if (unmatched.length) result.pNotes = appendUnique(result.pNotes, unmatched.join("\n\n"));
  return result;
}
function applyImportedProfile(parsed, options = {}) {
  const changed = [];
  Object.entries(parsed).forEach(([id, rawValue]) => {
    const input = $(`#${id}`);
    if (!input) return;
    const value = cleanImportedValue(rawValue, id);
    if (!value) return;
    const isShortField = ["pName","pAge","pHeight","pWeight","pWaist","pSex"].includes(id);
    const shouldReplace = isShortField || options.replace || looksMachineFormatted(input.value);
    input.value = shouldReplace ? value : appendUnique(input.value, value);
    state.profile[id] = input.value.trim();
    changed.push(profileLabels[id]);
  });
  return [...new Set(changed)];
}
function normalizeExtraRecord(record = {}) {
  return {
    id: record.id || `extra-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    label: String(record.label || record.title || "추가 건강 정보").trim(),
    value: String(record.value || record.detail || record.content || "").trim(),
    date: String(record.date || "").trim(),
    source: String(record.source || "").trim()
  };
}
function renderExtraRecords() {
  const container = $("#extraRecords");
  const records = state.profile.additionalRecords || [];
  if (!records.length) {
    container.innerHTML = `<div class="extra-empty">AI가 찾은 정보나 직접 추가한 기록이 여기에 쌓입니다.</div>`;
    return;
  }
  container.innerHTML = records.map(record => `
    <div class="extra-record" data-id="${escapeHtml(record.id)}">
      <input data-extra-key="label" value="${escapeHtml(record.label)}" placeholder="항목명">
      <textarea data-extra-key="value" placeholder="내용">${escapeHtml(record.value)}</textarea>
      <button type="button" data-remove-extra="${escapeHtml(record.id)}" aria-label="삭제">×</button>
      <input data-extra-key="date" value="${escapeHtml(record.date)}" placeholder="날짜">
      <input data-extra-key="source" value="${escapeHtml(record.source)}" placeholder="출처">
    </div>`).join("");
}
function saveExtraRecordsFromUI() {
  $$(".extra-record").forEach(row => {
    const record = state.profile.additionalRecords.find(x => x.id === row.dataset.id);
    if (!record) return;
    row.querySelectorAll("[data-extra-key]").forEach(input => record[input.dataset.extraKey] = input.value.trim());
  });
}
function mergeExtraRecords(records = []) {
  const added = [];
  records.map(normalizeExtraRecord).forEach(record => {
    if (!record.value) return;
    const duplicate = state.profile.additionalRecords.some(x =>
      x.label === record.label && x.value === record.value && x.date === record.date
    );
    if (!duplicate) {
      state.profile.additionalRecords.push(record);
      added.push(record.label);
    }
  });
  renderExtraRecords();
  return added;
}
function normalizeProfileExtraction(raw) {
  if (raw?.choices?.[0]?.message?.content) raw = raw.choices[0].message.content;
  if (raw?.output_text) raw = raw.output_text;
  if (typeof raw === "string") raw = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  const extracted = raw.profile || raw.extraction || raw.result || raw;
  const normalizedFields = {};
  Object.entries(extracted.fields || {}).forEach(([key, value]) => {
    const target = profileIds.includes(key) ? key : fieldForLabel(key);
    if (target) normalizedFields[target] = appendUnique(normalizedFields[target], value);
  });
  return {...extracted, fields:normalizedFields};
}
function parseAIJson(raw) {
  if (raw?.choices?.[0]?.message?.content) raw = raw.choices[0].message.content;
  if (raw?.output_text) raw = raw.output_text;
  if (raw?.result && typeof raw.result !== "string") raw = raw.result;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned);
  }
  return raw;
}
function aiConfigured() {
  const mode = state.settings.aiConnectionMode || "direct";
  return mode === "proxy"
    ? Boolean(state.settings.apiEndpoint && (state.settings.proxyAiApiKey || state.settings.appAccessCode))
    : Boolean(state.settings.aiApiKey && state.settings.aiApiUrl && state.settings.aiModel);
}
function localProxyUrl(pathname) {
  return `${runtimeOrigin}${pathname}`;
}
function proxyHeaders() {
  const headers = {"Content-Type":"application/json"};
  if (state.settings.appAccessCode) headers["X-App-Code"] = state.settings.appAccessCode;
  if (state.settings.proxyAiApiKey) headers["X-OpenAI-Key"] = state.settings.proxyAiApiKey;
  return headers;
}
async function assertLocalProxyAvailable(endpoint) {
  let url;
  try { url = new URL(endpoint, window.location.href); } catch { return; }
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) return;
  try {
    const response = await fetch(`${url.origin}/api/health`, {cache:"no-store"});
    if (!response.ok) throw new Error();
  } catch {
    const error = new Error("온기록 로컬 서버가 실행되지 않았습니다. start-local.bat을 실행하고 이 창을 닫지 마세요.");
    error.code = "LOCAL_PROXY_OFFLINE";
    throw error;
  }
}
async function callAI({task, systemPrompt, data, images = []}) {
  const mode = state.settings.aiConnectionMode || "direct";
  if (mode === "proxy") {
    if (!state.settings.apiEndpoint) throw new Error("AI 프록시 주소가 설정되지 않았습니다.");
    await assertLocalProxyAvailable(state.settings.apiEndpoint);
    const response = await fetch(state.settings.apiEndpoint, {
      method:"POST",
      headers:proxyHeaders(),
      body:JSON.stringify({task, systemPrompt, ...data, images})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `AI API ${response.status}`);
    return parseAIJson(result);
  }
  if (!state.settings.aiApiKey) throw new Error("AI API 키가 설정되지 않았습니다.");
  if (!state.settings.aiApiUrl) throw new Error("AI API 주소가 설정되지 않았습니다.");
  if (!state.settings.aiModel) throw new Error("AI 모델명이 설정되지 않았습니다.");
  const content = [{type:"text", text:JSON.stringify({task, ...data})}];
  images.forEach(image => content.push({
    type:"image_url",
    image_url:{url:image.dataUrl}
  }));
  const response = await fetch(state.settings.aiApiUrl, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${state.settings.aiApiKey}`
    },
    body:JSON.stringify({
      model:state.settings.aiModel,
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:systemPrompt},
        {role:"user",content}
      ]
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI API ${response.status}${detail ? `: ${detail.slice(0,160)}` : ""}`);
  }
  return parseAIJson(await response.json());
}
async function extractDailyImagesWithAI(attachments) {
  const imageAttachments = attachments.filter(a => String(a.type || "").startsWith("image/") && a.content);
  if (!imageAttachments.length) return null;
  if (!aiConfigured()) {
    const error = new Error("설정창에 AI API 키·주소·모델을 입력해 주세요.");
    error.code = "IMAGE_API_MISSING";
    throw error;
  }
  const extracted = await callAI({
      task:"extract_daily_health_data",
      systemPrompt:state.settings.dailyImagePrompt || defaultDailyImagePrompt,
      data:{
      healthProfileMarkdown: profileMarkdown(),
      responseFormat:"json"
      },
      images:imageAttachments.map(a => ({name:a.name,mimeType:a.type,dataUrl:a.content}))
  });
  if (!extracted?.recognized) throw new Error("API가 이미지 판독 완료 상태를 반환하지 않았습니다.");
  return extracted;
}
function applyImageMetrics(extracted) {
  const metrics = extracted?.dailyMetrics || {};
  if (metrics.steps != null) {
    $("#stepsInput").value = metrics.steps;
    getDay().stepsInput = String(metrics.steps);
  }
  if (metrics.sleepHours != null) {
    $("#sleepInput").value = metrics.sleepHours;
    getDay().sleepInput = String(metrics.sleepHours);
  }
  if (metrics.waterLiters != null) {
    $("#waterInput").value = metrics.waterLiters;
    getDay().waterInput = String(metrics.waterLiters);
  }
}
function imageExtractionAsText(extracted) {
  if (!extracted) return "";
  return JSON.stringify({
    summary: extracted.summary,
    dailyMetrics: extracted.dailyMetrics,
    workouts: extracted.workouts,
    sleep: extracted.sleep,
    otherMetrics: extracted.otherMetrics,
    imageEvidence: extracted.imageEvidence,
    warnings: extracted.warnings
  }, null, 2);
}
async function extractProfileWithAI(attachments) {
  if (!aiConfigured()) return {status:"missing-endpoint"};
  const images = attachments
    .filter(a => String(a.type || "").startsWith("image/") && a.content)
    .map(a => ({name:a.name,mimeType:a.type,dataUrl:a.content}));
  const documents = attachments
    .filter(a => !String(a.type || "").startsWith("image/"))
    .map(a => ({name:a.name,type:a.type,content:a.content || "",contentStored:a.contentStored}));
  const extracted = await callAI({
      task:"extract_health_profile",
      systemPrompt:state.settings.profileExtractionPrompt || defaultProfileExtractionPrompt,
      data:{
      currentProfileMarkdown: profileMarkdown(),
      currentAdditionalRecords: state.profile.additionalRecords,
      attachments:documents
      },
      images
  });
  const normalized = normalizeProfileExtraction(extracted);
  const changed = applyImportedProfile(normalized.fields || {});
  const added = mergeExtraRecords(normalized.additionalRecords || []);
  return {status:"success", changed, added, summary:normalized.summary || "", warnings:normalized.warnings || []};
}

function compactAttachment(attachment = {}) {
  const {content, ...metadata} = attachment;
  return {...metadata, contentStored:false};
}
function compactStateForStorage(source) {
  const saved = JSON.parse(JSON.stringify(source));
  if (saved.profile?.attachments) saved.profile.attachments = saved.profile.attachments.map(compactAttachment);
  Object.values(saved.days || {}).forEach(day => {
    if (day.attachments) day.attachments = day.attachments.map(compactAttachment);
  });
  return saved;
}
function persist() {
  state.currentDate = currentDate.toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compactStateForStorage(state)));
    return true;
  } catch (error) {
    try {
      const essential = compactStateForStorage(state);
      essential.profile.attachments = [];
      Object.values(essential.days || {}).forEach(day => { day.attachments = []; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(essential));
      return true;
    } catch {
      console.error("온기록 저장 실패", error);
      return false;
    }
  }
}
function saveDay() {
  const day = getDay();
  dayFields.forEach(id => day[id] = id === "entryText" ? $(`#${id}`).innerText : $(`#${id}`).value);
  day.mood = $("#moodText").textContent;
  day.emoji = $("#moodEmoji").textContent;
  persist();
}
function loadDay() {
  const day = getDay();
  dayFields.forEach(id => {
    if (id === "entryText") $(`#${id}`).innerText = day[id] || "";
    else $(`#${id}`).value = day[id] || "";
  });
  $("#moodText").textContent = day.mood || "가뿐해요";
  $("#moodEmoji").textContent = day.emoji || "🌿";
  renderAttachmentStatus();
  renderReport(day.analysis);
}
function renderAttachmentStatus() {
  const day = getDay();
  const files = day.attachments || day.files || [];
  const images = files.filter(a => String(a.type || "").startsWith("image/"));
  const status = $("#attachmentStatus");
  status.className = "attachment-status";
  if (!files.length) {
    status.textContent = "첨부된 자료가 없습니다.";
  } else if (images.length && !day.extractedImageData) {
    status.classList.add("pending");
    status.textContent = `이미지 ${images.length}장 첨부됨 · 아직 내용은 판독하지 않았습니다.`;
  } else if (images.length) {
    status.classList.add("ready");
    status.textContent = `이미지 ${images.length}장 AI 판독 완료 · 분석에 반영됩니다.`;
  } else {
    status.classList.add("ready");
    status.textContent = `자료 ${files.length}개가 분석에 연결되었습니다.`;
  }
}
function renderDate() {
  const day = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"][currentDate.getDay()];
  $("#dateLabel").textContent = `${currentDate.getMonth()+1}월 ${currentDate.getDate()}일 ${day}`;
}
function parseKmaWeather(data) {
  const items = data?.response?.body?.items?.item;
  if (!Array.isArray(items)) {
    throw new Error(data?.response?.header?.resultMsg || "날씨 응답 형식을 읽을 수 없습니다.");
  }
  const values = {};
  items.forEach(item => { values[item.category] = item.obsrValue ?? item.fcstValue; });
  const precipitation = Number(values.PTY || 0);
  const description = [1,5].includes(precipitation) ? "비"
    : [2,6].includes(precipitation) ? "비·눈"
    : [3,7].includes(precipitation) ? "눈" : "맑음";
  return {
    temperature: values.T1H ?? values.TMP,
    humidity: values.REH,
    wind: values.WSD,
    rain: values.RN1,
    description
  };
}
function latLonToKmaGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + OLAT * DEGRAD * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - OLON * DEGRAD;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  };
}
function applyWeatherRegion(value) {
  if (!value || value === "current") return;
  const [name, nx, ny] = value.split("|");
  state.settings.weatherLocation = name;
  state.settings.weatherNx = nx;
  state.settings.weatherNy = ny;
}
function useCurrentLocation() {
  if (!navigator.geolocation) return toast("이 브라우저는 현재 위치를 지원하지 않아요");
  const button = $("#useCurrentLocation");
  button.disabled = true; button.textContent = "위치를 확인하는 중…";
  navigator.geolocation.getCurrentPosition(position => {
    const grid = latLonToKmaGrid(position.coords.latitude, position.coords.longitude);
    state.settings.weatherLocation = "현재 위치";
    state.settings.weatherNx = String(grid.nx);
    state.settings.weatherNy = String(grid.ny);
    $("#weatherRegion").value = "current";
    persist(); loadWeather();
    button.disabled = false; button.textContent = "✓ 현재 위치 적용됨";
    toast("현재 위치를 날씨 지역으로 설정했어요");
  }, error => {
    button.disabled = false; button.textContent = "⌖ 현재 위치 사용";
    toast(error.code === 1 ? "위치 권한이 필요해요" : "현재 위치를 확인하지 못했어요");
  }, {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
}
async function loadWeather() {
  const location = state.settings.weatherLocation || "서울";
  if (!state.settings.weatherEndpoint) {
    $("#weatherLabel").textContent = `${location} · 날씨 API 연결 전`;
    return;
  }
  try {
    await assertLocalProxyAvailable(state.settings.weatherEndpoint);
    const url = new URL(state.settings.weatherEndpoint, window.location.href);
    url.searchParams.set("nx", state.settings.weatherNx || "60");
    url.searchParams.set("ny", state.settings.weatherNy || "127");
    const response = await fetch(url, {
      headers: {
        ...(state.settings.appAccessCode ? {"X-App-Code":state.settings.appAccessCode} : {}),
        ...(state.settings.weatherApiKey ? {"X-Weather-Key":state.settings.weatherApiKey} : {})
      }
    });
    if (!response.ok) throw new Error(`날씨 API ${response.status}`);
    const weather = parseKmaWeather(await response.json());
    $("#weatherLabel").textContent = `${location} · ${weather.description}${weather.temperature != null ? ` ${weather.temperature}°` : ""}`;
    getDay().weather = weather;
    persist();
  } catch (error) {
    $("#weatherLabel").textContent = error.code === "LOCAL_PROXY_OFFLINE"
      ? `${location} · 로컬 서버 꺼짐`
      : `${location} · 날씨 불러오기 실패`;
    console.warn(error);
  }
}
function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
function setPage(index) {
  pageIndex = Math.max(0, Math.min(2, index));
  $$(".page").forEach((page, i) => page.classList.toggle("active", i === pageIndex));
  $$(".page-tab").forEach((tab, i) => tab.classList.toggle("active", i === pageIndex));
  $("#prevPage").disabled = pageIndex === 0;
  $("#nextPage").disabled = pageIndex === 2;
  $(".book-stage").classList.toggle("show-report", pageIndex === 2);
  $(".phone-shell").classList.toggle("cover-open", pageIndex === 0);
  window.scrollTo({top: 0, behavior: "smooth"});
}
function shiftDay(amount) {
  saveDay();
  currentDate.setDate(currentDate.getDate() + amount);
  volatileDayAttachments = [];
  renderDate(); loadDay(); setPage(1); persist();
}
function renderCover() {
  const profile = state.profile || {};
  $("#coverOwner").textContent = profile.pName || "아직 이름을 적지 않았어요";
  $("#coverPledge").textContent = `“${profile.pPledge || "건강한 오늘을 한 페이지씩 쌓아갑니다."}”`;
  const basics = [
    profile.pAge,
    profile.pHeight && `키 ${profile.pHeight}cm`,
    profile.pWeight && `체중 ${profile.pWeight}kg`,
    profile.pLifestyle && profile.pLifestyle.split("\n")[0],
    profile.pConcerns && `주의: ${profile.pConcerns.split("\n")[0]}`
  ].filter(Boolean);
  $("#coverProfileSummary").textContent = basics.length
    ? basics.join(" · ")
    : "건강 기본정보를 등록하면 나에게 맞춘 분석이 시작됩니다.";
}

function profileMarkdown() {
  const p = state.profile;
  return `# 건강 기본 정보

## 신체 정보
- 이름/별명: ${p.pName || "미입력"}
- 나이: ${p.pAge || "미입력"}
- 키: ${p.pHeight ? `${p.pHeight} cm` : "미입력"}
- 체중: ${p.pWeight ? `${p.pWeight} kg` : "미입력"}
- 허리둘레: ${p.pWaist ? `${p.pWaist} cm` : "미입력"}
- 성별/생물학적 특성: ${p.pSex || "미입력"}

## 병력
${p.pHistory || "미입력"}

## 병원 진료·수술·입원
${p.pHospital || "미입력"}

## 건강검진·혈액검사
${p.pCheckup || "미입력"}

## 복용약·영양제·알레르기
${p.pMedication || "미입력"}

## 생활습관
${p.pLifestyle || "미입력"}

## 통증 및 주의 부위
${p.pConcerns || "미입력"}

## 기타 건강 정보
${p.pNotes || "미입력"}

## 추가 기록
${(p.additionalRecords || []).map(record =>
  `### ${record.label || "추가 정보"}\n- 내용: ${record.value || "미입력"}\n- 날짜: ${record.date || "미입력"}\n- 출처: ${record.source || "직접 입력"}`
).join("\n\n") || "없음"}

## 건강 다짐
> ${p.pPledge || "미입력"}

## 첨부 자료
${(p.files || []).map(f => `- ${f}`).join("\n") || "- 없음"}

_마지막 수정: ${new Date().toLocaleString("ko-KR")}_`;
}

function buildPayload() {
  const day = getDay();
  const attachments = volatileDayAttachments.length ? volatileDayAttachments : (day.attachments || day.files || []);
  const attachmentMetadata = attachments.map(attachment => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    imageAnalyzed: String(attachment.type || "").startsWith("image/") && Boolean(day.extractedImageData),
    textContent: attachment.encoding === "utf-8" && attachment.content
      ? String(attachment.content).slice(0, 12000)
      : undefined
  }));
  return {
    systemPrompt: state.settings.customPrompt || defaultPrompt,
    healthProfileMarkdown: profileMarkdown(),
    healthProfileAttachments: volatileProfileAttachments.length ? volatileProfileAttachments : (state.profile.attachments || []),
    date: dateKey(),
    weather: $("#weatherLabel").textContent,
    dailyRecord: {
      title: day.entryTitle || "",
      narrative: day.entryText || "",
      mood: `${day.emoji || ""} ${day.mood || ""}`.trim(),
      pledge: day.dailyPledge || "",
      steps: day.stepsInput || null,
      sleepHours: day.sleepInput || null,
      waterLiters: day.waterInput || null,
      uploadedFiles: attachmentMetadata
    },
    extractedImageData: day.extractedImageData || null,
    instruction: "업로드 이미지·파일이 별도로 전달된 경우 함께 읽고, 프롬프트의 JSON 스키마로만 응답하세요."
  };
}

function demoAnalysis(payload) {
  const d = payload.dailyRecord;
  const text = `${d.title} ${d.narrative}`.toLowerCase();
  const steps = Number(String(d.steps || "").replace(/,/g,"")) || 0;
  const sleep = Number(d.sleepHours) || 0;
  const water = Number(d.waterLiters) || 0;
  const active = /러닝|달리|걷기|운동|헬스|수영|자전거|요가/.test(text);
  const tired = /피곤|지쳤|힘들|통증|아프|잠을 못|불면/.test(text);
  let score = 62 + (steps >= 7000 ? 8 : 0) + (sleep >= 7 ? 8 : 0) + (water >= 1.5 ? 5 : 0) + (active ? 7 : 0) - (tired ? 8 : 0);
  score = Math.max(35, Math.min(94, score));
  const exercise = active
    ? `기록에서 운동 활동이 확인됩니다. ${steps ? `총 ${steps.toLocaleString()}걸음으로 일상 활동량도 함께 확보했습니다.` : "걸음 수는 입력되지 않았습니다."} 다만 운동 시간·거리·평균 심박수·체감 강도가 없어 정확한 운동 부하와 회복 시간을 계산하기 어렵습니다. 다음 기록에는 종목, 시간, 거리와 1~10의 체감 강도를 함께 남겨주세요.`
    : `${steps ? `${steps.toLocaleString()}걸음을 기록했습니다.` : "걸음과 운동 수치가 입력되지 않았습니다."} 별도 운동은 확인되지 않습니다. 무리한 보충 운동보다 10~20분 가벼운 걷기와 관절 가동성 운동부터 권합니다.`;
  return {
    score,
    headline: tired ? "활동보다 회복을 우선해야 하는 신호가 보여요." : active ? "움직임을 잘 챙긴 날, 이제 회복의 질을 높여보세요." : "기초 생활 리듬을 한 가지씩 채우면 좋은 날이에요.",
    exercise,
    recovery: sleep ? `${sleep}시간 수면을 기록했습니다. ${sleep >= 7 ? "일반적인 성인 권장 범위에 가깝지만, 개운함과 중간 각성 여부도 함께 봐야 합니다." : "수면 시간이 짧은 편이므로 오늘 고강도 운동은 줄이고 취침 준비를 30분 앞당겨 보세요."}` : "수면 시간이 없어 회복 상태를 정량 평가하기 어렵습니다. 취침·기상 시각과 중간 각성을 함께 기록해 주세요.",
    nutrition: water ? `수분 ${water}L를 기록했습니다. ${water >= 1.5 ? "기본 섭취는 비교적 잘 챙겼습니다. 운동이나 더운 날에는 활동 전후로 나누어 보충하세요." : "활동량을 고려하면 조금 더 보충할 여지가 있습니다. 한 번에 많이 마시기보다 200~300mL씩 나누세요."}` : "수분량이 입력되지 않았습니다. 식사 사진만으로 양과 영양소를 단정하지 않고, 다음에는 대략적인 양과 시간을 함께 기록해 주세요.",
    metrics: [
      {label:"걸음", value: steps ? steps.toLocaleString() : "미입력", note: steps >= 7000 ? "활동 기반 양호" : "기록 보완 필요"},
      {label:"수면", value: sleep ? `${sleep}시간` : "미입력", note: sleep >= 7 ? "시간 확보" : "회복 우선"},
      {label:"수분", value: water ? `${water}L` : "미입력", note: water >= 1.5 ? "꾸준히 유지" : "나누어 보충"}
    ],
    evidence: [
      d.mood ? `주관적 컨디션: ${d.mood}` : "주관적 컨디션 미입력",
      d.narrative ? `일기 본문 ${d.narrative.length}자와 제목을 분석함` : "본문 기록이 없어 수치 중심으로 분석함",
      (d.uploadedFiles || []).length ? `첨부 자료 ${(d.uploadedFiles || []).length}개가 있음` : "정량 운동 파일 또는 사진이 없음",
      state.profile.pConcerns ? `프로필의 주의 부위 반영: ${state.profile.pConcerns}` : "프로필에 통증·주의 부위가 입력되지 않음"
    ],
    actions: [
      {priority:"필수", title: tired ? "회복 강도 낮추기" : "10분 회복 루틴", detail: tired ? "오늘 고강도 운동을 피하고 통증 없는 범위에서 가볍게 움직이세요." : "취침 전 종아리·엉덩이·등을 각 30초씩 2회 편안하게 늘리세요."},
      {priority:"권장", title:"수분 나누어 마시기", detail:`앞으로 3시간 동안 200~300mL씩 ${water >= 1.5 ? "1~2회" : "2~3회"} 나누어 마시세요.`},
      {priority:"권장", title:"내일 기록 보완", detail:"운동 종목·시간·거리·심박수 또는 체감 강도(1~10)를 함께 남기세요."}
    ],
    weekPlan: [
      {day:"주 2~3회", plan:"20~40분 중강도 유산소. 대화 가능한 강도를 기본으로 합니다."},
      {day:"주 2회", plan:"전신 근력운동 20~30분. 기존 병력과 통증이 있으면 전문가 지침을 우선합니다."},
      {day:"매일", plan:"같은 시간대 수면과 5~10분 가벼운 스트레칭을 시도합니다."}
    ],
    caution: tired ? "피로·통증 표현이 확인됩니다. 심하거나 악화되거나 일상 기능을 방해하면 의료진과 상담하세요." : "기록에서 즉각적인 위험 신호는 확인되지 않았습니다.",
    missingData: ["운동 시간·거리·심박수·체감 강도", "식사 시간과 대략적인 양", "수면의 질과 중간 각성"]
  };
}

function normalizeAnalysis(raw) {
  if (typeof raw === "string") {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "");
    return JSON.parse(cleaned);
  }
  return raw.analysis || raw.result || raw;
}
function missingDataGuide(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (/수면|취침|기상|각성|코골|수면의 질/.test(text)) {
    return {kind:"sleep", button:"수면 입력하기", guide:"1쪽의 수면 시간에 총 수면시간을 입력하고, 중간 각성·수면의 질은 일기 본문에 적어주세요."};
  }
  if (/수분|물\s*섭취/.test(text)) {
    return {kind:"water", button:"수분 입력하기", guide:"1쪽의 물(L) 칸에 하루 섭취량을 입력하세요. 예: 1.8"};
  }
  if (/걸음|보행/.test(text)) {
    return {kind:"steps", button:"걸음 입력하기", guide:"1쪽의 걸음 칸에 숫자를 입력하거나 건강 앱 화면을 첨부하세요."};
  }
  if (/심박|페이스|속도|거리|운동 시간|케이던스|칼로리|체감 강도|RPE|운동 데이터/.test(text)) {
    return {kind:"workout", button:"운동 자료 올리기", guide:"운동 상세 화면을 첨부하거나 일기에 종목, 시간, 거리, 평균 심박, 체감 강도(1~10)를 적어주세요."};
  }
  if (/식사|음식|영양|단백질|채소|탄수화물|식사 시간|섭취량/.test(text)) {
    return {kind:"food", button:"식사 기록하기", guide:"음식 사진을 올리고 일기에 식사 시간과 대략적인 양을 적어주세요. 예: 12:30, 밥 반 공기·닭가슴살 1개"};
  }
  if (/병력|진단|검진|혈액|약물|복용약|알레르기|키|체중|허리|통증 부위/.test(text)) {
    return {kind:"profile", button:"기본정보 추가", guide:"건강 기본정보 창에 직접 입력하거나 검진표·병원 기록 파일을 업로드하세요."};
  }
  if (/피로|통증|기분|스트레스|증상/.test(text)) {
    return {kind:"journal", button:"일기에 추가하기", guide:"1쪽 일기 본문에 발생 시각, 정도(1~10), 지속시간과 상황을 함께 적어주세요."};
  }
  return {kind:"journal", button:"기록 추가하기", guide:"1쪽 일기 본문에 수치·시간·상황을 구체적으로 적거나 관련 사진·파일을 첨부하세요."};
}
function renderMissingData(items = []) {
  const container = $("#missingDataList");
  if (!items.length) {
    container.innerHTML = `<p class="missing-empty">현재 기록으로 분석에 필요한 주요 데이터가 충분합니다.</p>`;
    return;
  }
  container.innerHTML = items.map(item => {
    const guide = missingDataGuide(item);
    return `<article class="missing-card">
      <header><strong>${escapeHtml(item)}</strong><button type="button" data-missing-kind="${guide.kind}">${guide.button}</button></header>
      <p>${escapeHtml(guide.guide)}</p>
    </article>`;
  }).join("");
}
function openMissingDataInput(kind) {
  if (kind === "profile") {
    $("#profileDialog").showModal();
    return;
  }
  setPage(1);
  setTimeout(() => {
    if (kind === "sleep") return $("#sleepInput").focus();
    if (kind === "water") return $("#waterInput").focus();
    if (kind === "steps") return $("#stepsInput").focus();
    if (kind === "workout" || kind === "food") return $("#dailyImages").click();
    $("#entryText").focus();
    $("#entryText").scrollIntoView({behavior:"smooth",block:"center"});
  }, 220);
}
function renderReport(a) {
  if (!a) {
    $("#healthScore").textContent = "--";
    $("#reportStatus").textContent = "첫 페이지의 기록과 자료를 바탕으로 상세 분석을 만들 수 있어요.";
    $("#exerciseAnalysis").textContent = "운동 종류, 시간, 거리, 강도, 회복 상태를 분석합니다.";
    $("#recoveryAnalysis").textContent = "수면과 피로 기록을 살펴봅니다.";
    $("#nutritionAnalysis").textContent = "식사 사진과 기록을 살펴봅니다.";
    $("#analysisMetrics").innerHTML = "";
    $("#evidenceList").innerHTML = "<li>아직 분석된 기록이 없습니다.</li>";
    renderMissingData([]);
    $("#actionList").innerHTML = "";
    $("#weekPlan").innerHTML = "";
    return;
  }
  $("#healthScore").textContent = a.score ?? "--";
  $("#reportTitle").textContent = getDay().entryTitle || "오늘의 건강 리포트";
  $("#reportStatus").innerHTML = `<strong>${escapeHtml(a.headline || "분석이 완료되었습니다.")}</strong><small>${escapeHtml(a.caution || "")}</small>`;
  $("#exerciseAnalysis").textContent = a.exercise || "분석 정보 없음";
  $("#recoveryAnalysis").textContent = a.recovery || "분석 정보 없음";
  $("#nutritionAnalysis").textContent = a.nutrition || "분석 정보 없음";
  $("#analysisMetrics").innerHTML = (a.metrics || []).map(m => `<div><span>${escapeHtml(m.label)}</span><strong>${escapeHtml(m.value)}</strong><small>${escapeHtml(m.note || "")}</small></div>`).join("");
  $("#evidenceList").innerHTML = (a.evidence || []).map(x => `<li>${escapeHtml(x)}</li>`).join("") || "<li>분석 근거가 제공되지 않았습니다.</li>";
  renderMissingData(a.missingData || []);
  $("#actionList").innerHTML = (a.actions || []).map((x,i) => `<article><b>${i+1}</b><div><span>${escapeHtml(x.priority || "권장")}</span><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail)}</p></div></article>`).join("");
  $("#weekPlan").innerHTML = (a.weekPlan || []).map(item => {
    const day = String(item.day || item.frequency || item.schedule || "이번 주").replace(/\s+/g, " ").trim();
    const planParts = [item.activity, item.plan, item.detail, item.target]
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map(value => String(value).replace(/\s+/g, " ").trim())
      .filter((value, index, all) => all.indexOf(value) === index);
    return `<article class="week-plan-row"><strong>${escapeHtml(day)}</strong><p>${escapeHtml(planParts.join(" · ") || "계획을 확인해 주세요.")}</p></article>`;
  }).join("");
}

async function analyze() {
  saveDay(); setPage(2);
  const btn = $("#analyzeBtn"); btn.disabled = true; btn.textContent = "자료를 연결해 꼼꼼히 읽는 중…";
  try {
    const attachments = volatileDayAttachments.length ? volatileDayAttachments : [];
    const pendingImages = attachments.filter(a => String(a.type || "").startsWith("image/") && a.content);
    if (pendingImages.length) {
      btn.textContent = `이미지 ${pendingImages.length}장을 판독하는 중…`;
      const extracted = await extractDailyImagesWithAI(attachments);
      getDay().extractedImageData = extracted;
      applyImageMetrics(extracted);
      saveDay();
      renderAttachmentStatus();
    }
    const payload = buildPayload();
    let analysis;
    if (aiConfigured()) {
      analysis = await callAI({
        task:"analyze_daily_health",
        systemPrompt:state.settings.customPrompt || defaultPrompt,
        data:{payload}
      });
      analysis = normalizeAnalysis(analysis);
    } else {
      if ((getDay().attachments || []).some(a => String(a.type || "").startsWith("image/")) && !getDay().extractedImageData) {
        const error = new Error("이미지 내용은 아직 판독되지 않았습니다. 설정에서 AI API를 연결한 뒤 다시 분석해 주세요.");
        error.code = "IMAGE_NOT_ANALYZED";
        throw error;
      }
      await new Promise(r => setTimeout(r, 900));
      analysis = demoAnalysis(payload);
    }
    getDay().analysis = analysis; persist(); renderReport(analysis);
    toast(aiConfigured() ? "AI 상세 분석을 완료했어요" : "데모 분석을 완료했어요");
  } catch (error) {
    const imageIssue = ["IMAGE_API_MISSING","IMAGE_NOT_ANALYZED"].includes(error.code);
    const serverOffline = error.code === "LOCAL_PROXY_OFFLINE";
    $("#reportStatus").innerHTML = `<strong>${serverOffline ? "로컬 프록시 서버가 꺼져 있어요." : imageIssue ? "첨부 이미지 판독이 필요해요." : "분석 API에 연결하지 못했어요."}</strong><small>${escapeHtml(error.message)}${imageIssue || serverOffline ? "" : " · API 설정을 확인해 주세요."}</small>`;
    toast(serverOffline ? "start-local.bat을 실행해 주세요" : imageIssue ? "이미지를 읽을 AI 연결이 필요해요" : "분석 연결을 확인해 주세요");
  } finally {
    btn.disabled = false; btn.textContent = "내 기록 다시 분석하기 ✦";
  }
}

$("#prevDay").onclick = () => shiftDay(-1);
$("#nextDay").onclick = () => shiftDay(1);
$("#prevPage").onclick = () => setPage(pageIndex - 1);
$("#nextPage").onclick = () => setPage(pageIndex + 1);
$$(".page-tab").forEach(x => x.onclick = () => setPage(Number(x.dataset.page)));
dayFields.forEach(id => $(`#${id}`).addEventListener("input", saveDay));
$("#moodBtn").onclick = () => $("#moodDialog").showModal();
$$(".mood-grid button").forEach(btn => btn.onclick = () => {
  $("#moodEmoji").textContent = btn.dataset.emoji; $("#moodText").textContent = btn.value; saveDay();
});
$("#profileBtn").onclick = () => setPage(0);
$("#coverProfileBtn").onclick = () => $("#profileDialog").showModal();
$("#openDiaryBtn").onclick = () => setPage(1);
$("#shareAppBtn").onclick = async () => {
  const shareData = {title:"온기록", text:"나를 돌보는 건강 일기, 온기록", url:window.location.origin};
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(shareData.url);
      toast("공유 주소를 복사했어요");
    }
  } catch (error) {
    if (error.name !== "AbortError") toast("공유 주소를 복사하지 못했어요");
  }
};
$("#settingsBtn").onclick = () => $("#settingsDialog").showModal();
$("#writeBtn").onclick = () => { setPage(1); $("#entryText").focus(); };
$("#analyzeBtn").onclick = analyze;
$("#missingDataList").addEventListener("click", event => {
  const button = event.target.closest("[data-missing-kind]");
  if (button) openMissingDataInput(button.dataset.missingKind);
});

async function importDailyFiles(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  toast(`${files.length}개 자료를 읽고 있어요`);
  const newAttachments = await Promise.all(files.map(readUploadAttachment));
  const existing = volatileDayAttachments.length ? volatileDayAttachments : (getDay().attachments || []);
  volatileDayAttachments = [
    ...existing.filter(old => !newAttachments.some(item => item.name === old.name && item.size === old.size)),
    ...newAttachments
  ];
  getDay().attachments = volatileDayAttachments;
  getDay().extractedImageData = null;
  renderAttachmentStatus();
  files.filter(f => f.type.startsWith("image/")).slice(0,4).forEach((file,i) => {
    $$(".default-card").forEach(x => x.remove());
    const reader = new FileReader();
    reader.onload = () => {
      const fig = document.createElement("figure"); fig.className = "photo-card";
      fig.style.cssText = `top:${8+(i%2)*24}px;left:${8+(i%2)*145}px;transform:rotate(${i%2?5:-6}deg);z-index:${i+1}`;
      fig.innerHTML = `<img src="${reader.result}" alt=""><figcaption>${file.name.replace(/\.[^.]+$/,"")}</figcaption>`;
      $("#collage").append(fig);
    }; reader.readAsDataURL(file);
  });
  if (!persist()) toast("브라우저 저장 공간이 부족해요. 불필요한 사이트 데이터를 정리해 주세요.");
  const imageCount = files.filter(file => file.type.startsWith("image/")).length;
  toast(imageCount ? `이미지 ${imageCount}장을 첨부했어요. 분석 버튼을 누르면 AI가 판독합니다.` : `${files.length}개 자료를 오늘 기록에 연결했어요`);
  e.target.value = "";
}
$("#dailyImages").onchange = importDailyFiles;
$("#dailyFiles").onchange = importDailyFiles;
async function importProfileFiles(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  state.profile.files = files.map(f => f.name);
  volatileProfileAttachments = await Promise.all(files.map(readUploadAttachment));
  state.profile.attachments = volatileProfileAttachments;
  const importedFields = [];
  const localExtraRecords = [];
  volatileProfileAttachments
    .filter(a => a.encoding === "utf-8" && /\.(md|markdown)$/i.test(a.name))
    .forEach(a => {
      const extracted = structuredHealthData(a.content);
      importedFields.push(...applyImportedProfile(extracted.fields, {replace:extracted.structured}));
      localExtraRecords.push(...extracted.additionalRecords);
    });
  const addedLocalRecords = mergeExtraRecords(localExtraRecords);
  const requiresAI = files.some(file =>
    !/\.(md|markdown|txt|csv|json)$/i.test(file.name) ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf"
  ) || importedFields.length < 3;
  state.profile.markdown = profileMarkdown();
  state.profile.updatedAt = new Date().toISOString();
  $("#profileFileList").innerHTML = state.profile.files.map(f => `• ${escapeHtml(f)}`).join("<br>");
  const result = $("#profileImportResult");
  if (importedFields.length) {
    const unique = [...new Set(importedFields)];
    result.hidden = false;
    result.innerHTML = `<strong>✓ Markdown을 읽기 쉬운 건강정보로 변환해 저장했어요.</strong><br>${[...unique,...addedLocalRecords].map(escapeHtml).join(" · ")}`;
    toast(`${unique.length}개 건강 정보 항목을 반영·저장했어요`);
  } else {
    result.hidden = false;
    result.textContent = files.some(f => /\.(md|markdown)$/i.test(f.name))
      ? "Markdown을 읽었지만 인식 가능한 항목이 없어요. ‘나이: 32’ 또는 ‘## 병력’ 형식으로 작성해 주세요."
      : "첨부 자료를 저장했어요. Markdown 파일은 입력 항목까지 자동으로 채워집니다.";
  }
  if (requiresAI) {
    if (aiConfigured()) {
      result.hidden = false;
      result.innerHTML += `${result.innerHTML ? "<br>" : ""}<strong>✦ AI가 비정형 자료를 추가로 읽고 있어요.</strong>`;
      try {
        const ai = await extractProfileWithAI(volatileProfileAttachments);
        const details = [...ai.changed, ...ai.added];
        state.profile.markdown = profileMarkdown();
        state.profile.updatedAt = new Date().toISOString();
        result.innerHTML = `<strong>✓ 규칙 분석과 AI 분석을 마치고 자동 저장했어요.</strong><br>${details.length ? details.map(escapeHtml).join(" · ") : escapeHtml(ai.summary || "새롭게 확정할 수 있는 항목은 없었습니다.")}${ai.warnings.length ? `<br><small>확인 필요: ${ai.warnings.map(escapeHtml).join(" · ")}</small>` : ""}`;
        toast(`AI가 ${details.length}개 항목을 찾아 반영했어요`);
      } catch (error) {
        result.innerHTML += `<br><strong>AI 추출 실패:</strong> ${escapeHtml(error.message)} · API 설정을 확인해 주세요.`;
      }
    } else {
      result.hidden = false;
      result.innerHTML += `${result.innerHTML ? "<br>" : ""}<strong>이미지·PDF·비정형 자료의 자동 입력에는 설정창의 OpenAI API 키가 필요해요.</strong>`;
    }
  }
  const saved = persist();
  if (!saved) {
    result.hidden = false;
    result.innerHTML += `${result.innerHTML ? "<br>" : ""}<strong>저장 실패:</strong> 브라우저 저장 공간을 확보한 뒤 다시 시도해 주세요.`;
  }
  e.target.value = "";
}
$("#profileImages").onchange = importProfileFiles;
$("#profileFiles").onchange = importProfileFiles;
$("#saveProfile").onclick = () => {
  saveExtraRecordsFromUI();
  profileIds.forEach(id => state.profile[id] = $(`#${id}`).value.trim());
  state.profile.markdown = profileMarkdown(); state.profile.updatedAt = new Date().toISOString();
  if (persist()) {
    renderCover(); $("#profileDialog").close(); toast("건강 기본 정보를 저장했어요");
  } else {
    toast("저장 공간이 부족해 기본정보를 저장하지 못했어요");
  }
};
$("#downloadProfile").onclick = () => {
  saveExtraRecordsFromUI();
  profileIds.forEach(id => state.profile[id] = $(`#${id}`).value.trim());
  const blob = new Blob([profileMarkdown()], {type:"text/markdown;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "건강-기본정보.md"; a.click(); URL.revokeObjectURL(a.href);
};
$("#saveSettings").onclick = () => {
  state.settings.aiConnectionMode = "proxy";
  state.settings.proxyAiApiKey = $("#proxyAiApiKey").value.trim();
  state.settings.apiEndpoint = localProxyUrl("/api/analyze");
  state.settings.appAccessCode = "";
  state.settings.weatherApiKey = $("#weatherApiKey").value.trim();
  state.settings.weatherEndpoint = localProxyUrl("/api/weather");
  state.settings.customPrompt = $("#customPrompt").value.trim() || defaultPrompt;
  state.settings.profileExtractionPrompt = $("#profileExtractionPrompt").value.trim() || defaultProfileExtractionPrompt;
  state.settings.dailyImagePrompt = $("#dailyImagePrompt").value.trim() || defaultDailyImagePrompt;
  persist(); $("#settingsDialog").close(); loadWeather(); toast("API 키와 분석 설정을 이 브라우저에 저장했어요");
};
$("#resetPrompt").onclick = () => {
  $("#customPrompt").value = defaultPrompt;
  $("#profileExtractionPrompt").value = defaultProfileExtractionPrompt;
  $("#dailyImagePrompt").value = defaultDailyImagePrompt;
  toast("분석·정보 추출 프롬프트를 기본값으로 복원했어요");
};
$("#addExtraRecord").onclick = () => {
  saveExtraRecordsFromUI();
  state.profile.additionalRecords.push(normalizeExtraRecord({label:"",value:""}));
  renderExtraRecords(); persist();
};
$("#extraRecords").addEventListener("input", () => { saveExtraRecordsFromUI(); persist(); });
$("#extraRecords").addEventListener("click", event => {
  const id = event.target.dataset.removeExtra;
  if (!id) return;
  saveExtraRecordsFromUI();
  state.profile.additionalRecords = state.profile.additionalRecords.filter(x => x.id !== id);
  renderExtraRecords(); persist();
});
$$(".bottom-nav button[data-view]").forEach(btn => btn.onclick = () => {
  $$(".bottom-nav button").forEach(x => x.classList.remove("active")); btn.classList.add("active");
  if (btn.dataset.view === "diary") setPage(0);
  else toast(`${btn.textContent.trim()} 화면은 다음 단계에서 연결됩니다`);
});

profileIds.forEach(id => $(`#${id}`).value = state.profile[id] || "");
$("#profileFileList").innerHTML = (state.profile.files || []).map(f => `• ${escapeHtml(f)}`).join("<br>");
state.settings.aiConnectionMode = "proxy";
state.settings.apiEndpoint = localProxyUrl("/api/analyze");
state.settings.weatherEndpoint = localProxyUrl("/api/weather");
state.settings.appAccessCode = "";
$("#proxyAiApiKey").value = state.settings.proxyAiApiKey || "";
$("#weatherApiKey").value = state.settings.weatherApiKey || "";
$("#customPrompt").value = state.settings.customPrompt || defaultPrompt;
$("#profileExtractionPrompt").value = state.settings.profileExtractionPrompt || defaultProfileExtractionPrompt;
$("#dailyImagePrompt").value = state.settings.dailyImagePrompt || defaultDailyImagePrompt;
state.profile.additionalRecords = (state.profile.additionalRecords || []).map(normalizeExtraRecord);
renderExtraRecords();
renderCover(); renderDate(); loadDay(); setPage(0); loadWeather();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("/service-worker.js").catch(error => console.warn("서비스 워커 등록 실패", error));
}
