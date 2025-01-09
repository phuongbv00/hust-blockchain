import { useState } from 'react'
import { ethers } from 'ethers'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TOKEN_TYPES, TokenType } from '../constants/tokenTypes'

interface BorrowFormProps {
  signer: ethers.Signer | null
  lendingContract: ethers.Contract | null
  tokenTypes: typeof TOKEN_TYPES
}

export default function BorrowForm({ signer, lendingContract, tokenTypes }: BorrowFormProps) {
  const [collateralAmount, setCollateralAmount] = useState('')
  const [borrowAmount, setBorrowAmount] = useState('')
  const [collateralType, setCollateralType] = useState<TokenType>(tokenTypes[0].id)
  const [borrowType, setBorrowType] = useState<TokenType>(tokenTypes[0].id)
  const [isBorrowing, setIsBorrowing] = useState(false)

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signer || !lendingContract) return

    setIsBorrowing(true)
    try {
      const tx = await lendingContract.borrow(
        collateralType,
        ethers.parseEther(collateralAmount),
        borrowType,
        ethers.parseEther(borrowAmount)
      )
      await tx.wait()
      alert('Borrow successful!')
    } catch (error) {
      console.error('Borrow failed:', error)
      alert('Borrow failed. See console for details.')
    } finally {
      setIsBorrowing(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Borrow Tokens</CardTitle>
        <CardDescription>Use your collateral to borrow tokens</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBorrow}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="collateralType">Collateral Type</Label>
              <Select value={collateralType} onValueChange={(value) => setCollateralType(value as TokenType)}>
                <SelectTrigger id="collateralType">
                  <SelectValue placeholder="Select collateral type" />
                </SelectTrigger>
                <SelectContent>
                  {tokenTypes.map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="collateralAmount">Collateral Amount</Label>
              <Input
                id="collateralAmount"
                placeholder="Enter collateral amount"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="borrowType">Borrow Type</Label>
              <Select value={borrowType} onValueChange={(value) => setBorrowType(value as TokenType)}>
                <SelectTrigger id="borrowType">
                  <SelectValue placeholder="Select borrow type" />
                </SelectTrigger>
                <SelectContent>
                  {tokenTypes.map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="borrowAmount">Borrow Amount</Label>
              <Input
                id="borrowAmount"
                placeholder="Enter borrow amount"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" disabled={isBorrowing} onClick={handleBorrow}>
          {isBorrowing ? 'Borrowing...' : 'Borrow'}
        </Button>
      </CardFooter>
    </Card>
  )
}

