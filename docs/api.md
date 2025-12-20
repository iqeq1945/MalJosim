# API 문서

프론트엔드 개발을 위한 테스트용 API 문서입니다.

## 목차

- [기본 정보](#기본-정보)
- [필터링 API](#필터링-api)
- [금칙어 관리 API](#금칙어-관리-api)
- [헬스 체크 API](#헬스-체크-api)
- [데이터 타입](#데이터-타입)
- [에러 처리](#에러-처리)

---

## 기본 정보

### Base URL

```
http://localhost:3000
```

프로덕션 환경에서는 실제 서버 URL로 변경하세요.

### 인증

금칙어 관리 API의 등록(POST), 수정(PATCH), 삭제(DELETE) 엔드포인트는 API KEY 인증이 필요합니다.

**API KEY 인증이 필요한 엔드포인트:**

- `POST /bad-words` - 금칙어 등록
- `PATCH /bad-words/:id` - 금칙어 수정
- `DELETE /bad-words/:id` - 금칙어 삭제

**인증 방법:**
HTTP Header에 `X-API-Key`를 포함하여 요청하세요:

```
X-API-Key: your-admin-api-key
```

API KEY는 서버 환경 변수 `ADMIN_API_KEY`에 설정되어 있어야 합니다.

**인증이 필요하지 않은 엔드포인트:**

- `GET /bad-words` - 금칙어 목록 조회
- `GET /bad-words/:id` - 금칙어 상세 조회
- `POST /filter/check` - 필터링 API
- 모든 헬스 체크 API

### Content-Type

모든 요청은 `Content-Type: application/json` 헤더를 포함해야 합니다.

### 공통 응답 형식

성공 응답은 각 엔드포인트별로 정의된 형식을 따릅니다.

에러 응답은 [에러 처리](#에러-처리) 섹션을 참고하세요.

---

## 필터링 API

### POST `/filter/check`

텍스트를 필터링하여 부적절한 표현이 포함되어 있는지 확인합니다.

#### 요청

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "text": "string", // 필수, 최대 1000자
  "clientId": "string" // 선택, 최대 100자 (현재는 사용하지 않음)
}
```

**파라미터 설명:**

| 필드       | 타입   | 필수 | 설명                                             |
| ---------- | ------ | ---- | ------------------------------------------------ |
| `text`     | string | ✅   | 필터링할 텍스트 (최대 1000자)                    |
| `clientId` | string | ❌   | 클라이언트 ID (최대 100자, 현재는 사용하지 않음) |

#### 응답

**성공 (200 OK):**

```json
{
  "status": "allow" | "warning" | "block",
  "text": "string",
  "dictionaryScore": 0.0,
  "matchedWords": [
    {
      "word": "string",
      "normalizedWord": "string",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "category": "PROFANITY" | "HATE_SPEECH" | "SEXUAL" | "VIOLENCE" | "SPAM" | "OTHER",
      "isPartialMatch": false
    }
  ],
  "totalMatches": 0,
  "hasEvasionPattern": false,
  "suspiciousScore": 0.0,
  "evasionPatterns": {
    "hasLeetspeak": false,
    "hasRepetition": false,
    "hasJamoSeparation": false,
    "hasZeroWidth": false,
    "hasSpaceSeparation": false,
    "suspiciousScore": 0.0,
    "detectedPatterns": []
  }
}
```

**응답 필드 설명:**

| 필드                            | 타입    | 설명                                                   |
| ------------------------------- | ------- | ------------------------------------------------------ |
| `status`                        | string  | 필터링 결과 상태 (`allow`, `warning`, `block`)         |
| `text`                          | string  | 원본 텍스트                                            |
| `dictionaryScore`               | number  | 사전 기반 점수 (0-1)                                   |
| `matchedWords`                  | array   | 매칭된 금칙어 목록                                     |
| `matchedWords[].word`           | string  | 원본 단어                                              |
| `matchedWords[].normalizedWord` | string  | 정규화된 단어                                          |
| `matchedWords[].severity`       | string  | 심각도 (LOW, MEDIUM, HIGH, CRITICAL)                   |
| `matchedWords[].category`       | string  | 카테고리                                               |
| `matchedWords[].isPartialMatch` | boolean | 부분 매칭 여부 (토큰 기준이 아닌 슬라이딩 윈도우 매칭) |
| `totalMatches`                  | number  | 매칭된 단어 개수                                       |
| `hasEvasionPattern`             | boolean | 회피 패턴 감지 여부                                    |
| `suspiciousScore`               | number  | 의심도 점수 (0-1, 회피 패턴 기반)                      |
| `evasionPatterns`               | object  | 회피 패턴 상세 정보 (회피 패턴이 감지된 경우에만 포함) |

#### 예제

**요청:**

```bash
curl -X POST http://localhost:3000/filter/check \
  -H "Content-Type: application/json" \
  -d '{
    "text": "시발",
    "clientId": "test-client"
  }'
```

**응답 (차단):**

```json
{
  "status": "block",
  "text": "시발",
  "dictionaryScore": 0.9,
  "matchedWords": [
    {
      "word": "시발",
      "normalizedWord": "시발",
      "severity": "HIGH",
      "category": "PROFANITY",
      "isPartialMatch": false
    }
  ],
  "totalMatches": 1,
  "hasEvasionPattern": false,
  "suspiciousScore": 0
}
```

**응답 (경고):**

```json
{
  "status": "warning",
  "text": "바보",
  "dictionaryScore": 0.3,
  "matchedWords": [
    {
      "word": "바보",
      "normalizedWord": "바보",
      "severity": "LOW",
      "category": "PROFANITY",
      "isPartialMatch": false
    }
  ],
  "totalMatches": 1,
  "hasEvasionPattern": false,
  "suspiciousScore": 0
}
```

**응답 (허용):**

```json
{
  "status": "allow",
  "text": "안녕하세요",
  "dictionaryScore": 0,
  "matchedWords": [],
  "totalMatches": 0,
  "hasEvasionPattern": false,
  "suspiciousScore": 0
}
```

**응답 (회피 패턴 감지):**

```json
{
  "status": "block",
  "text": "시8발",
  "dictionaryScore": 0.8,
  "matchedWords": [
    {
      "word": "시발",
      "normalizedWord": "시발",
      "severity": "HIGH",
      "category": "PROFANITY",
      "isPartialMatch": false
    }
  ],
  "totalMatches": 1,
  "hasEvasionPattern": true,
  "suspiciousScore": 0.3,
  "evasionPatterns": {
    "hasLeetspeak": true,
    "hasRepetition": false,
    "hasJamoSeparation": false,
    "hasZeroWidth": false,
    "hasSpaceSeparation": false,
    "suspiciousScore": 0.3,
    "detectedPatterns": ["leetspeak"]
  }
}
```

#### 에러

- **400 Bad Request**: 요청 바디가 유효하지 않거나 필수 필드가 누락된 경우
- **500 Internal Server Error**: 서버 내부 오류

---

## 금칙어 관리 API

### GET `/bad-words`

금칙어 목록을 조회합니다. 페이지네이션 및 필터링을 지원합니다.

#### 요청

**Query Parameters:**

| 파라미터   | 타입    | 필수 | 기본값 | 설명                                                                  |
| ---------- | ------- | ---- | ------ | --------------------------------------------------------------------- |
| `page`     | number  | ❌   | 1      | 페이지 번호 (최소 1)                                                  |
| `limit`    | number  | ❌   | 10     | 페이지당 항목 수 (1-100)                                              |
| `category` | string  | ❌   | -      | 카테고리 필터 (PROFANITY, HATE_SPEECH, SEXUAL, VIOLENCE, SPAM, OTHER) |
| `severity` | string  | ❌   | -      | 심각도 필터 (LOW, MEDIUM, HIGH, CRITICAL)                             |
| `isActive` | boolean | ❌   | -      | 활성화 여부 필터                                                      |
| `search`   | string  | ❌   | -      | 검색어 (단어 또는 정규화된 단어에서 검색)                             |

#### 응답

**성공 (200 OK):**

```json
{
  "data": [
    {
      "id": "string",
      "word": "string",
      "normalizedWord": "string",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "category": "PROFANITY" | "HATE_SPEECH" | "SEXUAL" | "VIOLENCE" | "SPAM" | "OTHER",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 0
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/bad-words?page=1&limit=10&category=PROFANITY&severity=HIGH"
```

**응답:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "word": "시발",
      "normalizedWord": "시발",
      "severity": "HIGH",
      "category": "PROFANITY",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

### POST `/bad-words`

새로운 금칙어를 생성합니다.

#### 요청

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "word": "string", // 필수, 최대 100자
  "normalizedWord": "string", // 필수, 최대 100자
  "severity": "MEDIUM", // 선택, 기본값: MEDIUM
  "category": "OTHER", // 선택, 기본값: OTHER
  "isActive": true // 선택, 기본값: true
}
```

**파라미터 설명:**

| 필드             | 타입    | 필수 | 기본값 | 설명                                                             |
| ---------------- | ------- | ---- | ------ | ---------------------------------------------------------------- |
| `word`           | string  | ✅   | -      | 원본 금칙어 (최대 100자)                                         |
| `normalizedWord` | string  | ✅   | -      | 정규화된 형태 (최대 100자)                                       |
| `severity`       | string  | ❌   | MEDIUM | 심각도 (LOW, MEDIUM, HIGH, CRITICAL)                             |
| `category`       | string  | ❌   | OTHER  | 카테고리 (PROFANITY, HATE_SPEECH, SEXUAL, VIOLENCE, SPAM, OTHER) |
| `isActive`       | boolean | ❌   | true   | 활성화 여부                                                      |

#### 응답

**성공 (201 Created):**

```json
{
  "id": "string",
  "word": "string",
  "normalizedWord": "string",
  "severity": "MEDIUM",
  "category": "OTHER",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 예제

**요청:**

```bash
curl -X POST http://localhost:3000/bad-words \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-api-key" \
  -d '{
    "word": "시발",
    "normalizedWord": "시발",
    "severity": "HIGH",
    "category": "PROFANITY"
  }'
```

**응답:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "word": "시발",
  "normalizedWord": "시발",
  "severity": "HIGH",
  "category": "PROFANITY",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 에러

- **400 Bad Request**: 요청 바디가 유효하지 않거나 필수 필드가 누락된 경우
- **401 Unauthorized**: API KEY가 누락되었거나 유효하지 않은 경우
- **409 Conflict**: 동일한 단어가 이미 존재하는 경우
- **500 Internal Server Error**: 서버 내부 오류

---

### GET `/bad-words/word/:word`

단어로 금칙어를 조회합니다.

#### 요청

**Path Parameters:**

| 파라미터 | 타입   | 필수 | 설명          |
| -------- | ------ | ---- | ------------- |
| `word`   | string | ✅   | 금칙어 (단어) |

#### 응답

**성공 (200 OK):**

```json
{
  "id": "string",
  "word": "string",
  "normalizedWord": "string",
  "severity": "MEDIUM",
  "category": "OTHER",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/bad-words/word/시발"
```

**응답:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "word": "시발",
  "normalizedWord": "시발",
  "severity": "HIGH",
  "category": "PROFANITY",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 에러

- **404 Not Found**: 해당 단어의 금칙어가 존재하지 않는 경우
- **500 Internal Server Error**: 서버 내부 오류

---

### GET `/bad-words/:id`

특정 금칙어의 상세 정보를 조회합니다.

#### 요청

**Path Parameters:**

| 파라미터 | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| `id`     | string | ✅   | 금칙어 ID (UUID) |

#### 응답

**성공 (200 OK):**

```json
{
  "id": "string",
  "word": "string",
  "normalizedWord": "string",
  "severity": "MEDIUM",
  "category": "OTHER",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/bad-words/550e8400-e29b-41d4-a716-446655440000"
```

**응답:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "word": "시발",
  "normalizedWord": "시발",
  "severity": "HIGH",
  "category": "PROFANITY",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 에러

- **404 Not Found**: 해당 ID의 금칙어가 존재하지 않는 경우
- **500 Internal Server Error**: 서버 내부 오류

---

### PATCH `/bad-words/:id`

금칙어 정보를 수정합니다.

#### 요청

**Path Parameters:**

| 파라미터 | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| `id`     | string | ✅   | 금칙어 ID (UUID) |

**Headers:**

```
Content-Type: application/json
X-API-Key: your-admin-api-key
```

> **⚠️ 인증 필요**: 이 엔드포인트는 유효한 API KEY가 필요합니다.

**Body:**

```json
{
  "word": "string", // 선택, 최대 100자
  "normalizedWord": "string", // 선택, 최대 100자
  "severity": "MEDIUM", // 선택
  "category": "OTHER", // 선택
  "isActive": true // 선택
}
```

모든 필드는 선택 사항이며, 제공된 필드만 업데이트됩니다.

#### 응답

**성공 (200 OK):**

```json
{
  "id": "string",
  "word": "string",
  "normalizedWord": "string",
  "severity": "MEDIUM",
  "category": "OTHER",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 예제

**요청:**

```bash
curl -X PATCH http://localhost:3000/bad-words/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-api-key" \
  -d '{
    "severity": "CRITICAL",
    "isActive": false
  }'
```

**응답:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "word": "시발",
  "normalizedWord": "시발",
  "severity": "CRITICAL",
  "category": "PROFANITY",
  "isActive": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

#### 에러

- **400 Bad Request**: 요청 바디가 유효하지 않은 경우
- **401 Unauthorized**: API KEY가 누락되었거나 유효하지 않은 경우
- **404 Not Found**: 해당 ID의 금칙어가 존재하지 않는 경우
- **500 Internal Server Error**: 서버 내부 오류

---

### DELETE `/bad-words/:id`

금칙어를 삭제합니다.

#### 요청

**Path Parameters:**

| 파라미터 | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| `id`     | string | ✅   | 금칙어 ID (UUID) |

**Headers:**

```
X-API-Key: your-admin-api-key
```

> **⚠️ 인증 필요**: 이 엔드포인트는 유효한 API KEY가 필요합니다.

#### 응답

**성공 (204 No Content):**

응답 본문이 없습니다.

#### 예제

**요청:**

```bash
curl -X DELETE http://localhost:3000/bad-words/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: your-admin-api-key"
```

**응답:**

```
(응답 본문 없음, 상태 코드: 204)
```

#### 에러

- **404 Not Found**: 해당 ID의 금칙어가 존재하지 않는 경우
- **500 Internal Server Error**: 서버 내부 오류

---

## 헬스 체크 API

### GET `/health`

서비스 상태를 확인합니다.

#### 요청

파라미터 없음

#### 응답

**성공 (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "service": "up"
  }
}
```

**실패 (503 Service Unavailable):**

```json
{
  "status": "error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "service": "down"
  },
  "message": "Service health check failed"
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/health"
```

**응답 (성공):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "service": "up"
  }
}
```

---

### GET `/health/all`

서비스, 데이터베이스, Redis의 전체 상태를 확인합니다.

#### 요청

파라미터 없음

#### 응답

**성공 (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "service": "up",
    "db": "up",
    "redis": "up"
  }
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/health/all"
```

**응답:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "service": "up",
    "db": "up",
    "redis": "up"
  }
}
```

---

### GET `/health/db`

데이터베이스 연결 상태를 확인합니다.

#### 요청

파라미터 없음

#### 응답

**성공 (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "db": "up"
  }
}
```

**실패 (503 Service Unavailable):**

```json
{
  "status": "error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "db": "down"
  },
  "message": "Database health check failed"
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/health/db"
```

**응답 (성공):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "db": "up"
  }
}
```

---

### GET `/health/redis`

Redis 연결 상태를 확인합니다.

#### 요청

파라미터 없음

#### 응답

**성공 (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "redis": "up"
  }
}
```

**실패 (503 Service Unavailable):**

```json
{
  "status": "error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "redis": "down"
  },
  "message": "Redis health check failed"
}
```

#### 예제

**요청:**

```bash
curl "http://localhost:3000/health/redis"
```

**응답 (성공):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "redis": "up"
  }
}
```

---

## 데이터 타입

### FilterStatus

필터링 결과 상태입니다.

| 값        | 설명                                        |
| --------- | ------------------------------------------- |
| `allow`   | 허용 - 부적절한 표현이 감지되지 않음        |
| `warning` | 경고 - 낮은 심각도의 부적절한 표현이 감지됨 |
| `block`   | 차단 - 높은 심각도의 부적절한 표현이 감지됨 |

### Severity

금칙어의 심각도입니다.

| 값         | 설명                  |
| ---------- | --------------------- |
| `LOW`      | 낮음 - 경고 수준      |
| `MEDIUM`   | 보통 - 기본값         |
| `HIGH`     | 높음 - 차단 수준      |
| `CRITICAL` | 매우 높음 - 즉시 차단 |

### Category

금칙어의 카테고리입니다.

| 값            | 설명          |
| ------------- | ------------- |
| `PROFANITY`   | 욕설          |
| `HATE_SPEECH` | 혐오 발언     |
| `SEXUAL`      | 성적 표현     |
| `VIOLENCE`    | 폭력적 표현   |
| `SPAM`        | 스팸          |
| `OTHER`       | 기타 - 기본값 |

### EvasionPattern

회피 패턴 분석 결과입니다.

| 필드                 | 타입     | 설명                                     |
| -------------------- | -------- | ---------------------------------------- |
| `hasLeetspeak`       | boolean  | 숫자/영문/특수문자 혼용 (예: 시8, cibal) |
| `hasRepetition`      | boolean  | 반복 문자 (예: 시발발발)                 |
| `hasJamoSeparation`  | boolean  | 자모 분리 (예: ㅅㅣ발)                   |
| `hasZeroWidth`       | boolean  | Zero-width 문자 사용 (예: 시\u200b발)    |
| `hasSpaceSeparation` | boolean  | 공백 분리 (예: 시 발 개 새 끼)           |
| `suspiciousScore`    | number   | 의심도 점수 (0-1)                        |
| `detectedPatterns`   | string[] | 감지된 패턴 목록                         |

---

## 에러 처리

### 에러 응답 형식

에러가 발생하면 다음과 같은 형식으로 응답됩니다:

```json
{
  "statusCode": 400,
  "message": ["error message 1", "error message 2"],
  "error": "Bad Request"
}
```

### HTTP 상태 코드

| 코드  | 설명                                                         |
| ----- | ------------------------------------------------------------ |
| `200` | 성공                                                         |
| `201` | 생성 성공                                                    |
| `204` | 성공 (응답 본문 없음)                                        |
| `400` | 잘못된 요청 - 요청 바디가 유효하지 않거나 필수 필드가 누락됨 |
| `401` | 인증 실패 - API KEY가 누락되었거나 유효하지 않음             |
| `404` | 리소스를 찾을 수 없음                                        |
| `409` | 충돌 - 리소스가 이미 존재함                                  |
| `500` | 서버 내부 오류                                               |
| `503` | 서비스 사용 불가 - 헬스 체크 실패 시                         |

### 일반적인 에러 케이스

#### 400 Bad Request

**요청 바디 유효성 검증 실패:**

```json
{
  "statusCode": 400,
  "message": [
    "text must be a string",
    "text should not be empty",
    "text must be shorter than or equal to 1000 characters"
  ],
  "error": "Bad Request"
}
```

**필수 필드 누락:**

```json
{
  "statusCode": 400,
  "message": ["word should not be empty", "normalizedWord should not be empty"],
  "error": "Bad Request"
}
```

#### 404 Not Found

**존재하지 않는 리소스:**

```json
{
  "statusCode": 404,
  "message": "BadWord with id 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

#### 401 Unauthorized

**API KEY 누락:**

```json
{
  "statusCode": 401,
  "message": "API Key is required",
  "error": "Unauthorized"
}
```

**유효하지 않은 API KEY:**

```json
{
  "statusCode": 401,
  "message": "Invalid API Key",
  "error": "Unauthorized"
}
```

#### 409 Conflict

**중복된 리소스:**

```json
{
  "statusCode": 409,
  "message": "BadWord with word '시발' already exists",
  "error": "Conflict"
}
```

#### 500 Internal Server Error

**서버 내부 오류:**

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## 테스트 예제

### JavaScript (Fetch API)

```javascript
// 필터링 API 호출
async function checkText(text) {
  const response = await fetch("http://localhost:3000/filter/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text,
      clientId: "test-client",
    }),
  });

  const data = await response.json();
  return data;
}

// 사용 예제
checkText("시발").then((result) => {
  console.log("Status:", result.status);
  console.log("Matched words:", result.matchedWords);
});
```

### Python (requests)

```python
import requests

# 필터링 API 호출
def check_text(text):
    url = 'http://localhost:3000/filter/check'
    payload = {
        'text': text,
        'clientId': 'test-client'
    }
    response = requests.post(url, json=payload)
    return response.json()

# 사용 예제
result = check_text('시발')
print('Status:', result['status'])
print('Matched words:', result['matchedWords'])
```

### TypeScript (axios)

```typescript
import axios from "axios";

// 필터링 API 호출
async function checkText(text: string) {
  const response = await axios.post("http://localhost:3000/filter/check", {
    text: text,
    clientId: "test-client",
  });
  return response.data;
}

// 사용 예제
checkText("시발").then((result) => {
  console.log("Status:", result.status);
  console.log("Matched words:", result.matchedWords);
});
```

---

## 주의사항

1. **한글 인코딩**: curl에서 JSON을 직접 전달할 때 한글이 깨질 수 있습니다. 파일을 통해 요청하거나 Postman/Insomnia 같은 도구를 사용하는 것을 권장합니다.

2. **요청 크기 제한**:
   - `text` 필드는 최대 1000자까지 허용됩니다.
   - `word` 및 `normalizedWord` 필드는 최대 100자까지 허용됩니다.

3. **페이지네이션**:
   - `limit` 파라미터는 최대 100까지 허용됩니다.
   - `page` 파라미터는 최소 1입니다.

4. **날짜 형식**: 모든 날짜는 ISO 8601 형식 (UTC)으로 반환됩니다.

5. **UUID 형식**: ID는 UUID v4 형식을 따릅니다.

---

## 추가 리소스

- [프로젝트 README](../README.md)
- [데이터베이스 스키마 문서](./rdb-schema.md)
- [프로젝트 상세 문서](../PROJECT.md)
