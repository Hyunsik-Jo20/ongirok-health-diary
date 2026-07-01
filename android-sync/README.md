# 온기록 Sync Android 앱

Health Connect에서 걸음·운동·심박·수면 데이터를 읽어 온기록 서버 `/api/device-data`로 업로드하는 보조 Android 앱입니다.

## 현재 상태

이 프로젝트는 Android Studio에서 열 수 있는 1차 MVP 뼈대입니다.

- 이메일/비밀번호로 Supabase 로그인
- Health Connect 읽기 권한 요청
- 오늘 데이터 동기화
- 최근 7일 데이터 동기화
- 온기록 PWA의 `/api/device-data`로 업로드

## 준비

1. Android Studio에서 `work/ongirok-sync-android` 폴더를 엽니다.
2. `local.properties.example`을 복사해서 `local.properties`를 만듭니다.
3. 아래 값을 입력합니다.

```properties
ONGIROK_API_BASE_URL=https://ongirok-health-diary.vercel.app
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`SUPABASE_ANON_KEY`는 공개 클라이언트 키라 앱에 들어가도 됩니다. `service_role` 키는 절대 넣으면 안 됩니다.

## 실행

1. Android 9 이상 기기에서 실행합니다.
2. 기기에 Health Connect가 설치되어 있어야 합니다.
3. 앱에서 온기록 계정 이메일/비밀번호로 로그인합니다.
4. `Health Connect 권한 허용`을 누르고 걸음·운동·심박·수면 권한을 허용합니다.
5. `오늘 동기화` 또는 `최근 7일 동기화`를 누릅니다.
6. 온기록 PWA를 열면 1쪽의 `스마트 기기 자동 수집` 패널에 표시됩니다.

## 제외한 항목

- 수분 섭취량: 온기록 1쪽에서 사용자가 직접 입력
- 체중: 온기록 표지/기본 건강정보에서 사용자가 직접 입력

