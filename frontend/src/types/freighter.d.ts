declare global {
  interface Window {
    freighterApi?: {
      isConnected(): Promise<boolean>
      getPublicKey(): Promise<string>
      signTransaction(xdr: string): Promise<string>
      getNetwork(): Promise<string>
      requestAccess(): Promise<string>
      isAllowed(): Promise<boolean>
      setAllowed(): Promise<void>
    }
  }
}

export {}