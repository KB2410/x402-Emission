#!/bin/bash

# X402 Emission Options - Create Test Options Script

set -e

NETWORK="${1:-testnet}"

echo "📝 Creating test options on $NETWORK..."

# Set network-specific variables
if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
else
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
fi

# Check for source account
if [ -z "$STELLAR_SECRET_KEY" ]; then
    echo "❌ Error: STELLAR_SECRET_KEY environment variable not set"
    echo "Export your secret key: export STELLAR_SECRET_KEY=S..."
    exit 1
fi

# Load contract addresses from .env.local
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/frontend/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.local file not found. Run deploy.sh first."
    exit 1
fi

source "$ENV_FILE"

# Get writer address from secret key using stellar-sdk
WRITER_ADDRESS="GCHWURXZ6US3SCIBMTH7N6DLYAG2WV63IE54G5NMJ33ZWCO4LJYWBYBK"

echo "📋 Writer Address: $WRITER_ADDRESS"
echo ""

# Calculate timestamps
CURRENT_TIME=$(date +%s)
EXPIRATION=$((CURRENT_TIME + 2592000))  # 30 days from now
EMISSION_START=$CURRENT_TIME
EMISSION_END=$((CURRENT_TIME + 7776000))  # 90 days from now

echo "=== Creating Test Options ==="
echo ""

# Create Call Option #1
echo "📝 Creating Call Option (Strike: \$0.15)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- write_option \
    --writer "$WRITER_ADDRESS" \
    --option_type '"Call"' \
    --strike_price 1500000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 100000000000 \
    --premium 800000 \
    --collateral_amount 100000000000

echo "✅ Call option created"
echo ""

# Create Put Option #2
echo "📝 Creating Put Option (Strike: \$0.10)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- write_option \
    --writer "$WRITER_ADDRESS" \
    --option_type '"Put"' \
    --strike_price 1000000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 50000000000 \
    --premium 500000 \
    --collateral_amount 50000000000

echo "✅ Put option created"
echo ""

# Create Call Option #3
echo "📝 Creating Call Option (Strike: \$0.20)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- write_option \
    --writer "$WRITER_ADDRESS" \
    --option_type '"Call"' \
    --strike_price 2000000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 75000000000 \
    --premium 600000 \
    --collateral_amount 75000000000

echo "✅ Call option created"
echo ""

echo "✅ Test options created successfully!"
echo ""
echo "🎯 You can now:"
echo "1. View options on the Trade page"
echo "2. Buy options with your wallet"
echo "3. Exercise options before expiration"
echo ""
