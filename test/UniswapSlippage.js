const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UniswapSlippage", function () {
  let uniswapSlippage;
  const initialX = 3000000000; // Large liquidity for token X
  const initialY = 2000000000; // Large liquidity for token Y

  beforeEach(async function () {
    const UniswapSlippage = await ethers.getContractFactory("UniswapSlippage");
    uniswapSlippage = await UniswapSlippage.deploy(initialX, initialY);
    await uniswapSlippage.waitForDeployment();
  });

  it("Proof 1: Slippage is always positive", async function () {
    const deltaX = 1; // Test small purchase of token X
    const slippage = await uniswapSlippage.calculateSlippage(deltaX);

    console.log("slippage", ethers.formatUnits(slippage, 18));

    // Verify that slippage is always positive
    expect(slippage).to.be.gt(0);

    // Additional test for varying Δx
    for (let i = 1; i <= 5; i++) {
      const deltaXTest = 10 ** i; // Test for increasing Δx
      const slippageTest = await uniswapSlippage.calculateSlippage(deltaXTest);
      expect(slippageTest).to.be.gt(0);
    }
  });

  it("Proof 2: Slippage approximates Δx / x when x is large", async function () {
    const deltaX = 1; // Test small Δx compared to large x
    const slippage = await uniswapSlippage.calculateSlippage(deltaX);

    // Calculate expected approximation
    const expectedApproximation = deltaX / initialX; // Δx / x
    const slippageNormalized = +ethers.formatUnits(slippage, 18); // Normalize slippage to decimal

    // Verify that slippage approximates Δx / x
    expect(slippageNormalized).to.be.closeTo(expectedApproximation, 0.00001);

    // Test for varying Δx (ensuring small relative to x)
    for (let i = 1; i <= 5; i++) {
      const deltaXTest = 10 ** i; // Test increasing Δx
      const slippageTest = await uniswapSlippage.calculateSlippage(deltaXTest);
      const expectedApproximationTest = deltaXTest / initialX;
      const slippageNormalizedTest = +ethers.formatUnits(slippageTest, 18);

      expect(slippageNormalizedTest).to.be.closeTo(
        expectedApproximationTest,
        0.00001
      );
    }
  });
});
