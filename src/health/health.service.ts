import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   *  서비스 상태를 확인하기 위한 간단한 체크.
   * - 성공: true 반환
   * - 실패: 예외 throw (컨트롤러에서 HTTP 에러로 변환)
   */
  async checkService(): Promise<boolean> {
    return true;
  }

  /**
   * DB 연결 상태를 확인하기 위한 간단한 체크.
   * - 성공: true 반환
   * - 실패: 예외 throw (컨트롤러에서 HTTP 에러로 변환)
   */
  async checkDatabase(): Promise<boolean> {
    // 가장 가벼운 쿼리 중 하나: SELECT 1
    await this.prisma.$queryRawUnsafe("SELECT 1");
    return true;
  }
}
