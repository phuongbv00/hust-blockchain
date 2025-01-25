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
      .borrow(usdc.target, ethers.parseUnits("1000", DECIMALS), [
        {
          debtAsset: eth.target,
          debtAmount: ethers.parseUnits("0.2", DECIMALS),
        },
        {
          debtAsset: axs.target,
          debtAmount: ethers.parseUnits("20", DECIMALS),
        },
      ]);

    const loan = await lendingProtocol.getLoan(bob.address);

    expect(loan.collateralAsset).to.equal(usdc.target);
    expect(loan.collateralAmount).to.equal(ethers.parseUnits("1000", DECIMALS));
    expect(loan.borrowedAmounts[0]).to.equal(
      ethers.parseUnits("0.2", DECIMALS)
    );
    expect(loan.borrowedAmounts[1]).to.equal(ethers.parseUnits("20", DECIMALS));
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
    console.log(
      "initialCollaterals",
      ethers.formatUnits(initialLoan.collateralAmount, DECIMALS)
    );
    console.log("initialBorrowedETH", ethers.formatUnits(borrwedETH, DECIMALS));

    // Alice liquidates Bob's loan
    await lendingProtocol
      .connect(alice)
      .liquidate(bob.address, eth.target, liquidatorExchangeRate);

    // Log Bob's loan state after liquidation
    const finalLoan = await lendingProtocol.getLoan(bob.address);

    // Assert collateral is reduced
    expect(finalLoan.collateralAmount).to.be.lt(initialLoan.collateralAmount);
    const remainBorrowedETH = finalLoan.borrowedAmounts[0];
    console.log(
      "remainCollaterals",
      ethers.formatUnits(finalLoan.collateralAmount, DECIMALS)
    );
    console.log(
      "remainBorrowedETH",
      ethers.formatUnits(remainBorrowedETH, DECIMALS)
    );
    expect(remainBorrowedETH).to.be.lt(borrwedETH);
  });
});
