// Multi-wallet support for Stellar
import { DEMO_MODE, DEMO_ACCOUNT } from './stellar'

export type WalletType = 'freighter' | 'rabet' | 'xbull' | 'lobstr' | 'albedo'

export interface WalletAdapter {
    name: string
    type: WalletType
    icon: string
    isInstalled: () => Promise<boolean>
    connect: () => Promise<string>
    getPublicKey: () => Promise<string | null>
    getNetwork: () => Promise<string | null>
    signTransaction: (xdr: string) => Promise<string>
}

// Freighter Wallet Adapter
export const FreighterAdapter: WalletAdapter = {
    name: 'Freighter',
    type: 'freighter',
    icon: '🚀',
    
    async isInstalled(): Promise<boolean> {
        if (typeof window === 'undefined') return false
        
        // Check multiple times with delays
        for (let i = 0; i < 5; i++) {
            if ('freighterApi' in window && (window as any).freighterApi) {
                return true
            }
            await new Promise(resolve => setTimeout(resolve, 200))
        }
        return false
    },
    
    async connect(): Promise<string> {
        const api = (window as any).freighterApi
        if (!api) throw new Error('Freighter not found')
        return await api.requestAccess()
    },
    
    async getPublicKey(): Promise<string | null> {
        try {
            const api = (window as any).freighterApi
            if (!api) return null
            const isConnected = await api.isConnected()
            if (!isConnected) return null
            return await api.getPublicKey()
        } catch {
            return null
        }
    },
    
    async getNetwork(): Promise<string | null> {
        try {
            const api = (window as any).freighterApi
            if (!api) return null
            return await api.getNetwork()
        } catch {
            return null
        }
    },
    
    async signTransaction(xdr: string): Promise<string> {
        const api = (window as any).freighterApi
        if (!api) throw new Error('Freighter not found')
        return await api.signTransaction(xdr, { networkPassphrase: 'Test SDF Network' })
    }
}

// Rabet Wallet Adapter
export const RabetAdapter: WalletAdapter = {
    name: 'Rabet',
    type: 'rabet',
    icon: '🦊',
    
    async isInstalled(): Promise<boolean> {
        if (typeof window === 'undefined') return false
        return 'rabet' in window
    },
    
    async connect(): Promise<string> {
        const rabet = (window as any).rabet
        if (!rabet) throw new Error('Rabet not found')
        const result = await rabet.connect()
        return result.publicKey
    },
    
    async getPublicKey(): Promise<string | null> {
        try {
            const rabet = (window as any).rabet
            if (!rabet) return null
            const result = await rabet.connect({ silent: true })
            return result?.publicKey || null
        } catch {
            return null
        }
    },
    
    async getNetwork(): Promise<string | null> {
        try {
            const rabet = (window as any).rabet
            if (!rabet) return null
            return 'TESTNET' // Rabet handles network internally
        } catch {
            return null
        }
    },
    
    async signTransaction(xdr: string): Promise<string> {
        const rabet = (window as any).rabet
        if (!rabet) throw new Error('Rabet not found')
        const result = await rabet.sign(xdr, 'testnet')
        return result.xdr
    }
}

// xBull Wallet Adapter
export const XBullAdapter: WalletAdapter = {
    name: 'xBull',
    type: 'xbull',
    icon: '🐂',
    
    async isInstalled(): Promise<boolean> {
        if (typeof window === 'undefined') return false
        return 'xBullSDK' in window
    },
    
    async connect(): Promise<string> {
        const xbull = (window as any).xBullSDK
        if (!xbull) throw new Error('xBull not found')
        await xbull.connect()
        const publicKey = await xbull.getPublicKey()
        return publicKey
    },
    
    async getPublicKey(): Promise<string | null> {
        try {
            const xbull = (window as any).xBullSDK
            if (!xbull) return null
            return await xbull.getPublicKey()
        } catch {
            return null
        }
    },
    
    async getNetwork(): Promise<string | null> {
        return 'TESTNET'
    },
    
    async signTransaction(xdr: string): Promise<string> {
        const xbull = (window as any).xBullSDK
        if (!xbull) throw new Error('xBull not found')
        const result = await xbull.signXDR(xdr)
        return result
    }
}

// Albedo Wallet Adapter (Web-based, no extension needed)
// Commented out - requires @albedo-link/intent package
// Install with: npm install @albedo-link/intent
/*
export const AlbedoAdapter: WalletAdapter = {
    name: 'Albedo',
    type: 'albedo',
    icon: '⭐',
    
    async isInstalled(): Promise<boolean> {
        return true
    },
    
    async connect(): Promise<string> {
        try {
            const albedo = await import('@albedo-link/intent').catch(() => null)
            if (!albedo) {
                throw new Error('Albedo library not available. Install with: npm install @albedo-link/intent')
            }
            const result = await albedo.default.publicKey({
                require_existing: false
            })
            return result.pubkey
        } catch (error) {
            throw new Error('Failed to connect to Albedo. Please try another wallet.')
        }
    },
    
    async getPublicKey(): Promise<string | null> {
        try {
            const stored = localStorage.getItem('albedo_pubkey')
            return stored
        } catch {
            return null
        }
    },
    
    async getNetwork(): Promise<string | null> {
        return 'TESTNET'
    },
    
    async signTransaction(xdr: string): Promise<string> {
        try {
            const albedo = await import('@albedo-link/intent').catch(() => null)
            if (!albedo) {
                throw new Error('Albedo library not available')
            }
            const result = await albedo.default.tx({
                xdr,
                network: 'testnet'
            })
            return result.signed_envelope_xdr
        } catch (error) {
            throw new Error('Failed to sign transaction with Albedo')
        }
    }
}
*/

// All available wallets (Albedo removed - requires additional package)
export const AVAILABLE_WALLETS: WalletAdapter[] = [
    FreighterAdapter,
    RabetAdapter,
    XBullAdapter
]

// Wallet Manager
export class WalletManager {
    private currentWallet: WalletAdapter | null = null
    
    async detectWallets(): Promise<WalletAdapter[]> {
        if (DEMO_MODE) return []
        
        const available: WalletAdapter[] = []
        for (const wallet of AVAILABLE_WALLETS) {
            if (await wallet.isInstalled()) {
                available.push(wallet)
            }
        }
        return available
    }
    
    async connectWallet(walletType: WalletType): Promise<string> {
        if (DEMO_MODE) {
            return DEMO_ACCOUNT.publicKey
        }
        
        const wallet = AVAILABLE_WALLETS.find(w => w.type === walletType)
        if (!wallet) {
            throw new Error(`Wallet ${walletType} not found`)
        }
        
        if (!await wallet.isInstalled()) {
            throw new Error(`${wallet.name} is not installed`)
        }
        
        const publicKey = await wallet.connect()
        this.currentWallet = wallet
        
        // Store wallet preference
        localStorage.setItem('preferred_wallet', walletType)
        if (walletType === 'albedo') {
            localStorage.setItem('albedo_pubkey', publicKey)
        }
        
        return publicKey
    }
    
    async getPublicKey(): Promise<string | null> {
        if (DEMO_MODE) {
            return DEMO_ACCOUNT.publicKey
        }
        
        // Try to get from current wallet
        if (this.currentWallet) {
            return await this.currentWallet.getPublicKey()
        }
        
        // Try to reconnect to preferred wallet
        const preferred = localStorage.getItem('preferred_wallet') as WalletType
        if (preferred) {
            const wallet = AVAILABLE_WALLETS.find(w => w.type === preferred)
            if (wallet && await wallet.isInstalled()) {
                const publicKey = await wallet.getPublicKey()
                if (publicKey) {
                    this.currentWallet = wallet
                    return publicKey
                }
            }
        }
        
        return null
    }
    
    async signTransaction(xdr: string): Promise<string> {
        if (!this.currentWallet) {
            throw new Error('No wallet connected')
        }
        return await this.currentWallet.signTransaction(xdr)
    }
    
    disconnect(): void {
        this.currentWallet = null
        localStorage.removeItem('preferred_wallet')
        localStorage.removeItem('albedo_pubkey')
    }
}

// Global wallet manager instance
export const walletManager = new WalletManager()