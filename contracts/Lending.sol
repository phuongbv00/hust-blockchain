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
    // Struct to store user position
    struct Loan {
        address collateralAsset;
        uint256 collateralAmount;
        mapping(address => uint256) borrowedAssets;
        address[] borrowedAssetList; // Danh sách tài sản đã vay
    }

    address[] public availableAssets;
    
    // Mapping to store user positions
    mapping(address => Loan) public loans;

    // Mapping collateral ratio
    mapping(address => uint256) public collateralFactors;

    // Mapping to store asset prices (local storage of prices)
    mapping(address => uint256) public assetPrices;

    IPriceOracle public priceOracle;
    uint256 public constant LIQUIDATION_THRESHOLD = 90; // 90% ngưỡng thanh lý

    constructor(address _priceOracle) {
        priceOracle = IPriceOracle(_priceOracle);
    }

    // Event
    event CollateralFactorUpdated(address asset, uint256 factor);
    event PriceUpdated(address asset, uint256 price);
    event CollateralDeposited(address user, address asset, uint256 amount);
    event AssetBorrowed(address user, address asset, uint256 amount);

    // Hàm cập nhật hệ số thế chấp cho tài sản
    function setCollateralFactor(address asset, uint256 factor) external {
        require(factor > 0 && factor <= 1e18, "Invalid factor");
        collateralFactors[asset] = factor;
        emit CollateralFactorUpdated(asset, factor);
    }

    // Deposit collateral for the user's position
    function depositCollateral(address collateralAsset, uint256 collateralAmount) external {
        require(collateralAmount > 0, "Invalid collateral amount");
        uint256 collateralFactor = collateralFactors[collateralAsset];
        require(collateralFactor > 0, "No collateral factor set");

        Loan storage loan = loans[msg.sender];

        // If user already has a loan, ensure the same collateral asset
        if (loan.collateralAsset != address(0)) {
            require(loan.collateralAsset == collateralAsset, "Collateral asset mismatch");
        } else {
            loan.collateralAsset = collateralAsset;
        }

        // Update collateral amount
        loan.collateralAmount += collateralAmount;

        emit CollateralDeposited(msg.sender, collateralAsset, collateralAmount);
    }

    // Borrow an asset
    function borrowAsset(address debtAsset, uint256 debtAmount) external {
        require(debtAmount > 0, "Invalid debt amount");
        bool isAssetAvailable = false;
        for (uint256 i = 0; i < availableAssets.length; i++) {
            if (availableAssets[i] == debtAsset) {
                isAssetAvailable = true;
                break;
            }
        }
        require(isAssetAvailable, "Asset not available for borrowing");
        Loan storage loan = loans[msg.sender];
        require(loan.collateralAmount > 0, "No collateral deposited");

        uint256 collateralFactor = collateralFactors[loan.collateralAsset];
        require(collateralFactor > 0, "No collateral factor set");

        uint256 collateralValue = loan.collateralAmount * assetPrices[loan.collateralAsset];
        uint256 maxDebtValue = (collateralValue * collateralFactor) / 1e18;

        uint256 totalDebtValue = getDebtValue(msg.sender) + (debtAmount * assetPrices[debtAsset]) / 1e18;
        require(totalDebtValue <= maxDebtValue, "Exceeds borrowing limit");

        if (loan.borrowedAssets[debtAsset] == 0) {
            // Nếu đây là lần đầu vay tài sản này, thêm vào mảng borrowedAssetList
            loan.borrowedAssetList.push(debtAsset);
        }
        loan.borrowedAssets[debtAsset] += debtAmount;

        emit AssetBorrowed(msg.sender, debtAsset, debtAmount);
    }

    // Hàm thế chấp tài sản
    // function depositCollateral(
    //     address collateralAsset,
    //     uint256 collateralAmount,
    //     address debtAsset,
    //     uint256 debtAmount
    // ) external {
    //     require(collateralAmount > 0 && debtAmount > 0, "Invalid amounts");
    //     uint256 collateralFactor = collateralFactors[collateralAsset];
    //     require(collateralFactor > 0, "No collateral factor set");

    //     // Tính giá trị thế chấp tối đa có thể vay
    //     uint256 collateralValue = collateralAmount * assetPrices[collateralAsset];
    //     uint256 maxDebtValue = (collateralValue * collateralFactor) / 1e18;
    //     uint256 debtValue = debtAmount * assetPrices[debtAsset] / 1e18;

    //     require(debtValue <= maxDebtValue, "Debt exceeds collateral limit");

    //     // Chuyển tài sản thế chấp vào contract
    //     // require(
    //     //     IERC20(collateralAsset).transferFrom(msg.sender, address(this), collateralAmount),
    //     //     "Transfer failed"
    //     // );

    //     // Lưu khoản vay
    //     loans[msg.sender].push(
    //         Loan(
    //         collateralAsset,
    //         collateralAmount,
    //         debtAsset,
    //         debtAmount
    //     ));
    // }

    // Hàm thêm tài sản vào danh sách khả dụng (chỉ chủ sở hữu hợp đồng được phép gọi)
    function addAsset(address asset) external {
        for (uint256 i = 0; i < availableAssets.length; i++) {
            require(availableAssets[i] != asset, "Asset already exists");
        }
        availableAssets.push(asset);
    }

    // Get borrowed assets for a user
    function getBorrowedAssets(address user) public view returns (address[] memory) {
        Loan storage loan = loans[user];
        return loan.borrowedAssetList;
    }

    // Get the collateral value
    function getCollateralValue(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        uint256 price = assetPrices[loan.collateralAsset];
        return loan.collateralAmount * price / 1e18;
    }

    // Get the debt value
    function getDebtValue(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        uint256 totalDebt = 0;

        for (uint256 i = 0; i < getBorrowedAssets(user).length; i++) {
            address asset = getBorrowedAssets(user)[i];
            totalDebt += loan.borrowedAssets[asset] * assetPrices[asset];
        }

        return totalDebt / 1e18;
    }

    // Check liquidation status
    function checkLiquidation(address user) public view returns (bool) {
        uint256 collateralValue = getCollateralValue(user);
        uint256 debtValue = getDebtValue(user);

        return debtValue > (collateralValue * LIQUIDATION_THRESHOLD) / 100;
    }

    // Liquidate the user's position
    function liquidate(address user) external {
        require(checkLiquidation(user), "Cannot liquidate");
        // Reset the user's position
        delete loans[user];
    }

    // Update price manual
    function updatePrice(address asset, uint256 newPrice) external {
        priceOracle.setPrice(asset, newPrice);
        emit PriceUpdated(asset, newPrice);
    }

    // Fetch the current price from the Price Oracle (in case you want to update from the Oracle)
    function updatePriceFromOracle(address asset) external {
        uint256 price = priceOracle.getPrice(asset);
        assetPrices[asset] = price;
        emit PriceUpdated(asset, price);
    }

    function calculateUSDCToLose(address user, address debtAsset, uint256 liquidationRate) public view returns (uint256) {

        // Tính giá trị tài sản thế chấp của Bob (collateral value)
        uint256 collateralValue = getCollateralValue(user);

        // Tính giá trị nợ hiện tại của Bob (debt value)
        uint256 debtValue = getDebtValue(user);

        // Tính giá trị nợ tối đa mà Bob có thể duy trì mà không bị thanh lý
        uint256 maxHealthyDebtValue = (collateralValue * LIQUIDATION_THRESHOLD) / 100;

        // Nếu nợ hiện tại không vượt quá giá trị nợ tối đa thì không cần thanh lý
        if (debtValue <= maxHealthyDebtValue) {
            return 0;
        }

        // Tính số tiền nợ cần thanh lý để đưa vị thế về trạng thái khỏe mạnh
        uint256 debtToLiquidate = debtValue - maxHealthyDebtValue;

        // Tính số ETH cần thanh lý
        uint256 ethToLiquidate = (debtToLiquidate * 1e18) / assetPrices[debtAsset];

        // Tính số USDC cần để thanh lý số ETH này
        uint256 usdcToLiquidate = (ethToLiquidate * liquidationRate) / 1e18;

        return usdcToLiquidate;
    }

}

