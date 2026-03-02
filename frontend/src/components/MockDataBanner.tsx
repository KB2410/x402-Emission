'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MockDataBanner() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
            >
                <div className="glass rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">📊</div>
                        <div className="flex-1">
                            <h4 className="text-white font-semibold mb-1">Demo Data Active</h4>
                            <p className="text-gray-400 text-sm">
                                You're viewing example options and pools. To see real contract data, 
                                initialize the smart contracts using the deployment scripts.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-gray-400 hover:text-white transition"
                            title="Dismiss"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}