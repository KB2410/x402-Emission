'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import WalletConnect from '@/components/WalletConnect'
import DemoModeIndicator from '@/components/DemoModeIndicator'
import {
    getUserOptions,
    getOptionById,
    getPublicKey,
    formatXLM,
    formatPrice,
    formatExpiry,
    EmissionOption,
    DEMO_MODE,
    DEMO_ACCOUNT
} from '@/lib/stellar'

interface UserPosition {
    option: EmissionOption
    size: number
    avgCost: bigint
    currentValue: bigint
    pnl: number
    pnlAmount: bigint
}

import { useRealTimeData } from '@/hooks/useRealTimeData'

export default function PortfolioPage() {
    const { xlmPrice, lastUpdate } = useRealTimeData()
    const [activeTab, setActiveTab] = useState<'positions' | 'written' | 'lp' | 'history'>('positions')
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)
    const [positions, setPositions] = useState<UserPosition[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadPortfolio = async () => {
            setIsLoading(true)
            try {
                let publicKey: string | null = null
                if (DEMO_MODE) {
                    publicKey = DEMO_ACCOUNT.publicKey
                } else {
                    publicKey = await getPublicKey()
                }
                setUserPublicKey(publicKey)

                if (publicKey) {
                    if (DEMO_MODE) {
                        // In demo mode, show mock positions
                        setPositions(getMockPositions())
                    } else {
                        // Get user's option IDs
                        const optionIds = await getUserOptions(publicKey)

                        // Fetch full option details
                        const userPositions: UserPosition[] = []
                        for (const optionId of optionIds) {
                            const option = await getOptionById(optionId)
                            if (option && option.buyer === publicKey) {
                                // Calculate position metrics (mock for now)
                                const size = 1 // In production, track actual position size
                                const avgCost = option.premium
                                const currentValue = option.premium // In production, get current market value
                                const pnlAmount = currentValue - avgCost
                                const pnl = Number(pnlAmount) / Number(avgCost) * 100

                                userPositions.push({
                                    option,
                                    size,
                                    avgCost,
                                    currentValue,
                                    pnl,
                                    pnlAmount
                                })
                            }
                        }

                        setPositions(userPositions)
                    }
                }
            } catch (error) {
                console.error('Error loading portfolio:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadPortfolio()
    }, [])

    useEffect(() => {
        if (positions.length === 0) return

        // Update positions based on xlmPrice drift
        setPositions(prevPositions => prevPositions.map(pos => {
            const isCall = pos.option.optionType === 'Call'
            const strikeValue = Number(pos.option.strikePrice) / 1000000

            // Simple intrinsic value simulation for demonstration
            // In reality, this would use the same Black-Scholes as Trade page
            const drift = 1 + (Math.random() * 0.001 - 0.0005)
            const newValue = BigInt(Math.floor(Number(pos.currentValue) * drift))
            const newPnlAmount = newValue - pos.avgCost
            const newPnl = (Number(newPnlAmount) / Number(pos.avgCost)) * 100

            return {
                ...pos,
                currentValue: newValue,
                pnlAmount: newPnlAmount,
                pnl: newPnl
            }
        }))
    }, [lastUpdate])

    // Calculate portfolio totals
    const totalValue = positions.reduce((sum, pos) => sum + Number(pos.currentValue) * pos.size, 0) / 10_000_000
    const totalPnlAmount = positions.reduce((sum, pos) => sum + Number(pos.pnlAmount) * pos.size, 0) / 10_000_000
    const totalPnlPct = totalValue > 0 ? (totalPnlAmount / (totalValue - totalPnlAmount)) * 100 : 0

    // Mock data for demo mode
    const getMockPositions = (): UserPosition[] => {
        return [
            {
                option: {
                    id: 1,
                    optionType: 'Call',
                    strikePrice: BigInt(150000),
                    expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                    emissionPeriodStart: Math.floor(Date.now() / 1000),
                    emissionPeriodEnd: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
                    underlyingAmount: BigInt(10000_0000000),
                    premium: BigInt(80000),
                    collateralAmount: BigInt(10000_0000000),
                    writer: 'GWRITER...',
                    buyer: DEMO_ACCOUNT.publicKey,
                    status: 'Active',
                    createdAt: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
                },
                size: 5,
                avgCost: BigInt(80000),
                currentValue: BigInt(95000),
                pnl: 18.75,
                pnlAmount: BigInt(15000)
            },
            {
                option: {
                    id: 2,
                    optionType: 'Put',
                    strikePrice: BigInt(100000),
                    expiration: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60,
                    emissionPeriodStart: Math.floor(Date.now() / 1000),
                    emissionPeriodEnd: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
                    underlyingAmount: BigInt(5000_0000000),
                    premium: BigInt(50000),
                    collateralAmount: BigInt(5000_0000000),
                    writer: 'GWRITER2...',
                    buyer: DEMO_ACCOUNT.publicKey,
                    status: 'Active',
                    createdAt: Math.floor(Date.now() / 1000) - 12 * 60 * 60,
                },
                size: 3,
                avgCost: BigInt(50000),
                currentValue: BigInt(42000),
                pnl: -16.0,
                pnlAmount: BigInt(-8000)
            }
        ]
    }

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
                                    Connect your Freighter wallet to view your portfolio and track your positions.
                                </p>
                                <WalletConnect onConnect={setUserPublicKey} className="inline-block" />
                            </div>
                        </div>
                    )}

                    {/* Demo Mode Indicator - only shown in demo mode */}
                    {DEMO_MODE && <DemoModeIndicator />}

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Portfolio</h1>
                        <p className="text-gray-400">Manage your options positions</p>
                    </div>

                    {/* Portfolio Summary */}
                    <div className="grid md:grid-cols-4 gap-4 mb-8">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card rounded-2xl p-6">
                            <p className="text-gray-400 text-sm mb-1">Total Value</p>
                            <p className="text-3xl font-bold text-white">{totalValue.toFixed(2)} XLM</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card rounded-2xl p-6">
                            <p className="text-gray-400 text-sm mb-1">Total P&L</p>
                            <p className={`text-3xl font-bold ${totalPnlAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalPnlAmount >= 0 ? '+' : ''}{totalPnlAmount.toFixed(2)} XLM
                            </p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card rounded-2xl p-6">
                            <p className="text-gray-400 text-sm mb-1">P&L %</p>
                            <p className={`text-3xl font-bold ${totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%
                            </p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card rounded-2xl p-6">
                            <p className="text-gray-400 text-sm mb-1">Open Positions</p>
                            <p className="text-3xl font-bold text-white">{positions.length}</p>
                        </motion.div>
                    </div>

                    {/* Wallet Connection for Portfolio */}
                    {!userPublicKey && !DEMO_MODE && (
                        <div className="text-center mb-8">
                            <div className="glass rounded-2xl p-8 max-w-md mx-auto">
                                <h3 className="text-xl font-semibold text-white mb-4">Portfolio Unavailable</h3>
                                <p className="text-gray-400 mb-6">
                                    Please connect your wallet above to view your portfolio and positions.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-4 mb-6">
                        {[
                            { id: 'positions', label: 'Bought Options' },
                            { id: 'written', label: 'Written Options' },
                            { id: 'lp', label: 'LP Positions' },
                            { id: 'history', label: 'History' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`px-6 py-3 rounded-xl font-medium transition ${activeTab === tab.id
                                    ? 'bg-stellar-purple/20 text-stellar-purple'
                                    : 'glass text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Positions Table */}
                    {activeTab === 'positions' && userPublicKey && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl overflow-hidden">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex items-center gap-3 text-gray-400">
                                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Loading positions...
                                    </div>
                                </div>
                            ) : positions.length === 0 ? (
                                <div className="text-center py-12">
                                    <h3 className="text-xl font-semibold text-white mb-2">No positions found</h3>
                                    <p className="text-gray-400">You don't have any open positions yet.</p>
                                </div>
                            ) : (
                                <table className="w-full option-table">
                                    <thead>
                                        <tr className="text-left text-gray-400 text-sm">
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Strike</th>
                                            <th className="px-6 py-4">Expiry</th>
                                            <th className="px-6 py-4">Size</th>
                                            <th className="px-6 py-4">Avg Cost</th>
                                            <th className="px-6 py-4">Current</th>
                                            <th className="px-6 py-4">P&L</th>
                                            <th className="px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.map((pos) => (
                                            <tr key={pos.option.id} className="border-t border-white/5">
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                                        ${pos.option.optionType === 'Call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {pos.option.optionType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-white font-medium">${formatPrice(pos.option.strikePrice)}</td>
                                                <td className="px-6 py-4 text-gray-300">{formatExpiry(pos.option.expiration)}</td>
                                                <td className="px-6 py-4 text-white">{pos.size}</td>
                                                <td className="px-6 py-4 text-gray-300">{formatXLM(pos.avgCost)} XLM</td>
                                                <td className="px-6 py-4 text-white">{formatXLM(pos.currentValue)} XLM</td>
                                                <td className="px-6 py-4">
                                                    <span className={pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(1)}% ({pos.pnlAmount >= 0 ? '+' : ''}{formatXLM(pos.pnlAmount)} XLM)
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-stellar-purple hover:text-white transition text-sm">
                                                        Exercise
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </motion.div>
                    )}

                    {/* Written Options Table */}
                    {activeTab === 'written' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl overflow-hidden">
                            <table className="w-full option-table">
                                <thead>
                                    <tr className="text-left text-gray-400 text-sm">
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Strike</th>
                                        <th className="px-6 py-4">Expiry</th>
                                        <th className="px-6 py-4">Size</th>
                                        <th className="px-6 py-4">Premium Earned</th>
                                        <th className="px-6 py-4">Collateral</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mockWrittenOptions.map((opt) => (
                                        <tr key={opt.id} className="border-t border-white/5">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium
                          ${opt.type === 'Call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {opt.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white font-medium">{opt.strike}</td>
                                            <td className="px-6 py-4 text-gray-300">{opt.expiry}</td>
                                            <td className="px-6 py-4 text-white">{opt.size}</td>
                                            <td className="px-6 py-4 text-green-400">{opt.premium}</td>
                                            <td className="px-6 py-4 text-gray-300">{opt.collateral}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                                                    {opt.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    )}

                    {/* LP Positions */}
                    {activeTab === 'lp' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-6">
                            {mockLpPositions.map((lp) => (
                                <div key={lp.poolId} className="option-card rounded-2xl p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-gray-400">Pool #{lp.poolId}</span>
                                        <span className="text-green-400 font-medium">{lp.apy} APY</span>
                                    </div>
                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm">Strike: {lp.strike}</p>
                                        <p className="text-gray-400 text-sm">Expiry: {lp.expiry}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-gray-400 text-sm">Shares</p>
                                            <p className="text-white font-medium">{lp.shares}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm">Value</p>
                                            <p className="text-white font-medium">{lp.value}</p>
                                        </div>
                                    </div>
                                    <button className="mt-4 w-full btn-primary py-2 rounded-lg text-sm">
                                        Manage Position
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* History Table */}
                    {activeTab === 'history' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl overflow-hidden">
                            <table className="w-full option-table">
                                <thead>
                                    <tr className="text-left text-gray-400 text-sm">
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Action</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Strike</th>
                                        <th className="px-6 py-4">Expiry</th>
                                        <th className="px-6 py-4">Size</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mockHistory.map((tx) => (
                                        <tr key={tx.id} className="border-t border-white/5">
                                            <td className="px-6 py-4 text-gray-300 text-sm">{tx.date}</td>
                                            <td className="px-6 py-4 text-white font-medium">{tx.action}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium
                          ${tx.type === 'Call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white">{tx.strike}</td>
                                            <td className="px-6 py-4 text-gray-300">{tx.expiry}</td>
                                            <td className="px-6 py-4 text-white">{tx.size}</td>
                                            <td className="px-6 py-4 text-gray-300">{tx.price}</td>
                                            <td className="px-6 py-4 text-white font-medium">{tx.total}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-green-400 flex items-center gap-1 text-sm">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    )}
                </div>
            </div>
        </main>
    )
}

// Mock data for demo
const mockWrittenOptions = [
    { id: 1, type: 'Call', strike: '$0.15', expiry: 'Mar 2026', size: '2', premium: '+0.016 XLM', collateral: '2000 X402', status: 'Active' },
    { id: 2, type: 'Put', strike: '$0.10', expiry: 'Jun 2026', size: '1', premium: '+0.005 XLM', collateral: '100 XLM', status: 'Expired' },
]

const mockLpPositions = [
    { poolId: 1, strike: '$0.15', expiry: 'Mar 2026', shares: '1,250', value: '125.5 XLM', apy: '24.5%' },
    { poolId: 2, strike: '$0.12', expiry: 'Jun 2026', shares: '850', value: '89.2 XLM', apy: '18.2%' },
]

const mockHistory = [
    { id: 1, date: '2026-02-04', action: 'Buy', type: 'Call', strike: '$0.15', expiry: 'Mar 26', size: '5', price: '0.008 XLM', total: '0.040 XLM', status: 'Confirmed' },
    { id: 2, date: '2026-02-03', action: 'Write', type: 'Put', strike: '$0.10', expiry: 'Jun 26', size: '3', price: '0.005 XLM', total: '0.015 XLM', status: 'Confirmed' },
    { id: 3, date: '2026-02-02', action: 'Exercise', type: 'Call', strike: '$0.12', expiry: 'Feb 26', size: '2', price: '0.006 XLM', total: '0.012 XLM', status: 'Confirmed' },
]
