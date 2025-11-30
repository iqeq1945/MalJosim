import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 서비스 상태를 확인하기 위한 엔드포인트.
   * - 성공: 200 OK 반환
   * - 실패: 503 Service Unavailable 반환
   */
  @Get("")
  async checkHealth(): Promise<HealthResponseDto> {
    try {
      await this.healthService.checkService();
      return HealthResponseDto.success({ service: "up" });
    } catch (error) {
      throw new HttpException(
        HealthResponseDto.error(
          { service: "down" },
          "Service health check failed"
        ),
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Get("all")
  async checkAll(): Promise<HealthResponseDto> {
    const service = await this.healthService.checkService();
    const db = await this.healthService.checkDatabase();
    const redis = await this.healthService.checkRedis();
    return HealthResponseDto.success({
      service: service ? "up" : "down",
      db: db ? "up" : "down",
      redis: redis ? "up" : "down",
    });
  }

  /**
   * DB 연결 상태를 확인하기 위한 엔드포인트.
   * - 성공: 200 OK 반환
   * - 실패: 503 Service Unavailable 반환
   */
  @Get("db")
  async checkDb(): Promise<HealthResponseDto> {
    try {
      await this.healthService.checkDatabase();
      return HealthResponseDto.success({ db: "up" });
    } catch (error) {
      throw new HttpException(
        HealthResponseDto.error({ db: "down" }, "Database health check failed"),
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Redis 연결 상태를 확인하기 위한 엔드포인트.
   * - 성공: 200 OK 반환
   * - 실패: 503 Service Unavailable 반환
   */
  @Get("redis")
  async checkRedis(): Promise<HealthResponseDto> {
    try {
      await this.healthService.checkRedis();
      return HealthResponseDto.success({ redis: "up" });
    } catch (error) {
      throw new HttpException(
        HealthResponseDto.error({ redis: "down" }, "Redis health check failed"),
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
