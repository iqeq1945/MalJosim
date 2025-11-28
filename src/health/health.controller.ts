import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 서비스 상태를 확인하기 위한 엔드포인트.
   * - 성공: 200 OK 반환
   * - 실패: 503 Service Unavailable 반환
   */
  @Get("")
  async checkHealth() {
    try {
      await this.healthService.checkService();
      return {
        status: "ok",
        service: "up",
      };
    } catch (error) {
      throw new HttpException(
        {
          status: "error",
          service: "down",
          message: "Service health check failed",
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * DB 연결 상태를 확인하기 위한 엔드포인트.
   * - 성공: 200 OK 반환
   * - 실패: 503 Service Unavailable 반환
   */
  @Get("db")
  async checkDb() {
    try {
      await this.healthService.checkDatabase();
      return {
        status: "ok",
        db: "up",
      };
    } catch (error) {
      throw new HttpException(
        {
          status: "error",
          db: "down",
          message: "Database health check failed",
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
