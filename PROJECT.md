# MalJosim - 욕설 필터링 API 프로젝트

## 📋 프로젝트 개요

**MalJosim**은 AI 기반 욕설 필터링 서비스입니다. Fast Path First 전략을 통해 비용을 최적화하면서도 높은 정확도로 욕설 및 부적절한 표현을 감지합니다.

### 주요 특징

- 🚀 **Fast Path First 전략**: 95-98% AI 호출 감소로 비용 최적화
- 🎯 **높은 정확도**: 부분 매칭, 회피 패턴 감지로 False Positive/False Negative 최소화
- 🔄 **실시간 필터링**: Redis 캐싱으로 빠른 응답 속도
- 🤖 **AI/RAG 통합**: OpenAI GPT-4o-mini + ChromaDB를 활용한 고급 분석
- 🏢 **멀티 테넌트 지원**: 클라이언트별 금칙어 정책 오버라이드

---

## 🛠 기술 스택

### Backend

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache**: Redis 7
- **Vector Store**: ChromaDB

### AI/ML

- **LLM**: OpenAI GPT-4o-mini
- **Embedding**: OpenAI text-embedding-3-small
- **RAG**: LangChain + ChromaDB

### Infrastructure

- **Container**: Docker & Docker Compose
- **Package Manager**: npm

---

## 📁 프로젝트 구조

```
filtering/
├── src/
│   ├── ai/                    # AI/RAG 서비스
│   │   ├── ai.module.ts
│   │   ├── llm.service.ts      # OpenAI LLM 통합
│   │   ├── embedding.service.ts # Embedding 생성
│   │   ├── rag.service.ts      # RAG 파이프라인
│   │   ├── vector-store.service.ts # ChromaDB 통합
│   │   └── chroma.provider.ts
│   │
│   ├── bad-word/              # 금칙어 관리 API
│   │   ├── bad-word.controller.ts
│   │   ├── bad-word.service.ts
│   │   └── dto/
│   │
│   ├── cache/                 # Redis 캐시 레이어
│   │   ├── cache.service.ts
│   │   ├── cache.module.ts
│   │   └── redis.provider.ts
│   │
│   ├── database/              # Prisma 데이터베이스
│   │   ├── prisma.service.ts
│   │   └── database.module.ts
│   │
│   ├── filter/                # 필터링 핵심 로직
│   │   ├── filter.controller.ts
│   │   ├── filter.service.ts  # Fast Path First 전략
│   │   ├── filter.module.ts
│   │   ├── dto/
│   │   ├── normalization/     # 텍스트 정규화
│   │   │   ├── normalization.service.ts
│   │   │   ├── text-normalizer.ts
│   │   │   ├── evasion-detectors.ts  # 회피 패턴 감지
│   │   │   └── evasion-analyzer.ts    # 회피 패턴 분석
│   │   ├── tokenization/      # 토큰화
│   │   │   └── tokenization.service.ts
│   │   └── trie/              # Trie 기반 매칭
│   │       └── trie.service.ts
│   │
│   ├── health/                # Health Check API
│   │   └── health.controller.ts
│   │
│   ├── app.module.ts          # 루트 모듈
│   └── main.ts               # 애플리케이션 진입점
│
├── prisma/
│   ├── schema.prisma         # 데이터베이스 스키마
│   └── migrations/           # 마이그레이션 파일
│
├── docs/
│   └── rdb-schema.md         # 데이터베이스 스키마 문서
│
├── docker-compose.yml        # 인프라 설정
├── package.json
└── tsconfig.json
```

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
[3] 토큰화
    ↓
[4] Fast Path: Trie 기반 매칭
    ├─ 전체 단어 매칭 발견 → 심각도 높으면 즉시 차단
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

1. **즉시 차단**: 전체 단어 매칭 + dictionaryScore ≥ 0.7
2. **AI 호출 생략**: 전체 단어 매칭 + dictionaryScore < 0.7 (경고만)
3. **AI 호출**:
   - `suspiciousScore > 0.3` (회피 패턴 감지)
   - `fastMatches.length === 0 && text.length <= 20` (매칭 없음 + 짧은 텍스트)
   - `partialMatches.length > 0 && fullMatches.length === 0` (부분 매칭만 있음)

---

## 🔍 주요 기능

### 1. 텍스트 정규화 (Normalization)

**TextNormalizer**:

- Zero-width 문자 제거
- 제어 문자 제거
- 연속 공백 축소

**회피 패턴 감지 (EvasionDetectors)**:

- **Leetspeak**: 한글 + 숫자/영문/특수문자 혼용 (예: `시8`, `cibal`)
- **Repetition**: 같은 문자 2회 이상 연속 반복 (예: `시발발`)
- **Jamo Separation**: 자모 분리 (예: `ㅅㅣ발`)
- **Zero Width**: Zero-width 문자 삽입 (예: `시\u200b발`)
- **Mixed Script**: 한글/영문/숫자 혼용 (예: `시b발`)
- **Space Separation**: 공백으로 단어 분리 (예: `시 발`)

**EvasionAnalyzer**:

- 각 패턴의 가중치를 합산하여 `suspiciousScore` (0-1) 계산
- 패턴별 가중치:
  - Leetspeak: 0.3
  - Repetition: 0.2
  - Jamo Separation: 0.25
  - Zero Width: 0.3
  - Mixed Script: 0.2
  - Space Separation: 0.3

### 2. 토큰화 (Tokenization)

**TokenizationService**:

- **tokenize()**: 공백 기준 토큰 분리

### 3. Trie 기반 매칭 (Dictionary Matching)

**TrieService**:

- **Trie 데이터 구조**: 메모리 기반 금칙어 트리
- **findAllMatches()**: 텍스트를 한 번 순회하여 모든 매칭 발견
- **성능**: O(n) 시간 복잡도 (n = 텍스트 길이)
- **네트워크 I/O**: 0회 (메모리 직접 접근)

**CacheService**:

- **Write-through 캐싱**: PostgreSQL → Redis 자동 동기화
- **스마트 로드**: Redis에 데이터가 있으면 Redis → Trie, 없으면 PostgreSQL → Redis + Trie
- **Redis 키 구조**:
  - `bad_words:global`: 글로벌 금칙어 Set
  - `bad_words:normalized`: 정규화된 단어 → 상세 정보 Hash
  - `bad_words:client:{clientId}`: 클라이언트별 금칙어 Set

**부분 매칭 구분**:

- **전체 단어 매칭**: 매칭된 단어의 위치가 토큰의 경계와 정확히 일치하는 경우
- **부분 매칭**: 매칭된 단어가 토큰의 일부인 경우 (예: "시발점" → "시발")
- 부분 매칭은 가중치 50% 감소

### 4. AI/RAG 파이프라인

**RAGService**:

- **extractCandidates()**: LLM을 통해 맥락 기반 후보 추출
- **프로세스**:
  1. 입력 텍스트를 LLM에 전달
  2. LLM이 의심스러운 단어/구문 추출
  3. 추출된 후보를 정규화
  4. Trie에서 매칭 확인

**Vector Store (ChromaDB)**:

- 향후 유사 단어 검색 및 확장 기능용

### 5. 멀티 테넌트 지원

**ClientBadWord**:

- 클라이언트별 금칙어 정책 오버라이드
- `overrideSeverity`: 클라이언트별 심각도 재정의
- `isActive`: 클라이언트별 활성화/비활성화

---

## 📊 데이터베이스 스키마

### BadWord 테이블

| 컬럼             | 타입     | 설명                                                        |
| ---------------- | -------- | ----------------------------------------------------------- |
| `id`             | UUID     | 고유 ID (PK)                                                |
| `word`           | String   | 원본 금칙어                                                 |
| `normalizedWord` | String   | 정규화된 형태                                               |
| `severity`       | Severity | 심각도 (LOW/MEDIUM/HIGH/CRITICAL)                           |
| `category`       | Category | 카테고리 (PROFANITY/HATE_SPEECH/SEXUAL/VIOLENCE/SPAM/OTHER) |
| `isActive`       | Boolean  | 활성화 여부                                                 |
| `aliases`        | String[] | 별칭/변형 리스트                                            |

### ClientBadWord 테이블

| 컬럼               | 타입      | 설명                           |
| ------------------ | --------- | ------------------------------ |
| `clientId`         | String    | 클라이언트 ID (복합 PK)        |
| `wordId`           | UUID      | BadWord.id (FK)                |
| `overrideSeverity` | Severity? | 클라이언트별 심각도 오버라이드 |
| `isActive`         | Boolean   | 클라이언트별 활성화 여부       |

자세한 스키마 설명은 [docs/rdb-schema.md](./docs/rdb-schema.md) 참고

---

## 🔌 API 엔드포인트

### 필터링 API

#### `POST /filter/check`

텍스트를 필터링합니다.

**Request**:

```json
{
  "text": "시발 개새끼",
  "clientId": "optional-client-id"
}
```

**Response**:

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
    }
  ]
}
```

**Status 값**:

- `ALLOW`: 허용
- `WARN`: 경고 (낮은 심각도)
- `BLOCK`: 차단

### 금칙어 관리 API

#### `POST /bad-words`

금칙어를 생성합니다.

#### `GET /bad-words`

금칙어 목록을 조회합니다. (페이징, 필터링 지원)

#### `GET /bad-words/:id`

특정 금칙어를 조회합니다.

#### `PATCH /bad-words/:id`

금칙어를 수정합니다.

#### `DELETE /bad-words/:id`

금칙어를 삭제합니다. (소프트 삭제: `isActive = false`)

### Health Check API

#### `GET /health`

서비스 상태를 확인합니다.

---

## ⚙️ 환경 변수

`.env` 파일에 다음 변수들을 설정해야 합니다:

```env
# 서버
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/filtering

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=  # 비어있으면 비밀번호 없이 실행, 설정하면 해당 비밀번호 사용

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# ChromaDB
CHROMA_URL=http://localhost:8000
```

---

## 🚀 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 인프라 시작 (Docker Compose)

```bash
docker-compose up -d
```

이 명령으로 다음 서비스가 시작됩니다:

- PostgreSQL (포트 5433)
- Redis (포트 6380)
- ChromaDB (포트 8000)

### 3. 데이터베이스 마이그레이션

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. 애플리케이션 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

### 5. Prisma Studio (선택사항)

```bash
npm run prisma:studio
```

---

## 📈 진행 상황

### ✅ 완료된 기능

- [x] **프로젝트 초기 설정**
  - NestJS 프로젝트 구조
  - TypeScript 설정
  - Docker Compose 인프라 설정

- [x] **데이터베이스**
  - Prisma 스키마 설계
  - BadWord, ClientBadWord, History 테이블
  - 마이그레이션 파일

- [x] **Health Check API**
  - 서비스 상태 확인 엔드포인트

- [x] **금칙어 관리 API**
  - CRUD 기능
  - 페이징, 필터링
  - 소프트 삭제

- [x] **Redis 캐시 레이어**
  - Write-through 캐싱 전략
  - 글로벌/클라이언트별 캐시 분리
  - 정규화된 단어 → 상세 정보 매핑
  - REDIS_PASSWORD가 비어있을 때 자동 처리 (docker-compose.yml)

- [x] **텍스트 정규화**
  - TextNormalizer (기본 정규화)
  - EvasionDetectors (6가지 회피 패턴 감지)
  - EvasionAnalyzer (suspiciousScore 계산)

- [x] **토큰화 및 후보 추출**
  - 공백 기준 토큰화
  - Sliding Window로 부분 문자열 추출
  - 길이 제한 제거 (모든 부분 문자열 추출)

- [x] **필터링 서비스**
  - Fast Path First 전략 구현
  - 전체/부분 매칭 구분
  - AI 호출 조건부 실행
  - dictionaryScore 계산

- [x] **AI/RAG 파이프라인**
  - OpenAI LLM 통합
  - Embedding 서비스
  - ChromaDB Vector Store 통합
  - RAG 서비스 (후보 추출)

- [x] **코드 리팩토링**
  - 중복 코드 제거
  - 책임 분리 (SRP 준수)
  - 파일 통합 (EvasionDetectors, TokenizationService)
  - 네이밍 개선

### ✅ 검증 완료

- [x] **시스템 검증**
  - Trie 로드 검증: 서버 시작 시 PostgreSQL → Redis → Trie 자동 로드 확인
  - 필터링 동작 검증: 금칙어 정상 차단 확인 ("시발" 등)
  - 부분 매칭 구분: "시발점" 같은 정상 단어에서 False Positive 방지 확인
  - 데이터베이스 연결: PostgreSQL, Redis 정상 연결 확인
  - Redis 설정 개선: REDIS_PASSWORD가 비어있을 때 자동 처리

### 🔄 진행 중 / 개선 필요

- [ ] **테스트 코드**
  - 단위 테스트
  - 통합 테스트
  - E2E 테스트

- [ ] **에러 핸들링**
  - 전역 예외 필터
  - 비즈니스 로직 예외 처리 강화

- [ ] **로깅**
  - 구조화된 로깅 (Winston/Pino)
  - 필터링 결과 로깅
  - 성능 모니터링

- [ ] **환경 변수 검증**
  - 시작 시 필수 환경 변수 검증
  - ConfigModule validationSchema

- [ ] **API 문서화**
  - Swagger/OpenAPI 통합

- [ ] **공백 분리 패턴 개선**
  - `extractCandidatesFromTextWithoutSpaces` 구현
  - Fast Path에서 공백 분리 단어 감지 강화

---

## 🎯 향후 계획

### 단기 (1-2주)

1. 테스트 코드 작성
2. 에러 핸들링 강화
3. 로깅 시스템 구축
4. API 문서화 (Swagger)

### 중기 (1-2개월)

1. 성능 최적화
   - Redis 파이프라인 활용
   - 배치 처리 최적화
2. 모니터링
   - Prometheus 메트릭
   - Grafana 대시보드
3. 확장성
   - 수평 확장 지원
   - 로드 밸런싱

### 장기 (3-6개월)

1. 고급 기능
   - 유사 단어 검색 (Vector Store 활용)
   - 맥락 기반 필터링 강화
   - 다국어 지원
2. 관리 UI
   - 금칙어 관리 대시보드
   - 필터링 통계
   - 클라이언트별 정책 관리

---

## 📝 주요 설계 결정

### 1. Fast Path First 전략

**이유**: AI 호출 비용이 높으므로, 가능한 한 Redis 사전 매칭으로 해결
**효과**: 95-98% AI 호출 감소

### 2. 부분 매칭 구분

**이유**: "시발점" 같은 False Positive 방지
**구현**: 토큰에 정확히 일치하면 전체 매칭, 아니면 부분 매칭 (가중치 50% 감소)

### 3. 회피 패턴 감지

**이유**: 사용자가 필터를 우회하려는 시도를 감지
**구현**: 6가지 패턴을 감지하여 suspiciousScore 계산

### 4. Write-through 캐싱

**이유**: 데이터 일관성 보장 + 빠른 조회
**구현**: PostgreSQL 변경 시 Redis 자동 동기화

### 5. 멀티 테넌트 지원

**이유**: SaaS 환경에서 클라이언트별 정책 필요
**구현**: ClientBadWord 테이블로 오버라이드

---

## 🐛 알려진 이슈

1. **공백 분리 패턴**: "시 발" 같은 경우 현재 AI로 전달됨. Fast Path에서 처리하도록 개선 필요
2. **테스트 코드 부재**: 현재 테스트 파일이 없음. 단위/통합 테스트 추가 필요
3. **에러 핸들링**: 전역 예외 필터가 없어 일관성 없는 에러 응답
4. **한글 인코딩**: curl에서 JSON을 직접 전달할 때 한글이 깨질 수 있음. 파일을 통해 요청하거나 Postman/Insomnia 사용 권장

---

## 📚 참고 문서

- [데이터베이스 스키마 문서](./docs/rdb-schema.md)
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [NestJS 공식 문서](https://docs.nestjs.com)
- [OpenAI API 문서](https://platform.openai.com/docs)

---

## 👥 기여자

프로젝트 진행 및 개발: [홍성웅]

---

## 📄 라이선스

MIT License

---

**마지막 업데이트**: 2025년 11월
