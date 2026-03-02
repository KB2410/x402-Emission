#!/bin/bash

# X402 Emission Options - Contract Deployment Script

set -e

NETWORK="${1:-testnet}"

echo "🚀 Deploying X402 Emission Options contracts to $NETWORK..."

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

echo "📦 Building contracts..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR/contracts"
cargo build --release --target wasm32-unknown-unknown

WASM_DIR="$PROJECT_DIR/contracts/target/wasm32-unknown-unknown/release"

# Deploy each contract
deploy_contract() {
    local name=$1
    local wasm_file="${WASM_DIR}/${name//-/_}.wasm"
    
    echo "📄 Deploying $name..."
    
    CONTRACT_ID=$(stellar contract deploy \
        --wasm "$wasm_file" \
        --source "$STELLAR_SECRET_KEY" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        2>&1)
    
    echo "✅ $name deployed: $CONTRACT_ID"
    echo "$CONTRACT_ID"
}

# Deploy contracts in order
echo ""
echo "=== Deploying Core Contracts ==="

PRICE_ORACLE_ID=$(deploy_contract "price-oracle")
EMISSION_OPTION_ID=$(deploy_contract "emission-option")
OPTIONS_FACTORY_ID=$(deploy_contract "options-factory")
COLLATERAL_MANAGER_ID=$(deploy_contract "collateral-manager")
OPTIONS_AMM_ID=$(deploy_contract "options-amm")
SETTLEMENT_ENGINE_ID=$(deploy_contract "settlement-engine")
RISK_MANAGER_ID=$(deploy_contract "risk-manager")

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Contract IDs:"
echo "  PRICE_ORACLE:        $PRICE_ORACLE_ID"
echo "  EMISSION_OPTION:     $EMISSION_OPTION_ID"
echo "  OPTIONS_FACTORY:     $OPTIONS_FACTORY_ID"
echo "  COLLATERAL_MANAGER:  $COLLATERAL_MANAGER_ID"
echo "  OPTIONS_AMM:         $OPTIONS_AMM_ID"
echo "  SETTLEMENT_ENGINE:   $SETTLEMENT_ENGINE_ID"
echo "  RISK_MANAGER:        $RISK_MANAGER_ID"
echo ""
echo "Add these to your frontend .env.local file!"
echo ""

# Create env file
cat > "$PROJECT_DIR/frontend/.env.local" << EOF
NEXT_PUBLIC_STELLAR_NETWORK=$(echo "$NETWORK" | tr '[:lower:]' '[:upper:]')
NEXT_PUBLIC_PRICE_ORACLE_CONTRACT=$PRICE_ORACLE_ID
NEXT_PUBLIC_EMISSION_OPTION_CONTRACT=$EMISSION_OPTION_ID
NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT=$OPTIONS_FACTORY_ID
NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT=$COLLATERAL_MANAGER_ID
NEXT_PUBLIC_OPTIONS_AMM_CONTRACT=$OPTIONS_AMM_ID
NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT=$SETTLEMENT_ENGINE_ID
NEXT_PUBLIC_RISK_MANAGER_CONTRACT=$RISK_MANAGER_ID
EOF

echo "✅ .env.local file created in frontend/"
echo ""
echo "🎉 Deployment successful!"
