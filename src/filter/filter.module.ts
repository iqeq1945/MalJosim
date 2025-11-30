import { Module } from "@nestjs/common";
import { NormalizationService } from "./normalization/normalization.service";
import { EvasionAnalyzer } from "./normalization/evasion-analyzer";
import { TokenizationService } from "./tokenization/tokenization.service";
import { FilterService } from "./filter.service";
import { FilterController } from "./filter.controller";
import { CacheModule } from "../cache/cache.module";
import { AIModule } from "../ai/ai.module";

@Module({
  imports: [CacheModule, AIModule],
  controllers: [FilterController],
  providers: [
    NormalizationService,
    EvasionAnalyzer,
    TokenizationService,
    FilterService,
  ],
  exports: [
    NormalizationService,
    EvasionAnalyzer,
    TokenizationService,
    FilterService,
  ],
})
export class FilterModule {}
