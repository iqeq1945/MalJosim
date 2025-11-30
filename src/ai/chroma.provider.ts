import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChromaClient } from "chromadb";

export const CHROMA_CLIENT = "CHROMA_CLIENT";

export const ChromaProvider: Provider = {
  provide: CHROMA_CLIENT,
  useFactory: (configService: ConfigService): ChromaClient => {
    const chromaUrl = configService.get<string>("CHROMA_URL");
    return new ChromaClient({
      path: chromaUrl,
    });
  },
  inject: [ConfigService],
};
