# 온기록 로컬 실행

## 1. API 키 입력

`outputs/.env` 파일을 메모장으로 열어 키를 입력합니다.

```env
OPENAI_API_KEY=sk-실제키
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_URL=https://api.openai.com/v1/responses

WEATHER_API_KEY=날씨_API_키
WEATHER_API_URL=https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst
WEATHER_API_KEY_PARAM=serviceKey
WEATHER_DEFAULT_PARAMS=dataType=JSON&numOfRows=1000
```

`.env` 파일은 공유하거나 Git에 올리지 마세요.

## 2. 실행

`start-local.bat`을 더블클릭하거나 PowerShell에서 실행합니다.

```powershell
cd C:\Users\user\Documents\Codex\2026-06-22\sk\outputs
node server.js
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:4173
```

`index.html`을 직접 여는 것보다 로컬 서버 주소를 사용하는 것을 권장합니다.

## 3. 앱 설정

- AI 연결 방식: `내 서버 프록시로 연결`
- 프록시 주소: `http://127.0.0.1:4173/api/analyze`
- 날씨 API 주소: `http://127.0.0.1:4173/api/weather`

앱 설정에서는 주요 도시를 선택하거나 `현재 위치 사용`을 누릅니다. 위도·경도와 기상청 격자 변환은 앱 내부에서 처리하므로 사용자가 `nx`, `ny`를 입력할 필요가 없습니다. 서버가 한국 시각 기준 `base_date`, `base_time`도 자동 계산합니다. 공공데이터포털에서 받은 키는 일반 인증키(Decoding)를 권장하며, Encoding 키도 한 번 디코딩해 처리합니다.

키는 앱 설정창에 입력하지 않아도 됩니다. 로컬 서버가 `.env`에서 읽습니다.

## 제공되는 로컬 API

- `GET /api/health`: AI·날씨 키 설정 상태 확인
- `POST /api/analyze`: 텍스트·이미지를 OpenAI Responses API로 중계
- `GET /api/weather`: 날씨 공공데이터 API로 쿼리와 키를 중계

이미지는 Data URL 형태로 로컬 프록시에 전달되고, 프록시는 이를 멀티모달 입력으로 OpenAI API에 전달합니다.

## Vercel 무료 배포

GitHub 저장소를 Vercel Hobby 프로젝트로 가져온 뒤 다음 환경변수를 등록합니다.

```env
OPENAI_API_KEY=실제키
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_URL=https://api.openai.com/v1/responses
WEATHER_API_KEY=공공데이터포털_키
WEATHER_API_URL=https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst
WEATHER_API_KEY_PARAM=serviceKey
WEATHER_DEFAULT_PARAMS=dataType=JSON&numOfRows=1000&pageNo=1
APP_ACCESS_CODE=공유할_앱_접근코드
```

빌드 명령과 출력 폴더는 비워 둡니다. 배포 후 앱의 AI·날씨 프록시 주소는 현재 배포 주소의 `/api/analyze`, `/api/weather`로 자동 설정됩니다.

공공데이터 키도 호출량 제한과 무단 사용 방지를 위해 GitHub나 브라우저 코드에는 넣지 않고 Vercel 환경변수로 관리합니다.

## 모바일 사용자 개인 키 사용

배포된 앱의 설정창에서 사용자가 자신의 OpenAI 키와 공공데이터포털 키를 입력할 수 있습니다. 키는 해당 스마트폰의 브라우저 저장소에만 보관되며, Vercel 함수는 요청을 중계할 때만 키를 사용하고 서버나 데이터베이스에 저장하지 않습니다.

브라우저 데이터 삭제·시크릿 모드·기기 변경 시 키를 다시 입력해야 하며, 공용 기기에서는 개인 키를 저장하지 않는 것을 권장합니다.
