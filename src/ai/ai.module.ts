import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { VectorStoreService } from "./vector-store.service";
import { EmbeddingService } from "./embedding.service";
import { LLMService } from "./llm.service";
import { CHROMA_CLIENT, ChromaProvider } from "./chroma.provider";
import { OPENAI_API_KEY, OpenAIConfigProvider } from "./openai-config.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    ChromaProvider,
    OpenAIConfigProvider,
    VectorStoreService,
    EmbeddingService,
    LLMService,
  ],
  exports: [
    CHROMA_CLIENT,
    OPENAI_API_KEY,
    VectorStoreService,
    EmbeddingService,
    LLMService,
  ],
})
export class AIModule {}
