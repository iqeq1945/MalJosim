import { Module } from "@nestjs/common";
import { BadWordService } from "./bad-word.service";
import { BadWordController } from "./bad-word.controller";

@Module({
  controllers: [BadWordController],
  providers: [BadWordService],
  exports: [BadWordService],
})
export class BadWordModule {}
