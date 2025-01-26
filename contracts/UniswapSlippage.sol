// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UniswapSlippage {
    // Variables for pool reserves
    uint256 public x; // Reserve of token X
    uint256 public y; // Reserve of token Y

    // Constructor to initialize the pool reserves
    constructor(uint256 _x, uint256 _y) {
        x = _x;
        y = _y;
    }

    /**
     * @dev Calculate the slippage based on the open market price and Uniswap price.
     * @param deltaX Amount of token X being purchased.
     * @return slippage Slippage percentage as a decimal (e.g., 0.01 for 1%).
     */
    function calculateSlippage(
        uint256 deltaX
    ) public view returns (uint256 slippage) {
        require(deltaX < x, "Delta X too large, insufficient liquidity");

        // Market price p = y / x
        uint256 marketPrice = (y * 1e18) / (x); // Scale up by 1e18 for precision

        // Uniswap price Δy/Δx
        // Δy = y * Δx / (x - Δx)
        uint256 uniswapPrice = (y * deltaX * 1e18) / (x - deltaX) / deltaX; // Scale up by 1e18 for precision

        require(uniswapPrice > marketPrice, "uniswapPrice <= marketPrice");

        // Slippage s = (UniswapPrice - MarketPrice) / MarketPrice
        slippage = ((uniswapPrice - marketPrice) * 1e18) / marketPrice; // Scale up by 1e18
    }
}
