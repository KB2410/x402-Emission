#!/bin/bash

# X402 Emission Options - Contract Initialization Script

set -e

NETWORK="${1:-testnet}"

echo "🔧 Initializing X402 Emission Options contracts on $NETWORK..."

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

# Get admin address from secret key
# Use the test-account identity that was created during deployment
ADMIN_ADDRESS=$(stellar keys address test-account 2>/dev/null || echo "GCHWURXZ6US3SCIBMTH7N6DLYAG2WV63IE54G5NMJ33ZWCO4LJYWBYBK")

echo "📋 Admin Address: $ADMIN_ADDRESS"
echo ""

# Mock token addresses (in production, deploy actual tokens)
# For testnet, we'll use the native XLM contract address
# Native XLM on Stellar: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
XLM_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"  # Native XLM
X402_TOKEN="$XLM_TOKEN"  # Use XLM for now
USDC_TOKEN="$XLM_TOKEN"  # Use XLM for now

echo "=== Initializing Contracts ==="
echo ""

# Initialize PriceOracle contract
echo "🔧 Initializing PriceOracle..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_PRICE_ORACLE_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --max_price_age 3600 \
    --min_confidence 9000 || echo "⚠️  PriceOracle already initialized"

# Add admin as price feeder
echo "🔧 Adding price feeder..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_PRICE_ORACLE_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- add_price_feeder \
    --feeder "$ADMIN_ADDRESS" || echo "⚠️  Price feeder already added"

# Set initial XLM price
echo "🔧 Setting initial XLM price..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_PRICE_ORACLE_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- update_price \
    --asset XLM \
    --price 118000 \
    --confidence 9500 || echo "⚠️  Price already set"

# Initialize EmissionOption contract
echo "🔧 Initializing EmissionOption..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --collateral_token "$X402_TOKEN" \
    --settlement_token "$XLM_TOKEN" \
    --emission_token "$X402_TOKEN" \
    --protocol_fee 100 \
    --treasury "$ADMIN_ADDRESS" \
    --collateral_manager "$NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT" \
    --risk_manager "$NEXT_PUBLIC_RISK_MANAGER_CONTRACT" \
    --settlement_engine "$NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT" || echo "⚠️  EmissionOption already initialized"

# Initialize CollateralManager
echo "🔧 Initializing CollateralManager..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --liquidation_bonus 500 \
    --min_health_factor 1200 || echo "⚠️  CollateralManager already initialized"

# Initialize OptionsAMM
echo "🔧 Initializing OptionsAMM..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --liquidity_token "$XLM_TOKEN" \
    --settlement_token "$XLM_TOKEN" \
    --oracle "$ADMIN_ADDRESS" || echo "⚠️  OptionsAMM already initialized"

# Initialize SettlementEngine
echo "🔧 Initializing SettlementEngine..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --emission_option_contract "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" \
    --oracle "$NEXT_PUBLIC_PRICE_ORACLE_CONTRACT" \
    --settlement_token "$XLM_TOKEN" \
    --emission_token "$X402_TOKEN" || echo "⚠️  SettlementEngine already initialized"

# Initialize RiskManager
echo "🔧 Initializing RiskManager..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_RISK_MANAGER_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --guardian "$ADMIN_ADDRESS" \
    --max_daily_volume 1000000000000 \
    --insurance_fund "$ADMIN_ADDRESS" || echo "⚠️  RiskManager already initialized"

# Initialize OptionsFactory
echo "🔧 Initializing OptionsFactory..."
stellar contract invoke \
    --id "$NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT" \
    --source "$STELLAR_SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- initialize \
    --admin "$ADMIN_ADDRESS" \
    --emission_option_contract "$NEXT_PUBLIC_EMISSION_OPTION_CONTRACT" || echo "⚠️  OptionsFactory already initialized"

echo ""
echo "✅ Contract initialization complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Fund your account with XLM for gas fees"
echo "2. Create some test options using the write page"
echo "3. Add liquidity to AMM pools"
echo "4. Start trading!"
echo ""