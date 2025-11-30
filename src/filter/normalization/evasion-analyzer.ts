import { Injectable } from "@nestjs/common";
import { EvasionDetectors } from "./evasion-detectors";
import { Type } from "class-transformer";

/**
 * 회피 패턴 분석 결과
 */
export interface EvasionPattern {
  hasLeetspeak: boolean; // 숫자/영문/특수문자 혼용
  hasRepetition: boolean; // 반복 문자 (예: 시발발발)
  hasJamoSeparation: boolean; // 자모 분리 (예: ㅅㅣ발)
  hasZeroWidth: boolean; // Zero-width 문자 사용
  hasSpaceSeparation: boolean; // 공백 분리 (예: 시 발 개 새 끼)
  suspiciousScore: number; // 의심도 점수 (0-1)
  detectedPatterns: string[]; // 감지된 패턴 목록
}

/**
 * 회피 패턴 종류
 */
export enum PATTERNS {
  LEETSPEAK = "leetspeak",
  REPETITION = "repetition",
  JAMO_SEPARATION = "jamo_separation",
  ZERO_WIDTH = "zero_width",
  SPACE_SEPARATION = "space_separation",
}

/**
 * 회피 패턴 분석기
 *
 * 텍스트에서 필터링 회피를 시도하는 패턴을 감지합니다.
 * AI가 원본 텍스트를 직접 보고 발음 기반으로 판단할 수 있도록
 * 회피 패턴 정보만 제공합니다.
 */
@Injectable()
export class EvasionAnalyzer {
  /**
   * 텍스트에서 회피 패턴을 분석합니다.
   *
   * @param text 분석할 텍스트
   * @returns 회피 패턴 분석 결과
   */
  analyze(text: string): EvasionPattern {
    if (!text || typeof text !== "string") {
      return this.createEmptyPattern();
    }

    const patterns: PATTERNS[] = [];
    let suspiciousScore = 0;

    // 1. Leetspeak 감지 (숫자/영문/특수문자 혼용)
    const hasLeetspeak = EvasionDetectors.detectLeetspeak(text);
    if (hasLeetspeak) {
      patterns.push(PATTERNS.LEETSPEAK);
      suspiciousScore += 0.3;
    }

    // 2. 반복 문자 감지
    const hasRepetition = EvasionDetectors.detectRepetition(text);
    if (hasRepetition) {
      patterns.push(PATTERNS.REPETITION);
      suspiciousScore += 0.2;
    }

    // 3. 자모 분리 감지
    const hasJamoSeparation = EvasionDetectors.detectJamoSeparation(text);
    if (hasJamoSeparation) {
      patterns.push(PATTERNS.JAMO_SEPARATION);
      suspiciousScore += 0.25;
    }

    // 4. Zero-width 문자 감지
    const hasZeroWidth = EvasionDetectors.detectZeroWidth(text);
    if (hasZeroWidth) {
      patterns.push(PATTERNS.ZERO_WIDTH);
      suspiciousScore += 0.3;
    }

    // 5. 공백 분리 패턴 감지
    const hasSpaceSeparation = EvasionDetectors.detectSpaceSeparation(text);
    if (hasSpaceSeparation) {
      patterns.push(PATTERNS.SPACE_SEPARATION);
      suspiciousScore += 0.3;
    }

    // 의심도 점수 정규화 (0-1 범위)
    suspiciousScore = Math.min(1, suspiciousScore);

    return {
      hasLeetspeak,
      hasRepetition,
      hasJamoSeparation,
      hasZeroWidth,
      hasSpaceSeparation,
      suspiciousScore,
      detectedPatterns: patterns,
    };
  }

  /**
   * 빈 패턴 생성
   */
  private createEmptyPattern(): EvasionPattern {
    return {
      hasLeetspeak: false,
      hasRepetition: false,
      hasJamoSeparation: false,
      hasZeroWidth: false,
      hasSpaceSeparation: false,
      suspiciousScore: 0,
      detectedPatterns: [],
    };
  }
}
