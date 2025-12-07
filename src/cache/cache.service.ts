import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../database/prisma.service";
import { CacheKeys } from "./cache-keys";
import { REDIS_CLIENT } from "./redis.provider";
import { TrieService } from "../filter/trie/trie.service";

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private trieService: TrieService | undefined;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService
  ) {}

  /**
   * TrieService를 설정합니다 (순환 의존성 해결을 위해 별도 메서드로 분리)
   */
  setTrieService(trieService: TrieService): void {
    this.trieService = trieService;
  }

  async onModuleInit() {
    // Redis에 데이터가 있는지 확인
    const hasCache = await this.checkRedisCache();

    if (hasCache) {
      // Redis에 데이터 있음 → FilterModule에서 Trie만 구축
      this.logger.log("Redis cache found, Trie will be loaded from Redis");
    } else {
      // Redis 비어있음 → PostgreSQL에서 로드
      this.logger.log("Redis cache empty, loading from PostgreSQL");
      await this.loadGlobalBadWords(false); // Redis만 저장, Trie는 나중에
    }
    this.logger.log("Cache initialized");
  }

  /**
   * PostgreSQL에서 활성 금칙어를 로드하여 Redis에 저장
   *
   * @param includeTrie Trie에도 추가할지 여부 (기본값: true)
   */
  async loadGlobalBadWords(includeTrie: boolean = true): Promise<void> {
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

      // Trie에도 추가 (TrieService가 설정된 경우이고 includeTrie가 true인 경우)
      if (includeTrie && this.trieService) {
        for (const word of badWords) {
          this.trieService.addWord(word.normalizedWord, {
            word: word.word,
            normalizedWord: word.normalizedWord,
            id: word.id,
            severity: word.severity,
          });
        }
        this.logger.log(`Loaded ${badWords.length} bad words into Trie`);
      }
    } catch (error) {
      this.logger.error("Failed to load bad words into cache:", error);
      throw error;
    }
  }

  /**
   * Redis 캐시에 데이터가 있는지 확인
   */
  async checkRedisCache(): Promise<boolean> {
    try {
      const exists = await this.redis.exists(CacheKeys.globalBadWords());
      return exists > 0;
    } catch (error) {
      this.logger.error("Failed to check Redis cache:", error);
      return false;
    }
  }

  /**
   * Redis에서 Trie 구축
   */
  async loadTrieFromRedis(): Promise<void> {
    if (!this.trieService) {
      return;
    }

    try {
      // Redis에서 모든 정규화된 단어 가져오기
      const normalizedWords = await this.redis.smembers(
        CacheKeys.globalBadWords()
      );

      if (normalizedWords.length === 0) {
        this.logger.warn(
          "Redis cache is empty, loading from PostgreSQL instead"
        );
        await this.loadGlobalBadWords(); // PostgreSQL에서 로드
        return;
      }

      // 각 단어의 상세 정보를 가져와서 Trie에 추가
      for (const normalizedWord of normalizedWords) {
        const wordInfo = await this.getWordByNormalized(normalizedWord);
        if (wordInfo) {
          this.trieService.addWord(normalizedWord, {
            word: wordInfo.word,
            normalizedWord: normalizedWord,
            id: wordInfo.id,
            severity: wordInfo.severity,
          });
        }
      }

      this.logger.log(
        `Loaded ${normalizedWords.length} bad words into Trie from Redis`
      );
    } catch (error) {
      this.logger.error(
        "Failed to load Trie from Redis, loading from PostgreSQL:",
        error
      );
      // Redis 로드 실패 시 PostgreSQL에서 로드
      await this.loadGlobalBadWords();
    }
  }

  /**
   * 단어가 금칙어인지 확인
   */
  async isBadWord(normalizedWord: string): Promise<boolean> {
    const result = await this.redis.sismember(
      CacheKeys.globalBadWords(),
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

    // Trie에도 추가
    if (this.trieService) {
      this.trieService.addWord(word.normalizedWord, {
        word: word.word,
        normalizedWord: word.normalizedWord,
        id: word.id,
        severity: word.severity,
      });
    }
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

    // Trie도 업데이트
    if (this.trieService) {
      if (oldNormalized && oldNormalized !== word.normalizedWord) {
        this.trieService.removeWord(oldNormalized);
      }
      if (word.isActive) {
        this.trieService.addWord(word.normalizedWord, {
          word: word.word,
          normalizedWord: word.normalizedWord,
          id: word.id,
          severity: word.severity,
        });
      } else {
        this.trieService.removeWord(word.normalizedWord);
      }
    }
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

    // Trie에서도 제거
    if (this.trieService) {
      this.trieService.removeWord(normalizedWord);
    }
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
