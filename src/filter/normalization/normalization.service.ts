import { Injectable } from "@nestjs/common";
import { EvasionAnalyzer, EvasionPattern } from "./evasion-analyzer";
import { TextNormalizer } from "./text-normalizer";

/**
 * 텍스트 분석 결과
 * AI가 원본 텍스트를 직접 보고 발음 기반으로 판단할 수 있도록
 * 원본과 회피 패턴 정보를 제공합니다.
 *
 * 주의: normalized 필드는 제거되었습니다.
 * AI가 후보 단어를 추출한 후, 그 후보들을 normalize()로 정규화하여 Redis 매칭합니다.
 */
export interface TextAnalysisResult {
  original: string; // 원본 텍스트 (AI가 직접 판단)
  evasionPatterns: EvasionPattern; // 회피 패턴 분석 결과
}

/**
 * 텍스트 분석 서비스
 *
 * AI가 원본 텍스트를 직접 보고 발음 기반으로 판단할 수 있도록
 * 회피 패턴 정보만 제공합니다. 자모 변환 등은 하지 않습니다.
 */
@Injectable()
export class NormalizationService {
  constructor(private readonly evasionAnalyzer: EvasionAnalyzer) {}

  /**
   * 텍스트를 분석합니다.
   *
   * AI 판단을 위한 원본 텍스트와 회피 패턴 정보를 제공합니다.
   *
   * 주의: Redis 매칭은 AI가 후보 단어를 추출한 후,
   * 그 후보들을 normalize()로 정규화하여 수행합니다.
   *
   * @param text 원본 텍스트
   * @returns 원본 텍스트와 회피 패턴 분석 결과
   */
  analyze(text: string): TextAnalysisResult {
    if (!text || typeof text !== "string") {
      const empty = text || "";
      return {
        original: empty,
        evasionPatterns: this.evasionAnalyzer.analyze(empty),
      };
    }

    const original = text;

    // 회피 패턴 분석 (원본 기준)
    const evasionPatterns = this.evasionAnalyzer.analyze(text);

    return {
      original,
      evasionPatterns,
    };
  }

  /**
   * 여러 텍스트를 일괄 분석합니다.
   *
   * @param texts 텍스트 배열
   * @returns 분석 결과 배열
   */
  analyzeBatch(texts: string[]): TextAnalysisResult[] {
    return texts.map((text) => this.analyze(text));
  }

  /**
   * 텍스트를 정규화합니다.
   *
   * AI가 추출한 후보 단어들을 Redis 매칭하기 위해 정규화합니다.
   * 예: AI가 "시발"을 추출했다면 → normalize("시발") → Redis에서 매칭
   *
   * 주의: 입력 텍스트를 직접 정규화하는 게 아니라,
   * AI가 추출한 후보 단어들을 정규화하는 용도로 사용합니다.
   *
   * @param text 정규화할 텍스트 (보통 AI가 추출한 후보 단어)
   * @returns 정규화된 텍스트 (Zero-width 제거 등)
   */
  normalize(text: string): string {
    return TextNormalizer.normalize(text);
  }

  /**
   * 여러 텍스트를 일괄 정규화합니다.
   *
   * @param texts 텍스트 배열
   * @returns 정규화된 텍스트 배열
   */
  normalizeBatch(texts: string[]): string[] {
    return texts.map((text) => this.normalize(text));
  }
}
