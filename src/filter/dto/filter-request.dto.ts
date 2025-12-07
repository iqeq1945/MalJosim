import { IsString, IsOptional, MaxLength } from "class-validator";

/**
 * 필터링 요청 DTO
 */
export class FilterRequestDto {
  @IsString()
  @MaxLength(1000)
  text: string; // 필터링할 텍스트

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string; // 클라이언트 ID (선택적, 현재는 사용하지 않음)
}
