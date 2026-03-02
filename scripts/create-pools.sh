#!/bin/bash

# Create liquidity pools for the Options AMM
# This script creates pools for different strike prices and expirations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Creating Liquidity Pools...${NC}"

# Check if .env.local exists
if [ ! -f "frontend/.env.local" ]; then
    echo -e "${RED}Error: frontend/.env.local not found${NC}"
    echo "Please run ./scripts/init-and-create-options.sh first"
    exit 1
fi

# Source the contract addresses
source frontend/.env.local

# Check if AMM contract is deployed
if [ -z "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" ]; then
    echo -e "${RED}Error: OPTIONS_AMM contract not found${NC}"
    echo "Please deploy contracts first"
    exit 1
fi

echo "Using AMM Contract: $NEXT_PUBLIC_OPTIONS_AMM_CONTRACT"

# Check if AMM is initialized by trying to get active pools
echo "Checking if AMM is initialized..."
INIT_CHECK=$(stellar contract invoke \
  --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
  --source test-account \
  --network testnet \
  -- \
  get_active_pools 2>&1 || echo "not_initialized")

if [[ "$INIT_CHECK" == *"not_initialized"* ]] || [[ "$INIT_CHECK" == *"NotInitialized"* ]]; then
    echo -e "${RED}Error: AMM contract is not initialized${NC}"
    echo "Please run: ./scripts/initialize.sh"
    exit 1
fi

echo -e "${GREEN}✓ AMM is initialized${NC}"

# Calculate timestamps
CURRENT_TIME=$(date +%s)
EXPIRATION_30D=$((CURRENT_TIME + 30 * 24 * 60 * 60))  # 30 days from now
EXPIRATION_60D=$((CURRENT_TIME + 60 * 24 * 60 * 60))  # 60 days from now

# Get the public key from the secret key
CREATOR_ADDRESS="GCHWURXZ6US3SCIBMTH7N6DLYAG2WV63IE54G5NMJ33ZWCO4LJYWBYBK"

echo "Creator Address: $CREATOR_ADDRESS"

# Initial liquidity amounts (in stroops, 7 decimals)
INITIAL_CALL="10000000000"  # 1000 XLM
INITIAL_PUT="10000000000"   # 1000 XLM

# Pool 1: Strike $0.15, 30 days
echo -e "${YELLOW}Creating Pool 1: Strike \$0.15, 30 days expiration${NC}"
stellar contract invoke \
  --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
  --source test-account \
  --network testnet \
  -- \
  create_pool \
  --creator "$CREATOR_ADDRESS" \
  --strike_price "150000" \
  --expiration "$EXPIRATION_30D" \
  --initial_call_liquidity "$INITIAL_CALL" \
  --initial_put_liquidity "$INITIAL_PUT" \
  --fee_rate "30"

echo -e "${GREEN}✓ Pool 1 created${NC}"

# Pool 2: Strike $0.12, 30 days
echo -e "${YELLOW}Creating Pool 2: Strike \$0.12, 30 days expiration${NC}"
stellar contract invoke \
  --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
  --source test-account \
  --network testnet \
  -- \
  create_pool \
  --creator "$CREATOR_ADDRESS" \
  --strike_price "120000" \
  --expiration "$EXPIRATION_30D" \
  --initial_call_liquidity "$INITIAL_CALL" \
  --initial_put_liquidity "$INITIAL_PUT" \
  --fee_rate "30"

echo -e "${GREEN}✓ Pool 2 created${NC}"

# Pool 3: Strike $0.18, 60 days
echo -e "${YELLOW}Creating Pool 3: Strike \$0.18, 60 days expiration${NC}"
stellar contract invoke \
  --id "$NEXT_PUBLIC_OPTIONS_AMM_CONTRACT" \
  --source test-account \
  --network testnet \
  -- \
  create_pool \
  --creator "$CREATOR_ADDRESS" \
  --strike_price "180000" \
  --expiration "$EXPIRATION_60D" \
  --initial_call_liquidity "$INITIAL_CALL" \
  --initial_put_liquidity "$INITIAL_PUT" \
  --fee_rate "30"

echo -e "${GREEN}✓ Pool 3 created${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All pools created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Pools created with 1000 XLM initial liquidity each (call + put)"
echo "You can now add more liquidity to these pools from the frontend."
echo "Visit http://localhost:3000/pools to see the pools."
