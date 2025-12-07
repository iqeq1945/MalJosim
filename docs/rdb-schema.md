## MalJosim DB 스키마 개요

이 문서는 MalJosim 욕설 필터링 서비스에서 사용하는 **PostgreSQL + Prisma 스키마**를 설명합니다.  
목표는 팀원/미래의 나/클라이언트 통합 시에 **데이터 구조와 의도를 빠르게 이해**할 수 있게 하는 것입니다.

---

## 1. 주요 테이블 개요

- **BadWord**
  - 글로벌 금칙어 원본 단어를 관리하는 마스터 테이블
- **ClientBadWord**
  - 특정 클라이언트(clientId) 기준으로 금칙어 정책을 오버라이드하는 테이블
- **History**
  - 금칙어/설정 변경 이력을 남기는 (선택적) 감사용 로그 테이블

---

## 2. BadWord 테이블

- **역할**
  - 욕설/비속어/정책상 문제가 되는 표현들을 **정규화된 형태로 관리하는 중앙 사전**
  - Redis 캐시(`bad_words:global`, `bad_words:normalized`)를 채우는 소스 오브 트루스(Source of Truth)

- **컬럼 설명**

| 컬럼명           | 타입              | 설명                                                                          |
| ---------------- | ----------------- | ----------------------------------------------------------------------------- |
| `id`             | `String` (UUID)   | 금칙어 고유 ID (PK)                                                           |
| `word`           | `String`          | 원본 금칙어 문자열 (예: `씨발`)                                               |
| `normalizedWord` | `String`          | 정규화 후 대표 형태 (자모 합치기, leetspeak 변환, 반복 축소 등 적용)          |
| `severity`       | `Severity` (enum) | 욕설 강도 레벨 (`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`)                       |
| `category`       | `Category` (enum) | 표현 종류 (`PROFANITY`, `HATE_SPEECH`, `SEXUAL`, `VIOLENCE`, `SPAM`, `OTHER`) |
| `isActive`       | `Boolean`         | 현재 필터링에서 사용할지 여부 (소프트 삭제/비활성화 플래그)                   |
| `createdAt`      | `DateTime`        | 레코드 생성 시각                                                              |
| `updatedAt`      | `DateTime`        | 레코드 최종 수정 시각 (자동 업데이트)                                         |

- **인덱스 및 제약 조건**
  - `@@unique([word])` : 동일한 원본 단어 중복 저장 방지
  - `@@index([normalizedWord])` : 정규화된 토큰 기준 빠른 조회용
  - `@@index([isActive])` : 활성 금칙어만 빠르게 필터링
  - `@@index([category])` : 카테고리별 통계/정책 조회용

---

## 3. ClientBadWord 테이블

- **역할**
  - SaaS/멀티 테넌트 환경에서 **클라이언트별 금칙어 정책 오버라이드**를 담당
  - 예: 글로벌로는 막는 단어이지만, 특정 클라이언트에서는 허용하거나 강도를 다르게 두고 싶을 때 사용

- **컬럼 설명**

| 컬럼명             | 타입        | 설명                                                            |
| ------------------ | ----------- | --------------------------------------------------------------- |
| `clientId`         | `String`    | 클라이언트 식별자 (예: 테넌트 ID, 고객사 ID)                    |
| `wordId`           | `String`    | `BadWord.id` FK (어떤 금칙어를 오버라이드 하는지)               |
| `overrideSeverity` | `Severity?` | 클라이언트 기준 재정의된 심각도 (없으면 글로벌 `severity` 사용) |
| `isActive`         | `Boolean`   | 해당 클라이언트에서 이 단어를 사용할지 여부                     |
| `createdAt`        | `DateTime`  | 레코드 생성 시각                                                |
| `updatedAt`        | `DateTime`  | 레코드 최종 수정 시각                                           |

- **관계 및 인덱스**
  - `badWord BadWord @relation(fields: [wordId], references: [id], onDelete: Cascade)`
  - `@@id([clientId, wordId])` : (clientId, wordId) 복합 PK → 한 클라이언트당 한 단어에 대해 하나의 설정만 허용
  - `@@index([clientId])` : 클라이언트별 정책 조회 최적화
  - `@@index([wordId])` : 특정 단어에 대한 클라이언트별 정책 탐색

---

## 4. History 테이블 (선택적 Audit 로그)

- **역할**
  - 금칙어/클라이언트 정책 변경에 대한 **감사 로그(Audit Trail)** 저장
  - 누가 언제 어떤 값을 어떻게 바꿨는지 추적 가능

- **컬럼 설명**

| 컬럼명      | 타입                   | 설명                                                           |
| ----------- | ---------------------- | -------------------------------------------------------------- |
| `id`        | `String` (UUID)        | 로그 고유 ID                                                   |
| `tableName` | `String`               | 변경된 테이블 이름 (예: `"BadWord"`, `"ClientBadWord"`)        |
| `recordId`  | `String`               | 변경 대상 레코드의 ID (`BadWord.id` 또는 `clientId+wordId` 등) |
| `action`    | `HistoryAction` (enum) | `CREATE` / `UPDATE` / `DELETE`                                 |
| `userId`    | `String?`              | 변경을 수행한 사용자/시스템 ID                                 |
| `createdAt` | `DateTime`             | 로그 생성 시각                                                 |

- **인덱스**
  - `@@index([tableName, recordId])` : 특정 레코드 변경 이력 조회용
  - `@@index([createdAt])` : 시간순 로그 조회/정리용

---

## 5. 인덱싱 & 조회 패턴

- **정규화 기반 필터링**
  - 필터링 엔진은 입력 텍스트를 정규화한 뒤, `normalizedWord` 기준으로 Redis/DB를 조회
  - `BadWord.normalizedWord` 인덱스가 핵심

- **클라이언트별 정책 조회**
  - 기본 흐름:
    1. 글로벌 활성 금칙어: `BadWord` where `isActive = true`
    2. 클라이언트 별 오버라이드: `ClientBadWord` where `clientId = ?` and `isActive = true`
  - Redis 키 예:
    - `bad_words:global`
    - `bad_words:client:{clientId}`

---

## 6. 향후 확장 포인트

- **Category 확장**
  - 현재는 enum 기반이지만, 필요 시 `Category`를 별도 테이블로 분리하여
    - 관리 UI에서 카테고리 추가/수정
    - 다국어 라벨/설명 지원
  - 가능

- **Severity 스코어링**
  - enum(`LOW`~`CRITICAL`)을 내부적으로 0.0~1.0 스코어로 매핑하여
  - 최종 `dictionaryScore` 계산에 활용 가능

- **History 고도화**
  - `History`를 별도 서비스/테이블로 분리하여
  - 보존 기간 정책, 검색/필터링 UI, 알림 시스템 연동 등 확장 가능

---

## 7. 이 문서를 보는 사람이 알면 좋은 것

- Prisma 스키마(`prisma/schema.prisma`)는 이 문서와 1:1로 매핑되어 있음
- DB 변경(컬럼 추가/삭제/타입 변경 등)을 할 때는:
  1. **먼저 `schema.prisma` 수정**
  2. `npx prisma migrate dev --name <변경_이름>` 실행
  3. **이 문서에도 변경 이유와 필드 설명을 업데이트**

이 흐름을 지키면, MalJosim의 데이터 모델이 장기적으로도 깨끗하게 유지될 수 있습니다.
