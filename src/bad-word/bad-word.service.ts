import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateBadWordDto } from "./dto/create-bad-word.dto";
import { UpdateBadWordDto } from "./dto/update-bad-word.dto";
import { QueryBadWordDto } from "./dto/query-bad-word.dto";
import {
  BadWordResponseDto,
  BadWordListResponseDto,
} from "./dto/bad-word-response.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class BadWordService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBadWordDto): Promise<BadWordResponseDto> {
    // 중복 체크 (word는 unique)
    const existing = await this.prisma.badWord.findUnique({
      where: { word: dto.word },
    });

    if (existing) {
      throw new ConflictException(
        `Bad word with word "${dto.word}" already exists`
      );
    }

    const badWord = await this.prisma.badWord.create({
      data: dto.buildCreateData(),
    });

    return BadWordResponseDto.from(badWord);
  }

  async findAll(query: QueryBadWordDto): Promise<BadWordListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where = query.buildQuery();

    // 전체 개수와 데이터 조회
    const [total, badWords] = await Promise.all([
      this.prisma.badWord.count({ where }),
      this.prisma.badWord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const data = badWords.map((bw) => BadWordResponseDto.from(bw));

    return new BadWordListResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<BadWordResponseDto> {
    const badWord = await this.prisma.badWord.findUnique({
      where: { id },
    });

    if (!badWord) {
      throw new NotFoundException(`Bad word with ID "${id}" not found`);
    }

    return BadWordResponseDto.from(badWord);
  }

  async update(id: string, dto: UpdateBadWordDto): Promise<BadWordResponseDto> {
    // 존재 여부 확인
    const existing = await this.prisma.badWord.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Bad word with ID "${id}" not found`);
    }

    // word 변경 시 중복 체크
    if (dto.word && dto.word !== existing.word) {
      const duplicate = await this.prisma.badWord.findUnique({
        where: { word: dto.word },
      });

      if (duplicate) {
        throw new ConflictException(
          `Bad word with word "${dto.word}" already exists`
        );
      }
    }

    const updated = await this.prisma.badWord.update({
      where: { id },
      data: dto.buildUpdateData(),
    });

    return BadWordResponseDto.from(updated);
  }

  // 비활성화 soft delete
  async remove(id: string): Promise<void> {
    // 존재 여부 확인
    await this.findOne(id);

    await this.prisma.badWord.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
