import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const OLLAMA_API_KEY = "OLLAMA_API_KEY";

/**
 * Ollama API Key Provider
 *
 * 환경 변수에서 Ollama API Key를 가져와서 주입합니다.
 */
export const OllamaApiKeyProvider: Provider = {
  provide: OLLAMA_API_KEY,
  useFactory: (configService: ConfigService): string => {
    return configService.get<string>("OLLAMA_API_KEY") || "";
  },
  inject: [ConfigService],
};
