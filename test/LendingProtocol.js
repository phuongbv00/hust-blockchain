const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingProtocol", function () {
  let lendingProtocol, usdc, eth, axs;
  let owner, alice, bob;

  before(async function () {
    // Get signers
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy ERC20 mock tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

    usdc = await ERC20Mock.deploy("USD Coin", "USDC", 18);
    await usdc.waitForDeployment();

    eth = await ERC20Mock.deploy("Ethereum", "ETH", 18);
    await eth.waitForDeployment();

    axs = await ERC20Mock.deploy("Axie Infinity", "AXS", 18);
    await axs.waitForDeployment();

    // Deploy LendingProtocol
    const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
    lendingProtocol = await LendingProtocol.deploy();
    await lendingProtocol.waitForDeployment();

    // Mint tokens for users
    await usdc.mint(owner.address, ethers.parseUnits("10000", 18));
    await eth.mint(owner.address, ethers.parseUnits("100", 18));
    await axs.mint(owner.address, ethers.parseUnits("1000", 18));

    await usdc.mint(alice.address, ethers.parseUnits("5000", 18));
    await eth.mint(alice.address, ethers.parseUnits("50", 18));
    await axs.mint(alice.address, ethers.parseUnits("500", 18));
  });

  it("should allow setting collateral factors and exchange rates", async function () {
    await lendingProtocol.setCollateralFactor(
      usdc.target,
      ethers.parseUnits("0.9", 18)
    );
    await lendingProtocol.setCollateralFactor(
      eth.target,
      ethers.parseUnits("0.8", 18)
    );
    await lendingProtocol.setCollateralFactor(
      axs.target,
      ethers.parseUnits("0.7", 18)
    );

    await lendingProtocol.setExchangeRate(
      usdc.target,
      ethers.parseUnits("1500", 18)
    );
    await lendingProtocol.setExchangeRate(
      eth.target,
      ethers.parseUnits("1", 18)
    );
    await lendingProtocol.setExchangeRate(
      axs.target,
      ethers.parseUnits("100", 18)
    );

    const usdcFactor = await lendingProtocol.collateralFactors(usdc.target);
    expect(usdcFactor).to.equal(ethers.parseUnits("0.9", 18));
    const ethFactor = await lendingProtocol.collateralFactors(eth.target);
    expect(ethFactor).to.equal(ethers.parseUnits("0.8", 18));
    const axsFactor = await lendingProtocol.collateralFactors(axs.target);
    expect(axsFactor).to.equal(ethers.parseUnits("0.7", 18));
    
    const usdcExRate = await lendingProtocol.exchangeRates(usdc.target);
    expect(usdcExRate).to.equal(ethers.parseUnits("1500", 18));
    const ethExRate = await lendingProtocol.exchangeRates(eth.target);
    expect(ethExRate).to.equal(ethers.parseUnits("1", 18));
    const axsExRate = await lendingProtocol.exchangeRates(axs.target);
    expect(axsExRate).to.equal(ethers.parseUnits("100", 18));
  });

  it("should allow borrowing against collateral", async function () {
    // Bob deposits 1000 USDC
    await usdc
      .connect(bob)
      .approve(lendingProtocol.target, ethers.parseUnits("1000", 18));

    await lendingProtocol
      .connect(bob)
      .borrow(usdc.target, ethers.parseUnits("1000", 18), [
        { debtAsset: eth.target, debtAmount: ethers.parseUnits("0.2", 18) },
        { debtAsset: axs.target, debtAmount: ethers.parseUnits("20", 18) },
      ]);

    const loan = await lendingProtocol.getLoan(bob.address);

    expect(loan.collateralAsset).to.equal(usdc.target);
    expect(loan.collateralAmount).to.equal(ethers.parseUnits("1000", 18));
    expect(loan.borrowedAmounts[0]).to.equal(ethers.parseUnits("0.2", 18));
    expect(loan.borrowedAmounts[1]).to.equal(ethers.parseUnits("20", 18));
  });

  it("failedborrowing", async function () {
    // Bob deposits 1000 USDC
    await usdc
      .connect(bob)
      .approve(lendingProtocol.target, ethers.parseUnits("1000", 18));

    await lendingProtocol
      .connect(bob)
      .borrow(usdc.target, ethers.parseUnits("0", 18), [
        { debtAsset: eth.target, debtAmount: ethers.parseUnits("0.2", 18) },
        { debtAsset: axs.target, debtAmount: ethers.parseUnits("20", 18) },
      ]);

    const loan = await lendingProtocol.getLoan(bob.address);

    expect(loan.collateralAsset).to.equal(usdc.target);
    expect(loan.collateralAmount).to.equal(ethers.parseUnits("1000", 18));
    expect(loan.borrowedAmounts[0]).to.equal(ethers.parseUnits("0.2", 18));
    expect(loan.borrowedAmounts[1]).to.equal(ethers.parseUnits("20", 18));
  });

  // it("should allow liquidating unhealthy positions", async function () {
  //   // Modify AXS exchange rate to trigger liquidation
  //   await lendingProtocol.setExchangeRate(
  //     axs.target,
  //     ethers.parseUnits("48", 18)
  //   );
  //   const axsExRate = await lendingProtocol.exchangeRates(axs.target);
  //   expect(axsExRate).to.equal(ethers.parseUnits("48", 18));

  //   // Liquidator exchange rate
  //   const liquidatorExchangeRate = ethers.parseUnits("1520", 18);  // 1 ETH = 1520 USDC

  //   // Log Bob's initial loan state before liquidation
  //   const initialLoan = await lendingProtocol.getLoan(bob.address);
  //   console.log("Initial loan state:", initialLoan);

  //   // Alice liquidates Bob's loan
  //   const liquidationTx = await lendingProtocol.connect(alice).liquidate(
  //       bob.address,
  //       eth.target,
  //       liquidatorExchangeRate
  //   );

  //   // // Wait for transaction to be mined
  //   // const receipt = await liquidationTx.wait();

  //   // console.log("Receipt events:", receipt.events);

  //   // // Extract Liquidation event
  //   // const liquidationEvent = receipt.events?.find(event => event.event === "Liquidation");

  //   // // Ensure the event was emitted
  //   // expect(liquidationEvent).to.not.be.undefined;

  //   // // Extract seizedAmount
  //   // const seizedAmount = liquidationEvent.args.seizedAmount;

  //   // console.log(seizedAmount);

  //   // // Ensure seizedAmount is > 0
  //   // expect(seizedAmount.toString()).to.not.equal("0");

  //   // Log Bob's loan state after liquidation
  //   const finalLoan = await lendingProtocol.getLoan(bob.address);
  //   console.log("Final loan state:", finalLoan);

  //   // Assert collateral is reduced
  //   expect(finalLoan.collateralAmount).to.be.lt(initialLoan.collateralAmount);
  //   expect(finalLoan.borrowedAssets[eth.target]).to.be.lt(initialLoan.borrowedAssets[eth.target]);
  // });
});
