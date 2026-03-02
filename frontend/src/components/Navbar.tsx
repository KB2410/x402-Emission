'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from './WalletConnect'
import { DEMO_MODE, DEMO_ACCOUNT, getPublicKey } from '@/lib/stellar'

const navLinks = [
    { href: '/trade', label: 'Trade' },
    { href: '/write', label: 'Write Options' },
    { href: '/pools', label: 'Pools' },
    { href: '/portfolio', label: 'Portfolio' },
]

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const [userPublicKey, setUserPublicKey] = useState<string | null>(null)

    useEffect(() => {
        const loadUser = async () => {
            if (DEMO_MODE) {
                setUserPublicKey(DEMO_ACCOUNT.publicKey)
            } else {
                const publicKey = await getPublicKey()
                setUserPublicKey(publicKey)
            }
        }
        loadUser()
    }, [])

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-stellar-gradient flex items-center justify-center">
                            <span className="text-white font-bold">X</span>
                        </div>
                        <span className="text-xl font-bold text-white">X402 Options</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-gray-300 hover:text-white transition font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Wallet Connect */}
                    <div className="hidden md:block">
                        {DEMO_MODE ? (
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                                    DEMO
                                </div>
                                <div className="stat-card rounded-xl px-4 py-2">
                                    <p className="text-gray-400 text-xs">Demo Account</p>
                                    <p className="text-white font-medium text-sm">
                                        {DEMO_ACCOUNT.publicKey.slice(0, 4)}...{DEMO_ACCOUNT.publicKey.slice(-4)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <WalletConnect onConnect={setUserPublicKey} />
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="md:hidden p-2 text-gray-300 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden glass-dark border-t border-white/5"
                    >
                        <div className="px-6 py-4 space-y-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="block text-gray-300 hover:text-white transition font-medium"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="pt-4 border-t border-white/10">
                                {DEMO_MODE ? (
                                    <div className="flex items-center gap-3">
                                        <div className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                                            DEMO
                                        </div>
                                        <div className="stat-card rounded-xl px-4 py-2">
                                            <p className="text-gray-400 text-xs">Demo Account</p>
                                            <p className="text-white font-medium text-sm">
                                                {DEMO_ACCOUNT.publicKey.slice(0, 4)}...{DEMO_ACCOUNT.publicKey.slice(-4)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <WalletConnect onConnect={setUserPublicKey} />
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}
