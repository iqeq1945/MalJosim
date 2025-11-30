/**
 * 텍스트 정규화 유틸리티
 * Redis 캐시 매칭을 위한 정규화 (Zero-width 제거, 기본 정리)
 */
export class TextNormalizer {
  /**
   * 텍스트를 정규화합니다.
   * Redis 캐시 매칭에 사용할 수 있는 형태로 변환합니다.
   *
   * @param text 원본 텍스트
   * @returns 정규화된 텍스트
   */
  static normalize(text: string): string {
    if (!text || typeof text !== "string") {
      return text || "";
    }

    let normalized = text;

    // 1. Zero-width 문자 제거
    // U+200B: Zero-width space
    // U+200C: Zero-width non-joiner
    // U+200D: Zero-width joiner
    // U+FEFF: Zero-width no-break space
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // 2. 제어 문자 제거 (탭, 개행, 캐리지 리턴은 유지)
    // U+0000 ~ U+001F (제어 문자), U+007F (DEL), U+0080 ~ U+009F (확장 제어 문자)
    normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // 3. 연속된 공백을 하나로 축소
    normalized = normalized.replace(/[ \t]+/g, " ");

    return normalized.trim();
  }
}
