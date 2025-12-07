import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { CacheModule } from "./cache/cache.module";
import { HealthModule } from "./health/health.module";
import { BadWordModule } from "./bad-word/bad-word.module";
import { FilterModule } from "./filter/filter.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    CacheModule,
    HealthModule,
    BadWordModule,
    FilterModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
