'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { Button } from "@/components/ui/button"
import BorrowForm from './components/BorrowForm'
import DebtsList from './components/DebtsList'
import AssetsSeed from './components/AssetsSeed'
import PriceOracle from './components/PriceOracle'
import { TOKEN_TYPES } from './constants/tokenTypes'
import Image from 'next/image'
import { LENDING_CONTRACT_ABI } from './constants/lendingContractABI'

// Replace these with your actual contract address and ABI
const LENDING_CONTRACT_ADDRESS = '0x...';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function LendingSystem() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [lendingContract, setLendingContract] = useState<ethers.Contract | null>(null)

  useEffect(() => {
    const connectWallet = async () => {
      if (typeof window.ethereum === 'undefined') {
        console.log('Please install MetaMask!')
        setIsConnecting(false)
        return
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        
        // Request account access
        await provider.send("eth_requestAccounts", [])
        
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        
        const lendingContract = new ethers.Contract(LENDING_CONTRACT_ADDRESS, LENDING_CONTRACT_ABI, signer)
        
        setIsConnected(true)
        setSigner(signer)
        setAddress(address)
        setLendingContract(lendingContract)
      } catch (error) {
        console.error("Failed to connect wallet:", error)
      } finally {
        setIsConnecting(false)
      }
    }

    connectWallet()

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        handleDisconnect()
      } else {
        // User switched to a different account
        await connectWallet()
      }
    }

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  const handleDisconnect = () => {
    setIsConnected(false)
    setSigner(null)
    setAddress(null)
    setLendingContract(null)
  }

  if (isConnecting) {
    return <div className="container mx-auto p-4">Connecting to wallet...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Lending System</h1>
      {isConnected ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm flex gap-1">Connected: {address}
              <Image src="/metamask.svg" width={20} height={20} alt=""/>
            </span>
          </div>
          <BorrowForm signer={signer} lendingContract={lendingContract} tokenTypes={TOKEN_TYPES} />
          <DebtsList signer={signer} lendingContract={lendingContract} />
          <AssetsSeed signer={signer} lendingContract={lendingContract} tokenTypes={TOKEN_TYPES} />
          <PriceOracle signer={signer} lendingContract={lendingContract} tokenTypes={TOKEN_TYPES} />
        </>
      ) : (
        <div className="text-center">
          <p className="mb-4">Please connect your wallet to use the Lending System.</p>
          <Button onClick={() => window.location.reload()}>Retry Connection</Button>
        </div>
      )}
    </div>
  )
}

