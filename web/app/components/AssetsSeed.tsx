import { useState } from 'react'
import { ethers } from 'ethers'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TOKEN_TYPES, TokenType } from '../constants/tokenTypes'

interface AssetsSeedProps {
  signer: ethers.Signer | null
  lendingContract: ethers.Contract | null
  tokenTypes: typeof TOKEN_TYPES
}

export default function AssetsSeed({ signer, lendingContract, tokenTypes }: AssetsSeedProps) {
  const [seedAmount, setSeedAmount] = useState('')
  const [seedTokenType, setSeedTokenType] = useState<TokenType>(tokenTypes[0].id)
  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeedAssets = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signer || !lendingContract) return

    setIsSeeding(true)
    try {
      const tx = await lendingContract.seedAssets(seedTokenType, ethers.parseEther(seedAmount))
      await tx.wait()
      alert('Assets seeded successfully!')
    } catch (error) {
      console.error('Failed to seed assets:', error)
      alert('Failed to seed assets. See console for details.')
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Seed Assets</CardTitle>
        <CardDescription>Add new assets to the lending pool</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSeedAssets}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="seedTokenType">Token Type</Label>
              <Select value={seedTokenType} onValueChange={(value) => setSeedTokenType(value as TokenType)}>
                <SelectTrigger id="seedTokenType">
                  <SelectValue placeholder="Select token type" />
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
              <Label htmlFor="seedAmount">Seed Amount</Label>
              <Input
                id="seedAmount"
                placeholder="Enter amount to seed"
                value={seedAmount}
                onChange={(e) => setSeedAmount(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={isSeeding}>
            {isSeeding ? 'Seeding...' : 'Seed Assets'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

