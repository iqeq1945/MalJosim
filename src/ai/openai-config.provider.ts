import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const OPENAI_API_KEY = "OPENAI_API_KEY";

/**
 * OpenAI API Key Provider
 *
 * 환경 변수에서 OpenAI API Key를 가져와서 주입합니다.
 */
export const OpenAIConfigProvider: Provider = {
  provide: OPENAI_API_KEY,
  useFactory: (configService: ConfigService): string => {
    return configService.get<string>("OPENAI_API_KEY") || "";
  },
  inject: [ConfigService],
};
