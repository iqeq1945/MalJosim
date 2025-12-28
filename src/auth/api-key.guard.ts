import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new UnauthorizedException("API Key is required");
    }

    const adminApiKey = this.configService.get<string>("ADMIN_API_KEY");

    if (!adminApiKey) {
      // Log the actual configuration issue internally
      this.logger.error("Server configuration error: ADMIN_API_KEY is not set");
      // Return generic error message to prevent information disclosure
      throw new UnauthorizedException("Authentication failed");
    }

    // Use constant-time comparison to prevent timing attacks
    if (
      apiKey.length !== adminApiKey.length ||
      !timingSafeEqual(Buffer.from(apiKey), Buffer.from(adminApiKey))
    ) {
      throw new UnauthorizedException("Invalid API Key");
    }

    return true;
  }
}
