# 온기록 Health Connect 1차 연동 규격

온기록 PWA는 웹 브라우저만으로 Health Connect 데이터를 직접 읽을 수 없으므로, 별도의 Android 동기화 앱이 Health Connect 권한을 받아 하루 요약 데이터를 온기록 서버로 업로드합니다.

## 흐름

```text
스마트워치/헬스앱
→ Health Connect
→ 온기록 Android 동기화 앱
→ /api/device-data
→ Supabase device_daily_metrics
→ 온기록 PWA 1쪽 자동 수집 패널
```

## 업로드 API

`POST /api/device-data`

요청에는 온기록 로그인 사용자의 Supabase access token을 `Authorization: Bearer ...`로 포함해야 합니다.

```json
{
  "date": "2026-07-01",
  "source": "Health Connect",
  "provider": "Samsung Health",
  "collectedAt": "2026-07-01T10:30:00+09:00",
  "metrics": {
    "steps": 8420,
    "distanceKm": 6.1,
    "activeCaloriesKcal": 430,
    "totalCaloriesKcal": 2310,
    "activeMinutes": 78,
    "heartRateAvgBpm": 92,
    "heartRateMaxBpm": 164,
    "restingHeartRateBpm": 58,
    "sleepHours": 7.2,
    "sleepScore": 81,
    "bloodOxygenAvgPercent": 96,
    "weightKg": 72.4,
    "waterLiters": 1.8
  },
  "workouts": [
    {
      "type": "running",
      "durationMinutes": 42,
      "distanceKm": 6.3,
      "caloriesKcal": 410,
      "averageHeartRateBpm": 142,
      "maxHeartRateBpm": 176,
      "averagePace": "6'40\"/km"
    }
  ],
  "sleep": {
    "bedTime": "2026-06-30T23:40:00+09:00",
    "wakeTime": "2026-07-01T06:55:00+09:00",
    "deepSleepMinutes": 62,
    "remSleepMinutes": 94,
    "awakeMinutes": 28
  }
}
```

## 조회 API

`GET /api/device-data?date=YYYY-MM-DD`

PWA는 로그인 후, 날짜 변경 후, 분석 직전에 이 API를 호출하여 1쪽 패널과 AI 분석 입력에 반영합니다.

## 1차 수집 권장 항목

- 걸음 수
- 이동 거리
- 활동 시간
- 활동 칼로리 / 총 칼로리
- 운동 세션: 종류, 시간, 거리, 칼로리, 평균/최대 심박, 페이스
- 평균/최대/안정시 심박
- 수면 시간, 수면 점수, 수면 단계
- 혈중산소
- 체중
- 수분 섭취량

