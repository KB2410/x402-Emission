'use client'

import { motion } from 'framer-motion'

interface OptionCardProps {
    type: 'Call' | 'Put'
    strike: string
    expiry: string
    premium: string
    iv: string
    delta?: string
    gamma?: string
    onClick?: () => void
}

export default function OptionCard({
    type,
    strike,
    expiry,
    premium,
    iv,
    delta,
    gamma,
    onClick
}: OptionCardProps) {
    const isCall = type === 'Call'

    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`option-card ${isCall ? 'call-option' : 'put-option'} 
        rounded-2xl p-6 cursor-pointer`}
        >
            <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${isCall ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {type}
                </span>
                <span className="text-gray-400 text-sm">{expiry}</span>
            </div>

            <div className="mb-4">
                <p className="text-gray-400 text-sm">Strike Price</p>
                <p className="text-2xl font-bold text-white">{strike}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-gray-400 text-sm">Premium</p>
                    <p className="text-white font-medium">{premium}</p>
                </div>
                <div>
                    <p className="text-gray-400 text-sm">IV</p>
                    <p className="text-stellar-purple font-medium">{iv}</p>
                </div>
            </div>

            {(delta || gamma) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    {delta && (
                        <div>
                            <p className="text-gray-500 text-xs">Delta</p>
                            <p className="text-gray-300 text-sm">{delta}</p>
                        </div>
                    )}
                    {gamma && (
                        <div>
                            <p className="text-gray-500 text-xs">Gamma</p>
                            <p className="text-gray-300 text-sm">{gamma}</p>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    )
}
