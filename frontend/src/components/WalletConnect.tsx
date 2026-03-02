'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import WalletSelector from './WalletSelector'
import { walletManager } from '@/lib/wallets'
import { DEMO_MODE } from '@/lib/stellar'
import { connectFreighterSecure } from '@/lib/stellar-secure'

interface WalletConnectProps {
    onConnect?: (publicKey: string) => void
    className?: string
}

export default function WalletConnect({ onConnect, className = '' }: WalletConnectProps) {
    const [showSelector, setShowSelector] = useState(false)
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)

    useEffect(() => {
        const checkConnection = async () => {
            if (DEMO_MODE) return
            
            try {
                const publicKey = await walletManager.getPublicKey()
                if (publicKey) {
                    setUserPublicKey(publicKey)
                    onConnect?.(publicKey)
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error)
            }
        }

        checkConnection()
    }, [onConnect])

    const handleConnect = (publicKey: string) => {
        setUserPublicKey(publicKey)
        onConnect?.(publicKey)
        setShowSelector(false)
    }

    const handleDisconnect = () => {
        walletManager.disconnect()
        setUserPublicKey(null)
    }

    if (DEMO_MODE) {
        return null // Don't show wallet connect in demo mode
    }

    if (userPublicKey) {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <div className="stat-card rounded-xl px-4 py-2">
                    <p className="text-gray-400 text-xs">Connected</p>
                    <p className="text-white font-medium text-sm">
                        {userPublicKey.slice(0, 4)}...{userPublicKey.slice(-4)}
                    </p>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="text-gray-400 hover:text-white transition text-sm"
                    title="Disconnect wallet"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        )
    }

    return (
        <>
            <div className={className}>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowSelector(true)}
                    className="btn-primary rounded-xl px-6 py-3 font-medium flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Connect Wallet
                </motion.button>
            </div>

            <AnimatePresence>
                {showSelector && (
                    <WalletSelector
                        onConnect={handleConnect}
                        onClose={() => setShowSelector(false)}
                    />
                )}
            </AnimatePresence>
        </>
    )
}
