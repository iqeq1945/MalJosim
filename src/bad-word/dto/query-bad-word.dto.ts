import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { Severity, Category, Prisma } from "@prisma/client";

/**
 * Query Bad Word DTO
 */
export class QueryBadWordDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  buildQuery(): Prisma.BadWordWhereInput {
    const where: Prisma.BadWordWhereInput = {
      ...(this.category && { category: this.category }),
      ...(this.severity && { severity: this.severity }),
      ...(this.isActive !== undefined && { isActive: this.isActive }),
      ...(this.search && {
        OR: [
          { word: { contains: this.search, mode: "insensitive" } },
          { normalizedWord: { contains: this.search, mode: "insensitive" } },
        ],
      }),
    };
    return where;
  }
}
