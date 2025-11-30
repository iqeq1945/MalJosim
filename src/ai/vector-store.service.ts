import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";
import { EmbeddingService } from "./embedding.service";
import { CHROMA_CLIENT } from "./chroma.provider";
import { OPENAI_API_KEY } from "./openai-config.provider";

/**
 * Vector Store 서비스
 *
 * ChromaDB를 사용하여 금칙어 임베딩을 저장하고 검색합니다.
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private collectionName = "bad_words";
  private embeddingFunction: OpenAIEmbeddingFunction | null = null;

  constructor(
    @Inject(CHROMA_CLIENT) private readonly client: ChromaClient,
    @Inject(OPENAI_API_KEY) private readonly apiKey: string
  ) {}

  async onModuleInit() {
    try {
      // Embedding Function 설정 (OpenAI API Key가 있으면)
      if (this.apiKey) {
        this.embeddingFunction = new OpenAIEmbeddingFunction({
          openai_api_key: this.apiKey,
        });
      }

      // 컬렉션 생성 또는 가져오기
      await this.ensureCollection();
      this.logger.log("VectorStore initialized");
    } catch (error) {
      this.logger.error("Failed to initialize VectorStore:", error);
      // VectorStore 초기화 실패해도 서비스는 계속 동작 (AI 없이도 필터링 가능)
      this.logger.warn("VectorStore will be disabled");
    }
  }

  /**
   * 컬렉션이 존재하는지 확인하고 없으면 생성합니다.
   */
  private async ensureCollection() {
    try {
      await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction || undefined,
      });
    } catch (error) {
      // 컬렉션이 없으면 생성
      await this.client.createCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction || undefined,
      });
      this.logger.log(`Collection created: ${this.collectionName}`);
    }
  }

  /**
   * 금칙어를 벡터 스토어에 추가합니다.
   *
   * @param word 금칙어
   * @param embedding 임베딩 벡터
   * @param metadata 메타데이터 (severity, category 등)
   */
  async addBadWord(
    word: string,
    embedding: number[],
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction || undefined,
      });

      await collection.add({
        ids: [word],
        embeddings: [embedding],
        metadatas: metadata ? [metadata] : undefined,
      });
    } catch (error) {
      this.logger.error(`Failed to add bad word "${word}":`, error);
      throw error;
    }
  }

  /**
   * 유사한 금칙어를 검색합니다.
   *
   * @param queryEmbedding 쿼리 임베딩 벡터
   * @param topK 상위 K개 결과 반환 (기본값: 5)
   * @returns 검색 결과 (word, distance, metadata)
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<
    Array<{
      word: string;
      distance: number;
      metadata?: Record<string, any>;
    }>
  > {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction || undefined,
      });

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
      });

      if (!results.ids || results.ids.length === 0) {
        return [];
      }

      const words = results.ids[0] as string[];
      const distances = results.distances?.[0] || [];
      const metadatas = results.metadatas?.[0] || [];

      return words.map((word, index) => ({
        word,
        distance: distances[index] || 0,
        metadata: metadatas[index],
      }));
    } catch (error) {
      this.logger.error("Failed to search similar words:", error);
      return [];
    }
  }

  /**
   * 금칙어를 벡터 스토어에서 삭제합니다.
   *
   * @param word 금칙어
   */
  async removeBadWord(word: string): Promise<void> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction || undefined,
      });

      await collection.delete({
        ids: [word],
      });
    } catch (error) {
      this.logger.error(`Failed to remove bad word "${word}":`, error);
      // 삭제 실패해도 예외를 던지지 않음 (없는 단어일 수 있음)
    }
  }

  /**
   * 모든 금칙어를 벡터 스토어에서 삭제합니다.
   */
  async clearAll(): Promise<void> {
    try {
      await this.client.deleteCollection({
        name: this.collectionName,
      });
      await this.ensureCollection();
      this.logger.log("VectorStore cleared");
    } catch (error) {
      this.logger.error("Failed to clear VectorStore:", error);
      throw error;
    }
  }
}
