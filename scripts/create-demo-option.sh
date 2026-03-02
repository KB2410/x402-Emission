#!/bin/bash

# X402 Emission Options - Create Demo Option Script
# This script creates a sample option for testing

set -e

echo "🎯 Creating Demo Option for Testing"
echo "==================================="
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

# Set network variables
if [ "$NEXT_PUBLIC_STELLAR_NETWORK" = "MAINNET" ]; then
    RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
else
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
fi

echo "📋 Demo Option Parameters"
echo "========================="
echo "Type: Call Option"
echo "Strike Price: $0.15 (150000 with 6 decimals)"
echo "Expiry: 30 days from now"
echo "Underlying: 1000 X402 tokens"
echo "Premium: 8 XLM"
echo "Collateral: 1000 X402 tokens"
echo ""

# Calculate expiry (30 days from now)
expiry=$(date -d "+30 days" +%s 2>/dev/null || date -v+30d +%s)
emission_start=$(date +%s)
emission_end=$expiry

echo "🔧 Creating option..."

result=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- write_option \
    --option_type Call \
    --strike_price 150000 \
    --expiration $expiry \
    --emission_period_start $emission_start \
    --emission_period_end $emission_end \
    --underlying_amount 10000000000 \
    --premium 80000000 \
    2>&1)

if echo "$result" | grep -q -E '^[0-9]+$'; then
    echo "✅ Demo option created successfully!"
    echo "   Option ID: $result"
    echo ""
    echo "🎉 You can now:"
    echo "1. View the option on the Trade page"
    echo "2. Buy it with a different account"
    echo "3. Check it in your Portfolio"
    echo ""
    echo "🚀 Start the frontend to see your option:"
    echo "   cd frontend && npm run dev"
    echo "   Then go to http://localhost:3000/trade"
else
    echo "❌ Failed to create demo option"
    echo "Error: $result"
    echo ""
    echo "🔧 This might be because:"
    echo "1. Contracts need initialization: ./scripts/initialize.sh testnet"
    echo "2. Account needs more XLM for gas fees"
    echo "3. Collateral token not available (expected for demo)"
    echo ""
    echo "💡 The error is normal if you don't have X402 tokens for collateral."
    echo "   The important thing is that the contract call was attempted."
fi

echo ""
echo "📊 Checking current options..."

options=$(stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_open_options 2>&1)

echo "Current open options: $options"