import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../database/prisma.service";
import { CacheKeys } from "./cache-keys";
import { REDIS_CLIENT } from "./redis.provider";

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    await this.loadGlobalBadWords();
    this.logger.log("Cache initialized from database");
  }

  /**
   * PostgreSQL에서 활성 금칙어를 로드하여 Redis에 저장
   */
  async loadGlobalBadWords(): Promise<void> {
    try {
      const badWords = await this.prisma.badWord.findMany({
        where: { isActive: true },
      });

      const pipeline = this.redis.pipeline();

      // 기존 글로벌 키 삭제
      pipeline.del(CacheKeys.globalBadWords());

      for (const word of badWords) {
        // 글로벌 Set에 추가
        pipeline.sadd(CacheKeys.globalBadWords(), word.normalizedWord);

        // 정규화된 단어 → 원본 단어 매핑
        pipeline.hset(
          CacheKeys.normalizedWordMapping(word.normalizedWord),
          "word",
          word.word
        );
        pipeline.hset(
          CacheKeys.normalizedWordMapping(word.normalizedWord),
          "id",
          word.id
        );
        pipeline.hset(
          CacheKeys.normalizedWordMapping(word.normalizedWord),
          "severity",
          word.severity
        );

        // 단어 상세 정보
        pipeline.hset(CacheKeys.wordDetail(word.id), {
          id: word.id,
          word: word.word,
          normalizedWord: word.normalizedWord,
          severity: word.severity,
          category: word.category,
          isActive: String(word.isActive),
        });
      }

      await pipeline.exec();
      this.logger.log(`Loaded ${badWords.length} bad words into cache`);
    } catch (error) {
      this.logger.error("Failed to load bad words into cache:", error);
      throw error;
    }
  }

  /**
   * 클라이언트별 금칙어 로드
   */
  async loadClientBadWords(clientId: string): Promise<void> {
    try {
      const clientBadWords = await this.prisma.clientBadWord.findMany({
        where: {
          clientId,
          isActive: true,
        },
        include: {
          badWord: true,
        },
      });

      const pipeline = this.redis.pipeline();
      pipeline.del(CacheKeys.clientBadWords(clientId));

      for (const cbw of clientBadWords) {
        pipeline.sadd(
          CacheKeys.clientBadWords(clientId),
          cbw.badWord.normalizedWord
        );
      }

      await pipeline.exec();
      this.logger.log(
        `Loaded ${clientBadWords.length} client bad words for ${clientId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to load client bad words for ${clientId}:`,
        error
      );
    }
  }

  /**
   * 단어가 금칙어인지 확인 (글로벌)
   */
  async isBadWord(normalizedWord: string): Promise<boolean> {
    const result = await this.redis.sismember(
      CacheKeys.globalBadWords(),
      normalizedWord
    );
    return result === 1;
  }

  /**
   * 단어가 금칙어인지 확인 (클라이언트별)
   */
  async isClientBadWord(
    clientId: string,
    normalizedWord: string
  ): Promise<boolean> {
    const result = await this.redis.sismember(
      CacheKeys.clientBadWords(clientId),
      normalizedWord
    );
    return result === 1;
  }

  /**
   * 정규화된 단어로 원본 단어 정보 조회
   */
  async getWordByNormalized(normalizedWord: string): Promise<{
    word: string;
    id: string;
    severity: string;
  } | null> {
    const data = await this.redis.hgetall(
      CacheKeys.normalizedWordMapping(normalizedWord)
    );

    if (!data || !data.word) {
      return null;
    }

    return {
      word: data.word,
      id: data.id,
      severity: data.severity,
    };
  }

  /**
   * 금칙어 추가 (Write-through)
   */
  async addBadWord(word: {
    id: string;
    word: string;
    normalizedWord: string;
    severity: string;
    category: string;
    isActive: boolean;
  }): Promise<void> {
    if (!word.isActive) {
      return;
    }

    const pipeline = this.redis.pipeline();
    pipeline.sadd(CacheKeys.globalBadWords(), word.normalizedWord);
    pipeline.hset(CacheKeys.normalizedWordMapping(word.normalizedWord), {
      word: word.word,
      id: word.id,
      severity: word.severity,
    });
    pipeline.hset(CacheKeys.wordDetail(word.id), {
      id: word.id,
      word: word.word,
      normalizedWord: word.normalizedWord,
      severity: word.severity,
      category: word.category,
      isActive: String(word.isActive),
    });

    await pipeline.exec();
  }

  /**
   * 금칙어 업데이트 (Write-through)
   */
  async updateBadWord(word: {
    id: string;
    word: string;
    normalizedWord: string;
    severity: string;
    category: string;
    isActive: boolean;
  }): Promise<void> {
    // 기존 정규화된 단어 찾기 (변경될 수 있음)
    const oldDetail = await this.redis.hgetall(CacheKeys.wordDetail(word.id));
    const oldNormalized = oldDetail?.normalizedWord;

    const pipeline = this.redis.pipeline();

    if (oldNormalized && oldNormalized !== word.normalizedWord) {
      // 정규화된 단어가 변경된 경우
      pipeline.srem(CacheKeys.globalBadWords(), oldNormalized);
      pipeline.del(CacheKeys.normalizedWordMapping(oldNormalized));
    }

    if (word.isActive) {
      pipeline.sadd(CacheKeys.globalBadWords(), word.normalizedWord);
      pipeline.hset(CacheKeys.normalizedWordMapping(word.normalizedWord), {
        word: word.word,
        id: word.id,
        severity: word.severity,
      });
    } else {
      pipeline.srem(CacheKeys.globalBadWords(), word.normalizedWord);
    }

    pipeline.hset(CacheKeys.wordDetail(word.id), {
      id: word.id,
      word: word.word,
      normalizedWord: word.normalizedWord,
      severity: word.severity,
      category: word.category,
      isActive: String(word.isActive),
    });

    await pipeline.exec();
  }

  /**
   * 금칙어 삭제 (Write-through)
   */
  async removeBadWord(wordId: string, normalizedWord: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.srem(CacheKeys.globalBadWords(), normalizedWord);
    pipeline.del(CacheKeys.normalizedWordMapping(normalizedWord));
    pipeline.del(CacheKeys.wordDetail(wordId));
    await pipeline.exec();
  }

  /**
   * Redis 연결 종료
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Redis 클라이언트 직접 접근 (필요시)
   */
  getClient(): Redis {
    return this.redis;
  }
}
