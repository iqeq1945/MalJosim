/**
 * 회피 패턴 감지기
 *
 * 텍스트에서 필터링 회피를 시도하는 패턴을 감지합니다.
 * 모든 회피 패턴 감지 로직을 통합하여 제공합니다.
 */
export class EvasionDetectors {
  /**
   * Leetspeak 패턴 감지
   * 한글과 숫자/영문/특수문자가 혼용된 경우를 감지
   *
   * @param text 분석할 텍스트
   * @returns Leetspeak 패턴이 있는지 여부
   */
  static detectLeetspeak(text: string): boolean {
    if (!text) return false;

    // 한글이 포함되어 있고, 숫자나 영문/특수문자도 함께 있는 경우
    const hasKorean = /[가-힣]/.test(text);
    const hasNumber = /[0-9]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    const hasSpecial = /[@#\-_|\\\/]/.test(text);

    return hasKorean && (hasNumber || hasEnglish || hasSpecial);
  }

  /**
   * 반복 문자 패턴 감지
   * 같은 문자가 2회 이상 연속 반복되는 경우를 감지
   *
   * @param text 분석할 텍스트
   * @returns 반복 패턴이 있는지 여부
   */
  static detectRepetition(text: string): boolean {
    if (!text) return false;

    // 같은 문자가 2회 이상 연속 반복
    return /(.)\1{2,}/.test(text);
  }

  /**
   * 자모 분리 패턴 감지
   * 분리된 한글 자모가 포함된 경우를 감지
   *
   * @param text 분석할 텍스트
   * @returns 자모 분리 패턴이 있는지 여부
   */
  static detectJamoSeparation(text: string): boolean {
    if (!text) return false;

    // 초성, 중성, 종성 자모 범위
    // 초성: U+3131 ~ U+314E
    // 중성: U+314F ~ U+3163
    // 종성: U+3131 ~ U+318E
    return /[ㄱ-ㅎㅏ-ㅣ]/.test(text);
  }

  /**
   * Zero-width 문자 패턴 감지
   *
   * @param text 분석할 텍스트
   * @returns Zero-width 문자가 있는지 여부
   */
  static detectZeroWidth(text: string): boolean {
    if (!text) return false;

    // U+200B: Zero-width space
    // U+200C: Zero-width non-joiner
    // U+200D: Zero-width joiner
    // U+FEFF: Zero-width no-break space
    return /[\u200B-\u200D\uFEFF]/.test(text);
  }

  /**
   * 공백 분리 패턴 감지
   * 의도적으로 공백을 넣어 필터링을 회피하는 패턴을 감지
   * 예: "시 발", "시 발 개 새 끼"
   *
   * @param text 분석할 텍스트
   * @returns 공백 분리 패턴이 있는지 여부
   */
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
}
