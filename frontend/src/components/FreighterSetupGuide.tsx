'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function FreighterSetupGuide() {
    const [currentStep, setCurrentStep] = useState(1)

    const steps = [
        {
            number: 1,
            title: 'Install Freighter',
            description: 'Install the Freighter browser extension',
            action: (
                <a
                    href="https://freighter.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary px-6 py-3 rounded-xl inline-flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Freighter Website
                </a>
            ),
            details: [
                'Click "Add to Chrome" (or your browser)',
                'Confirm the installation',
                'Pin the extension to your toolbar'
            ]
        },
        {
            number: 2,
            title: 'Refresh This Page',
            description: 'After installing, refresh the page to detect Freighter',
            action: (
                <button
                    onClick={() => window.location.reload()}
                    className="btn-primary px-6 py-3 rounded-xl inline-flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Page
                </button>
            ),
            details: [
                'Press Ctrl+R (Cmd+R on Mac)',
                'Or click the refresh button above',
                'The page will reload and detect Freighter'
            ]
        },
        {
            number: 3,
            title: 'Import Test Account',
            description: 'Import your pre-funded test account',
            action: (
                <div className="space-y-3">
                    <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Secret Key:</p>
                        <code className="text-white text-xs break-all">
                            YOUR_STELLAR_SECRET_KEY_HERE
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText('YOUR_STELLAR_SECRET_KEY_HERE')
                            }}
                            className="mt-2 text-stellar-purple hover:text-white text-xs flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
            ),
            details: [
                'Click Freighter extension icon',
                'Select "Import wallet with secret key"',
                'Paste the secret key above',
                'Set a password for your wallet'
            ]
        },
        {
            number: 4,
            title: 'Switch to Testnet',
            description: 'Configure Freighter for Stellar Testnet',
            action: null,
            details: [
                'Open Freighter extension',
                'Click the settings icon (⚙️)',
                'Find "Network" section',
                'Select "Testnet" from dropdown',
                'Verify it shows "Test SDF Network"'
            ]
        },
        {
            number: 5,
            title: 'Connect Wallet',
            description: 'Connect your wallet to start trading',
            action: (
                <button
                    onClick={() => window.location.reload()}
                    className="btn-primary px-6 py-3 rounded-xl inline-flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Try Connecting Again
                </button>
            ),
            details: [
                'Refresh this page',
                'Click "Connect Wallet" button',
                'Approve the connection in Freighter popup',
                'Start trading options!'
            ]
        }
    ]

    return (
        <div className="glass rounded-2xl p-8 max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-stellar-gradient flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Freighter Setup Guide</h2>
                <p className="text-gray-400">Follow these steps to connect your wallet</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    {steps.map((step, index) => (
                        <div key={step.number} className="flex items-center flex-1">
                            <button
                                onClick={() => setCurrentStep(step.number)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${
                                    currentStep === step.number
                                        ? 'bg-stellar-purple text-white'
                                        : currentStep > step.number
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white/10 text-gray-400'
                                }`}
                            >
                                {currentStep > step.number ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step.number
                                )}
                            </button>
                            {index < steps.length - 1 && (
                                <div className={`flex-1 h-1 mx-2 rounded ${
                                    currentStep > step.number ? 'bg-green-500' : 'bg-white/10'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Current Step */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">
                        Step {currentStep}: {steps[currentStep - 1].title}
                    </h3>
                    <p className="text-gray-400">{steps[currentStep - 1].description}</p>
                </div>

                {steps[currentStep - 1].action && (
                    <div className="flex justify-center">
                        {steps[currentStep - 1].action}
                    </div>
                )}

                <div className="bg-black/20 rounded-xl p-6">
                    <h4 className="text-white font-semibold mb-3">Instructions:</h4>
                    <ul className="space-y-2">
                        {steps[currentStep - 1].details.map((detail, index) => (
                            <li key={index} className="flex items-start gap-3 text-gray-300 text-sm">
                                <span className="w-6 h-6 rounded-full bg-stellar-purple/20 text-stellar-purple flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                    {index + 1}
                                </span>
                                {detail}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-4">
                    <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        disabled={currentStep === 1}
                        className={`px-4 py-2 rounded-lg transition ${
                            currentStep === 1
                                ? 'opacity-50 cursor-not-allowed text-gray-500'
                                : 'text-gray-300 hover:text-white'
                        }`}
                    >
                        ← Previous
                    </button>
                    <span className="text-gray-400 text-sm">
                        Step {currentStep} of {steps.length}
                    </span>
                    <button
                        onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                        disabled={currentStep === steps.length}
                        className={`px-4 py-2 rounded-lg transition ${
                            currentStep === steps.length
                                ? 'opacity-50 cursor-not-allowed text-gray-500'
                                : 'text-gray-300 hover:text-white'
                        }`}
                    >
                        Next →
                    </button>
                </div>
            </motion.div>

            {/* Quick Tips */}
            <div className="mt-8 p-4 bg-blue-500/10 rounded-xl">
                <p className="text-blue-400 text-sm">
                    <strong>💡 Quick Tip:</strong> If you just installed Freighter, make sure to refresh this page (Ctrl+R or Cmd+R) 
                    so the browser can detect the extension!
                </p>
            </div>
        </div>
    )
}