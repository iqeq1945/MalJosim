import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LLMService } from "./llm.service";
import { OPENAI_API_KEY, OpenAIConfigProvider } from "./openai-config.provider";
import { OLLAMA_API_KEY, OllamaApiKeyProvider } from "./ollama-config.provider";

@Module({
  imports: [ConfigModule],
  providers: [OpenAIConfigProvider, OllamaApiKeyProvider, LLMService],
  exports: [OPENAI_API_KEY, OLLAMA_API_KEY, LLMService],
})
export class AIModule {}
