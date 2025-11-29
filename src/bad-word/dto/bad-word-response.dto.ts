import { Severity, Category } from "@prisma/client";

/**
 * Bad Word Response DTO
 */
export class BadWordResponseDto {
  id: string;

  word: string;

  normalizedWord: string;

  severity: Severity;

  category: Category;

  isActive: boolean;

  aliases: string[] | null;

  createdAt: Date;

  updatedAt: Date;

  constructor(data: {
    id: string;
    word: string;
    normalizedWord: string;
    severity: Severity;
    category: Category;
    isActive: boolean;
    aliases: string[] | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.word = data.word;
    this.normalizedWord = data.normalizedWord;
    this.severity = data.severity;
    this.category = data.category;
    this.isActive = data.isActive;
    this.aliases = data.aliases as string[] | null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Prisma BadWord 모델에서 BadWordResponseDto 생성
   */
  static from(badWord: {
    id: string;
    word: string;
    normalizedWord: string;
    severity: Severity;
    category: Category;
    isActive: boolean;
    aliases: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): BadWordResponseDto {
    return new BadWordResponseDto({
      id: badWord.id,
      word: badWord.word,
      normalizedWord: badWord.normalizedWord,
      severity: badWord.severity,
      category: badWord.category,
      isActive: badWord.isActive,
      aliases: badWord.aliases as string[] | null,
      createdAt: badWord.createdAt,
      updatedAt: badWord.updatedAt,
    });
  }
}

/**
 * Bad Word List Response DTO
 */
export class BadWordListResponseDto {
  data: BadWordResponseDto[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;

  constructor(
    data: BadWordResponseDto[],
    total: number,
    page: number,
    limit: number
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
