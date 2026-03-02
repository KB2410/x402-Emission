'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'

import { useRealTimeData } from '@/hooks/useRealTimeData'

interface StatItem {
    label: string;
    key?: string;
    value?: number;
    prefix: string;
    suffix: string;
    format: (v: number) => string;
}

interface DashboardStat extends StatItem {
    display: string;
    change: string;
}

const initialStats: StatItem[] = [
    { label: 'Total Volume', key: 'totalVolumeXlm', prefix: '$', suffix: 'M', format: (v: number) => (v / 1000000).toFixed(1) },
    { label: 'Open Interest', value: 847000, prefix: '', suffix: 'K XLM', format: (v: number) => (v / 1000).toFixed(0) },
    { label: 'Active Options', key: 'activeOptionsCount', prefix: '', suffix: '', format: (v: number) => Math.floor(v).toLocaleString() },
    { label: 'TVL', key: 'tvlXlm', prefix: '$', suffix: 'M', format: (v: number) => (v / 1000000).toFixed(1) },
]

const featuredOptions = [
    { type: 'Call', strike: '$0.15', expiry: 'Mar 2026', premium: '0.008 XLM', iv: '62%' },
    { type: 'Put', strike: '$0.10', expiry: 'Mar 2026', premium: '0.005 XLM', iv: '58%' },
    { type: 'Call', strike: '$0.20', expiry: 'Jun 2026', premium: '0.012 XLM', iv: '71%' },
]

export default function Home() {
    const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
    const { totalVolumeXlm, activeOptionsCount, tvlXlm, lastUpdate } = useRealTimeData()

    const [dashboardStats, setDashboardStats] = useState<DashboardStat[]>(initialStats.map((s: StatItem) => ({
        ...s,
        display: s.value ? `${s.prefix}${s.format(s.value)}${s.suffix}` : '...',
        change: '+0.0%'
    })))

    useEffect(() => {
        setDashboardStats(prev => prev.map((stat: DashboardStat) => {
            let currentValue = stat.value || 0
            if (stat.key === 'totalVolumeXlm') currentValue = totalVolumeXlm
            if (stat.key === 'activeOptionsCount') currentValue = activeOptionsCount
            if (stat.key === 'tvlXlm') currentValue = tvlXlm

            const change = (Math.random() * 5 + 2).toFixed(1)
            return {
                ...stat,
                display: `${stat.prefix}${stat.format(currentValue)}${stat.suffix}`,
                change: `+${change}%`
            }
        }))
    }, [totalVolumeXlm, activeOptionsCount, tvlXlm])

    return (
        <main className="min-h-screen">
            <Navbar />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-sm text-gray-300">Live on Stellar Testnet {lastUpdate && ''}</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold mb-6">
                            <span className="bg-clip-text text-transparent bg-stellar-gradient">
                                Emission Options
                            </span>
                            <br />
                            <span className="text-white">Market</span>
                        </h1>

                        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                            Trade call and put options on future XLM emissions from Protocol 402.
                            Hedge your position or speculate on emission value.
                        </p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <Link href="/trade">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="btn-primary px-8 py-4 rounded-xl font-semibold text-lg"
                                >
                                    Start Trading
                                </motion.button>
                            </Link>
                            <Link href="/pools">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="glass px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10"
                                >
                                    Provide Liquidity
                                </motion.button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {dashboardStats.map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="stat-card rounded-2xl p-6 text-center"
                            >
                                <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                                <motion.p
                                    key={stat.display} // Triggers animation on change
                                    initial={{ scale: 1.1, color: '#4ade80' }}
                                    animate={{ scale: 1, color: '#ffffff' }}
                                    transition={{ duration: 0.3 }}
                                    className="text-3xl font-bold mb-1"
                                >
                                    {stat.display}
                                </motion.p>
                                <p className="text-green-400 text-sm">{stat.change}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Options */}
            <section className="py-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">
                        Featured Options
                    </h2>

                    <div className="grid md:grid-cols-3 gap-6">
                        {featuredOptions.map((option, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + i * 0.1 }}
                                onHoverStart={() => setHoveredFeature(i)}
                                onHoverEnd={() => setHoveredFeature(null)}
                                className={`option-card ${option.type === 'Call' ? 'call-option' : 'put-option'} 
                  rounded-2xl p-6 cursor-pointer`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium
                    ${option.type === 'Call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {option.type}
                                    </span>
                                    <span className="text-gray-400 text-sm">{option.expiry}</span>
                                </div>

                                <div className="mb-4">
                                    <p className="text-gray-400 text-sm">Strike Price</p>
                                    <p className="text-2xl font-bold text-white">{option.strike}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-gray-400 text-sm">Premium</p>
                                        <p className="text-white font-medium">{option.premium}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">IV</p>
                                        <p className="text-stellar-purple font-medium">{option.iv}</p>
                                    </div>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{
                                        opacity: hoveredFeature === i ? 1 : 0,
                                        height: hoveredFeature === i ? 'auto' : 0
                                    }}
                                    className="mt-4 pt-4 border-t border-white/10"
                                >
                                    <button className="w-full btn-primary py-2 rounded-lg font-medium">
                                        Trade Now
                                    </button>
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-12 text-center">
                        Why Trade Emission Options?
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: '📈',
                                title: 'Hedge X402 Holdings',
                                description: 'Protect your portfolio against XLM price volatility with put options.'
                            },
                            {
                                icon: '💰',
                                title: 'Generate Premium Income',
                                description: 'Write covered calls to earn premium while holding X402 tokens.'
                            },
                            {
                                icon: '⚡',
                                title: 'Leveraged Exposure',
                                description: 'Gain exposure to emission value with less capital through options.'
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="glass rounded-2xl p-8 text-center"
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-gray-400">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="glass rounded-3xl p-12"
                    >
                        <h2 className="text-4xl font-bold text-white mb-4">
                            Ready to Start Trading?
                        </h2>
                        <p className="text-gray-400 mb-8">
                            Connect your wallet and explore the world of emission derivatives.
                        </p>
                        <Link href="/trade">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="btn-primary px-10 py-4 rounded-xl font-semibold text-lg"
                            >
                                Launch App
                            </motion.button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                    <div className="text-gray-400">
                        © 2026 X402 Emission Options. Built on Stellar.
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="text-gray-400 hover:text-white transition">Docs</a>
                        <a href="#" className="text-gray-400 hover:text-white transition">GitHub</a>
                        <a href="#" className="text-gray-400 hover:text-white transition">Discord</a>

                    </div>
                </div>
            </footer>
        </main>
    )
}
