// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256);
    function setPrice(address asset, uint256 price) external;
}

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract LendingProtocol {

    // Cấu trúc cho một khoản vay
    struct Debt {
        address debtAsset;
        uint256 debtAmount;
    }

    // Struct to store user position
    struct Loan {
        address collateralAsset;
        uint256 collateralAmount;
        mapping(address => uint256) borrowedAssets;
        address[] borrowedAssetList; // Danh sách tài sản đã vay
    }

    mapping(address => uint256) availableAssets;
    
    // Mapping to store user positions
    mapping(address => Loan) public loans;

    // Mapping collateral ratio
    mapping(address => uint256) public collateralFactors;

    // Mapping to store asset prices (local storage of prices)
    mapping(address => uint256) public assetPrices;

    IPriceOracle public priceOracle;
    uint256 public constant LIQUIDATION_THRESHOLD = 100; // 100% ngưỡng thanh lý

    // constructor(address _priceOracle) {
    //     priceOracle = IPriceOracle(_priceOracle);
    // }

    // Event
    event LoanInitialized(address indexed user, address collateralAsset, uint256 collateralAmount);
    event CollateralFactorUpdated(address asset, uint256 factor);
    event PriceUpdated(address asset, uint256 price);
    event CollateralDeposited(address user, address asset, uint256 amount);
    event AssetBorrowed(address user, address asset, uint256 amount);
    event Liquidation(address indexed user, address liquidateToken, uint256 liquidationAmount, uint256 usdcLost);

    // Hàm thêm tài sản vào danh sách khả dụng (chỉ chủ sở hữu hợp đồng được phép gọi)
    function seedAssets(address tokenType, uint256 amount) external {
        availableAssets[tokenType] = amount;
    }

    // Hàm cập nhật hệ số thế chấp cho tài sản
    function setCollateralFactor(address asset, uint256 factor) external {
        require(factor > 0 && factor <= 1e18, "Invalid factor");
        collateralFactors[asset] = factor;
        emit CollateralFactorUpdated(asset, factor);
    }

    /* 
        @params: 
        collateralAsset,
        collateralAmount,
        Map(address debtAsset, uint256 debtAmount)

    */
    function borrow(address collateralAsset, uint256 collateralAmount, Debt[] calldata debts) external {    
        require(collateralAmount > 0, "Invalid collateral amount");
        require(collateralFactors[collateralAsset] > 0, "Invalid collateral factor");

        Loan storage loan = loans[msg.sender];

        // Kiểm tra người dùng có vị thế vay nào trước đó hay không
        require(
            loan.collateralAsset == address(0) && loan.collateralAmount == 0,
            "Existing loan position must be closed first"
        );

        // Tính giá trị thế chấp
        uint256 collateralValue = collateralAmount * assetPrices[collateralAsset];
        uint256 maxBorrowValue = (collateralValue * collateralFactors[collateralAsset] / 100);

        // Tính giá trị khoản vay được yêu cầu
        uint256 totalBorrowValue = 0;
        for (uint256 i = 0; i < debts.length; i++) {
            Debt memory request = debts[i];
            require(request.debtAmount > 0, "Invalid borrow amount");

            uint256 assetPrice = assetPrices[request.debtAsset];
            require(assetPrice > 0, "Asset price not set");

            totalBorrowValue += request.debtAmount * assetPrice;
        }

        // Kiểm tra tính hợp lệ của khoản vay
        require(totalBorrowValue <= maxBorrowValue, "Exceeds borrowing limit");

        // Cập nhật thông tin khoản vay
        loan.collateralAsset = collateralAsset;
        loan.collateralAmount = collateralAmount;

        for (uint256 i = 0; i < debts.length; i++) {
            Debt memory request = debts[i];
            loan.borrowedAssets[request.debtAsset] = request.debtAmount;
            loan.borrowedAssetList.push(request.debtAsset);
        }

        emit LoanInitialized(msg.sender, collateralAsset, collateralAmount);

    }


    // Get the collateral value
    function getCollateralValue(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        uint256 price = assetPrices[loan.collateralAsset];
        return loan.collateralAmount * price;
    }

    // Get the debt value
    function getDebtValue(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        uint256 totalDebt = 0;

        for (uint256 i = 0; i < loan.borrowedAssetList.length; i++) {
            address asset = loan.borrowedAssetList[i];
            totalDebt += loan.borrowedAssets[asset] * assetPrices[asset];
        }

        return totalDebt;
    }

    // Check liquidation status
    function checkHealth(address user) public view returns (bool) {
        Loan storage loan = loans[user];
        
        // Kiểm tra người dùng có vị thế vay không
        if (loan.collateralAsset == address(0) || loan.collateralAmount == 0) {
            return false; // Không có vị thế vay
        }

        // Giá trị tài sản thế chấp
        uint256 collateralPrice = assetPrices[loan.collateralAsset];
        uint256 collateralValue = loan.collateralAmount * collateralPrice;

        // Giá trị tối thiểu cần thiết để giữ khoản vay lành mạnh
        uint256 requiredCollateralValue = (getDebtValue(user)) / collateralFactors[loan.collateralAsset] * 100;

        // Kiểm tra xem có thể thanh lý không
        return collateralValue < requiredCollateralValue;
    }

    /*
        Liquidate the user's position    
    */
    function liquidate(address user, address liquidateToken, uint256 usdcPerEthRate) public returns (uint256) {
        // Lấy thông tin vị thế vay của Bob
        Loan storage loan = loans[user];

        // Kiểm tra người dùng có vị thế vay không
        require(loan.collateralAsset != address(0), "No active loan for user");
        require(loan.borrowedAssets[liquidateToken] > 0, "No debt to liquidate for this asset");

        // Tính giá trị tài sản thế chấp (USDC)
        uint256 collateralValue = loan.collateralAmount * assetPrices[loan.collateralAsset];

        // Tính tổng giá trị nợ (ETH và AXS)
        uint256 totalDebt = getDebtValue(user);

        // Tính tỷ lệ nợ cần đạt được để vị thế an toàn
        uint256 requiredCollateralValue = totalDebt / collateralFactors[loan.collateralAsset] * 100;

        // // Nếu tài sản thế chấp đã đủ, không cần thanh lý
        // if (collateralValue >= requiredCollateralValue) {
        //     revert("No liquidation needed. Collateral is sufficient.");
        // }

        // Tính toán số lượng ETH cần thanh lý để đảm bảo vị thế an toàn
        uint256 excessDebt = requiredCollateralValue - collateralValue;
        uint256 liquidationAmountETH = excessDebt / (assetPrices[liquidateToken] - usdcPerEthRate * collateralFactors[liquidateToken] * 100);

        // Kiểm tra số lượng ETH cần thanh lý không vượt quá số nợ hiện tại
        uint256 currentEthDebt = loan.borrowedAssets[liquidateToken];
        require(liquidationAmountETH <= currentEthDebt, "Cannot liquidate more than the debt");

        // Thanh lý ETH (giảm số nợ ETH)
        loan.borrowedAssets[liquidateToken] -= liquidationAmountETH;

        // Tính toán số lượng USDC sẽ bị mất từ tài sản thế chấp
        uint256 requiredUSDC = liquidationAmountETH * usdcPerEthRate;

        // Kiểm tra xem Bob có đủ USDC để thanh lý không
        require(requiredUSDC <= loan.collateralAmount, "Not enough collateral to liquidate");

        // Trừ USDC từ tài sản thế chấp của Bob
        loan.collateralAmount -= requiredUSDC;

        // Chuyển USDC cho liquidator (người gọi hàm)
        // usdcToken.transfer(msg.sender, requiredUSDC);

        // Emit sự kiện thanh lý
        emit Liquidation(user, liquidateToken, liquidationAmountETH, requiredUSDC);
        return requiredUSDC;
    }

    // Update price manual
    function setTokenPrice(address tokenType, uint256 newPrice) external {
        // priceOracle.setPrice(asset, newPrice);
        assetPrices[tokenType] = newPrice;
        emit PriceUpdated(tokenType, newPrice);
    }

    // Fetch the current price from the Price Oracle (in case you want to update from the Oracle)
    function updatePriceFromOracle(address asset) external {
        uint256 price = priceOracle.getPrice(asset);
        assetPrices[asset] = price;
        emit PriceUpdated(asset, price);
    }
}

