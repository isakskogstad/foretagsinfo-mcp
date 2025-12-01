#!/bin/bash
# Wait for Supabase project restart to complete

echo "⏳ Waiting for Supabase project to restart..."
echo "Testing insert every 60 seconds (max 10 attempts)"
echo ""

for i in {1..10}; do
  echo "🔄 Attempt $i/10 at $(date +%H:%M:%S)..."

  cd "/Users/isak/Desktop/CLAUDE_CODE /projects/personupplysning"

  result=$(npx tsx scripts/test-insert.ts 2>&1)

  if echo "$result" | grep -q "Insert successful"; then
    echo "✅ SUCCESS! Supabase is ready!"
    echo ""
    echo "$result"
    exit 0
  else
    echo "❌ Still restarting... (cache not ready)"
    if [ $i -lt 10 ]; then
      echo "   Waiting 60 seconds..."
      sleep 60
    fi
  fi
  echo ""
done

echo "⚠️  Timeout after 10 minutes. Project may need manual intervention."
exit 1
