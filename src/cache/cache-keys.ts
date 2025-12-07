/**
 * Redis 키 구조 정의
 */
export class CacheKeys {
  /**
   * 활성 금칙어 목록 (Set)
   * bad_words:global
   */
  static globalBadWords(): string {
    return "bad_words:global";
  }

  /**
   * 정규화된 단어 → 원본 단어 매핑 (Hash)
   * bad_words:normalized:{normalizedWord} → word
   */
  static normalizedWordMapping(normalizedWord: string): string {
    return `bad_words:normalized:${normalizedWord}`;
  }

  /**
   * 단어 상세 정보 (Hash)
   * bad_words:detail:{wordId}
   */
  static wordDetail(wordId: string): string {
    return `bad_words:detail:${wordId}`;
  }

  /**
   * 모든 정규화된 단어 매핑의 키 패턴
   */
  static normalizedWordPattern(): string {
    return "bad_words:normalized:*";
  }
}
