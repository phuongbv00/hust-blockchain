export const LENDING_CONTRACT_ABI = [
  {
    inputs: [
      { name: "collateralType", type: "string" },
      { name: "collateralAmount", type: "uint256" },
      { name: "borrowTypes", type: "string[]" },
      { name: "borrowAmounts", type: "uint256[]" },
    ],
    name: "borrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllDebts",
    outputs: [
      {
        components: [
          { name: "id", type: "string" },
          { name: "borrower", type: "address" },
          { name: "collateralType", type: "string" },
          { name: "collateralAmount", type: "uint256" },
          {
            components: [
              { name: "type", type: "string" },
              { name: "amount", type: "uint256" },
            ],
            name: "debtTokens",
            type: "tuple[]",
          },
        ],
        name: "debts",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "debtId", type: "string" }],
    name: "liquidate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenType", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    name: "seedAssets",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenType", type: "string" },
      { name: "newPrice", type: "uint256" },
    ],
    name: "setTokenPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getTokenPrices",
    outputs: [
      {
        components: [
          { name: "tokenType", type: "string" },
          { name: "price", type: "uint256" },
        ],
        name: "prices",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
]

