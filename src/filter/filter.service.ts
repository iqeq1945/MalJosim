import { Injectable, Optional } from "@nestjs/common";
import { NormalizationService } from "./normalization/normalization.service";
import { TokenizationService } from "./tokenization/tokenization.service";
import { CacheService } from "../cache/cache.service";
import { RAGService } from "../ai/rag.service";
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
 * Normalization + AI (RAG) + Tokenization + Cache 매칭 파이프라인을 통합합니다.
 */
@Injectable()
export class FilterService {
  constructor(
    private readonly normalizationService: NormalizationService,
    private readonly tokenizationService: TokenizationService,
    private readonly cacheService: CacheService,
    @Optional() private readonly ragService?: RAGService
  ) {}

  /**
   * 텍스트를 필터링합니다.
   *
   * Fast Path First 전략:
   * 1. Fast Path: Tokenization + Redis 매칭 (무료, 빠름)
   * 2. Fast Path에서 높은 심각도 매칭 시 즉시 차단
   * 3. Slow Path: 회피 패턴이 있거나 매칭이 없으면 AI 호출 (비용 발생)
   *
   * @param dto 필터링 요청 DTO
   * @returns 필터링 결과
   */
  async filter(dto: FilterRequestDto): Promise<FilterResponseDto> {
    const { text, clientId } = dto;

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

    // 4. Fast Path: 정규화된 텍스트에서 후보 추출
    const fastCandidates =
      this.tokenizationService.extractCandidates(normalizedText);

    const fastMatches = await this.checkDictionary(
      fastCandidates,
      normalizedTokens, // 토큰 목록 전달 (부분 매칭 구분용)
      clientId
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

    if (shouldCallAI && this.ragService) {
      try {
        // AI로 후보 추출 및 정규화
        const aiCandidates = await this.ragService.extractCandidates(text);
        const normalizedAiCandidates =
          this.normalizationService.normalizeBatch(aiCandidates);

        // AI가 추출한 후보들도 Redis에서 매칭 확인
        const aiMatches = await this.checkDictionary(
          normalizedAiCandidates,
          normalizedTokens,
          clientId
        );

        // Fast Path와 AI 결과 통합 (중복 제거)
        allMatches = this.mergeMatches(fastMatches, aiMatches);
      } catch (error) {
        // AI 실패 시 Fast Path 결과만 사용
        // 에러 로깅은 RAG Service에서 처리됨
      }
    }

    // 7. 점수 계산 및 최종 판정
    const dictionaryScore = this.calculateDictionaryScore(allMatches);
    const status = this.determineStatus(dictionaryScore, suspiciousScore);

    // 8. 결과 반환
    return this.createResponse(
      status,
      text,
      allMatches,
      dictionaryScore,
      suspiciousScore
    );
  }

  /**
   * 두 매칭 결과를 통합합니다 (중복 제거).
   *
   * @param matches1 첫 번째 매칭 결과
   * @param matches2 두 번째 매칭 결과
   * @returns 통합된 매칭 결과 (중복 제거)
   */
  private mergeMatches(
    matches1: MatchedBadWord[],
    matches2: MatchedBadWord[]
  ): MatchedBadWord[] {
    const merged = new Map<string, MatchedBadWord>();
    [...matches1, ...matches2].forEach((match) => {
      const key = match.normalizedWord;
      if (!merged.has(key)) {
        merged.set(key, match);
      }
    });
    return Array.from(merged.values());
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
   * 후보 단어들을 Redis에서 매칭 확인합니다.
   *
   * @param normalizedCandidates 정규화된 후보 단어 배열
   * @param normalizedTokens 정규화된 토큰 배열 (전체 단어 매칭 구분용)
   * @param clientId 클라이언트 ID (선택적)
   * @returns 매칭된 금칙어 목록 (부분 매칭 여부 포함)
   */
  private async checkDictionary(
    normalizedCandidates: string[],
    normalizedTokens: string[],
    clientId?: string
  ): Promise<MatchedBadWord[]> {
    if (normalizedCandidates.length === 0) {
      return [];
    }

    const matchedWords: MatchedBadWord[] = [];
    const tokenSet = new Set(normalizedTokens); // 빠른 조회용 Set

    for (const candidate of normalizedCandidates) {
      // 정규화된 후보 단어로 Redis 매칭
      const isBad = clientId
        ? await this.cacheService.isClientBadWord(clientId, candidate)
        : await this.cacheService.isBadWord(candidate);

      if (isBad) {
        // 매칭된 단어의 상세 정보 조회
        const wordInfo = await this.cacheService.getWordByNormalized(candidate);

        if (wordInfo) {
          // 중복 제거 (같은 단어가 여러 번 매칭될 수 있음)
          const existing = matchedWords.find(
            (m) => m.normalizedWord === candidate
          );

          if (!existing) {
            // 부분 매칭 여부 판단
            // 토큰에 정확히 일치하면 전체 단어 매칭, 아니면 부분 매칭
            const isPartialMatch = !tokenSet.has(candidate);

            matchedWords.push({
              word: wordInfo.word,
              normalizedWord: candidate,
              severity: wordInfo.severity as Severity,
              category: "", // Redis에 저장되지 않음, 필요시 확장
              isPartialMatch,
            });
          }
        }
      }
    }

    return matchedWords;
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
