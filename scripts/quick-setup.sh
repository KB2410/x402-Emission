#!/bin/bash

# X402 Emission Options - Quick Setup Script
# This script helps you get started quickly with deployment

set -e

echo "🚀 X402 Emission Options Market - Quick Setup"
echo "=============================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Stellar CLI
if ! command -v stellar &> /dev/null; then
    echo "❌ Stellar CLI not found. Please install it first:"
    echo "   https://developers.stellar.org/docs/tools/developer-tools"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Please install Rust first:"
    echo "   https://rustup.rs/"
    exit 1
fi

echo "✅ All prerequisites found!"
echo ""

# Check if user has Stellar account
echo "🔑 Stellar Account Setup"
echo "========================"

if [ -z "$STELLAR_SECRET_KEY" ]; then
    echo "No STELLAR_SECRET_KEY environment variable found."
    echo ""
    echo "Choose an option:"
    echo "1. I have an existing Stellar testnet account"
    echo "2. Create a new testnet account for me"
    echo "3. Exit and set up manually"
    echo ""
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo ""
            read -p "Enter your Stellar secret key (starts with S): " secret_key
            export STELLAR_SECRET_KEY="$secret_key"
            ;;
        2)
            echo ""
            echo "🔧 Creating new testnet account..."
            
            # Generate new keypair
            stellar keys generate --global x402-test --network testnet
            
            # Fund the account
            echo "💰 Funding account with testnet XLM..."
            stellar keys fund x402-test --network testnet
            
            # Get the secret key
            secret_key=$(stellar keys show x402-test)
            export STELLAR_SECRET_KEY="$secret_key"
            
            echo "✅ New account created and funded!"
            echo "📝 Your public key: $(stellar keys address x402-test)"
            echo "🔐 Your secret key: $secret_key"
            echo ""
            echo "⚠️  IMPORTANT: Save your secret key securely!"
            echo ""
            ;;
        3)
            echo "Please set up your Stellar account and run this script again."
            exit 0
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
else
    echo "✅ Using existing STELLAR_SECRET_KEY"
fi

# Verify account has funds
echo "💰 Checking account balance..."
public_key=$(stellar keys address --secret-key "$STELLAR_SECRET_KEY")
balance=$(stellar account --account "$public_key" --network testnet 2>/dev/null | grep "XLM" | head -1 | awk '{print $2}' || echo "0")

if [ "$balance" = "0" ] || [ -z "$balance" ]; then
    echo "⚠️  Account has no XLM balance. Attempting to fund..."
    stellar account fund "$public_key" --network testnet || {
        echo "❌ Failed to fund account. Please fund manually:"
        echo "   https://laboratory.stellar.org/#account-creator?network=test"
        exit 1
    }
fi

echo "✅ Account funded with XLM"
echo ""

# Build contracts
echo "🏗️  Building smart contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..
echo "✅ Contracts built successfully"
echo ""

# Deploy contracts
echo "🚀 Deploying contracts to testnet..."
./scripts/deploy.sh testnet

if [ $? -ne 0 ]; then
    echo "❌ Contract deployment failed. Please check the error messages above."
    exit 1
fi

echo "✅ Contracts deployed successfully"
echo ""

# Initialize contracts
echo "🔧 Initializing contracts..."
./scripts/initialize.sh testnet

if [ $? -ne 0 ]; then
    echo "❌ Contract initialization failed. Please check the error messages above."
    exit 1
fi

echo "✅ Contracts initialized successfully"
echo ""

# Setup frontend
echo "🖥️  Setting up frontend..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "✅ Frontend setup complete"
echo ""

# Final instructions
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Your X402 Emission Options Market is ready!"
echo ""
echo "📝 Contract addresses saved to: frontend/.env.local"
echo "🔐 Your account: $public_key"
echo ""
echo "🚀 Next steps:"
echo "1. Start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "2. Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "3. Connect your Freighter wallet"
echo "4. Start trading options!"
echo ""
echo "📚 For detailed testing instructions, see:"
echo "   DEPLOYMENT_GUIDE.md"
echo ""
echo "🆘 Need help? Check the troubleshooting section in DEPLOYMENT_GUIDE.md"
echo ""

# Ask if user wants to start frontend
read -p "Would you like to start the frontend now? (y/n): " start_frontend

if [ "$start_frontend" = "y" ] || [ "$start_frontend" = "Y" ]; then
    echo ""
    echo "🚀 Starting frontend..."
    echo "Open http://localhost:3000 in your browser"
    echo ""
    npm run dev
fi