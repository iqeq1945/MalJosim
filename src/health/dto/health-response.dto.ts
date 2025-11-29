/**
 * Health Check 응답 표준 형식
 *
 * 모든 health check 엔드포인트는 이 형식을 따릅니다.
 */
export class HealthResponseDto {
  status: "ok" | "error";
  timestamp: string;
  checks: {
    service?: "up" | "down";
    db?: "up" | "down";
    [key: string]: "up" | "down" | undefined;
  };
  message?: string;

  constructor(
    status: "ok" | "error",
    checks: {
      service?: "up" | "down";
      db?: "up" | "down";
      [key: string]: "up" | "down" | undefined;
    },
    message?: string
  ) {
    this.status = status;
    this.timestamp = new Date().toISOString();
    this.checks = checks;
    if (message) {
      this.message = message;
    }
  }

  /**
   * 성공 응답 생성 헬퍼
   */
  static success(checks: {
    service?: "up" | "down";
    db?: "up" | "down";
    [key: string]: "up" | "down" | undefined;
  }): HealthResponseDto {
    return new HealthResponseDto("ok", checks);
  }

  /**
   * 실패 응답 생성 헬퍼
   */
  static error(
    checks: {
      service?: "up" | "down";
      db?: "up" | "down";
      [key: string]: "up" | "down" | undefined;
    },
    message: string
  ): HealthResponseDto {
    return new HealthResponseDto("error", checks, message);
  }
}
