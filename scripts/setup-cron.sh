#!/bin/bash
# 기상청 데이터 자동 수집 cron 설정 스크립트
# 서버(EC2)에서 실행: bash scripts/setup-cron.sh
#
# 매일 06:00 KST (21:00 UTC 전일)에 데이터 수집 → 빌드 → PM2 재시작

CLIMATE_DIR="/home/ec2-user/climate"
NODE_BIN="/home/ec2-user/.nvm/versions/node/v22.9.0/bin"
CRON_LOG="${CLIMATE_DIR}/cron.log"

CRON_JOB="0 21 * * * cd ${CLIMATE_DIR} && ${NODE_BIN}/npx tsx scripts/fetch-kma-data.ts >> ${CRON_LOG} 2>&1 && ${NODE_BIN}/npx next build >> ${CRON_LOG} 2>&1 && ${NODE_BIN}/pm2 restart climate >> ${CRON_LOG} 2>&1"

# 기존 climate 관련 cron 제거 후 새로 추가
(crontab -l 2>/dev/null | grep -v "fetch-kma-data" ; echo "${CRON_JOB}") | crontab -

echo "Cron job registered:"
echo "${CRON_JOB}"
echo ""
echo "Verify with: crontab -l"
echo "Log file: ${CRON_LOG}"
