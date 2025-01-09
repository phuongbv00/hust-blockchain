import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TOKEN_TYPES, TokenType } from '../constants/tokenTypes'

interface PriceOracleProps {
  signer: ethers.Signer | null
  lendingContract: ethers.Contract | null
  tokenTypes: typeof TOKEN_TYPES
}

interface TokenPrice {
  tokenType: TokenType
  price: string
}

export default function PriceOracle({ signer, lendingContract, tokenTypes }: PriceOracleProps) {
  const [tokenPrices, setTokenPrices] = useState<TokenPrice[]>([])
  const [selectedToken, setSelectedToken] = useState<TokenType>(tokenTypes[0].id)
  const [newPrice, setNewPrice] = useState('')
  const [isModifyingPrice, setIsModifyingPrice] = useState(false)

  useEffect(() => {
    fetchTokenPrices()
  }, [lendingContract])

  const fetchTokenPrices = async () => {
    if (!lendingContract) return

    try {
      const prices = await Promise.all(
        tokenTypes.map(async (token) => {
          const price = await lendingContract.getTokenPrice(token.id)
          return { tokenType: token.id, price: ethers.formatEther(price) }
        })
      )
      setTokenPrices(prices)
    } catch (error) {
      console.error('Failed to fetch token prices:', error)
    }
  }

  const handleModifyPrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signer || !lendingContract) return

    setIsModifyingPrice(true)
    try {
      const tx = await lendingContract.setTokenPrice(selectedToken, ethers.parseEther(newPrice))
      await tx.wait()
      alert('Token price modified successfully!')
      fetchTokenPrices()
    } catch (error) {
      console.error('Failed to modify token price:', error)
      alert('Failed to modify token price. See console for details.')
    } finally {
      setIsModifyingPrice(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Price Oracle</CardTitle>
        <CardDescription>View and modify token prices</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token Type</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokenPrices.map((tokenPrice) => (
              <TableRow key={tokenPrice.tokenType}>
                <TableCell>{tokenPrice.tokenType}</TableCell>
                <TableCell>{tokenPrice.price}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form onSubmit={handleModifyPrice} className="mt-6">
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="selectedToken">Token Type</Label>
              <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as TokenType)}>
                <SelectTrigger id="selectedToken">
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
              <Label htmlFor="newPrice">New Price</Label>
              <Input
                id="newPrice"
                placeholder="Enter new token price"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={isModifyingPrice}>
            {isModifyingPrice ? 'Modifying...' : 'Modify Price'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

