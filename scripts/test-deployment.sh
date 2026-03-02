#!/bin/bash

# X402 Emission Options - Deployment Test Script
# This script tests that all contracts are deployed and working correctly

set -e

echo "🧪 X402 Emission Options Market - Deployment Test"
echo "================================================="
echo ""

# Check if .env.local exists
if [ ! -f "frontend/.env.local" ]; then
    echo "❌ .env.local not found. Please run deployment first:"
    echo "   ./scripts/deploy.sh testnet"
    exit 1
fi

# Load environment variables
source frontend/.env.local

# Check if STELLAR_SECRET_KEY is set
if [ -z "$STELLAR_SECRET_KEY" ]; then
    echo "❌ STELLAR_SECRET_KEY not set. Please export your secret key:"
    echo "   export STELLAR_SECRET_KEY=S..."
    exit 1
fi

echo "📋 Testing Configuration"
echo "========================"
echo "Network: $NEXT_PUBLIC_STELLAR_NETWORK"
echo "PriceOracle: ${NEXT_PUBLIC_PRICE_ORACLE_CONTRACT:0:8}..."
echo "EmissionOption: ${NEXT_PUBLIC_EMISSION_OPTION_CONTRACT:0:8}..."
echo "OptionsAMM: ${NEXT_PUBLIC_OPTIONS_AMM_CONTRACT:0:8}..."
echo ""

# Set network variables
if [ "$NEXT_PUBLIC_STELLAR_NETWORK" = "MAINNET" ]; then
    RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
else
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
fi

echo "🔍 Test 1: Oracle Price Check"
echo "=============================="

price_result=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_PRICE_ORACLE_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_price \
    --asset XLM 2>&1)

if echo "$price_result" | grep -q "price"; then
    echo "✅ Oracle price check passed"
    echo "   Price data: $(echo "$price_result" | head -1)"
else
    echo "❌ Oracle price check failed"
    echo "   Error: $price_result"
fi
echo ""

echo "🔍 Test 2: EmissionOption Contract"
echo "=================================="

option_count=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_option_count 2>&1)

if echo "$option_count" | grep -q -E '^[0-9]+$'; then
    echo "✅ EmissionOption contract working"
    echo "   Current option count: $option_count"
else
    echo "❌ EmissionOption contract test failed"
    echo "   Error: $option_count"
fi
echo ""

echo "🔍 Test 3: OptionsAMM Contract"
echo "=============================="

pools_result=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_active_pools 2>&1)

if echo "$pools_result" | grep -q -E '\[\]|\[.*\]'; then
    echo "✅ OptionsAMM contract working"
    echo "   Active pools: $(echo "$pools_result" | head -1)"
else
    echo "❌ OptionsAMM contract test failed"
    echo "   Error: $pools_result"
fi
echo ""

echo "🔍 Test 4: Frontend Dependencies"
echo "================================"

if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend dependencies not installed"
    echo "   Run: cd frontend && npm install"
fi
echo ""

echo "🔍 Test 5: Contract Integration"
echo "==============================="

# Test if we can get open options (should return empty array initially)
open_options=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_open_options 2>&1)

if echo "$open_options" | grep -q -E '\[\]|\[.*\]'; then
    echo "✅ Contract integration working"
    echo "   Open options: $(echo "$open_options" | head -1)"
else
    echo "❌ Contract integration test failed"
    echo "   Error: $open_options"
fi
echo ""

echo "📊 Test Summary"
echo "==============="
echo ""

# Count successful tests
tests_passed=0
total_tests=5

# Check each test result
if echo "$price_result" | grep -q "price"; then
    ((tests_passed++))
fi

if echo "$option_count" | grep -q -E '^[0-9]+$'; then
    ((tests_passed++))
fi

if echo "$pools_result" | grep -q -E '\[\]|\[.*\]'; then
    ((tests_passed++))
fi

if [ -d "frontend/node_modules" ]; then
    ((tests_passed++))
fi

if echo "$open_options" | grep -q -E '\[\]|\[.*\]'; then
    ((tests_passed++))
fi

echo "Tests passed: $tests_passed/$total_tests"

if [ $tests_passed -eq $total_tests ]; then
    echo "🎉 All tests passed! Your deployment is working correctly."
    echo ""
    echo "🚀 Ready to start trading!"
    echo "1. Start frontend: cd frontend && npm run dev"
    echo "2. Open browser: http://localhost:3000"
    echo "3. Connect Freighter wallet"
    echo "4. Start creating and trading options!"
else
    echo "⚠️  Some tests failed. Please check the errors above."
    echo ""
    echo "🔧 Troubleshooting:"
    echo "1. Ensure contracts are deployed: ./scripts/deploy.sh testnet"
    echo "2. Ensure contracts are initialized: ./scripts/initialize.sh testnet"
    echo "3. Check your STELLAR_SECRET_KEY is correct"
    echo "4. Verify your account has XLM for gas fees"
fi

echo ""
echo "📚 For more detailed testing, see DEPLOYMENT_GUIDE.md"