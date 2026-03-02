'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Toast, { ToastType } from '@/components/Toast'
import WalletConnect from '@/components/WalletConnect'
import DemoModeIndicator from '@/components/DemoModeIndicator'
import {
    getActivePools,
    getPoolById,
    getLpPosition,
    getPublicKey,
    formatXLM,
    formatPrice,
    formatExpiry,
    OptionsPool,
    LpPosition,
    DEMO_MODE,
    DEMO_ACCOUNT
} from '@/lib/stellar'
import { addLiquiditySecure, removeLiquiditySecure } from '@/lib/stellar-secure'
import { useRealTimeData } from '@/hooks/useRealTimeData'

export default function PoolsPage() {
    const { tvlXlm, lastUpdate } = useRealTimeData()
    const [showAddLiquidity, setShowAddLiquidity] = useState(false)
    const [showRemoveLiquidity, setShowRemoveLiquidity] = useState(false)
    const [selectedPool, setSelectedPool] = useState<OptionsPool | null>(null)
    const [callAmount, setCallAmount] = useState('')
    const [putAmount, setPutAmount] = useState('')
    const [removeShares, setRemoveShares] = useState('')
    const [pools, setPools] = useState<OptionsPool[]>([])
    const [userPositions, setUserPositions] = useState<Map<number, LpPosition>>(new Map())
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
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
        const loadData = async () => {
            setIsLoading(true)
            try {
                // Load user public key
                let publicKey: string | null = null
                if (DEMO_MODE) {
                    publicKey = DEMO_ACCOUNT.publicKey
                } else {
                    publicKey = await getPublicKey()
                }
                setUserPublicKey(publicKey)

                // Load active pools
                const activePools = await getActivePools()
                setPools(activePools)

                // Load user LP positions if wallet connected
                if (publicKey) {
                    const positions = new Map<number, LpPosition>()
                    for (const pool of activePools) {
                        const position = await getLpPosition(publicKey, pool.id)
                        if (position && position.shares > 0) {
                            positions.set(pool.id, position)
                        }
                    }
                    setUserPositions(positions)
                }
            } catch (error) {
                console.error('Error loading pools:', error)
                showToast('Error loading pool data', 'error')
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    useEffect(() => {
        if (pools.length === 0) return

        // Minor local fluctuations synced with lastUpdate
        setPools(prevPools => prevPools.map(pool => {
            const drift = 1 + (Math.random() * 0.0002 - 0.0001)
            return {
                ...pool,
                callLiquidity: BigInt(Math.floor(Number(pool.callLiquidity) * drift)),
                putLiquidity: BigInt(Math.floor(Number(pool.putLiquidity) * drift)),
            }
        }))
    }, [lastUpdate])

    const handleAddLiquidity = (pool: OptionsPool) => {
        if (!userPublicKey) {
            if (DEMO_MODE) {
                showToast('Demo mode: This would require wallet connection in production', 'info')
                return
            } else {
                showToast('Please connect your wallet first', 'error')
                return
            }
        }
        setSelectedPool(pool)
        setShowAddLiquidity(true)
    }

    const handleRemoveLiquidity = (pool: OptionsPool) => {
        if (!userPublicKey) {
            if (DEMO_MODE) {
                showToast('Demo mode: This would require wallet connection in production', 'info')
                return
            } else {
                showToast('Please connect your wallet first', 'error')
                return
            }
        }
        setSelectedPool(pool)
        setShowRemoveLiquidity(true)
    }

    const executeAddLiquidity = async () => {
        if (!selectedPool || !userPublicKey || !callAmount || !putAmount) {
            showToast('Please fill in all amounts', 'error')
            return
        }

        setIsProcessing(true)
        try {
            const callAmountBigInt = BigInt(Math.floor(parseFloat(callAmount) * 10_000_000))
            const putAmountBigInt = BigInt(Math.floor(parseFloat(putAmount) * 10_000_000))

            const txHash = await addLiquiditySecure(
                selectedPool.id,
                callAmountBigInt,
                putAmountBigInt,
                userPublicKey
            )

            showToast(`Liquidity added successfully! Transaction: ${txHash.slice(0, 8)}...`, 'success')

            // Refresh data
            const updatedPools = await getActivePools()
            setPools(updatedPools)

            // Update user position
            const newPosition = await getLpPosition(userPublicKey, selectedPool.id)
            if (newPosition) {
                setUserPositions(prev => new Map(prev.set(selectedPool.id, newPosition)))
            }

            setShowAddLiquidity(false)
            setCallAmount('')
            setPutAmount('')
        } catch (error) {
            console.error('Error adding liquidity:', error)
            showToast(
                error instanceof Error ? error.message : 'Failed to add liquidity',
                'error'
            )
        } finally {
            setIsProcessing(false)
        }
    }

    const executeRemoveLiquidity = async () => {
        if (!selectedPool || !userPublicKey || !removeShares) {
            showToast('Please enter shares amount', 'error')
            return
        }

        setIsProcessing(true)
        try {
            const sharesBigInt = BigInt(Math.floor(parseFloat(removeShares) * 10_000_000))

            const txHash = await removeLiquiditySecure(
                selectedPool.id,
                sharesBigInt,
                userPublicKey
            )

            showToast(`Liquidity removed successfully! Transaction: ${txHash.slice(0, 8)}...`, 'success')

            // Refresh data
            const updatedPools = await getActivePools()
            setPools(updatedPools)

            // Update user position
            const newPosition = await getLpPosition(userPublicKey, selectedPool.id)
            if (newPosition && newPosition.shares > 0) {
                setUserPositions(prev => new Map(prev.set(selectedPool.id, newPosition)))
            } else {
                setUserPositions(prev => {
                    const newMap = new Map(prev)
                    newMap.delete(selectedPool.id)
                    return newMap
                })
            }

            setShowRemoveLiquidity(false)
            setRemoveShares('')
        } catch (error) {
            console.error('Error removing liquidity:', error)
            showToast(
                error instanceof Error ? error.message : 'Failed to remove liquidity',
                'error'
            )
        } finally {
            setIsProcessing(false)
        }
    }

    // Calculate total TVL and average APY
    const totalTvl = pools.reduce((sum, pool) =>
        sum + Number(pool.callLiquidity) + Number(pool.putLiquidity), 0) / 10_000_000

    const avgApy = pools.length > 0
        ? pools.reduce((sum, pool) => sum + (pool.impliedVolatility / 100), 0) / pools.length
        : 0

    return (
        <main className="min-h-screen">
            <Navbar />

            <div className="pt-24 pb-12 px-6">
                <div className="max-w-7xl mx-auto">
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
                                    Connect your Freighter wallet to provide liquidity and earn trading fees.
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
                            <h1 className="text-3xl font-bold text-white mb-2">Liquidity Pools</h1>
                            <p className="text-gray-400">Provide liquidity and earn trading fees</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="stat-card rounded-xl px-6 py-3">
                                <p className="text-gray-400 text-xs">Total TVL</p>
                                <p className="text-xl font-bold text-white">{tvlXlm.toLocaleString()} XLM</p>
                            </div>
                            <div className="stat-card rounded-xl px-6 py-3">
                                <p className="text-gray-400 text-xs">Avg IV</p>
                                <p className="text-xl font-bold text-green-400">{avgApy.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Pools Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-3 text-gray-400">
                                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading pools...
                            </div>
                        </div>
                    ) : pools.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="glass rounded-2xl p-8 max-w-md mx-auto">
                                <h3 className="text-xl font-semibold text-white mb-2">No pools available</h3>
                                <p className="text-gray-400">
                                    There are currently no active liquidity pools. Check back later.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pools.map((pool, i) => {
                                const userPosition = userPositions.get(pool.id)
                                const poolTvl = (Number(pool.callLiquidity) + Number(pool.putLiquidity)) / 10_000_000

                                return (
                                    <motion.div
                                        key={pool.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="glass rounded-2xl p-6"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            {/* Pool Info */}
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 rounded-xl bg-stellar-gradient flex items-center justify-center">
                                                    <span className="text-white font-bold">{pool.id}</span>
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-lg">Strike ${formatPrice(pool.strikePrice)}</p>
                                                    <p className="text-gray-400 text-sm">Expires {formatExpiry(pool.expiration)}</p>
                                                    {userPosition && (
                                                        <p className="text-stellar-purple text-sm">
                                                            Your position: {formatXLM(userPosition.shares)} shares
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex flex-wrap items-center gap-8">
                                                <div className="text-center">
                                                    <p className="text-gray-400 text-xs">Call Liquidity</p>
                                                    <p className="text-white font-medium">{formatXLM(pool.callLiquidity)} XLM</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-400 text-xs">Put Liquidity</p>
                                                    <p className="text-white font-medium">{formatXLM(pool.putLiquidity)} XLM</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-400 text-xs">TVL</p>
                                                    <p className="text-white font-medium">{poolTvl.toFixed(0)} XLM</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-400 text-xs">IV</p>
                                                    <p className="text-stellar-purple font-medium">{(pool.impliedVolatility / 100).toFixed(1)}%</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-400 text-xs">Fee Rate</p>
                                                    <p className="text-green-400 font-bold">{(pool.feeRate / 100).toFixed(2)}%</p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleAddLiquidity(pool)}
                                                    className="btn-primary px-4 py-2 rounded-xl font-medium text-sm"
                                                >
                                                    Add
                                                </motion.button>
                                                {userPosition && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleRemoveLiquidity(pool)}
                                                        className="btn-danger px-4 py-2 rounded-xl font-medium text-sm"
                                                    >
                                                        Remove
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="mt-12 grid md:grid-cols-3 gap-6">
                        {[
                            { icon: '💰', title: 'Earn Fees', desc: 'Earn 0.3% on every trade in your pool' },
                            { icon: '⚡', title: 'Flexible', desc: 'Add or remove liquidity anytime' },
                            { icon: '🛡️', title: 'Protected', desc: 'Insurance fund protects against extreme events' },
                        ].map((item) => (
                            <div key={item.title} className="stat-card rounded-2xl p-6 text-center">
                                <div className="text-3xl mb-3">{item.icon}</div>
                                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                                <p className="text-gray-400 text-sm">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add Liquidity Modal */}
            <AnimatePresence>
                {showAddLiquidity && selectedPool && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowAddLiquidity(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="glass rounded-2xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
                                    <p className="text-gray-400">Pool #{selectedPool.id} - ${formatPrice(selectedPool.strikePrice)}</p>
                                </div>
                                <button onClick={() => setShowAddLiquidity(false)} className="text-gray-400 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label htmlFor="call-amount" className="text-gray-400 text-sm mb-2 block">Call Side Liquidity (XLM)</label>
                                    <input
                                        id="call-amount"
                                        name="callAmount"
                                        type="number"
                                        value={callAmount}
                                        onChange={(e) => setCallAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="input-field w-full rounded-xl px-4 py-3 text-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="put-amount" className="text-gray-400 text-sm mb-2 block">Put Side Liquidity (XLM)</label>
                                    <input
                                        id="put-amount"
                                        name="putAmount"
                                        type="number"
                                        value={putAmount}
                                        onChange={(e) => setPutAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="input-field w-full rounded-xl px-4 py-3 text-white"
                                    />
                                </div>
                                <div className="stat-card rounded-xl p-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">Current IV</span>
                                        <span className="text-stellar-purple">{(selectedPool.impliedVolatility / 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">Fee Rate</span>
                                        <span className="text-green-400">{(selectedPool.feeRate / 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Total Amount</span>
                                        <span className="text-white">
                                            {callAmount && putAmount ?
                                                `${(parseFloat(callAmount) + parseFloat(putAmount)).toFixed(2)} XLM` :
                                                '-'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={executeAddLiquidity}
                                disabled={isProcessing || !callAmount || !putAmount}
                                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 btn-primary
                                    ${(isProcessing || !callAmount || !putAmount) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    'Add Liquidity'
                                )}
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}

                {/* Remove Liquidity Modal */}
                {showRemoveLiquidity && selectedPool && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowRemoveLiquidity(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="glass rounded-2xl p-8 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Remove Liquidity</h2>
                                    <p className="text-gray-400">Pool #{selectedPool.id} - ${formatPrice(selectedPool.strikePrice)}</p>
                                </div>
                                <button onClick={() => setShowRemoveLiquidity(false)} className="text-gray-400 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                {userPositions.get(selectedPool.id) && (
                                    <div className="stat-card rounded-xl p-4 mb-4">
                                        <p className="text-gray-400 text-sm mb-2">Your Position</p>
                                        <p className="text-white font-medium">
                                            {formatXLM(userPositions.get(selectedPool.id)!.shares)} shares
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="remove-shares" className="text-gray-400 text-sm mb-2 block">Shares to Remove</label>
                                    <input
                                        id="remove-shares"
                                        name="removeShares"
                                        type="number"
                                        value={removeShares}
                                        onChange={(e) => setRemoveShares(e.target.value)}
                                        placeholder="0.00"
                                        max={userPositions.get(selectedPool.id) ?
                                            formatXLM(userPositions.get(selectedPool.id)!.shares) :
                                            undefined
                                        }
                                        className="input-field w-full rounded-xl px-4 py-3 text-white"
                                    />
                                </div>

                                <div className="stat-card rounded-xl p-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Estimated Return</span>
                                        <span className="text-white">
                                            {removeShares ? `~${removeShares} XLM` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={executeRemoveLiquidity}
                                disabled={isProcessing || !removeShares}
                                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 btn-danger
                                    ${(isProcessing || !removeShares) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    'Remove Liquidity'
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
