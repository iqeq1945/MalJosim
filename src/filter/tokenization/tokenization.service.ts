import { Injectable } from "@nestjs/common";
import { NormalizationService } from "../normalization/normalization.service";

/**
 * 토큰화 서비스
 *
 * 텍스트를 토큰화하고, 슬라이딩 윈도우를 통해 후보 단어를 추출합니다.
 * Redis 매칭을 위한 후보 단어 생성을 담당합니다.
 */
@Injectable()
export class TokenizationService {
  constructor(private readonly normalizationService: NormalizationService) {}

  /**
   * 공백 기준으로 텍스트를 토큰화합니다.
   *
   * @param text 토큰화할 텍스트
   * @returns 토큰 배열 (빈 토큰 제거, 트림 처리)
   */
  tokenize(text: string): string[] {
    if (!text || typeof text !== "string") {
      return [];
    }

    return text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }

  /**
   * 슬라이딩 윈도우로 후보 단어를 추출합니다.
   *
   * 공백 기준 토큰화 후, 각 토큰별로 슬라이딩 윈도우를 적용합니다.
   * 토큰별 처리로 False Positive를 줄이고 더 정확한 문맥 파악이 가능합니다.
   * 토큰 자체도 항상 후보에 포함하여 전체 단어 매칭을 지원합니다.
   *
   * @param text 추출할 텍스트
   * @returns 후보 단어 배열 (중복 제거)
   *
   * @example
   * extractCandidates("안녕하세요 시발")
   * // → ["안녕", "안녕하", "시발", "안녕하세요", ...] (각 토큰별 슬라이딩 윈도우 + 토큰 포함)
   */
  extractCandidates(text: string): string[] {
    if (!text || typeof text !== "string") {
      return [];
    }

    const candidates = new Set<string>();

    // 1. 공백 기준 토큰화
    const tokens = this.tokenize(text);

    // 2. 슬라이딩 윈도우 헬퍼 함수
    const extractSlidingWindow = (token: string): void => {
      if (!token || token.length === 0) {
        return;
      }

      const tokenLength = token.length;
      // 각 시작 위치에서 모든 가능한 부분 문자열 추출
      for (let start = 0; start < tokenLength; start++) {
        for (let end = start + 1; end <= tokenLength; end++) {
          const candidate = token.substring(start, end);
          if (candidate.length > 0) {
            candidates.add(candidate);
          }
        }
      }
    };

    // 3. 각 토큰에 대해 슬라이딩 윈도우 적용
    for (const token of tokens) {
      extractSlidingWindow(token);
    }

    // 4. 토큰도 후보에 포함 (항상 포함 - 전체 단어 매칭을 위해 필수)
    tokens.forEach((token) => {
      if (token.length > 0) {
        candidates.add(token);
      }
    });

    return Array.from(candidates);
  }
}
