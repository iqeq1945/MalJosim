import { Module, OnModuleInit } from "@nestjs/common";
import { NormalizationService } from "./normalization/normalization.service";
import { EvasionAnalyzer } from "./normalization/evasion-analyzer";
import { TokenizationService } from "./tokenization/tokenization.service";
import { TrieService } from "./trie/trie.service";
import { FilterService } from "./filter.service";
import { FilterController } from "./filter.controller";
import { CacheModule } from "../cache/cache.module";
import { CacheService } from "../cache/cache.service";
import { AIModule } from "../ai/ai.module";

@Module({
  imports: [CacheModule, AIModule],
  controllers: [FilterController],
  providers: [
    NormalizationService,
    EvasionAnalyzer,
    TokenizationService,
    TrieService,
    FilterService,
  ],
  exports: [
    NormalizationService,
    EvasionAnalyzer,
    TokenizationService,
    TrieService,
    FilterService,
  ],
})
export class FilterModule implements OnModuleInit {
  constructor(
    private readonly trieService: TrieService,
    private readonly cacheService: CacheService
  ) {}

  async onModuleInit() {
    // CacheService에 TrieService 설정 (순환 의존성 해결)
    this.cacheService.setTrieService(this.trieService);

    // Redis에 데이터가 있는지 확인
    const hasCache = await this.cacheService.checkRedisCache();

    if (hasCache) {
      // Redis에서 Trie 구축 (빠름)
      await this.cacheService.loadTrieFromRedis();
    } else {
      // PostgreSQL에서 Redis + Trie 구축 (안전)
      await this.cacheService.loadGlobalBadWords();
    }
  }
}
