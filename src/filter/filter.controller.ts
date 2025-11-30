import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { FilterService } from "./filter.service";
import { FilterRequestDto } from "./dto/filter-request.dto";
import { FilterResponseDto } from "./dto/filter-response.dto";

/**
 * 필터링 컨트롤러
 *
 * 텍스트 필터링 API를 제공합니다.
 */
@Controller("filter")
export class FilterController {
  constructor(private readonly filterService: FilterService) {}

  /**
   * 텍스트를 필터링합니다.
   *
   * @param dto 필터링 요청 DTO
   * @returns 필터링 결과
   */
  @Post("check")
  @HttpCode(HttpStatus.OK)
  async check(@Body() dto: FilterRequestDto): Promise<FilterResponseDto> {
    return this.filterService.filter(dto);
  }
}
