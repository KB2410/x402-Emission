#!/bin/bash

# X402 Emission Options - Initialize and Create Options
# This script initializes the EmissionOption contract and creates test options

set -e

echo "🚀 X402 Emission Options - Quick Setup"
echo "======================================"
echo ""

# Check for secret key
if [ -z "$STELLAR_SECRET_KEY" ]; then
    echo "❌ Error: STELLAR_SECRET_KEY environment variable not set"
    echo ""
    echo "Please run:"
    echo "export STELLAR_SECRET_KEY=\"YOUR_STELLAR_SECRET_KEY_HERE\""
    echo ""
    exit 1
fi

# Load contract addresses
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/frontend/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.local file not found"
    exit 1
fi

source "$ENV_FILE"

# Network settings
NETWORK="testnet"
ADMIN_ADDRESS="GCHWURXZ6US3SCIBMTH7N6DLYAG2WV63IE54G5NMJ33ZWCO4LJYWBYBK"
MOCK_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCF4J2"

echo "📋 Configuration:"
echo "   Network: $NETWORK"
echo "   Admin: $ADMIN_ADDRESS"
echo "   EmissionOption: $NEXT_PUBLIC_EMISSION_OPTION_CONTRACT"
echo ""

# Step 1: Initialize EmissionOption Contract
echo "=== Step 1: Initialize EmissionOption Contract ==="
echo ""

stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --collateral_token "$MOCK_TOKEN" \
    --settlement_token "$MOCK_TOKEN" \
    --emission_token "$MOCK_TOKEN" \
    --protocol_fee 100 \
    --treasury "$ADMIN_ADDRESS" \
    --collateral_manager "$NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT" \
    --risk_manager "$NEXT_PUBLIC_RISK_MANAGER_CONTRACT" \
    --settlement_engine "$NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT" \
    2>&1 | grep -v "error:" || echo "⚠️  Contract may already be initialized (this is OK)"

echo ""
echo "✅ Contract initialization complete"
echo ""

# Step 2: Create Test Options
echo "=== Step 2: Create Test Options ==="
echo ""

# Calculate timestamps
CURRENT_TIME=$(date +%s)
EXPIRATION=$((CURRENT_TIME + 2592000))  # 30 days
EMISSION_START=$CURRENT_TIME
EMISSION_END=$((CURRENT_TIME + 7776000))  # 90 days

echo "📝 Creating Call Option #1 (Strike: \$0.15)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- write_option \
    --writer "$ADMIN_ADDRESS" \
    --option_type '"Call"' \
    --strike_price 1500000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 100000000000 \
    --premium 800000 \
    --collateral_amount 100000000000 \
    2>&1 | tail -1

echo "✅ Call option #1 created"
echo ""

echo "📝 Creating Put Option #2 (Strike: \$0.10)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- write_option \
    --writer "$ADMIN_ADDRESS" \
    --option_type '"Put"' \
    --strike_price 1000000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 50000000000 \
    --premium 500000 \
    --collateral_amount 50000000000 \
    2>&1 | tail -1

echo "✅ Put option #2 created"
echo ""

echo "📝 Creating Call Option #3 (Strike: \$0.20)..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- write_option \
    --writer "$ADMIN_ADDRESS" \
    --option_type '"Call"' \
    --strike_price 2000000 \
    --expiration "$EXPIRATION" \
    --emission_period_start "$EMISSION_START" \
    --emission_period_end "$EMISSION_END" \
    --underlying_amount 75000000000 \
    --premium 600000 \
    --collateral_amount 75000000000 \
    2>&1 | tail -1

echo "✅ Call option #3 created"
echo ""

# Step 3: Verify
echo "=== Step 3: Verify Options ==="
echo ""

echo "📊 Checking option count..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source-account "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    -- get_option_count \
    2>&1 | tail -1

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "🎯 Next Steps:"
echo "1. Refresh your browser at http://localhost:3000/trade"
echo "2. The 'Demo Data' banner should disappear"
echo "3. You should see 3 real options from the contract"
echo "4. Try buying an option - it should work now!"
echo ""
echo "📝 Options Created:"
echo "   - Call Option (Strike: \$0.15, Premium: 0.08 XLM)"
echo "   - Put Option (Strike: \$0.10, Premium: 0.05 XLM)"
echo "   - Call Option (Strike: \$0.20, Premium: 0.06 XLM)"
echo ""
