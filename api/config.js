const {json} = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, {error:"GET 요청만 지원합니다."});
  return json(res, 200, {
    supabaseUrl:process.env.SUPABASE_URL || "",
    supabaseAnonKey:process.env.SUPABASE_ANON_KEY || "",
    authEnabled:Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    serverAiEnabled:Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
    serverWeatherEnabled:Boolean(process.env.WEATHER_API_KEY && process.env.WEATHER_API_URL),
    limits:{
      dailyAiLimit:Number(process.env.DAILY_AI_LIMIT || 2),
      profileMonthlyLimit:Number(process.env.PROFILE_MONTHLY_LIMIT || 1),
      maxImagesPerRequest:Number(process.env.MAX_IMAGES_PER_REQUEST || 5),
      maxFileMb:Number(process.env.MAX_UPLOAD_FILE_MB || 8),
      maxPdfMb:Number(process.env.MAX_UPLOAD_PDF_MB || 5)
    }
  });
};
