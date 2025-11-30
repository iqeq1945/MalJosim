# MalJosim - AI 기반 욕설 필터링 API

> Fast Path First 전략으로 비용을 최적화한 고정확도 욕설 필터링 서비스

[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)

## 🚀 빠른 시작

### 1. 저장소 클론 및 의존성 설치

```bash
git clone <repository-url>
cd filtering
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 서버
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/filtering

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# ChromaDB
CHROMA_URL=http://localhost:8000
```

### 3. 인프라 시작

```bash
docker-compose up -d
```

이 명령으로 다음 서비스가 시작됩니다:

- PostgreSQL (포트 5433)
- Redis (포트 6380)
- ChromaDB (포트 8000)

### 4. 데이터베이스 마이그레이션

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. 애플리케이션 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

서버가 `http://localhost:3000`에서 실행됩니다.

---

## 📖 프로젝트 소개

**MalJosim**은 AI 기반 욕설 필터링 서비스입니다. Fast Path First 전략을 통해 **95-98%의 AI 호출을 감소**시키면서도 높은 정확도로 욕설 및 부적절한 표현을 감지합니다.

### 주요 특징

- ⚡ **Fast Path First**: Redis 사전 매칭으로 대부분의 케이스를 빠르게 처리
- 🎯 **높은 정확도**: 부분 매칭 구분 및 회피 패턴 감지로 False Positive/False Negative 최소화
- 🔄 **실시간 필터링**: Redis 캐싱으로 빠른 응답 속도
- 🤖 **AI/RAG 통합**: OpenAI GPT-4o-mini + ChromaDB를 활용한 고급 분석
- 🏢 **멀티 테넌트 지원**: 클라이언트별 금칙어 정책 오버라이드

---

## 🏗 아키텍처

### 필터링 파이프라인

```
입력 텍스트
    ↓
[1] 텍스트 분석 (회피 패턴 감지)
    ↓
[2] 텍스트 정규화
    ↓
[3] 토큰화 및 후보 추출 (Sliding Window)
    ↓
[4] Fast Path: Redis 사전 매칭
    ├─ 전체 단어 매칭 발견 → 심각도 높으면 즉시 차단 ✅
    └─ 부분 매칭만 발견 → AI 호출
    ↓
[5] Slow Path: AI/RAG 호출 (조건부)
    ├─ 회피 패턴 감지 (suspiciousScore > 0.3)
    ├─ 매칭 없음 + 짧은 텍스트 (≤ 20자)
    └─ 부분 매칭만 있음
    ↓
[6] 최종 필터링 결과 반환
```

### Fast Path First 전략

**목표**: AI 호출 비용 최소화 (95-98% 감소)

**조건**:

- ✅ **즉시 차단**: 전체 단어 매칭 + dictionaryScore ≥ 0.7
- ⚠️ **경고만**: 전체 단어 매칭 + dictionaryScore < 0.7 (AI 호출 생략)
- 🤖 **AI 호출**: 회피 패턴 감지, 매칭 없음, 부분 매칭만 있는 경우

---

## 🔍 주요 기능

### 1. 회피 패턴 감지

다음 6가지 회피 패턴을 자동으로 감지합니다:

- **Leetspeak**: `시8`, `cibal` (한글 + 숫자/영문 혼용)
- **Repetition**: `시발발` (문자 반복)
- **Jamo Separation**: `ㅅㅣ발` (자모 분리)
- **Zero Width**: `시\u200b발` (보이지 않는 문자 삽입)
- **Mixed Script**: `시b발` (한글/영문 혼용)
- **Space Separation**: `시 발` (공백으로 단어 분리)

### 2. 부분 매칭 구분

"시발점" 같은 False Positive를 방지하기 위해 전체 매칭과 부분 매칭을 구분합니다.

- **전체 매칭**: 토큰에 정확히 일치 (예: "시발")
- **부분 매칭**: Sliding Window에서 추출된 부분 문자열 (예: "시발점" → "시발")
- 부분 매칭은 가중치 50% 감소

### 3. 멀티 테넌트 지원

클라이언트별로 금칙어 정책을 오버라이드할 수 있습니다.

```typescript
// 클라이언트별 심각도 재정의
ClientBadWord {
  clientId: "client-123",
  wordId: "word-uuid",
  overrideSeverity: "LOW"  // 글로벌은 HIGH지만 이 클라이언트는 LOW
}
```

---

## 📡 API 사용 예시

### 필터링 API

```bash
curl -X POST http://localhost:3000/filter/check \
  -H "Content-Type: application/json" \
  -d '{
    "text": "시발 개새끼",
    "clientId": "optional-client-id"
  }'
```

**응답**:

```json
{
  "status": "BLOCK",
  "text": "시발 개새끼",
  "dictionaryScore": 0.85,
  "suspiciousScore": 0.0,
  "matchedWords": [
    {
      "word": "시발",
      "normalizedWord": "시발",
      "severity": "HIGH",
      "category": "PROFANITY",
      "isPartialMatch": false
    },
    {
      "word": "개새끼",
      "normalizedWord": "개새끼",
      "severity": "CRITICAL",
      "category": "PROFANITY",
      "isPartialMatch": false
    }
  ]
}
```

**Status 값**:

- `ALLOW`: 허용
- `WARN`: 경고 (낮은 심각도)
- `BLOCK`: 차단

### 금칙어 관리 API

```bash
# 금칙어 생성
curl -X POST http://localhost:3000/bad-words \
  -H "Content-Type: application/json" \
  -d '{
    "word": "시발",
    "normalizedWord": "시발",
    "severity": "HIGH",
    "category": "PROFANITY"
  }'

# 금칙어 목록 조회
curl http://localhost:3000/bad-words?page=1&limit=10

# 금칙어 수정
curl -X PATCH http://localhost:3000/bad-words/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "CRITICAL"
  }'

# 금칙어 삭제
curl -X DELETE http://localhost:3000/bad-words/{id}
```

---

## 🛠 기술 스택

### Backend

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache**: Redis 7

### AI/ML

- **LLM**: OpenAI GPT-4o-mini
- **Embedding**: OpenAI text-embedding-3-small
- **Vector Store**: ChromaDB
- **RAG**: LangChain

### Infrastructure

- **Container**: Docker & Docker Compose

---

## 📁 프로젝트 구조

```
filtering/
├── src/
│   ├── ai/                    # AI/RAG 서비스
│   ├── bad-word/              # 금칙어 관리 API
│   ├── cache/                 # Redis 캐시 레이어
│   ├── database/              # Prisma 데이터베이스
│   ├── filter/                # 필터링 핵심 로직
│   │   ├── normalization/     # 텍스트 정규화
│   │   └── tokenization/      # 토큰화 및 후보 추출
│   └── health/                # Health Check API
├── prisma/                    # 데이터베이스 스키마
├── docs/                      # 문서
└── docker-compose.yml         # 인프라 설정
```

자세한 구조는 [PROJECT.md](./PROJECT.md) 참고

---

## 📊 데이터베이스 스키마

### BadWord 테이블

금칙어 원본 및 정규화된 형태를 저장합니다.

| 컬럼             | 타입     | 설명                              |
| ---------------- | -------- | --------------------------------- |
| `id`             | UUID     | 고유 ID                           |
| `word`           | String   | 원본 금칙어                       |
| `normalizedWord` | String   | 정규화된 형태                     |
| `severity`       | Severity | 심각도 (LOW/MEDIUM/HIGH/CRITICAL) |
| `category`       | Category | 카테고리                          |
| `isActive`       | Boolean  | 활성화 여부                       |
| `aliases`        | String[] | 별칭/변형 리스트                  |

### ClientBadWord 테이블

클라이언트별 금칙어 정책 오버라이드를 저장합니다.

자세한 스키마는 [docs/rdb-schema.md](./docs/rdb-schema.md) 참고

---

## 🧪 개발 스크립트

```bash
# 개발 모드 실행
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod

# Prisma
npm run prisma:generate    # Prisma Client 생성
npm run prisma:migrate     # 마이그레이션 실행
npm run prisma:studio      # Prisma Studio 실행

# 코드 포맷팅
npm run format

# 린팅
npm run lint

# 테스트
npm run test
npm run test:watch
npm run test:cov
```

---

## 📈 성능 최적화

### Fast Path First 전략

- **95-98% AI 호출 감소**: 대부분의 케이스를 Redis 사전 매칭으로 처리
- **평균 응답 시간**: Fast Path < 10ms, Slow Path < 500ms

### 캐싱 전략

- **Write-through 캐싱**: PostgreSQL 변경 시 Redis 자동 동기화
- **Redis 키 구조**:
  - `bad_words:global`: 글로벌 금칙어 Set
  - `bad_words:normalized`: 정규화된 단어 → 상세 정보 Hash
  - `bad_words:client:{clientId}`: 클라이언트별 금칙어 Set

---

## 🐛 알려진 이슈

1. **공백 분리 패턴**: "시 발" 같은 경우 현재 AI로 전달됨. Fast Path에서 처리하도록 개선 예정
2. **테스트 코드 부재**: 단위/통합 테스트 추가 예정
3. **에러 핸들링**: 전역 예외 필터 추가 예정

---

## 🗺 로드맵

### 단기 (1-2주)

- [ ] 테스트 코드 작성
- [ ] 에러 핸들링 강화
- [ ] 로깅 시스템 구축
- [ ] API 문서화 (Swagger)

### 중기 (1-2개월)

- [ ] 성능 최적화 (Redis 파이프라인, 배치 처리)
- [ ] 모니터링 (Prometheus, Grafana)
- [ ] 수평 확장 지원

### 장기 (3-6개월)

- [ ] 유사 단어 검색 (Vector Store 활용)
- [ ] 맥락 기반 필터링 강화
- [ ] 다국어 지원
- [ ] 관리 UI 대시보드

---

## 📚 문서

- [프로젝트 상세 문서](./PROJECT.md) - 전체 아키텍처 및 설계 결정
- [데이터베이스 스키마 문서](./docs/rdb-schema.md) - 상세 스키마 설명

---

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 등록해주세요.

---
