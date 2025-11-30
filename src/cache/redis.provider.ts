import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    const redis = new Redis({
      host: configService.get<string>("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
      password: configService.get<string>("REDIS_PASSWORD", undefined),
      db: configService.get<number>("REDIS_DB", 0),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });

    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });

    return redis;
  },
  inject: [ConfigService],
};
