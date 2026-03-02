import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Particles from '@/components/Particles'
import ClickSpark from '@/components/ClickSpark'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'X402 Emission Options Market',
    description: 'Trade options on future XLM emissions from Protocol 402',
    keywords: ['Stellar', 'DeFi', 'Options', 'X402', 'XLM', 'Derivatives'],
}
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} bg-transparent`} suppressHydrationWarning>
                <div className="relative min-h-screen overflow-hidden">
                    <Particles
                        particleCount={300}
                        particleSpread={10}
                        speed={0.1}
                        particleColors={['#7B61FF', '#00C2FF']}
                        moveParticlesOnHover={true}
                        particleHoverFactor={1}
                        alphaParticles={true}
                        particleBaseSize={100}
                        sizeRandomness={1}
                        cameraDistance={20}
                        className="fixed inset-0 -z-10 pointer-events-none bg-background"
                    />

                    {/* Main content */}
                    <div className="relative z-10">
                        <ClickSpark
                            sparkColor='#fff'
                            sparkSize={10}
                            sparkRadius={15}
                            sparkCount={8}
                            duration={400}
                        >
                            {children}
                        </ClickSpark>
                    </div>
                </div>
            </body>
        </html>
    )
}
