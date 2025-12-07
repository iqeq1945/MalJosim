import { Injectable, Logger, Inject } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { OPENAI_API_KEY } from "./openai-config.provider";

/**
 * LLM 서비스
 *
 * OpenAI LLM을 사용하여 텍스트를 문맥 기반으로 분석하여 욕설 여부를 판단합니다.
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private llm: ChatOpenAI;

  constructor(@Inject(OPENAI_API_KEY) private readonly apiKey: string) {
    if (!this.apiKey) {
      this.logger.warn("OPENAI_API_KEY not found. LLMService will not work.");
    } else {
      this.llm = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: "gpt-4o-mini", // 비용 효율적인 모델
        temperature: 0.1, // 일관성 있는 결과를 위해 낮은 temperature
      });
    }
  }

  /**
   * 텍스트가 욕설인지 문맥 기반으로 판단합니다.
   *
   * @param text 분석할 텍스트
   * @param evasionPatterns 회피 패턴 정보 (선택적)
   * @returns 욕설 판단 결과
   */
  async judgeProfanity(
    text: string,
    evasionPatterns?: {
      hasLeetspeak: boolean;
      hasRepetition: boolean;
      hasJamoSeparation: boolean;
      hasZeroWidth: boolean;
      hasSpaceSeparation: boolean;
      suspiciousScore: number;
    }
  ): Promise<{
    isProfanity: boolean;
    confidence: number; // 0-1
    reason?: string;
  }> {
    if (!this.llm) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const systemPrompt = `당신은 한국어 욕설을 감지하는 전문가입니다.
주어진 텍스트를 문맥을 고려하여 욕설인지 판단하세요.

주의사항:
1. 문맥을 고려하여 판단하세요 (예: "시발점"은 정상 단어, "시발"은 욕설)
2. 회피 패턴(leetspeak, 자모 분리 등)을 고려하세요
3. 정상적인 단어는 욕설이 아닙니다
4. 확신도(confidence)를 0-1 사이로 제공하세요

응답 형식: JSON
{
  "isProfanity": boolean,
  "confidence": number (0-1),
  "reason": string (선택적, 판단 이유)
}`;

      let userPrompt = `다음 텍스트가 욕설인지 문맥을 고려하여 판단하세요:\n\n${text}`;

      if (evasionPatterns && evasionPatterns.suspiciousScore > 0) {
        userPrompt += `\n\n회피 패턴 정보:\n`;
        if (evasionPatterns.hasLeetspeak) {
          userPrompt += "- 숫자/영문/특수문자 혼용 감지\n";
        }
        if (evasionPatterns.hasRepetition) {
          userPrompt += "- 반복 문자 감지\n";
        }
        if (evasionPatterns.hasJamoSeparation) {
          userPrompt += "- 자모 분리 감지\n";
        }
        if (evasionPatterns.hasZeroWidth) {
          userPrompt += "- Zero-width 문자 감지\n";
        }
        if (evasionPatterns.hasSpaceSeparation) {
          userPrompt += "- 공백 분리 감지\n";
        }
      }

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const response = await this.llm.invoke(messages);
      const content = response.content as string;

      // JSON 파싱
      try {
        const result = JSON.parse(content) as {
          isProfanity: boolean;
          confidence: number;
          reason?: string;
        };
        return {
          isProfanity: result.isProfanity || false,
          confidence: Math.max(0, Math.min(1, result.confidence || 0)),
          reason: result.reason,
        };
      } catch (parseError) {
        this.logger.warn("Failed to parse LLM response as JSON:", content);
        // 기본값 반환
        return {
          isProfanity: false,
          confidence: 0,
          reason: "LLM 응답 파싱 실패",
        };
      }
    } catch (error) {
      this.logger.error("Failed to judge profanity:", error);
      throw error;
    }
  }
}
