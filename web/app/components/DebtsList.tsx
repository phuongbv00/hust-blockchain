import { useState, useEffect } from "react"
import { ethers } from "ethers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TokenType } from "../constants/tokenTypes"

interface DebtsListProps {
  signer: ethers.Signer | null
  lendingContract: ethers.Contract | null
}

interface DebtToken {
  type: TokenType
  amount: string
}

interface Debt {
  id: string
  borrower: string
  collateralType: TokenType
  collateralAmount: string
  debtTokens: DebtToken[]
}

export default function DebtsList({ signer, lendingContract }: DebtsListProps) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchDebts()
  }, [lendingContract])

  const fetchDebts = async () => {
    if (!lendingContract) return

    setIsLoading(true)
    try {
      const debtsData = await lendingContract.getAllDebts()
      setDebts(debtsData)
    } catch (error) {
      console.error("Failed to fetch debts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLiquidate = async (debtId: string) => {
    if (!signer || !lendingContract) return

    try {
      const tx = await lendingContract.liquidate(debtId)
      await tx.wait()
      alert("Liquidation successful!")
      fetchDebts()
    } catch (error) {
      console.error("Liquidation failed:", error)
      alert("Liquidation failed. See console for details.")
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Debts to Liquidate</CardTitle>
        <CardDescription>List of all debts that can be liquidated</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading debts...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debt ID</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Collateral</TableHead>
                <TableHead>Debt Tokens</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell>{debt.id}</TableCell>
                  <TableCell>{debt.borrower}</TableCell>
                  <TableCell>
                    {ethers.formatEther(debt.collateralAmount)} {debt.collateralType}
                  </TableCell>
                  <TableCell>
                    {debt.debtTokens.map((token, index) => (
                      <div key={index}>
                        {ethers.formatEther(token.amount)} {token.type}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => handleLiquidate(debt.id)}>Liquidate</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

