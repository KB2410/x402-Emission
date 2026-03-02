'use client'

import { useState } from 'react'
import { DEMO_MODE, DEMO_ACCOUNT } from '@/lib/stellar'

export default function DemoModeIndicator() {
    const [showDetails, setShowDetails] = useState(false)

    if (!DEMO_MODE) return null

    return (
        <div className="glass rounded-2xl p-6 max-w-4xl mx-auto mb-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-xl">🚀</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Demo Mode Active</h3>
                        <p className="text-gray-400">Explore the full platform without wallet setup</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="stat-card rounded-xl px-4 py-2">
                        <p className="text-gray-400 text-xs">Demo Balance</p>
                        <p className="text-green-400 font-bold">{DEMO_ACCOUNT.balance} XLM</p>
                    </div>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="btn-secondary px-4 py-2 rounded-xl text-sm"
                    >
                        {showDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                </div>
            </div>

            {showDetails && (
                <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold">✨ What You Can Do:</h4>
                        <ul className="space-y-2 text-gray-300 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                Browse and analyze all available options
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                Simulate buying options with instant execution
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                Create new options and see them listed
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                Add/remove liquidity from AMM pools
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                View portfolio and track positions
                            </li>
                        </ul>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="text-white font-semibold">🔧 Demo Features:</h4>
                        <ul className="space-y-2 text-gray-300 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                Simulated transactions with realistic delays
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                Mock transaction hashes for testing
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                Real-time price calculations and Greeks
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                Full UI/UX experience without blockchain
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                Perfect for testing and demonstrations
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-yellow-400 text-sm">
                    <strong>💡 Ready for Production?</strong> To connect real wallets and execute on Stellar testnet, 
                    set <code className="bg-black/20 px-1 rounded">NEXT_PUBLIC_DEMO_MODE=false</code> in your environment.
                </p>
            </div>
        </div>
    )
}