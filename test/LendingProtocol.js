const { expect } = require("chai");
const { ethers } = require("hardhat");

const DECIMALS = 18;

describe("LendingProtocol", function () {
  let lendingProtocol, usdc, eth, axs;
  let owner, alice, bob;

  before(async function () {
    // Get signers
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy ERC20 mock tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

    usdc = await ERC20Mock.deploy("USD Coin", "USDC", DECIMALS);
    await usdc.waitForDeployment();

    eth = await ERC20Mock.deploy("Ethereum", "ETH", DECIMALS);
    await eth.waitForDeployment();

    axs = await ERC20Mock.deploy("Axie Infinity", "AXS", DECIMALS);
    await axs.waitForDeployment();

    // Deploy LendingProtocol
    const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
    lendingProtocol = await LendingProtocol.deploy();
    await lendingProtocol.waitForDeployment();

    // Mint tokens for users
    await usdc.mint(owner.address, ethers.parseUnits("10000", DECIMALS));
    await eth.mint(owner.address, ethers.parseUnits("100", DECIMALS));
    await axs.mint(owner.address, ethers.parseUnits("1000", DECIMALS));

    await usdc.mint(alice.address, ethers.parseUnits("5000", DECIMALS));
    await eth.mint(alice.address, ethers.parseUnits("50", DECIMALS));
    await axs.mint(alice.address, ethers.parseUnits("500", DECIMALS));
  });

  it("should allow setting collateral factors and exchange rates", async function () {
    await lendingProtocol.setCollateralFactor(
      usdc.target,
      ethers.parseUnits("0.9", DECIMALS)
    );
    await lendingProtocol.setCollateralFactor(
      eth.target,
      ethers.parseUnits("0.8", DECIMALS)
    );
    await lendingProtocol.setCollateralFactor(
      axs.target,
      ethers.parseUnits("0.7", DECIMALS)
    );

    await lendingProtocol.setExchangeRate(
      usdc.target,
      ethers.parseUnits("1500", DECIMALS)
    );
    await lendingProtocol.setExchangeRate(
      eth.target,
      ethers.parseUnits("1", DECIMALS)
    );
    await lendingProtocol.setExchangeRate(
      axs.target,
      ethers.parseUnits("100", DECIMALS)
    );

    const usdcFactor = await lendingProtocol.collateralFactors(usdc.target);
    expect(usdcFactor).to.equal(ethers.parseUnits("0.9", DECIMALS));
    const ethFactor = await lendingProtocol.collateralFactors(eth.target);
    expect(ethFactor).to.equal(ethers.parseUnits("0.8", DECIMALS));
    const axsFactor = await lendingProtocol.collateralFactors(axs.target);
    expect(axsFactor).to.equal(ethers.parseUnits("0.7", DECIMALS));

    const usdcExRate = await lendingProtocol.exchangeRates(usdc.target);
    expect(usdcExRate).to.equal(ethers.parseUnits("1500", DECIMALS));
    const ethExRate = await lendingProtocol.exchangeRates(eth.target);
    expect(ethExRate).to.equal(ethers.parseUnits("1", DECIMALS));
    const axsExRate = await lendingProtocol.exchangeRates(axs.target);
    expect(axsExRate).to.equal(ethers.parseUnits("100", DECIMALS));
  });

  it("should allow borrowing against collateral", async function () {
    // Bob deposits 1000 USDC
    await usdc
      .connect(bob)
      .approve(lendingProtocol.target, ethers.parseUnits("1000", DECIMALS));

    await lendingProtocol
      .connect(bob)
      .borrow(
        usdc.target,
        ethers.parseUnits("1000", DECIMALS),
        [eth.target, axs.target],
        [ethers.parseUnits("0.2", DECIMALS), ethers.parseUnits("20", DECIMALS)]
      );

    const loan = await lendingProtocol.getLoan(bob.address);

    expect(loan.collateralToken).to.equal(usdc.target);
    expect(loan.collateralAmount).to.equal(ethers.parseUnits("1000", DECIMALS));
    expect(loan.borrowedTokens[0]).to.equal(eth.target);
    expect(loan.borrowedTokens[1]).to.equal(axs.target);
    expect(loan.borrowedAmounts[0]).to.equal(
      ethers.parseUnits("0.2", DECIMALS)
    );
    expect(loan.borrowedAmounts[1]).to.equal(ethers.parseUnits("20", DECIMALS));

    const healthFactor = await lendingProtocol.getHealthFactor(bob.address);
    console.log("healthFactor:", ethers.formatUnits(healthFactor, DECIMALS));
    expect(healthFactor).to.gte(ethers.parseUnits("1", DECIMALS));
  });

  it("should allow liquidating unhealthy positions", async function () {
    // Modify AXS exchange rate to trigger liquidation
    await lendingProtocol.setExchangeRate(
      axs.target,
      ethers.parseUnits("48", DECIMALS)
    );
    const axsExRate = await lendingProtocol.exchangeRates(axs.target);
    expect(axsExRate).to.equal(ethers.parseUnits("48", DECIMALS));

    // Liquidator exchange rate
    const liquidatorExchangeRate = ethers.parseUnits("1520", DECIMALS); // 1 ETH = 1520 USDC

    // Log Bob's initial loan state before liquidation
    const initialLoan = await lendingProtocol.getLoan(bob.address);
    const borrwedETH = initialLoan.borrowedAmounts[0];
    const currentHealthfactor = await lendingProtocol.getHealthFactor(
      bob.address
    );
    console.log(
      "initialCollaterals (USDC):",
      ethers.formatUnits(initialLoan.collateralAmount, DECIMALS)
    );
    console.log(
      "initialBorrowed (ETH):",
      ethers.formatUnits(borrwedETH, DECIMALS)
    );
    console.log(
      "currentHealthfactor:",
      ethers.formatUnits(currentHealthfactor, DECIMALS)
    );

    console.log("===>");

    // Alice liquidates Bob's loan
    const tx = await lendingProtocol
      .connect(alice)
      .liquidate(bob.address, eth.target, liquidatorExchangeRate);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => lendingProtocol.interface.parseLog(log))
      .find((parsedLog) => parsedLog.name === "Liquidate");
    expect(event).to.be.not.null;
    const { seizedAmount, repayAmount } = event.args;
    console.log("seizedAmount (USDC):", ethers.formatUnits(seizedAmount, 18));
    console.log("repayAmount (ETH):", ethers.formatUnits(repayAmount, 18));

    console.log("===>");

    // Log Bob's loan state after liquidation
    const finalLoan = await lendingProtocol.getLoan(bob.address);
    const remainBorrowedETH = finalLoan.borrowedAmounts[0];
    const newHealthfactor = await lendingProtocol.getHealthFactor(bob.address);
    console.log(
      "remainCollaterals (USDC):",
      ethers.formatUnits(finalLoan.collateralAmount, DECIMALS)
    );
    console.log(
      "remainBorrowed (ETH):",
      ethers.formatUnits(remainBorrowedETH, DECIMALS)
    );
    console.log(
      "newHealthfactor:",
      ethers.formatUnits(newHealthfactor, DECIMALS)
    );
    expect(newHealthfactor).to.be.gte(1);
    expect(finalLoan.collateralAmount).to.be.lt(initialLoan.collateralAmount);
    expect(remainBorrowedETH).to.be.lt(borrwedETH);
  });
});
