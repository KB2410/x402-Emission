# Stellar Options DEX

> ⚠️ **DISCLAIMER**: This platform is for educational and testing purposes only. Options trading involves substantial risk. See [Legal Disclaimer](COMPLETE_DOCUMENTATION.md#️-legal-disclaimer) before use.

A decentralized options trading platform for XLM on the Stellar blockchain using Soroban smart contracts. Trade call and put options with automated market making, collateralized positions, and on-chain settlement.

## 🚀 Features

- **Call & Put Options** - Trade options on XLM price movements
- **Automated Market Making (AMM)** - Liquidity pools for seamless trading
- **Collateralized Positions** - All options fully backed by collateral
- **Option Writing** - Earn premium income by writing covered calls and cash-secured puts
- **Risk Management** - Circuit breakers, collateral checks, and insurance fund
- **Real-time Portfolio Tracking** - Monitor positions and P&L
- **Multi-Wallet Support** - Freighter, Rabet, and xBull wallets
- **Decentralized & Trustless** - No intermediaries, on-chain settlement

## ⚠️ Important Notices

- **Testnet Only**: Currently deployed on Stellar Testnet with test tokens (no monetary value)
- **Educational Purpose**: For learning and testing only, not financial advice
- **Regulatory Compliance**: Users responsible for compliance with local laws
- **No Warranties**: Provided "AS IS" without warranties of any kind
- **Risk of Loss**: You may lose your entire investment
- **Smart Contract Risk**: Contracts may contain bugs or vulnerabilities

**Read the full [Legal Disclaimer](COMPLETE_DOCUMENTATION.md#️-legal-disclaimer) and [Risk Disclosure](COMPLETE_DOCUMENTATION.md#risk-disclosure) before using this platform.**

## 📁 Project Structure

```
stellar-options-dex/
├── contracts/                    # Soroban Smart Contracts (Rust)
│   ├── emission-option/         # Core option contract
│   ├── options-factory/         # Option series factory
│   ├── collateral-manager/      # Collateral handling
│   ├── options-amm/             # AMM for options
│   ├── settlement-engine/       # Settlement logic
│   ├── price-oracle/            # Price feeds
│   └── risk-manager/            # Risk controls
│
├── frontend/                     # Next.js Frontend
│   ├── src/app/                 # Pages (Trade, Write, Pools, Portfolio)
│   ├── src/components/          # React components
│   ├── src/lib/                 # Stellar integration & security
│   └── src/types/               # TypeScript types
│
└── scripts/                      # Deployment scripts
    ├── deploy.sh                # Contract deployment
    └── initialize.sh            # Contract initialization
```

## 🛠️ Prerequisites

- Rust 1.74+ with `wasm32-unknown-unknown` target
- Stellar CLI 25.1.0+ (for Soroban development)
- Node.js 18+
- Freighter Wallet browser extension

## 📦 Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd stellar-options-dex

# Install frontend dependencies
cd frontend
npm install
```

### 2. Deploy Contracts (Testnet)

```bash
# Set your testnet secret key
export STELLAR_SECRET_KEY=S...

# Deploy and initialize contracts
./scripts/init-and-create-options.sh
```

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to access the application.

## 🔧 Configuration

The deployment script automatically creates `.env.local` with contract addresses:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_EMISSION_OPTION_CONTRACT=C...
NEXT_PUBLIC_OPTIONS_AMM_CONTRACT=C...
NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT=C...
NEXT_PUBLIC_PRICE_ORACLE_CONTRACT=C...
NEXT_PUBLIC_RISK_MANAGER_CONTRACT=C...
NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT=C...
```

## 📖 Smart Contract Overview

### EmissionOption (Core Options Contract)

Create, trade, and settle options on XLM.

- `write_option()` - Create a new option
- `buy_option()` - Purchase an option
- `exercise_option()` - Exercise in-the-money options
- `settle_option()` - Settle expired options

### OptionsAMM (Automated Market Maker)

Liquidity pools for options trading.

- `create_pool()` - Create new liquidity pool
- `add_liquidity()` / `remove_liquidity()` - Manage liquidity
- `get_quote()` - Get option price quote
- Black-Scholes based pricing with dynamic IV

### CollateralManager

Manages collateral deposits and liquidations.

- `deposit()` / `withdraw()` - Manage collateral
- `lock_collateral()` - Lock for positions
- `liquidate()` - Liquidate unhealthy positions

### RiskManager

Risk controls and circuit breakers.

- `pause_trading()` / `resume_trading()` - Circuit breaker
- `validate_trade()` - Check risk limits
- Insurance fund management

### PriceOracle

Real-time price feeds for settlement.

- `get_price()` - Get current XLM price
- `update_price()` - Update price feed
- TWAP calculation for manipulation resistance

### SettlementEngine

Automated option settlement.

- `settle_expired()` - Settle expired options
- `process_exercise()` - Process early exercise
- Collateral distribution

## 🔒 Security Features

- **OWASP Compliant**: Follows OWASP Top 10 best practices
- **Rate Limiting**: IP and user-based rate limits
- **Input Validation**: Schema-based validation on all inputs
- **Security Headers**: CSP, X-Frame-Options, etc.
- **Secure Wrappers**: All operations wrapped with security layers
- **No Hard-coded Secrets**: Environment-based configuration
- **Error Sanitization**: User-friendly error messages

See [Security Implementation](COMPLETE_DOCUMENTATION.md#security-implementation) for details.

## 🎯 Use Cases

1. **Price Speculation** - Bet on XLM price movements with leverage
2. **Hedging** - Protect XLM holdings against volatility
3. **Income Generation** - Earn premiums by writing options
4. **Liquidity Provision** - Earn trading fees from AMM pools
5. **Portfolio Management** - Sophisticated risk management strategies

## 🧪 Testing

### Smart Contracts
```bash
cd contracts
cargo test --workspace
```

### Frontend
```bash
cd frontend
npm test
```

### Security Testing
```bash
# Test rate limiting
for i in {1..20}; do curl http://localhost:3000/api/endpoint; done

# Check security headers
curl -I http://localhost:3000
```

## 📚 Documentation

- **Complete Documentation**: [COMPLETE_DOCUMENTATION.md](COMPLETE_DOCUMENTATION.md)
- **Legal Disclaimer**: See documentation
- **Risk Disclosure**: See documentation
- **Security Implementation**: See documentation
- **FAQ**: See documentation

## 📄 License

MIT License - See LICENSE file for details

**DISCLAIMER**: This license does not constitute legal, financial, or investment advice. Use at your own risk.

## 🤝 Contributing

Contributions welcome! Please:
1. Read [COMPLETE_DOCUMENTATION.md](COMPLETE_DOCUMENTATION.md)
2. Understand the risks and legal implications
3. Follow security best practices
4. Submit pull requests with clear descriptions

## 📞 Support

- **Documentation**: [COMPLETE_DOCUMENTATION.md](COMPLETE_DOCUMENTATION.md)
- **Issues**: GitHub Issues (for bugs only, not trading losses)
- **Community**: Check repository for community links

**Note**: No customer support for trading losses or user errors. Blockchain transactions are irreversible.

## 🎉 Recent Updates

- ✅ Implemented comprehensive security hardening (OWASP compliant)
- ✅ Added legal disclaimers and risk disclosures
- ✅ Rebranded as general-purpose Stellar Options DEX
- ✅ Real Soroban contract integration
- ✅ Wallet connection and transaction signing
- ✅ Portfolio tracking with real positions
- ✅ Deployment and initialization scripts
- ✅ Proper error handling and loading states

## ⚖️ Legal

**This platform is provided for educational purposes only.**

- Not financial advice
- No warranties or guarantees
- Users responsible for regulatory compliance
- Developers not liable for losses
- Smart contracts may contain bugs
- Use at your own risk

**BY USING THIS PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ AND AGREE TO THE [LEGAL DISCLAIMER](COMPLETE_DOCUMENTATION.md#️-legal-disclaimer).**
