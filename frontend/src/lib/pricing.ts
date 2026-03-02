/**
 * Black-Scholes Options Pricing Library
 * Client-side calculations for options Greeks and fair value
 */

// Standard normal cumulative distribution function
function normalCDF(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return 0.5 * (1.0 + sign * y)
}

// Standard normal probability density function
function normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export interface OptionParams {
    spot: number        // Current price
    strike: number      // Strike price
    timeToExpiry: number // Time to expiry in years
    riskFreeRate: number // Risk-free rate (e.g., 0.05 for 5%)
    volatility: number   // Implied volatility (e.g., 0.6 for 60%)
}

export interface OptionPricing {
    callPrice: number
    putPrice: number
    delta: number
    gamma: number
    theta: number
    vega: number
    rho: number
}

/**
 * Calculate Black-Scholes option price and Greeks
 */
export function blackScholes(params: OptionParams, isCall: boolean = true): OptionPricing {
    const { spot, strike, timeToExpiry, riskFreeRate, volatility } = params

    // Handle edge cases
    if (timeToExpiry <= 0) {
        const intrinsic = isCall
            ? Math.max(0, spot - strike)
            : Math.max(0, strike - spot)
        return {
            callPrice: Math.max(0, spot - strike),
            putPrice: Math.max(0, strike - spot),
            delta: isCall ? (spot > strike ? 1 : 0) : (spot < strike ? -1 : 0),
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
        }
    }

    const sqrtT = Math.sqrt(timeToExpiry)

    // d1 and d2 calculations
    const d1 = (Math.log(spot / strike) + (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiry)
        / (volatility * sqrtT)
    const d2 = d1 - volatility * sqrtT

    // Normal CDF values
    const Nd1 = normalCDF(d1)
    const Nd2 = normalCDF(d2)
    const NNd1 = normalCDF(-d1)
    const NNd2 = normalCDF(-d2)

    // Option prices
    const discountFactor = Math.exp(-riskFreeRate * timeToExpiry)
    const callPrice = spot * Nd1 - strike * discountFactor * Nd2
    const putPrice = strike * discountFactor * NNd2 - spot * NNd1

    // Greeks
    const nd1 = normalPDF(d1)

    // Delta
    const callDelta = Nd1
    const putDelta = callDelta - 1

    // Gamma (same for call and put)
    const gamma = nd1 / (spot * volatility * sqrtT)

    // Theta
    const callTheta = (-spot * nd1 * volatility / (2 * sqrtT))
        - riskFreeRate * strike * discountFactor * Nd2
    const putTheta = (-spot * nd1 * volatility / (2 * sqrtT))
        + riskFreeRate * strike * discountFactor * NNd2

    // Vega (same for call and put)
    const vega = spot * sqrtT * nd1

    // Rho
    const callRho = strike * timeToExpiry * discountFactor * Nd2
    const putRho = -strike * timeToExpiry * discountFactor * NNd2

    return {
        callPrice,
        putPrice,
        delta: isCall ? callDelta : putDelta,
        gamma,
        theta: (isCall ? callTheta : putTheta) / 365, // Per day
        vega: vega / 100, // Per 1% change in volatility
        rho: (isCall ? callRho : putRho) / 100, // Per 1% change in rate
    }
}

/**
 * Calculate implied volatility using Newton-Raphson method
 */
export function impliedVolatility(
    marketPrice: number,
    params: Omit<OptionParams, 'volatility'>,
    isCall: boolean = true,
    maxIterations: number = 100,
    tolerance: number = 0.0001
): number {
    let sigma = 0.5 // Initial guess

    for (let i = 0; i < maxIterations; i++) {
        const pricing = blackScholes({ ...params, volatility: sigma }, isCall)
        const price = isCall ? pricing.callPrice : pricing.putPrice
        const diff = price - marketPrice

        if (Math.abs(diff) < tolerance) {
            return sigma
        }

        // Newton-Raphson update
        const vega = pricing.vega * 100 // Undo the /100 from blackScholes
        if (Math.abs(vega) < 0.0001) {
            break
        }

        sigma = sigma - diff / vega

        // Keep sigma in reasonable bounds
        sigma = Math.max(0.01, Math.min(5.0, sigma))
    }

    return sigma
}

/**
 * Format Greeks for display
 */
export function formatGreeks(pricing: OptionPricing): {
    delta: string
    gamma: string
    theta: string
    vega: string
} {
    return {
        delta: pricing.delta.toFixed(4),
        gamma: pricing.gamma.toFixed(6),
        theta: pricing.theta.toFixed(4),
        vega: pricing.vega.toFixed(4),
    }
}

/**
 * Calculate days to expiry from timestamp
 */
export function daysToExpiry(expirationTimestamp: number): number {
    const now = Date.now() / 1000
    const secondsToExpiry = expirationTimestamp - now
    return Math.max(0, secondsToExpiry / (24 * 60 * 60))
}

/**
 * Convert days to years for Black-Scholes
 */
export function daysToYears(days: number): number {
    return days / 365
}

/**
 * Calculate breakeven price for an option
 */
export function breakeven(
    strike: number,
    premium: number,
    isCall: boolean
): number {
    return isCall ? strike + premium : strike - premium
}

/**
 * Calculate max profit/loss for simple option positions
 */
export function maxProfitLoss(
    strike: number,
    premium: number,
    isCall: boolean,
    isBuy: boolean
): { maxProfit: number | 'Unlimited'; maxLoss: number } {
    if (isBuy) {
        return {
            maxProfit: isCall ? 'Unlimited' : strike - premium,
            maxLoss: premium,
        }
    } else {
        return {
            maxProfit: premium,
            maxLoss: isCall ? Infinity : strike - premium,
        }
    }
}
