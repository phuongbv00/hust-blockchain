import { useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TOKEN_TYPES, TokenType } from "../constants/tokenTypes";
import { Plus, X } from "lucide-react";

interface BorrowFormProps {
  signer: ethers.Signer | null;
  lendingContract: ethers.Contract | null;
  tokenTypes: typeof TOKEN_TYPES;
}

interface BorrowToken {
  type: TokenType;
  amount: string;
}

export default function BorrowForm({
  signer,
  lendingContract,
  tokenTypes,
}: BorrowFormProps) {
  const [collateralAmount, setCollateralAmount] = useState("");
  const [collateralType, setCollateralType] = useState<TokenType>(
    tokenTypes[0].id
  );
  const [borrowTokens, setBorrowTokens] = useState<BorrowToken[]>([
    { type: tokenTypes[0].id, amount: "" },
  ]);
  const [isBorrowing, setIsBorrowing] = useState(false);

  const handleAddBorrowToken = () => {
    setBorrowTokens([...borrowTokens, { type: tokenTypes[0].id, amount: "" }]);
  };

  const handleRemoveBorrowToken = (index: number) => {
    if (borrowTokens.length === 1) return;
    const newBorrowTokens = borrowTokens.filter((_, i) => i !== index);
    setBorrowTokens(newBorrowTokens);
  };

  const handleBorrowTokenChange = (
    index: number,
    field: "type" | "amount",
    value: string
  ) => {
    const newBorrowTokens = [...borrowTokens];
    newBorrowTokens[index] = { ...newBorrowTokens[index], [field]: value };
    setBorrowTokens(newBorrowTokens);
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || !lendingContract) return;

    setIsBorrowing(true);
    try {
      const borrowTypes = borrowTokens.map((token) => token.type);
      const borrowAmounts = borrowTokens.map((token) =>
        ethers.parseEther(token.amount)
      );

      const tx = await lendingContract.borrow(
        collateralType,
        ethers.parseEther(collateralAmount),
        borrowTypes,
        borrowAmounts
      );
      await tx.wait();
      alert("Borrow successful!");
    } catch (error) {
      console.error("Borrow failed:", error);
      alert("Borrow failed. See console for details.");
    } finally {
      setIsBorrowing(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Borrow Tokens</CardTitle>
        <CardDescription>
          Use your collateral to borrow multiple tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBorrow}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="collateralType">Collateral Type</Label>
              <Select
                value={collateralType}
                onValueChange={(value) => setCollateralType(value as TokenType)}
              >
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
            {borrowTokens.map((token, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  {index === 0 && (
                    <Label htmlFor={`borrowType-${index}`}>Borrow Type</Label>
                  )}
                  <Select
                    value={token.type}
                    onValueChange={(value) =>
                      handleBorrowTokenChange(index, "type", value as TokenType)
                    }
                  >
                    <SelectTrigger id={`borrowType-${index}`}>
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
                <div className="flex-1">
                  {index === 0 && (
                    <Label htmlFor={`borrowAmount-${index}`}>
                      Borrow Amount
                    </Label>
                  )}
                  <Input
                    id={`borrowAmount-${index}`}
                    placeholder="Enter borrow amount"
                    value={token.amount}
                    onChange={(e) =>
                      handleBorrowTokenChange(index, "amount", e.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveBorrowToken(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={handleAddBorrowToken}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Borrow Token
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" disabled={isBorrowing} onClick={handleBorrow}>
          {isBorrowing ? "Borrowing..." : "Borrow"}
        </Button>
      </CardFooter>
    </Card>
  );
}
