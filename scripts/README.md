# X402 Scripts

This directory contains deployment and setup scripts for the X402 Emission Options platform.

## Available Scripts

### `deploy.sh`
Deploys all 7 smart contracts to Stellar network.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./deploy.sh testnet
```

### `initialize.sh`
Initializes all deployed contracts with configuration.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./initialize.sh testnet
```

### `create-test-options.sh`
Creates 3 test options on the EmissionOption contract.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./create-test-options.sh testnet
```

### `quick-setup.sh`
One-command setup: deploys, initializes, and creates test options.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./quick-setup.sh testnet
```

### `test-deployment.sh`
Tests deployed contracts to verify they're working.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./test-deployment.sh testnet
```

### `create-demo-option.sh`
Creates a single demo option for testing.

**Usage:**
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./create-demo-option.sh testnet
```

## Prerequisites

1. **Stellar CLI** installed
   ```bash
   cargo install --locked stellar-cli
   ```

2. **Funded Testnet Account**
   - Get XLM from: https://laboratory.stellar.org/#account-creator?network=test

3. **Secret Key**
   - Export your secret key before running scripts:
   ```bash
   export STELLAR_SECRET_KEY="SXXX..."
   ```

## Network Options

All scripts accept a network parameter:
- `testnet` (default) - Stellar Testnet
- `mainnet` - Stellar Mainnet (use with caution!)

## Common Issues

### "Contract already initialized"
This is normal - the script will continue with other operations.

### "Option not found" error
Run `create-test-options.sh` to populate the contract with test data.

### "Insufficient balance"
Fund your testnet account at https://laboratory.stellar.org/#account-creator?network=test

## Quick Start

For a fresh deployment:
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./quick-setup.sh testnet
```

To just create options on existing deployment:
```bash
export STELLAR_SECRET_KEY="YOUR_SECRET_KEY"
./create-test-options.sh testnet
```

## See Also

- `../QUICK_SETUP_GUIDE.md` - Manual setup commands
- `../DEPLOYMENT_GUIDE.md` - Detailed deployment guide
- `../SCRIPTS_GUIDE.md` - Comprehensive script documentation
