'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/Navbar'
import OptionCard from '@/components/OptionCard'
import Toast, { ToastType } from '@/components/Toast'
import WalletConnect from '@/components/WalletConnect'
import FreighterSetupGuide from '@/components/FreighterSetupGuide'
import MockDataBanner from '@/components/MockDataBanner'
import {
    getOpenOptions,
    getPublicKey,
    formatXLM,
    formatPrice,
    formatExpiry,
    EmissionOption,
    DEMO_MODE,
    DEMO_ACCOUNT
} from '@/lib/stellar'
import { buyOptionSecure } from '@/lib/stellar-secure'
import DemoModeIndicator from '@/components/DemoModeIndicator'

import { useRealTimeData } from '@/hooks/useRealTimeData'
import { blackScholes, daysToYears, daysToExpiry } from '@/lib/pricing'

type OrderSide = 'buy' | 'sell'
type OptionType = 'call' | 'put'

interface OptionCardData {
    id: number
    strike: string
    strikeValue: number
    expiry: string
    expiryTimestamp: number
    premium: string
    iv: string
    delta: string
    gamma: string
    optionType: 'Call' | 'Put'
}

export default function TradePage() {
    const { xlmPrice, priceChange24h } = useRealTimeData()
    const [selectedType, setSelectedType] = useState<OptionType>('call')
    const [orderSide, setOrderSide] = useState<OrderSide>('buy')
    const [selectedOption, setSelectedOption] = useState<OptionCardData | null>(null)
    const [amount, setAmount] = useState('')
    const [showOrderModal, setShowOrderModal] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [options, setOptions] = useState<EmissionOption[]>([])
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'success',
        isVisible: false
    })

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type, isVisible: true })
    }

    const hideToast = () => {
        setToast(prev => ({ ...prev, isVisible: false }))
    }

    // Load options and user data on component mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                // In demo mode, automatically set user public key
                if (DEMO_MODE) {
                    setUserPublicKey(DEMO_ACCOUNT.publicKey)
                } else {
                    // Load user public key from wallet
                    const publicKey = await getPublicKey()
                    setUserPublicKey(publicKey)
                }

                // Load open options
                const openOptions = await getOpenOptions()
                setOptions(openOptions)
            } catch (error) {
                console.error('Error loading data:', error)
                showToast('Error loading options data', 'error')
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    // Convert EmissionOption to OptionCardData format with dynamic pricing
    const getDynamicCardData = (option: EmissionOption): OptionCardData => {
        const strikePrice = Number(option.strikePrice) / 1000000
        const timeToExpiryYears = daysToYears(daysToExpiry(option.expiration))
        const isCall = option.optionType === 'Call'

        // Use Black-Scholes for dynamic premiums and Greeks
        const pricing = blackScholes({
            spot: xlmPrice,
            strike: strikePrice,
            timeToExpiry: timeToExpiryYears,
            riskFreeRate: 0.05,
            volatility: 0.6 // Mock 60% IV
        }, isCall)

        return {
            id: option.id,
            strike: `$${formatPrice(option.strikePrice)}`,
            strikeValue: strikePrice,
            expiry: formatExpiry(option.expiration),
            expiryTimestamp: option.expiration,
            premium: `${pricing[isCall ? 'callPrice' : 'putPrice'].toFixed(4)} XLM`,
            iv: `60%`,
            delta: pricing.delta.toFixed(2),
            gamma: pricing.gamma.toFixed(4),
            optionType: option.optionType
        }
    }

    const handleOrder = async () => {
        if (!amount || isNaN(parseFloat(amount))) {
            showToast('Please enter a valid amount', 'error')
            return
        }

        if (!selectedOption) {
            showToast('No option selected', 'error')
            return
        }

        if (!userPublicKey) {
            if (DEMO_MODE) {
                showToast('Demo mode: This would require wallet connection in production', 'info')
                return
            } else {
                showToast('Please connect your wallet first', 'error')
                return
            }
        }

        if (orderSide === 'sell') {
            showToast('Selling options not yet implemented', 'info')
            return
        }

        setIsProcessing(true)

        try {
            const txHash = await buyOptionSecure(selectedOption.id, userPublicKey)

            setShowOrderModal(false)
            setAmount('')

            showToast(
                `Option purchased successfully! Transaction: ${txHash.slice(0, 8)}...`,
                'success'
            )

            // Refresh options data
            const updatedOptions = await getOpenOptions()
            setOptions(updatedOptions)

        } catch (error) {
            console.error('Error buying option:', error)
            showToast(
                error instanceof Error ? error.message : 'Failed to buy option',
                'error'
            )
        } finally {
            setIsProcessing(false)
        }
    }

    // Filter options by type and calculate dynamic data
    const filteredOptions = options
        .filter(option => option.optionType.toLowerCase() === selectedType)
        .filter(option => option.status === 'Open')
        .map(getDynamicCardData)

    const handleOptionSelect = (option: OptionCardData) => {
        setSelectedOption(option)
        setShowOrderModal(true)
    }

    return (
        <main className="min-h-screen">
            <Navbar />

            <div className="pt-24 pb-12 px-6">
                <div className="max-w-7xl mx-auto">
                    {/* Page Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Trade Options</h1>
                            <p className="text-gray-400">Buy and sell emission options</p>
                        </div>

                        {/* Wallet Connection Prompt */}
                        {!DEMO_MODE && !userPublicKey && (
                            <div className="mb-8">
                                <div className="glass rounded-2xl p-8 max-w-2xl mx-auto text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-stellar-gradient flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
                                    <p className="text-gray-400 mb-6">
                                        Connect your Freighter wallet to start trading emission options on Stellar.
                                    </p>
                                    <WalletConnect onConnect={setUserPublicKey} className="inline-block" />
                                    <div className="mt-6 p-4 bg-blue-500/10 rounded-xl">
                                        <p className="text-blue-400 text-sm">
                                            <strong>Need help?</strong> Check out our <a href="/wallet-setup" className="underline">Wallet Setup Guide</a> for step-by-step instructions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Demo Mode Indicator - only shown in demo mode */}
                        {DEMO_MODE && <DemoModeIndicator />}

                        {/* Mock Data Banner - shown when using example data */}
                        {!DEMO_MODE && <MockDataBanner />}

                        {/* Price Ticker */}
                        <div className="flex items-center gap-6 mb-8">
                            <div className="stat-card rounded-xl px-6 py-3">
                                <p className="text-gray-400 text-xs">XLM Price</p>
                                <motion.p
                                    key={xlmPrice}
                                    initial={{ opacity: 0.5 }}
                                    animate={{ opacity: 1 }}
                                    className="text-xl font-bold text-white"
                                >
                                    ${xlmPrice.toFixed(4)}
                                </motion.p>
                            </div>
                            <div className="stat-card rounded-xl px-6 py-3">
                                <p className="text-gray-400 text-xs">24h Change</p>
                                <motion.p
                                    key={priceChange24h}
                                    initial={{ opacity: 0.5 }}
                                    animate={{ opacity: 1 }}
                                    className={`text-xl font-bold ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                                </motion.p>
                            </div>

                            {/* Account Info */}
                            {userPublicKey && (
                                <div className="stat-card rounded-xl px-6 py-3">
                                    <p className="text-gray-400 text-xs">{DEMO_MODE ? 'Demo Account' : 'Connected'}</p>
                                    <p className="text-white font-medium">
                                        {userPublicKey.slice(0, 4)}...{userPublicKey.slice(-4)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-4 mb-8">
                        {/* Option Type Toggle */}
                        <div className="flex rounded-xl overflow-hidden glass">
                            <button
                                onClick={() => setSelectedType('call')}
                                className={`px-6 py-3 font-medium transition ${selectedType === 'call'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Calls
                            </button>
                            <button
                                onClick={() => setSelectedType('put')}
                                className={`px-6 py-3 font-medium transition ${selectedType === 'put'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Puts
                            </button>
                        </div>

                        {/* Buy/Sell Toggle */}
                        <div className="flex rounded-xl overflow-hidden glass">
                            <button
                                onClick={() => setOrderSide('buy')}
                                className={`px-6 py-3 font-medium transition ${orderSide === 'buy'
                                    ? 'bg-stellar-purple/20 text-stellar-purple'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Buy
                            </button>
                            <button
                                onClick={() => setOrderSide('sell')}
                                className={`px-6 py-3 font-medium transition ${orderSide === 'sell'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Sell
                            </button>
                        </div>

                        {/* Expiry Filter */}
                        <div className="flex items-center">
                            <label htmlFor="expiry-filter" className="sr-only">Filter by Expiry</label>
                            <select
                                id="expiry-filter"
                                name="expiry"
                                className="input-field rounded-xl px-4 py-3 text-white bg-transparent"
                            >
                                <option value="mar2026">Mar 2026</option>
                                <option value="jun2026">Jun 2026</option>
                                <option value="sep2026">Sep 2026</option>
                            </select>
                        </div>
                    </div>

                    {/* Options Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-3 text-gray-400">
                                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading options...
                            </div>
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="glass rounded-2xl p-8 max-w-md mx-auto">
                                <h3 className="text-xl font-semibold text-white mb-2">
                                    No {selectedType}s available
                                </h3>
                                <p className="text-gray-400">
                                    There are currently no open {selectedType} options. Check back later or try the other option type.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOptions.map((option, i) => (
                                <motion.div
                                    key={`${option.id}-${i}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <OptionCard
                                        type={option.optionType}
                                        strike={option.strike}
                                        expiry={option.expiry}
                                        premium={option.premium}
                                        iv={option.iv}
                                        delta={option.delta}
                                        gamma={option.gamma}
                                        onClick={() => handleOptionSelect(option)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Order Modal */}
            <AnimatePresence>
                {showOrderModal && selectedOption && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowOrderModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">
                                        {orderSide === 'buy' ? 'Buy' : 'Sell'} {selectedType === 'call' ? 'Call' : 'Put'}
                                    </h2>
                                    <p className="text-gray-400">Strike: {selectedOption.strike}</p>
                                </div>
                                <button
                                    onClick={() => setShowOrderModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label htmlFor="amount-input" className="text-gray-400 text-sm mb-2 block">Amount (contracts)</label>
                                    <input
                                        id="amount-input"
                                        name="amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="input-field w-full rounded-xl px-4 py-3 text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="stat-card rounded-xl p-4">
                                        <p className="text-gray-400 text-xs">Premium per contract</p>
                                        <p className="text-white font-medium">{selectedOption.premium}</p>
                                    </div>
                                    <div className="stat-card rounded-xl p-4">
                                        <p className="text-gray-400 text-xs">Total Cost</p>
                                        <p className="text-white font-medium">
                                            {amount ? `${(parseFloat(amount) * parseFloat(selectedOption.premium.split(' ')[0])).toFixed(4)} XLM` : '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="stat-card rounded-xl p-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">IV</span>
                                        <span className="text-white">{selectedOption.iv}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">Delta</span>
                                        <span className="text-white">{selectedOption.delta}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Expiry</span>
                                        <span className="text-white">{selectedOption.expiry}</span>
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleOrder}
                                disabled={isProcessing || !amount}
                                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2
                  ${orderSide === 'buy' ? 'btn-primary' : 'btn-danger'}
                  ${(isProcessing || !amount) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    `${orderSide === 'buy' ? 'Buy' : 'Sell'} Option`
                                )}
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
            />
        </main>
    )
}
