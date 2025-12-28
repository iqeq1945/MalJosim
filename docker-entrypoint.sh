#!/bin/sh
set -e

# Prisma 마이그레이션 실행 (프로덕션 환경)
if [ "$NODE_ENV" = "production" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
fi

# 애플리케이션 실행
exec "$@"

