import { Injectable, Logger, Inject } from "@nestjs/common";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OPENAI_API_KEY } from "./openai-config.provider";

/**
 * Embedding 서비스
 *
 * OpenAI Embedding API를 사용하여 텍스트를 벡터로 변환합니다.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private embeddings: OpenAIEmbeddings;

  constructor(@Inject(OPENAI_API_KEY) private readonly apiKey: string) {
    if (!this.apiKey) {
      this.logger.warn(
        "OPENAI_API_KEY not found. EmbeddingService will not work."
      );
    } else {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.apiKey,
        modelName: "text-embedding-3-small", // 비용 효율적인 모델
      });
    }
  }

  /**
   * 텍스트를 임베딩 벡터로 변환합니다.
   *
   * @param text 변환할 텍스트
   * @returns 임베딩 벡터
   */
  async embed(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const result = await this.embeddings.embedQuery(text);
      return result;
    } catch (error) {
      this.logger.error(`Failed to embed text "${text}":`, error);
      throw error;
    }
  }

  /**
   * 여러 텍스트를 일괄 임베딩합니다.
   *
   * @param texts 텍스트 배열
   * @returns 임베딩 벡터 배열
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const results = await this.embeddings.embedDocuments(texts);
      return results;
    } catch (error) {
      this.logger.error("Failed to embed batch:", error);
      throw error;
    }
  }
}
