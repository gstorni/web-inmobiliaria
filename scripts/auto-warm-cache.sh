#!/bin/bash
# Automatic Redis Cache Warming
# Runs every 2 hours to keep cache fresh

cd /home/gonzalo/Documents/WEB/web-agustinmieres_v3
npx tsx scripts/warm-redis-cache.ts --max=100 --quiet
