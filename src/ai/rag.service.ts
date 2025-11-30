import { Injectable, Logger } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { LLMService } from "./llm.service";
import { VectorStoreService } from "./vector-store.service";
import { NormalizationService } from "../filter/normalization/normalization.service";

/**
 * RAG 서비스
 *
 * Retrieval-Augmented Generation을 사용하여 욕설 후보 단어를 추출합니다.
 * 1. LLM으로 후보 단어 추출
 * 2. VectorStore에서 유사한 금칙어 검색
 * 3. 결과 통합
 */
@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly llmService: LLMService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly normalizationService: NormalizationService
  ) {}

  /**
   * 텍스트에서 욕설 후보 단어를 추출합니다.
   *
   * @param text 분석할 텍스트
   * @returns 후보 단어 배열
   */
  async extractCandidates(text: string): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      // 1. 텍스트 분석 (회피 패턴 감지)
      const analysis = this.normalizationService.analyze(text);

      // 2. LLM으로 후보 단어 추출
      const llmCandidates = await this.llmService.extractCandidates(
        analysis.original,
        analysis.evasionPatterns
      );

      // 3. VectorStore에서 유사한 금칙어 검색 (선택적)
      // 텍스트를 임베딩하여 유사한 단어 검색
      let vectorCandidates: string[] = [];
      try {
        const textEmbedding = await this.embeddingService.embed(
          analysis.original
        );
        const similarWords = await this.vectorStoreService.searchSimilar(
          textEmbedding,
          3
        );

        // 유사도가 높은 단어만 후보에 추가
        vectorCandidates = similarWords
          .filter((item) => item.distance < 0.3) // 임계값 조정 가능
          .map((item) => item.word);
      } catch (error) {
        this.logger.warn("VectorStore search failed, skipping:", error);
      }

      // 4. 결과 통합 및 중복 제거
      const allCandidates = new Set<string>();
      llmCandidates.forEach((word) => allCandidates.add(word));
      vectorCandidates.forEach((word) => allCandidates.add(word));

      const candidates = Array.from(allCandidates);

      this.logger.debug(
        `Extracted ${candidates.length} candidates from text: "${text.substring(0, 50)}..."`
      );

      return candidates;
    } catch (error) {
      this.logger.error("Failed to extract candidates:", error);
      return [];
    }
  }

  /**
   * 여러 텍스트를 일괄 처리하여 후보를 추출합니다.
   *
   * @param texts 텍스트 배열
   * @returns 후보 단어 배열 (중복 제거)
   */
  async extractCandidatesBatch(texts: string[]): Promise<string[]> {
    const allCandidates = new Set<string>();

    for (const text of texts) {
      const candidates = await this.extractCandidates(text);
      candidates.forEach((word) => allCandidates.add(word));
    }

    return Array.from(allCandidates);
  }
}
