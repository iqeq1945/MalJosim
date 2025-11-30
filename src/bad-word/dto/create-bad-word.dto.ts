import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
} from "class-validator";
import { Severity, Category, Prisma } from "@prisma/client";

/**
 * Create Bad Word DTO
 */
export class CreateBadWordDto {
  @IsString()
  @MaxLength(100)
  word: string;

  @IsString()
  @MaxLength(100)
  normalizedWord: string;

  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity = Severity.MEDIUM;

  @IsEnum(Category)
  @IsOptional()
  category?: Category = Category.OTHER;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  aliases?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  buildCreateData(): Prisma.BadWordCreateInput {
    return {
      word: this.word,
      normalizedWord: this.normalizedWord,
      severity: this.severity ?? Severity.MEDIUM,
      category: this.category ?? Category.OTHER,
      aliases: this.aliases ?? [],
      isActive: this.isActive ?? true,
    };
  }
}
