'use client'

import { useState, useEffect } from 'react'
import { blackScholes, daysToYears, daysToExpiry } from '@/lib/pricing'

export interface RealTimeData {
    xlmPrice: number
    priceChange24h: number
    tvlXlm: number
    totalVolumeXlm: number
    activeOptionsCount: number
    lastUpdate: number
}

const INITIAL_DATA: RealTimeData = {
    xlmPrice: 0.1182,
    priceChange24h: 3.24,
    tvlXlm: 1845000,
    totalVolumeXlm: 2420000,
    activeOptionsCount: 1234,
    lastUpdate: Date.now()
}

export function useRealTimeData() {
    const [data, setData] = useState<RealTimeData>(INITIAL_DATA)

    useEffect(() => {
        const interval = setInterval(() => {
            setData(prev => {
                // XLM Price drift: ±0.1%
                const priceDrift = 1 + (Math.random() * 0.002 - 0.001)
                const newPrice = parseFloat((prev.xlmPrice * priceDrift).toFixed(4))

                // 24h Change drift: ±0.05%
                const changeDrift = (Math.random() * 0.1 - 0.05)
                const newChange = parseFloat((prev.priceChange24h + changeDrift).toFixed(2))

                // TVL drift: ±0.01%
                const tvlDrift = 1 + (Math.random() * 0.0002 - 0.0001)
                const newTvl = Math.floor(prev.tvlXlm * tvlDrift)

                // Volume increases slightly
                const volumeIncrease = Math.random() * 100
                const newVolume = Math.floor(prev.totalVolumeXlm + volumeIncrease)

                // Active options count can change by ±1
                const countChange = Math.random() > 0.9 ? (Math.random() > 0.5 ? 1 : -1) : 0
                const newCount = Math.max(0, prev.activeOptionsCount + countChange)

                return {
                    xlmPrice: newPrice,
                    priceChange24h: newChange,
                    tvlXlm: newTvl,
                    totalVolumeXlm: newVolume,
                    activeOptionsCount: newCount,
                    lastUpdate: Date.now()
                }
            })
        }, 3000)

        return () => clearInterval(interval)
    }, [])

    /**
     * Helper to calculate real-time pricing for an option based on current global spot
     */
    const getSimulatedOptionPricing = (strike: number, expiration: number, isCall: boolean, baseIv: number) => {
        const timeToExpiryYears = daysToYears(daysToExpiry(expiration))

        // Add some noise to IV as well
        const noisyIv = baseIv + (Math.random() * 0.02 - 0.01)

        const pricing = blackScholes({
            spot: data.xlmPrice,
            strike: strike,
            timeToExpiry: timeToExpiryYears,
            riskFreeRate: 0.05,
            volatility: noisyIv
        }, isCall)

        return {
            premium: isCall ? pricing.callPrice : pricing.putPrice,
            delta: pricing.delta,
            gamma: pricing.gamma,
            iv: noisyIv
        }
    }

    return {
        ...data,
        getSimulatedOptionPricing
    }
}
