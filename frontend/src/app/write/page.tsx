'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Toast, { ToastType } from '@/components/Toast'
import WalletConnect from '@/components/WalletConnect'
import DemoModeIndicator from '@/components/DemoModeIndicator'
import {
    getPublicKey,
    parseXLM,
    formatXLM,
    DEMO_MODE,
    DEMO_ACCOUNT
} from '@/lib/stellar'
import { writeOptionSecure } from '@/lib/stellar-secure'

import { useRealTimeData } from '@/hooks/useRealTimeData'

export default function WritePage() {
    const { xlmPrice: currentXlmPrice } = useRealTimeData()
    const [optionType, setOptionType] = useState<'call' | 'put'>('call')
    const [strikePrice, setStrikePrice] = useState('')
    const [expiryDays, setExpiryDays] = useState('30')
    const [underlyingAmount, setUnderlyingAmount] = useState('')
    const [premium, setPremium] = useState('')
    const [collateralAmount, setCollateralAmount] = useState('')
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
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

    useEffect(() => {
        const loadWallet = async () => {
            if (DEMO_MODE) {
                setUserPublicKey(DEMO_ACCOUNT.publicKey)
            } else {
                const publicKey = await getPublicKey()
                setUserPublicKey(publicKey)
            }
        }
        loadWallet()
    }, [])

    // Calculate suggested premium based on inputs (simplified Black-Scholes approximation)
    const suggestedPremium = underlyingAmount && strikePrice
        ? (parseFloat(underlyingAmount) * 0.008).toFixed(4)
        : '0'

    // Auto-calculate collateral based on option type and inputs
    useEffect(() => {
        if (underlyingAmount) {
            if (optionType === 'call') {
                // For calls, collateral is the underlying amount
                setCollateralAmount(underlyingAmount)
            } else {
                // For puts, collateral is strike * amount
                if (strikePrice) {
                    const putCollateral = (parseFloat(strikePrice) * parseFloat(underlyingAmount)).toFixed(2)
                    setCollateralAmount(putCollateral)
                }
            }
        }
    }, [optionType, underlyingAmount, strikePrice])

    const handleWriteOption = async () => {
        if (!userPublicKey) {
            if (DEMO_MODE) {
                showToast('Demo mode: This would require wallet connection in production', 'info')
                return
            } else {
                showToast('Please connect your wallet first', 'error')
                return
            }
        }

        if (!strikePrice || !underlyingAmount || !premium || !collateralAmount) {
            showToast('Please fill in all required fields', 'error')
            return
        }

        setIsProcessing(true)
        try {
            // Convert inputs to contract format
            const strikePriceBigInt = BigInt(Math.floor(parseFloat(strikePrice) * 1_000_000)) // 6 decimals
            const underlyingAmountBigInt = parseXLM(underlyingAmount)
            const premiumBigInt = parseXLM(premium)
            const collateralAmountBigInt = parseXLM(collateralAmount)

            // Calculate expiry timestamp
            const expirationTimestamp = Math.floor(Date.now() / 1000) + (parseInt(expiryDays) * 24 * 60 * 60)

            // Emission period (for now, use current time to expiry)
            const emissionPeriodStart = Math.floor(Date.now() / 1000)
            const emissionPeriodEnd = expirationTimestamp

            const txHash = await writeOptionSecure(
                optionType === 'call' ? 'Call' : 'Put',
                strikePriceBigInt,
                expirationTimestamp,
                emissionPeriodStart,
                emissionPeriodEnd,
                underlyingAmountBigInt,
                premiumBigInt,
                collateralAmountBigInt,
                userPublicKey
            )

            showToast(`Option created successfully! Transaction: ${txHash.slice(0, 8)}...`, 'success')

            // Reset form
            setStrikePrice('')
            setUnderlyingAmount('')
            setPremium('')
            setCollateralAmount('')

        } catch (error) {
            console.error('Error writing option:', error)
            showToast(
                error instanceof Error ? error.message : 'Failed to create option',
                'error'
            )
        } finally {
            setIsProcessing(false)
        }
    }

    const isFormValid = strikePrice && underlyingAmount && premium && collateralAmount && userPublicKey

    return (
        <main className="min-h-screen">
            <Navbar />

            <div className="pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto">
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
                                    Connect your Freighter wallet to start writing options and earning premiums.
                                </p>
                                <WalletConnect onConnect={setUserPublicKey} className="inline-block" />
                            </div>
                        </div>
                    )}

                    {/* Demo Mode Indicator - only shown in demo mode */}
                    {DEMO_MODE && <DemoModeIndicator />}

                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Write Options</h1>
                            <p className="text-gray-400">Create and sell options to earn premium</p>
                        </div>
                        {userPublicKey && (
                            <div className="stat-card rounded-xl px-6 py-3">
                                <p className="text-gray-400 text-xs">{DEMO_MODE ? 'Demo Account' : 'Connected'}</p>
                                <p className="text-white font-medium">
                                    {userPublicKey.slice(0, 4)}...{userPublicKey.slice(-4)}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Form */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="glass rounded-2xl p-8"
                        >
                            <h2 className="text-xl font-bold text-white mb-6">Create Option</h2>

                            {/* Option Type */}
                            <div className="mb-6">
                                <span id="option-type-label" className="text-gray-400 text-sm mb-2 block">Option Type</span>
                                <div
                                    role="group"
                                    aria-labelledby="option-type-label"
                                    className="flex rounded-xl overflow-hidden"
                                >
                                    <button
                                        onClick={() => setOptionType('call')}
                                        className={`flex-1 py-3 font-medium transition ${optionType === 'call'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-white/5 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Covered Call
                                    </button>
                                    <button
                                        onClick={() => setOptionType('put')}
                                        className={`flex-1 py-3 font-medium transition ${optionType === 'put'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-white/5 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Cash-Secured Put
                                    </button>
                                </div>
                            </div>

                            {/* Strike Price */}
                            <div className="mb-4">
                                <label htmlFor="strike-price" className="text-gray-400 text-sm mb-2 block">Strike Price (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <input
                                        id="strike-price"
                                        name="strikePrice"
                                        type="number"
                                        value={strikePrice}
                                        onChange={(e) => setStrikePrice(e.target.value)}
                                        placeholder="0.15"
                                        step="0.01"
                                        className="input-field w-full rounded-xl pl-8 pr-4 py-3 text-white"
                                    />
                                </div>
                                <p className="text-gray-500 text-xs mt-1">Current XLM: ${currentXlmPrice}</p>
                            </div>

                            {/* Expiry */}
                            <div className="mb-4">
                                <label htmlFor="expiry-days" className="text-gray-400 text-sm mb-2 block">Days to Expiry</label>
                                <select
                                    id="expiry-days"
                                    name="expiryDays"
                                    value={expiryDays}
                                    onChange={(e) => setExpiryDays(e.target.value)}
                                    className="input-field w-full rounded-xl px-4 py-3 text-white bg-transparent"
                                >
                                    <option value="7">7 days</option>
                                    <option value="14">14 days</option>
                                    <option value="30">30 days</option>
                                    <option value="60">60 days</option>
                                    <option value="90">90 days</option>
                                </select>
                            </div>

                            {/* Underlying Amount */}
                            <div className="mb-4">
                                <label htmlFor="underlying-amount" className="text-gray-400 text-sm mb-2 block">
                                    {optionType === 'call' ? 'Underlying Amount (X402)' : 'Underlying Amount (XLM)'}
                                </label>
                                <input
                                    id="underlying-amount"
                                    name="underlyingAmount"
                                    type="number"
                                    value={underlyingAmount}
                                    onChange={(e) => setUnderlyingAmount(e.target.value)}
                                    placeholder="1000"
                                    className="input-field w-full rounded-xl px-4 py-3 text-white"
                                />
                            </div>

                            {/* Premium */}
                            <div className="mb-4">
                                <label htmlFor="premium" className="text-gray-400 text-sm mb-2 block">Premium (XLM)</label>
                                <input
                                    id="premium"
                                    name="premium"
                                    type="number"
                                    value={premium}
                                    onChange={(e) => setPremium(e.target.value)}
                                    placeholder={suggestedPremium}
                                    className="input-field w-full rounded-xl px-4 py-3 text-white"
                                />
                                <p className="text-gray-500 text-xs mt-1">Suggested: {suggestedPremium} XLM</p>
                            </div>

                            {/* Collateral */}
                            <div className="mb-6">
                                <label htmlFor="collateral-amount" className="text-gray-400 text-sm mb-2 block">
                                    Collateral ({optionType === 'call' ? 'X402' : 'XLM'})
                                </label>
                                <input
                                    id="collateral-amount"
                                    name="collateralAmount"
                                    type="number"
                                    value={collateralAmount}
                                    onChange={(e) => setCollateralAmount(e.target.value)}
                                    placeholder="1000"
                                    className="input-field w-full rounded-xl px-4 py-3 text-white"
                                />
                                <p className="text-gray-500 text-xs mt-1">
                                    {optionType === 'call'
                                        ? 'X402 tokens will be locked as collateral'
                                        : 'XLM will be locked to secure the put'}
                                </p>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleWriteOption}
                                disabled={isProcessing || !isFormValid}
                                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 btn-primary
                                    ${(isProcessing || !isFormValid) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Creating Option...
                                    </>
                                ) : (
                                    'Write Option'
                                )}
                            </motion.button>
                        </motion.div>

                        {/* Info Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            {/* Summary Card */}
                            <div className="stat-card rounded-2xl p-6">
                                <h3 className="text-white font-bold mb-4">Option Summary</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Type</span>
                                        <span className={optionType === 'call' ? 'text-green-400' : 'text-red-400'}>
                                            {optionType === 'call' ? 'Covered Call' : 'Cash-Secured Put'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Strike</span>
                                        <span className="text-white">${strikePrice || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Expiry</span>
                                        <span className="text-white">{expiryDays} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Size</span>
                                        <span className="text-white">{underlyingAmount || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Premium</span>
                                        <span className="text-green-400">{premium || suggestedPremium} XLM</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Collateral</span>
                                        <span className="text-white">{collateralAmount || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Info */}
                            <div className="glass rounded-2xl p-6">
                                <h3 className="text-white font-bold mb-4">Risk Disclosure</h3>
                                <ul className="space-y-2 text-gray-400 text-sm">
                                    {optionType === 'call' ? (
                                        <>
                                            <li>• Your X402 will be locked until expiry</li>
                                            <li>• If exercised, you must sell at strike price</li>
                                            <li>• Max profit: Premium received</li>
                                            <li>• Max loss: Unlimited upside opportunity</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>• Your XLM will be locked until expiry</li>
                                            <li>• If exercised, you must buy at strike price</li>
                                            <li>• Max profit: Premium received</li>
                                            <li>• Max loss: Strike price - premium</li>
                                        </>
                                    )}
                                </ul>
                            </div>

                            {/* How It Works */}
                            <div className="glass rounded-2xl p-6">
                                <h3 className="text-white font-bold mb-4">How It Works</h3>
                                <ol className="space-y-3 text-gray-400 text-sm">
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 rounded-full bg-stellar-purple/20 text-stellar-purple flex items-center justify-center text-xs flex-shrink-0">1</span>
                                        <span>Deposit collateral to back your option</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 rounded-full bg-stellar-purple/20 text-stellar-purple flex items-center justify-center text-xs flex-shrink-0">2</span>
                                        <span>Set strike price, expiry, and premium</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 rounded-full bg-stellar-purple/20 text-stellar-purple flex items-center justify-center text-xs flex-shrink-0">3</span>
                                        <span>Option is listed on the market</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="w-6 h-6 rounded-full bg-stellar-purple/20 text-stellar-purple flex items-center justify-center text-xs flex-shrink-0">4</span>
                                        <span>Earn premium when someone buys</span>
                                    </li>
                                </ol>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
            />
        </main>
    )
}
