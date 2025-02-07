const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UniswapSlippage", function () {
  let uniswapSlippage;
  const x = 3 * 10 ** 11; // Large liquidity pool of token X
  const y = 2 * 10 ** 11; // Large liquidity pool of token Y

  beforeEach(async function () {
    const UniswapSlippage = await ethers.getContractFactory("UniswapSlippage");
    uniswapSlippage = await UniswapSlippage.deploy(x, y);
    await uniswapSlippage.waitForDeployment();
  });

  it("Proof 1: Slippage is always positive", async function () {
    // Test for varying Δx
    for (let i = 0; i < 11; i++) {
      const deltaX = 10 ** i;
      const slippage = await uniswapSlippage.calculateSlippage(deltaX);

      console.log(`slippage (Δx=${deltaX}):`, ethers.formatUnits(slippage, 18));

      // Verify that slippage is always positive
      expect(slippage).to.be.gt(0);
    }
  });

  it("Proof 2: Slippage approximates Δx / x when x is large", async function () {
    // Test for varying Δx (ensuring small relative to x)
    for (let i = 0; i < 5; i++) {
      const deltaX = 10 ** i;
      const slippage = await uniswapSlippage.calculateSlippage(deltaX);

      // Calculate expected approximation
      const expectedApproximation = deltaX / x;
      const slippageNormalized = +ethers.formatUnits(slippage, 18);

      // Verify that slippage approximates Δx / x
      expect(slippageNormalized).to.be.closeTo(expectedApproximation, 0.00001);
    }
  });
});
