# Multi-stage build를 사용하여 최적화

# Stage 1: 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY prisma.config.ts ./

# 의존성 설치 (devDependencies 포함)
RUN npm ci

# 소스 코드 복사
COPY . .

# Prisma Client 생성
RUN npx prisma generate

# TypeScript 빌드
RUN npm run build

# Stage 2: 프로덕션 단계
FROM node:20-alpine

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
COPY prisma.config.ts ./
RUN npm ci --only=production && npm cache clean --force

# Prisma 관련 파일 복사
# Prisma CLI도 필요하므로 (마이그레이션 실행용) 빌더에서 복사
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# 빌드된 애플리케이션 복사
COPY --from=builder /app/dist ./dist

# 프롬프트 파일 복사 (런타임에 필요)
# __dirname은 dist/src/ai/llm.service.js를 가리키므로 prompts는 dist/src/ai/prompts에 있어야 함
COPY --from=builder /app/src/ai/prompts ./dist/src/ai/prompts

# Entrypoint 스크립트 복사 및 실행 권한 부여
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 포트 노출
EXPOSE 3000

# 헬스체크 (선택사항)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Entrypoint 설정
ENTRYPOINT ["./docker-entrypoint.sh"]

# 애플리케이션 실행
CMD ["npm", "run", "start:prod"]

