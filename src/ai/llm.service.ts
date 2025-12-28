import { Injectable, Logger, Inject, OnModuleInit } from "@nestjs/common";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { OLLAMA_API_KEY } from "./ollama-config.provider";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * LLM 서비스
 *
 * Ollama Cloud LLM을 사용하여 텍스트를 문맥 기반으로 분석하여 욕설 여부를 판단합니다.
 */
@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);
  private llm: ChatOllama;
  private systemPrompt: string | null = null;
  private userPromptTemplate: string | null = null;

  // Ollama Cloud 설정 (고정값)
  private readonly baseUrl = "https://ollama.com";
  private readonly modelName = "gpt-oss:120b";

  private readonly promptsDir = (() => {
    // __dirname은 컴파일된 파일의 위치를 가리킴

    const fs = require("fs");
    const path = require("path");

    // 소스 경로 (개발 모드용)
    const srcPath = path.join(process.cwd(), "src", "ai", "prompts");

    // dist 경로 (프로덕션용)
    const distPath = join(__dirname, "prompts");

    // 소스 경로가 있으면 항상 우선 사용 (개발 모드에서 안정적)
    // 없으면 dist 경로 사용 (프로덕션)
    if (fs.existsSync(srcPath)) {
      return srcPath;
    } else if (fs.existsSync(distPath)) {
      return distPath;
    }

    return distPath;
  })();

  constructor(@Inject(OLLAMA_API_KEY) private readonly apiKey: string) {
    if (!this.apiKey) {
      this.logger.warn("OLLAMA_API_KEY not found. LLMService will not work.");
    } else {
      this.llm = new ChatOllama({
        baseUrl: this.baseUrl,
        model: this.modelName,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        temperature: 0.1, // 일관성 있는 결과를 위해 낮은 temperature
      });
      this.logger.log(
        `Ollama Cloud LLM initialized with model: ${this.modelName}, baseURL: ${this.baseUrl}`
      );
    }
  }

  /**
   * 모듈 초기화 시 프롬프트 파일을 로드합니다.
   */
  async onModuleInit(): Promise<void> {
    await this.loadPrompts();
  }

  /**
   * 프롬프트 파일을 로드합니다.
   * 파일이 없으면 에러를 발생시킵니다.
   */
  private async loadPrompts(): Promise<void> {
    try {
      this.systemPrompt = await readFile(
        join(this.promptsDir, "profanity-detection.system.txt"),
        "utf-8"
      );
      this.userPromptTemplate = await readFile(
        join(this.promptsDir, "profanity-detection.user.txt"),
        "utf-8"
      );

      if (!this.systemPrompt || !this.userPromptTemplate) {
        throw new Error("Prompt files are empty");
      }

      this.logger.log("Prompts loaded successfully");
    } catch (error) {
      this.logger.error("Failed to load prompts:", error);
      throw new Error(
        `프롬프트 파일을 로드할 수 없습니다. ${this.promptsDir} 디렉토리에 profanity-detection.system.txt와 profanity-detection.user.txt 파일이 필요합니다.`
      );
    }
  }

  /**
   * 텍스트가 욕설인지 문맥 기반으로 판단합니다.
   *
   * @param text 분석할 텍스트
   * @param evasionPatterns 회피 패턴 정보 (선택적)
   * @returns 욕설 판단 결과
   */
  /**
   * LLM 서비스가 사용 가능한지 확인합니다.
   */
  isAvailable(): boolean {
    return !!this.llm && !!this.systemPrompt && !!this.userPromptTemplate;
  }

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
    this.logger.debug(`judgeProfanity 호출: text="${text}"`);

    if (!this.isAvailable()) {
      this.logger.error(
        `LLM 서비스 사용 불가: systemPrompt=${!!this.systemPrompt}, userPromptTemplate=${!!this.userPromptTemplate}, apiKey=${this.apiKey ? "설정됨" : "미설정"}`
      );
      throw new Error("Ollama API key not configured or prompts not loaded");
    }

    // 프롬프트 파일이 없으면 에러 발생
    if (!this.systemPrompt || !this.userPromptTemplate) {
      throw new Error(
        "프롬프트 파일이 로드되지 않았습니다. 프롬프트 파일이 존재하는지 확인하세요."
      );
    }

    this.logger.debug("LLM API 호출 시작");
    try {
      // 회피 패턴 정보 구성
      let evasionPatternsText = "";
      if (evasionPatterns && evasionPatterns.suspiciousScore > 0) {
        evasionPatternsText = "\n\n회피 패턴 정보:\n";
        if (evasionPatterns.hasLeetspeak) {
          evasionPatternsText += "- 숫자/영문/특수문자 혼용 감지\n";
        }
        if (evasionPatterns.hasRepetition) {
          evasionPatternsText += "- 반복 문자 감지\n";
        }
        if (evasionPatterns.hasJamoSeparation) {
          evasionPatternsText += "- 자모 분리 감지\n";
        }
        if (evasionPatterns.hasZeroWidth) {
          evasionPatternsText += "- Zero-width 문자 감지\n";
        }
        if (evasionPatterns.hasSpaceSeparation) {
          evasionPatternsText += "- 공백 분리 감지\n";
        }
      }

      // 사용자 프롬프트 템플릿 치환
      const userPrompt = this.userPromptTemplate
        .replace("{{TEXT}}", text)
        .replace("{{EVASION_PATTERNS}}", evasionPatternsText)
        .replace(/\n{3,}/g, "\n\n") // 연속된 빈 줄 정리
        .trim();

      // LangChain 메시지 형식으로 구성
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(userPrompt),
      ];

      // 타임아웃 설정 (30초)
      const timeoutMs = 30000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("LLM API 호출 타임아웃 (30초)")),
          timeoutMs
        );
      });

      this.logger.debug(
        `LLM API 요청 전송: baseURL=${this.baseUrl}, model=${this.modelName}, apiKey=${this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "없음"}`
      );

      let response;
      try {
        const startTime = Date.now();
        response = await Promise.race([
          this.llm.invoke(messages),
          timeoutPromise,
        ]);
        const duration = Date.now() - startTime;
        this.logger.debug(`LLM API 응답 수신 완료 (소요 시간: ${duration}ms)`);
      } catch (invokeError) {
        const errorMessage = invokeError.message || String(invokeError);
        this.logger.error(
          `LLM API 호출 실패: ${errorMessage}`,
          invokeError.stack
        );

        // 네트워크 에러나 타임아웃인 경우 추가 정보 로깅
        if (
          errorMessage.includes("타임아웃") ||
          errorMessage.includes("timeout")
        ) {
          this.logger.error(
            `타임아웃 원인 가능성: 1) API 키 유효하지 않음 2) 네트워크 문제 3) Ollama Cloud 서버 응답 지연`
          );
        }

        throw invokeError;
      }

      const content = response.content as string;
      this.logger.debug(`LLM 응답 내용: ${content.substring(0, 200)}...`);

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
      this.logger.error(
        `Failed to judge profanity: ${error.message || error}`,
        error.stack
      );
      throw error;
    }
  }
}
