import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { BadWordService } from "./bad-word.service";
import { CreateBadWordDto } from "./dto/create-bad-word.dto";
import { UpdateBadWordDto } from "./dto/update-bad-word.dto";
import { QueryBadWordDto } from "./dto/query-bad-word.dto";
import {
  BadWordResponseDto,
  BadWordListResponseDto,
} from "./dto/bad-word-response.dto";
import { ApiKeyGuard } from "../auth/api-key.guard";

@Controller("bad-words")
export class BadWordController {
  constructor(private readonly badWordService: BadWordService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createBadWordDto: CreateBadWordDto
  ): Promise<BadWordResponseDto> {
    return this.badWordService.create(createBadWordDto);
  }

  @Get()
  async findAll(
    @Query() query: QueryBadWordDto
  ): Promise<BadWordListResponseDto> {
    return this.badWordService.findAll(query);
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<BadWordResponseDto> {
    return this.badWordService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(ApiKeyGuard)
  async update(
    @Param("id") id: string,
    @Body() updateBadWordDto: UpdateBadWordDto
  ): Promise<BadWordResponseDto> {
    return this.badWordService.update(id, updateBadWordDto);
  }

  @Delete(":id")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    return this.badWordService.remove(id);
  }
}
