import { Severity } from "@prisma/client";

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
 * 필터링 결과 DTO
 */
export class FilterResponseDto {
  status: FilterStatus; // allow | warning | block
  text: string; // 원본 텍스트
  dictionaryScore: number; // 사전 기반 점수 (0-1)
  matchedWords: MatchedBadWord[]; // 매칭된 금칙어 목록
  totalMatches: number; // 매칭된 단어 개수
  hasEvasionPattern: boolean; // 회피 패턴 감지 여부
  suspiciousScore: number; // 의심도 점수 (0-1, 회피 패턴 기반)

  constructor(data: {
    status: FilterStatus;
    text: string;
    dictionaryScore: number;
    matchedWords: MatchedBadWord[];
    totalMatches: number;
    hasEvasionPattern: boolean;
    suspiciousScore: number;
  }) {
    this.status = data.status;
    this.text = data.text;
    this.dictionaryScore = data.dictionaryScore;
    this.matchedWords = data.matchedWords;
    this.totalMatches = data.totalMatches;
    this.hasEvasionPattern = data.hasEvasionPattern;
    this.suspiciousScore = data.suspiciousScore;
  }

  /**
   * 허용 상태로 생성
   */
  static allow(text: string): FilterResponseDto {
    return new FilterResponseDto({
      status: "allow",
      text,
      dictionaryScore: 0,
      matchedWords: [],
      totalMatches: 0,
      hasEvasionPattern: false,
      suspiciousScore: 0,
    });
  }

  /**
   * 경고 상태로 생성
   */
  static warning(
    text: string,
    matchedWords: MatchedBadWord[],
    dictionaryScore: number,
    suspiciousScore: number
  ): FilterResponseDto {
    return new FilterResponseDto({
      status: "warning",
      text,
      dictionaryScore,
      matchedWords,
      totalMatches: matchedWords.length,
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
    suspiciousScore: number
  ): FilterResponseDto {
    return new FilterResponseDto({
      status: "block",
      text,
      dictionaryScore,
      matchedWords,
      totalMatches: matchedWords.length,
      hasEvasionPattern: suspiciousScore > 0,
      suspiciousScore,
    });
  }
}
