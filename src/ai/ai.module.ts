import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { VectorStoreService } from "./vector-store.service";
import { EmbeddingService } from "./embedding.service";
import { LLMService } from "./llm.service";
import { RAGService } from "./rag.service";
import { FilterModule } from "../filter/filter.module";
import { CHROMA_CLIENT, ChromaProvider } from "./chroma.provider";
import { OPENAI_API_KEY, OpenAIConfigProvider } from "./openai-config.provider";

@Module({
  imports: [ConfigModule, FilterModule],
  providers: [
    ChromaProvider,
    OpenAIConfigProvider,
    VectorStoreService,
    EmbeddingService,
    LLMService,
    RAGService,
  ],
  exports: [
    CHROMA_CLIENT,
    OPENAI_API_KEY,
    VectorStoreService,
    EmbeddingService,
    LLMService,
    RAGService,
  ],
})
export class AIModule {}
