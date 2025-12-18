## 아키텍처 설계

### **필터링 파이프라인**

```
입력 텍스트
    ↓
[1] 텍스트 분석 (회피 패턴 감지)
    ↓
[2] 텍스트 정규화
    ↓
[3] 토큰화 (전체 단어 매칭 구분용)
    ↓
[4] Fast Path: Trie 기반 매칭
    ├─ 전체 단어 매칭 발견 → 심각도 높으면 즉시 차단 ✅
    └─ 부분 매칭만 발견 → AI 호출
    ↓
[5] Slow Path: AI 호출 (조건부)
    ├─ 회피 패턴 감지 (suspiciousScore > 0.3)
    ├─ 매칭 없음 + 짧은 텍스트 (≤ 20자)
    └─ 부분 매칭만 있음
    ↓
[6] 최종 필터링 결과 반환
```

### **시스템 아키텍처**

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Filter Service │
│  (Fast Path)    │
└──────┬──────────┘
       │
       ├──► Trie (메모리 기반 매칭)
       │
       └──► AI Service (조건부)
            │
            └──► OpenAI LLM (문맥 판단)
```

---

## **핵심 기능**

## **1. Fast Path First 전략 구현**

**왜 이 전략을 세웠나요?**

초기에는 모든 요청에 AI를 호출했습니다. 정확도는 높았지만 비용이 급증할 것을 예상했습니다.

예를 들어:

- 일일 요청 10만 건 × AI 호출 = 월 수백만 원
- 대부분의 케이스는 단순 금칙어 매칭으로 해결 가능
- AI는 복잡한 회피 패턴이나 맥락 판단에만 필요

이를 바탕으로 Fast Path First 전략을 도입했습니다:

- 대부분의 케이스는 Trie 기반 매칭으로 처리 (무료, 빠름)
- 복잡한 케이스만 AI 호출 (비용 발생)
- 전체 단어 매칭 + 높은 심각도 시 즉시 차단 (AI 호출 생략)

```typescript
// Fast Path First 전략 구현
async filter(dto: FilterRequestDto): Promise<FilterResponseDto> {
  // 1. Fast Path: Trie 기반 매칭
  const fastMatches = this.checkDictionaryWithTrie(
    normalizedText,
    normalizedTokens
  );

  // 2. 전체 단어 매칭 + 높은 심각도 → 즉시 차단
  if (fullMatches.length > 0 && fullScore >= 0.7) {
    return FilterResponseDto.block(text, fastMatches, fullScore);
  }

  // 3. 조건부 AI 호출
  if (shouldCallAI && this.llmService) {
    const aiJudgment = await this.llmService.judgeProfanity(
      analysis.original,
      analysis.evasionPatterns
    );
    // ...
  }
}
```

---

## **2. 회피 패턴 감지 시스템**

**왜 회피 패턴 감지를 도입했나요?**

실제 운영 중 다양한 우회 기법을 목격했습니다:

- 시8, cibal 같은 Leetspeak
- ㅅㅣ발 같은 자모 분리
- 시발발 같은 무의미한 반복
- 시\u200b발 같은 보이지 않는 문자 삽입
- 시 발 같은 공백 분리

단순 금칙어 필터링으로는 이런 변형을 잡기 어려웠고, 사용자들이 계속 새로운 방법을 찾아냈습니다.

이를 해결하기 위해 패턴 기반 접근을 도입했습니다:

- 5가지 회피 패턴을 자동으로 감지
- 패턴별 가중치를 합산하여 suspiciousScore 계산
- 의심스러운 텍스트는 AI로 맥락 판단

### 5가지 회피 패턴 자동 감지

- **Leetspeak**: 시8, cibal (한글 + 숫자/영문 혼용)
- **Repetition**: 시발발 (문자 반복)
- **Jamo Separation**: ㅅㅣ발 (자모 분리)
- **Zero Width**: 시\u200b발 (보이지 않는 문자 삽입)
- **Space Separation**: 시 발 (공백으로 단어 분리)

### 구현

- 각 패턴별 정규표현식 및 알고리즘 구현
- 패턴별 가중치를 합산하여 suspiciousScore (0-1) 계산
- suspiciousScore > 0.3 시 AI 호출로 맥락 판단

```typescript
// 회피 패턴 감지 예시
static detectLeetspeak(text: string): boolean {
  const hasKorean = /[가-힣]/.test(text);
  const hasNumber = /[0-9]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  return hasKorean && (hasNumber || hasEnglish);
}

static detectSpaceSeparation(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false;
  }
  // 공백으로 분리된 토큰들
  const tokens = text.split(/\s+/).filter((t) => t.trim().length > 0);

  // 토큰이 2개 미만이면 공백 분리 패턴 아님
  if (tokens.length < 2) {
    return false;
  }

  // 공백 개수
  const spaceCount = (text.match(/\s/g) || []).length;
  const spaceRatio = spaceCount / text.length;

  // 짧은 토큰(1-2자) 개수
  const shortTokens = tokens.filter((t) => t.length <= 2).length;
  const shortTokenRatio = shortTokens / tokens.length;

  // 평균 토큰 길이
  const avgTokenLength =
    tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;

  // 의심스러운 패턴:
  // 1. 공백 비율이 40% 이상
  // 2. 짧은 토큰 비율이 70% 이상
  // 3. 평균 토큰 길이가 1.5자 이하
  return spaceRatio > 0.4 || shortTokenRatio > 0.7 || avgTokenLength <= 1.5;
}
```

---

## **3. 부분 매칭 구분 로직**

**왜 Trie 기반 매칭을 도입했나요?**

실제 운영 중 공백 없이 입력된 욕설이나 단어 내 포함 케이스를 자주 봤습니다:

- "시발점" - "시발"이 포함되어 있지만 정상 단어
- "개새끼야" - "개새끼"가 포함되어 있음
- "안녕시발" - 공백 없이 입력된 욕설

초기에는 Redis에서 Sliding Window로 후보를 추출하고 매칭했지만, 네트워크 I/O가 많고 성능이 느렸습니다.

이를 해결하기 위해 **Trie 데이터 구조**를 도입했습니다:

- 텍스트를 한 번 순회하여 모든 매칭 발견 (O(n) 시간 복잡도)
- 네트워크 I/O 제로 (메모리 직접 접근)
- 위치 정보를 포함하여 전체/부분 매칭 구분 가능

**부분 매칭 구분 로직**:

- 매칭된 단어의 위치(startIndex, endIndex)가 토큰의 경계와 정확히 일치하면 **전체 매칭**
- 그렇지 않으면 **부분 매칭** (가중치 50% 감소)

예시: "시발점" → "시발"이 부분 매칭으로 감지되지만, 토큰에 정확히 일치하지 않으므로 부분 매칭으로 분류

- 부분 매칭은 가중치 50% 감소하여 False Positive 방지

**문제**
"시발점" 같은 정상 단어에서 "시발"이 부분 매칭되어 False Positive 발생

### 해결책

- **Trie 기반 매칭**: 텍스트를 한 번 순회하여 모든 매칭 발견
- 토큰 위치 정보를 계산하여 전체/부분 매칭 구분
- 토큰에 정확히 일치하면 **전체 매칭**
- 그렇지 않으면 **부분 매칭** (가중치 50% 감소)

```typescript
// 부분 매칭 구분 로직
private isFullWordMatch(
  startIndex: number,
  endIndex: number,
  tokenPositions: Array<{ startIndex: number; endIndex: number; token: string }>
): boolean {
  // 매칭된 위치가 토큰의 경계와 정확히 일치하는지 확인
  for (const tokenPos of tokenPositions) {
    if (
      startIndex === tokenPos.startIndex &&
      endIndex === tokenPos.endIndex
    ) {
      return true; // 전체 단어 매칭
    }
  }
  return false; // 부분 매칭
}
```

---

## **4. AI 문맥 판단 파이프라인**

**왜 LLM을 도입했나요?**

Trie 기반 매칭만으로는 복잡한 회피 패턴이나 맥락을 판단하기 어려웠습니다.

이를 보완하기 위해 **LLM 기반 문맥 판단**을 도입했습니다:

- LLM으로 텍스트의 맥락을 고려하여 욕설 여부 판단
- 회피 패턴 정보를 프롬프트에 포함하여 정확도 향상
- confidence 점수를 suspiciousScore에 반영

**구현**

### **1. LLM 기반 문맥 판단**

OpenAI GPT-4o-mini를 사용하여 텍스트가 욕설인지 문맥 기반으로 판단합니다.

**모델 설정**

```typescript
this.llm = new ChatOpenAI({
  openAIApiKey: this.apiKey,
  modelName: "gpt-4o-mini", // 비용 효율적인 모델
  temperature: 0.1, // 일관성 있는 결과를 위해 낮은 temperature
});
```

**프롬프트 설계**

- System Prompt: 한국어 욕설 감지 전문가 역할 정의
- User Prompt: 원본 텍스트 + 회피 패턴 정보 포함
- 회피 패턴 정보를 프롬프트에 포함하여 정확도 향상

**응답 처리**

- JSON 형식으로 응답 받아 파싱
- JSON 파싱 실패 시 기본값 반환 (isProfanity: false, confidence: 0)

```typescript
// AI 문맥 판단 파이프라인
async judgeProfanity(
  text: string,
  evasionPatterns?: {
    hasLeetspeak: boolean;
    hasRepetition: boolean;
    hasJamoSeparation: boolean;
    hasZeroWidth: boolean;
    hasSpaceSeparation: boolean;
    suspiciousScore: number;
  }
): Promise<{
  isProfanity: boolean;
  confidence: number; // 0-1
  reason?: string;
}> {
  // System Prompt: 전문가 역할 정의
  const systemPrompt = `당신은 한국어 욕설을 감지하는 전문가입니다.
주어진 텍스트를 문맥을 고려하여 욕설인지 판단하세요.

주의사항:
1. 문맥을 고려하여 판단하세요 (예: "시발점"은 정상 단어, "시발"은 욕설)
2. 회피 패턴(leetspeak, 자모 분리 등)을 고려하세요
3. 정상적인 단어는 욕설이 아닙니다
4. 확신도(confidence)를 0-1 사이로 제공하세요`;

  // User Prompt: 원본 텍스트 + 회피 패턴 정보
  let userPrompt = `다음 텍스트가 욕설인지 문맥을 고려하여 판단하세요:\n\n${text}`;

  if (evasionPatterns && evasionPatterns.suspiciousScore > 0) {
    userPrompt += `\n\n회피 패턴 정보:\n`;
    if (evasionPatterns.hasLeetspeak) {
      userPrompt += "- 숫자/영문/특수문자 혼용 감지\n";
    }
    if (evasionPatterns.hasRepetition) {
      userPrompt += "- 반복 문자 감지\n";
    }
    if (evasionPatterns.hasJamoSeparation) {
      userPrompt += "- 자모 분리 감지\n";
    }
    if (evasionPatterns.hasZeroWidth) {
      userPrompt += "- Zero-width 문자 감지\n";
    }
    if (evasionPatterns.hasSpaceSeparation) {
      userPrompt += "- 공백 분리 감지\n";
    }
  }

  const response = await this.llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  // JSON 파싱 및 결과 반환
  const result = JSON.parse(response.content);
  return {
    isProfanity: result.isProfanity || false,
    confidence: Math.max(0, Math.min(1, result.confidence || 0)),
    reason: result.reason,
  };
}
```

**결과**

- LLM을 통해 맥락 기반 욕설 판단
- 회피 패턴 정보를 활용한 정확도 향상
- confidence 점수를 suspiciousScore에 반영하여 최종 판정에 활용

---

## **5. Trie 기반 고성능 매칭**

**왜 Trie를 도입했나요?**

초기에는 Redis에서 Sliding Window로 후보를 추출하고 매칭했습니다:

- 네트워크 I/O가 많아 성능이 느림
- 후보 추출 로직이 복잡함

이를 해결하기 위해 **Trie 데이터 구조**를 도입했습니다:

- 메모리 기반 금칙어 트리로 O(n) 시간 복잡도
- 네트워크 I/O 제로 (메모리 직접 접근)
- 위치 정보를 포함하여 전체/부분 매칭 구분 가능

**구현**

### **TrieService**

```typescript
// Trie 노드 구조
interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  wordInfo?: {
    word: string;
    normalizedWord: string;
    id: string;
    severity: string;
  };
}

// 텍스트에서 모든 매칭 찾기
findAllMatches(text: string): Array<{
  word: string;
  normalizedWord: string;
  id: string;
  severity: string;
  startIndex: number;
  endIndex: number;
}> {
  const matches = [];

  // 텍스트를 한 번 순회하여 모든 매칭 발견
  for (let i = 0; i < text.length; i++) {
    let node = this.globalTrie;

    for (let j = i; j < text.length; j++) {
      const char = text[j];
      const child = node.children.get(char);

      if (!child) {
        break;
      }

      node = child;

      // 단어 끝에 도달하면 매칭 추가
      if (node.isEndOfWord && node.wordInfo) {
        matches.push({
          word: node.wordInfo.word,
          normalizedWord: node.wordInfo.normalizedWord,
          id: node.wordInfo.id,
          severity: node.wordInfo.severity,
          startIndex: i,
          endIndex: j + 1,
        });
      }
    }
  }

  return this.deduplicateMatches(matches);
}
```

**CacheService 통합**

- 서버 시작 시 PostgreSQL → Redis → Trie 자동 로드
- Redis에 데이터가 있으면 Redis → Trie, 없으면 PostgreSQL → Redis + Trie
- Write-through 캐싱: PostgreSQL 변경 시 Redis + Trie 자동 동기화

```typescript
// CacheService에서 Trie 구축
async loadTrieFromRedis(): Promise<void> {
  // Redis에서 모든 정규화된 단어 가져오기
  const normalizedWords = await this.redis.smembers(
    CacheKeys.globalBadWords()
  );

  // 각 단어의 상세 정보를 가져와서 Trie에 추가
  for (const normalizedWord of normalizedWords) {
    const wordInfo = await this.getWordByNormalized(normalizedWord);
    if (wordInfo) {
      this.trieService.addWord(normalizedWord, {
        word: wordInfo.word,
        normalizedWord: normalizedWord,
        id: wordInfo.id,
        severity: wordInfo.severity,
      });
    }
  }
}
```

**성능**

- 시간 복잡도: O(n) (n = 텍스트 길이)
- 네트워크 I/O: 0회 (메모리 직접 접근)
- 평균 응답 시간: < 10ms (Fast Path)

---

## **검증 및 테스트**

### **시스템 검증 완료**

- ✅ **Trie 로드 검증**: 서버 시작 시 PostgreSQL → Redis → Trie 자동 로드 확인
- ✅ **필터링 동작 검증**: "시발" 등 금칙어 정상 차단 확인
- ✅ **부분 매칭 구분**: "시발점" 같은 정상 단어에서 False Positive 방지 확인
- ✅ **데이터베이스 연결**: PostgreSQL, Redis 정상 연결 확인

### **테스트 결과 예시**

```json
// 입력: "시발"
{
  "status": "block",
  "text": "시발",
  "dictionaryScore": 0.9,
  "matchedWords": [
    {
      "word": "시발",
      "normalizedWord": "시발",
      "severity": "HIGH",
      "isPartialMatch": false
    }
  ],
  "totalMatches": 1,
  "hasEvasionPattern": false,
  "suspiciousScore": 0
}
```

### **주의사항**

- **한글 인코딩**: curl에서 JSON을 직접 전달할 때 한글이 깨질 수 있음
  - 해결: 파일을 통해 요청하거나 Postman/Insomnia 사용 권장
  - 예시: `echo '{"text":"시발"}' > test.json && curl -X POST ... --data-binary @test.json`

---

## **추후 개발 예정사항**

### **1. 공백 분리 패턴 Fast Path 처리**

- "시 발" 같은 공백 분리된 욕설을 Fast Path에서 직접 감지
- AI 호출 없이 Trie 기반 매칭으로 처리하여 응답 속도 향상

### **2. 테스트 코드 작성**

- 단위 테스트 (회피 패턴 감지, 토큰화, 점수 계산)
- 통합 테스트 (필터링 파이프라인 전체)
- E2E 테스트 (API 엔드포인트)

### **3. 모니터링 및 로깅**

- 구조화된 로깅 시스템 (Winston/Pino)
- 필터링 통계 및 성능 메트릭 수집
- Prometheus 메트릭 및 Grafana 대시보드

### **4. 관리 UI 대시보드**

- 금칙어 관리 웹 인터페이스
- 필터링 통계 및 차단율 시각화
- 클라이언트별 정책 관리 UI

### **5. VectorStore 자동 동기화 (향후 확장)**

- 금칙어 추가/수정 시 ChromaDB에 임베딩 벡터 자동 저장
- 기존 금칙어 일괄 임베딩 및 VectorStore 마이그레이션 스크립트
- VectorStore 기반 유사 단어 검색 성능 개선
