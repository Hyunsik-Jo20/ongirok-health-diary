const {json} = require("./_shared");

module.exports = function handler(req, res) {
  return json(res, 200, {
    ok:true,
    aiConfigured:Boolean(process.env.OPENAI_API_KEY),
    weatherConfigured:Boolean(process.env.WEATHER_API_KEY && process.env.WEATHER_API_URL),
    accessCodeRequired:Boolean(process.env.APP_ACCESS_CODE)
  });
};
