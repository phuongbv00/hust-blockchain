export const TOKEN_TYPES = [
  { id: 'ETH', name: 'Ethereum' },
  { id: 'DAI', name: 'Dai Stablecoin' },
  { id: 'USDC', name: 'USD Coin' },
  { id: 'WBTC', name: 'Wrapped Bitcoin' },
] as const;

export type TokenType = typeof TOKEN_TYPES[number]['id'];
