import { Injectable, Logger, Inject } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { OPENAI_API_KEY } from "./openai-config.provider";

/**
 * LLM 서비스
 *
 * OpenAI LLM을 사용하여 텍스트에서 욕설 후보 단어를 추출합니다.
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
   * 텍스트에서 욕설 후보 단어를 추출합니다.
   *
   * @param text 분석할 텍스트
   * @param evasionPatterns 회피 패턴 정보 (선택적)
   * @returns 후보 단어 배열
   */
  async extractCandidates(
    text: string,
    evasionPatterns?: {
      hasLeetspeak: boolean;
      hasRepetition: boolean;
      hasJamoSeparation: boolean;
      hasZeroWidth: boolean;
      hasSpaceSeparation: boolean;
      suspiciousScore: number;
    }
  ): Promise<string[]> {
    if (!this.llm) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const systemPrompt = `당신은 한국어 욕설을 감지하는 전문가입니다.
주어진 텍스트에서 욕설이나 부적절한 단어를 발음 기반으로 추출하세요.

주의사항:
1. 원본 텍스트를 직접 보고 발음 기반으로 판단하세요.
2. 회피 패턴(leetspeak, 자모 분리 등)을 고려하세요.
3. 정상적인 단어는 제외하세요.
4. 추출한 단어는 한글로 정규화하여 반환하세요.

응답 형식: JSON 배열로 단어만 반환하세요.
예: ["시발", "개새끼"]`;

      let userPrompt = `다음 텍스트에서 욕설 후보 단어를 추출하세요:\n\n${text}`;

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
        const candidates = JSON.parse(content) as string[];
        if (Array.isArray(candidates)) {
          return candidates.filter((word) => word && word.trim().length > 0);
        }
      } catch (parseError) {
        // JSON 파싱 실패 시 텍스트에서 추출 시도
        this.logger.warn("Failed to parse LLM response as JSON:", content);
        return this.extractWordsFromText(content);
      }

      return [];
    } catch (error) {
      this.logger.error("Failed to extract candidates:", error);
      return [];
    }
  }

  /**
   * 텍스트에서 단어를 추출합니다 (JSON 파싱 실패 시 사용).
   */
  private extractWordsFromText(text: string): string[] {
    // 대괄호 안의 단어들을 추출
    const matches = text.match(/\[(.*?)\]/);
    if (matches) {
      const words = matches[1]
        .split(",")
        .map((w) => w.trim().replace(/['"]/g, ""))
        .filter((w) => w.length > 0);
      return words;
    }
    return [];
  }
}
