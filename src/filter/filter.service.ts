import { Injectable, Optional, Logger } from "@nestjs/common";
import { NormalizationService } from "./normalization/normalization.service";
import { TokenizationService } from "./tokenization/tokenization.service";
import { TrieService } from "./trie/trie.service";
import { LLMService } from "../ai/llm.service";
import { FilterRequestDto } from "./dto/filter-request.dto";
import {
  FilterResponseDto,
  FilterStatus,
  MatchedBadWord,
} from "./dto/filter-response.dto";
import { Severity } from "@prisma/client";

/**
 * 필터링 서비스
 *
 * 텍스트를 분석하고 금칙어를 감지하여 필터링 결과를 반환합니다.
 * Normalization + Trie 기반 매칭 + LLM 문맥 판단 파이프라인을 통합합니다.
 */
@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);

  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly tokenizationService: TokenizationService,
    private readonly trieService: TrieService,
    @Optional() private readonly llmService?: LLMService
  ) {}

  /**
   * 텍스트를 필터링합니다.
   *
   * Fast Path First 전략:
   * 1. Fast Path: Trie 기반 매칭 (무료, 빠름)
   * 2. Fast Path에서 높은 심각도 매칭 시 즉시 차단
   * 3. Slow Path: 회피 패턴이 있거나 매칭이 없으면 AI 호출 (비용 발생)
   *
   * @param dto 필터링 요청 DTO
   * @returns 필터링 결과
   */
  async filter(dto: FilterRequestDto): Promise<FilterResponseDto> {
    const { text } = dto;
    // clientId는 요청에는 있지만 현재는 사용하지 않음

    if (!text || text.trim().length === 0) {
      return FilterResponseDto.allow(text || "");
    }

    // 1. 텍스트 분석 (회피 패턴 감지)
    const analysis = this.normalizationService.analyze(text);
    const suspiciousScore = analysis.evasionPatterns.suspiciousScore;

    // 2. 텍스트 정규화 (한 번만 수행하고 재사용)
    const normalizedText = this.normalizationService.normalize(text);

    // 3. 정규화된 텍스트에서 토큰 추출 (전체 단어 매칭 구분용)
    const normalizedTokens = this.tokenizationService.tokenize(normalizedText);

    // 4. Fast Path: Trie 기반 매칭 (항상 사용)
    const fastMatches = this.checkDictionaryWithTrie(
      normalizedText,
      normalizedTokens
    );

    // 4. 전체 단어 매칭과 부분 매칭 분리
    const fullMatches = fastMatches.filter((m) => !m.isPartialMatch);
    const partialMatches = fastMatches.filter((m) => m.isPartialMatch);

    // 5. 전체 단어 매칭이 있으면 높은 심각도 시 즉시 차단 (AI 호출 생략)
    if (fullMatches.length > 0) {
      const fullScore = this.calculateDictionaryScore(fullMatches);
      if (fullScore >= 0.7) {
        return FilterResponseDto.block(
          text,
          fastMatches,
          fullScore,
          suspiciousScore
        );
      }
    }

    // 6. Slow Path: AI 호출 조건 체크
    const shouldCallAI =
      suspiciousScore > 0.3 || // 회피 패턴이 있으면
      (fastMatches.length === 0 && text.length <= 20) || // 매칭 없고 짧은 텍스트면
      (partialMatches.length > 0 && fullMatches.length === 0); // 부분 매칭만 있으면 AI로 맥락 판단

    let allMatches = [...fastMatches];
    let enhancedSuspiciousScore = suspiciousScore;

    if (shouldCallAI && this.llmService) {
      try {
        // AI가 문맥 기반으로 욕설 여부 판단
        const aiJudgment = await this.llmService.judgeProfanity(
          analysis.original,
          analysis.evasionPatterns
        );

        if (aiJudgment.isProfanity) {
          // AI가 욕설로 판단한 경우 confidence를 suspiciousScore에 반영
          enhancedSuspiciousScore = Math.max(
            suspiciousScore,
            aiJudgment.confidence
          );
          this.logger.debug(
            `AI judgment: isProfanity=${aiJudgment.isProfanity}, confidence=${aiJudgment.confidence}, reason=${aiJudgment.reason}`
          );
        }
      } catch (error) {
        // AI 실패 시 Fast Path 결과만 사용
        this.logger.warn(
          "AI judgment failed, using Fast Path result only:",
          error
        );
      }
    }

    // 7. 점수 계산 및 최종 판정
    const dictionaryScore = this.calculateDictionaryScore(allMatches);
    const status = this.determineStatus(
      dictionaryScore,
      enhancedSuspiciousScore
    );

    // 8. 결과 반환
    return this.createResponse(
      status,
      text,
      allMatches,
      dictionaryScore,
      enhancedSuspiciousScore
    );
  }

  /**
   * 필터링 결과를 생성합니다.
   *
   * @param status 필터링 상태
   * @param text 원본 텍스트
   * @param matchedWords 매칭된 금칙어 목록
   * @param dictionaryScore 사전 기반 점수
   * @param suspiciousScore 의심도 점수
   * @returns 필터링 결과 DTO
   */
  private createResponse(
    status: FilterStatus,
    text: string,
    matchedWords: MatchedBadWord[],
    dictionaryScore: number,
    suspiciousScore: number
  ): FilterResponseDto {
    switch (status) {
      case "allow":
        return FilterResponseDto.allow(text);
      case "warning":
        return FilterResponseDto.warning(
          text,
          matchedWords,
          dictionaryScore,
          suspiciousScore
        );
      case "block":
        return FilterResponseDto.block(
          text,
          matchedWords,
          dictionaryScore,
          suspiciousScore
        );
    }
  }

  /**
   * Trie를 사용하여 텍스트에서 매칭된 금칙어를 찾습니다.
   *
   * @param normalizedText 정규화된 텍스트
   * @param normalizedTokens 정규화된 토큰 배열 (전체 단어 매칭 구분용)
   * @returns 매칭된 금칙어 목록 (부분 매칭 여부 포함)
   */
  private checkDictionaryWithTrie(
    normalizedText: string,
    normalizedTokens: string[]
  ): MatchedBadWord[] {
    // Trie에서 모든 매칭 찾기 (위치 정보 포함)
    const trieMatches = this.trieService.findAllMatches(normalizedText);

    // 토큰의 위치 정보 계산 (부분 매칭 판단용)
    const tokenPositions = this.calculateTokenPositions(
      normalizedText,
      normalizedTokens
    );

    const matchedWords: MatchedBadWord[] = [];
    const seen = new Set<string>(); // 중복 제거용

    for (const match of trieMatches) {
      const key = `${match.normalizedWord}:${match.startIndex}:${match.endIndex}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // 부분 매칭 여부 판단
      // 매칭된 단어의 위치(startIndex, endIndex)가 토큰의 경계와 정확히 일치하면 전체 매칭
      const isPartialMatch = !this.isFullWordMatch(
        match.startIndex,
        match.endIndex,
        tokenPositions
      );

      matchedWords.push({
        word: match.word,
        normalizedWord: match.normalizedWord,
        severity: match.severity as Severity,
        category: "", // Trie에 저장되지 않음, 필요시 확장
        isPartialMatch,
      });
    }

    return matchedWords;
  }

  /**
   * 토큰의 위치 정보를 계산합니다.
   *
   * @param text 전체 텍스트
   * @param tokens 토큰 배열
   * @returns 토큰별 시작/끝 위치 정보
   */
  private calculateTokenPositions(
    text: string,
    tokens: string[]
  ): Array<{ startIndex: number; endIndex: number; token: string }> {
    const positions: Array<{
      startIndex: number;
      endIndex: number;
      token: string;
    }> = [];

    // 정규화된 텍스트에서 각 토큰의 정확한 위치 찾기
    let searchIndex = 0;

    for (const token of tokens) {
      // 텍스트에서 토큰 찾기 (공백 고려)
      const tokenIndex = text.indexOf(token, searchIndex);

      if (tokenIndex !== -1) {
        // 토큰 앞뒤가 공백이거나 텍스트의 시작/끝인지 확인 (전체 단어 매칭)
        const beforeChar = tokenIndex > 0 ? text[tokenIndex - 1] : " ";
        const afterChar =
          tokenIndex + token.length < text.length
            ? text[tokenIndex + token.length]
            : " ";

        // 공백으로 구분된 단어인지 확인
        if (/\s/.test(beforeChar) && /\s/.test(afterChar)) {
          positions.push({
            startIndex: tokenIndex,
            endIndex: tokenIndex + token.length,
            token,
          });
        }

        // 다음 검색 위치 업데이트
        searchIndex = tokenIndex + token.length;
      }
    }

    return positions;
  }

  /**
   * 매칭된 단어가 전체 단어 매칭인지 확인합니다.
   *
   * @param startIndex 매칭된 단어의 시작 위치
   * @param endIndex 매칭된 단어의 끝 위치
   * @param tokenPositions 토큰 위치 정보
   * @returns 전체 단어 매칭이면 true, 부분 매칭이면 false
   */
  private isFullWordMatch(
    startIndex: number,
    endIndex: number,
    tokenPositions: Array<{
      startIndex: number;
      endIndex: number;
      token: string;
    }>
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

  /**
   * 사전 기반 점수를 계산합니다.
   *
   * 매칭된 단어들의 심각도를 기반으로 점수를 계산합니다.
   * 부분 매칭은 가중치를 50% 감소시킵니다.
   *
   * @param matchedWords 매칭된 금칙어 목록
   * @returns 점수 (0-1)
   */
  private calculateDictionaryScore(matchedWords: MatchedBadWord[]): number {
    if (matchedWords.length === 0) {
      return 0;
    }

    // 심각도별 가중치
    const severityWeights: Record<Severity, number> = {
      LOW: 0.2,
      MEDIUM: 0.5,
      HIGH: 0.8,
      CRITICAL: 1.0,
    };

    // 각 단어의 심각도 가중치를 합산
    let totalWeight = 0;
    for (const word of matchedWords) {
      let weight = severityWeights[word.severity] || 0;

      // 부분 매칭은 가중치 50% 감소
      if (word.isPartialMatch) {
        weight *= 0.5;
      }

      totalWeight += weight;
    }

    // 평균 가중치 계산 (0-1 범위로 정규화)
    const avgWeight = totalWeight / matchedWords.length;

    // 매칭 개수에 따른 보너스 (최대 1.0)
    // 부분 매칭은 보너스에도 반영하지 않음
    const fullMatchCount = matchedWords.filter((w) => !w.isPartialMatch).length;
    const countBonus = Math.min(fullMatchCount * 0.1, 0.3);

    return Math.min(1.0, avgWeight + countBonus);
  }

  /**
   * 최종 상태를 결정합니다.
   *
   * @param dictionaryScore 사전 기반 점수 (0-1)
   * @param suspiciousScore 의심도 점수 (0-1)
   * @returns 필터링 상태
   */
  private determineStatus(
    dictionaryScore: number,
    suspiciousScore: number
  ): FilterStatus {
    // 사전 점수가 높으면 차단
    if (dictionaryScore >= 0.7) {
      return "block";
    }

    // 사전 점수 + 의심도 점수가 높으면 차단
    const combinedScore = dictionaryScore * 0.7 + suspiciousScore * 0.3;
    if (combinedScore >= 0.6) {
      return "block";
    }

    // 사전 점수나 의심도가 있으면 경고
    if (dictionaryScore > 0 || suspiciousScore > 0.3) {
      return "warning";
    }

    // 그 외는 허용
    return "allow";
  }
}
