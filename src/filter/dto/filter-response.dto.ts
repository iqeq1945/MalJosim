import { Severity } from "@prisma/client";
import { EvasionPattern } from "../normalization/evasion-analyzer";

/**
 * 필터링 결과 상태
 */
export type FilterStatus = "allow" | "warning" | "block";

/**
 * 매칭된 금칙어 정보
 */
export interface MatchedBadWord {
  word: string; // 원본 단어
  normalizedWord: string; // 정규화된 단어
  severity: Severity; // 심각도
  category: string; // 카테고리
  isPartialMatch?: boolean; // 부분 매칭 여부 (토큰 기준이 아닌 슬라이딩 윈도우 매칭)
}

/**
 * AI 판단 결과
 */
export interface AIJudgment {
  isProfanity: boolean; // 욕설 여부
  confidence: number; // 신뢰도 (0-1)
  reason?: string; // 판단 이유
}

/**
 * 필터링 결과 DTO
 */
export class FilterResponseDto {
  status: FilterStatus; // allow | warning | block
  text: string; // 원본 텍스트
  isProfanity: boolean; // 욕설 여부 (최종 판단)
  dictionaryScore: number; // 사전 기반 점수 (0-1)
  matchedWords: MatchedBadWord[]; // 매칭된 금칙어 목록
  aiJudgment?: AIJudgment; // AI 판단 결과 (있을 경우만)
  hasEvasionPattern: boolean; // 회피 패턴 감지 여부
  suspiciousScore: number; // 의심도 점수 (0-1, 회피 패턴 기반)

  constructor(data: {
    status: FilterStatus;
    text: string;
    isProfanity: boolean;
    dictionaryScore: number;
    matchedWords: MatchedBadWord[];
    aiJudgment?: AIJudgment;
    hasEvasionPattern: boolean;
    suspiciousScore: number;
  }) {
    this.status = data.status;
    this.text = data.text;
    this.isProfanity = data.isProfanity;
    this.dictionaryScore = data.dictionaryScore;
    this.matchedWords = data.matchedWords;
    this.aiJudgment = data.aiJudgment;
    this.hasEvasionPattern = data.hasEvasionPattern;
    this.suspiciousScore = data.suspiciousScore;
  }

  /**
   * 허용 상태로 생성
   */
  static allow(
    text: string,
    suspiciousScore: number = 0,
    aiJudgment?: AIJudgment
  ): FilterResponseDto {
    return new FilterResponseDto({
      status: "allow",
      text,
      isProfanity: aiJudgment?.isProfanity || false,
      dictionaryScore: 0,
      matchedWords: [],
      aiJudgment,
      hasEvasionPattern: suspiciousScore > 0,
      suspiciousScore,
    });
  }

  /**
   * 경고 상태로 생성
   */
  static warning(
    text: string,
    matchedWords: MatchedBadWord[],
    dictionaryScore: number,
    suspiciousScore: number,
    aiJudgment?: AIJudgment
  ): FilterResponseDto {
    // AI 판단이 있으면 그것을 우선, 없으면 사전 점수 기반으로 판단
    const isProfanity = aiJudgment?.isProfanity ?? dictionaryScore >= 0.3;

    return new FilterResponseDto({
      status: "warning",
      text,
      isProfanity,
      dictionaryScore,
      matchedWords,
      aiJudgment,
      hasEvasionPattern: suspiciousScore > 0,
      suspiciousScore,
    });
  }

  /**
   * 차단 상태로 생성
   */
  static block(
    text: string,
    matchedWords: MatchedBadWord[],
    dictionaryScore: number,
    suspiciousScore: number,
    aiJudgment?: AIJudgment
  ): FilterResponseDto {
    // 차단은 항상 욕설로 판단
    return new FilterResponseDto({
      status: "block",
      text,
      isProfanity: true,
      dictionaryScore,
      matchedWords,
      aiJudgment,
      hasEvasionPattern: suspiciousScore > 0,
      suspiciousScore,
    });
  }
}
