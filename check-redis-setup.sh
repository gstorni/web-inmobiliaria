#!/bin/bash

echo "🔍 Redis Setup Checker"
echo "====================="

# Check if Redis is installed locally
echo ""
echo "📦 Checking Redis installation..."
if command -v redis-server &> /dev/null; then
    echo "✅ Redis server is installed"
    redis-server --version
else
    echo "❌ Redis server not found"
    echo "💡 Install with: brew install redis (macOS) or sudo apt install redis-server (Ubuntu)"
fi

if command -v redis-cli &> /dev/null; then
    echo "✅ Redis CLI is installed"
else
    echo "❌ Redis CLI not found"
fi

# Check if Redis is running
echo ""
echo "🔄 Checking Redis process..."
if pgrep -x "redis-server" > /dev/null; then
    echo "✅ Redis server is running"
    
    # Test connection
    echo ""
    echo "🏓 Testing Redis connection..."
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is responding to ping"
        redis-cli info server | grep redis_version
    else
        echo "❌ Redis is not responding"
    fi
else
    echo "❌ Redis server is not running"
    echo "💡 Start with: redis-server"
fi

# Check port
echo ""
echo "🔌 Checking Redis port..."
if lsof -i :6379 &> /dev/null; then
    echo "✅ Port 6379 is in use (likely Redis)"
    lsof -i :6379
else
    echo "❌ Port 6379 is not in use"
fi

echo ""
echo "📝 Recommended .env.local configuration:"
echo "REDIS_HOST=localhost"
echo "REDIS_PORT=6379"
echo "REDIS_TTL=3600"
