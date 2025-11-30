import { Global, Module } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { RedisProvider, REDIS_CLIENT } from "./redis.provider";

@Global()
@Module({
  providers: [RedisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
