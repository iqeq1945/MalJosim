import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MaxLength,
} from "class-validator";
import { Severity, Category, Prisma } from "@prisma/client";

/**
 * Update Bad Word DTO
 */
export class UpdateBadWordDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  word?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  normalizedWord?: string;

  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity;

  @IsEnum(Category)
  @IsOptional()
  category?: Category;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  buildUpdateData(): Partial<Prisma.BadWordUpdateInput> {
    return {
      ...(this.word && { word: this.word }),
      ...(this.normalizedWord && { normalizedWord: this.normalizedWord }),
      ...(this.severity && { severity: this.severity }),
      ...(this.category && { category: this.category }),
      ...(this.isActive !== undefined && { isActive: this.isActive }),
    };
  }
}
