'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AVAILABLE_WALLETS, WalletAdapter, walletManager, WalletType } from '@/lib/wallets'
import { DEMO_MODE } from '@/lib/stellar'

interface WalletSelectorProps {
    onConnect: (publicKey: string) => void
    onClose?: () => void
}

export default function WalletSelector({ onConnect, onClose }: WalletSelectorProps) {
    const [availableWallets, setAvailableWallets] = useState<WalletAdapter[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)

    useEffect(() => {
        const detectWallets = async () => {
            const wallets = await walletManager.detectWallets()
            setAvailableWallets(wallets)
        }
        detectWallets()
    }, [])

    const handleConnect = async (walletType: WalletType) => {
        setIsConnecting(true)
        setError(null)
        setSelectedWallet(walletType)

        try {
            const publicKey = await walletManager.connectWallet(walletType)
            onConnect(publicKey)
            onClose?.()
        } catch (error) {
            console.error('Wallet connection error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
            setError(errorMessage)
        } finally {
            setIsConnecting(false)
            setSelectedWallet(null)
        }
    }

    if (DEMO_MODE) return null

    const walletInfo = {
        freighter: {
            description: 'Most popular Stellar wallet',
            downloadUrl: 'https://freighter.app/',
        },
        rabet: {
            description: 'Feature-rich Stellar wallet',
            downloadUrl: 'https://rabet.io/',
        },
        xbull: {
            description: 'Advanced Stellar wallet',
            downloadUrl: 'https://xbull.app/',
        },
        albedo: {
            description: 'Web-based wallet',
            downloadUrl: 'https://albedo.link/',
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass rounded-2xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Choose Wallet</h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <div className="space-y-2">
                    {AVAILABLE_WALLETS.map((wallet) => {
                        const isAvailable = availableWallets.some(w => w.type === wallet.type)
                        const isLoading = isConnecting && selectedWallet === wallet.type
                        const info = walletInfo[wallet.type as keyof typeof walletInfo]

                        return (
                            <button
                                key={wallet.type}
                                onClick={() => isAvailable && handleConnect(wallet.type)}
                                disabled={!isAvailable || isConnecting}
                                className={`w-full p-4 rounded-xl text-left transition flex items-center justify-between ${
                                    isAvailable
                                        ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                                        : 'bg-white/5 border border-white/5 opacity-50 cursor-not-allowed'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">{wallet.icon}</div>
                                    <div>
                                        <h3 className="text-white font-semibold">{wallet.name}</h3>
                                        <p className="text-gray-400 text-xs">{info.description}</p>
                                    </div>
                                </div>
                                <div>
                                    {isLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-stellar-purple" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : isAvailable ? (
                                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <a
                                            href={info.downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-stellar-purple hover:text-white text-xs"
                                        >
                                            Install →
                                        </a>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-blue-400 text-xs">
                        💡 After installing a wallet, refresh the page to detect it.
                    </p>
                </div>
            </motion.div>
        </div>
    )
}