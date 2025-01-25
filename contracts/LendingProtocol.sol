// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256);

    function setPrice(address asset, uint256 price) external;
}

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
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
    mapping(address => uint256) public exchangeRates;

    IPriceOracle public priceOracle;
    uint256 public constant LIQUIDATION_THRESHOLD = 100; // 100% ngưỡng thanh lý

    // constructor(address _priceOracle) {
    //     priceOracle = IPriceOracle(_priceOracle);
    // }

    // Event
    event LoanInitialized(
        address indexed user,
        address collateralAsset,
        uint256 collateralAmount
    );
    event CollateralFactorUpdated(address asset, uint256 factor);
    event ExchangeRateUpdated(address asset, uint256 price);
    event CollateralDeposited(address user, address asset, uint256 amount);
    event AssetBorrowed(address user, address asset, uint256 amount);
    event Liquidation(
        address indexed borrower,
        address repayToken,
        uint256 repayAmount,
        address seizedToken,
        uint256 seizedAmount
    );
    error LiquidationError(uint256 n);

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

    function borrow(
        address collateralAsset,
        uint256 collateralAmount,
        Debt[] calldata debts
    ) external {
        require(collateralAmount > 0, "Invalid collateral amount");
        require(
            collateralFactors[collateralAsset] > 0,
            "Invalid collateral factor"
        );

        Loan storage loan = loans[msg.sender];

        // Kiểm tra người dùng có vị thế vay nào trước đó hay không
        require(
            loan.collateralAsset == address(0) && loan.collateralAmount == 0,
            "Existing loan position must be closed first"
        );

        // Tính khả năng vay
        uint256 borrowCapacity = (collateralAmount *
            collateralFactors[collateralAsset]) /
            exchangeRates[collateralAsset];

        // Tính giá trị khoản vay được yêu cầu
        uint256 totalBorrowValue = 0;
        for (uint256 i = 0; i < debts.length; i++) {
            Debt memory request = debts[i];
            require(request.debtAmount > 0, "Invalid borrow amount");

            uint256 exchangeRate = exchangeRates[request.debtAsset];
            require(exchangeRate > 0, "Asset exchange rate was not set");

            totalBorrowValue += (request.debtAmount * 1e18) / exchangeRate;
        }

        // Kiểm tra tính hợp lệ của khoản vay
        require(totalBorrowValue <= borrowCapacity, "Exceeds borrowing limit");

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

    function getBorrowCapacity(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        return
            (loan.collateralAmount * collateralFactors[loan.collateralAsset]) /
            exchangeRates[loan.collateralAsset];
    }

    function getDebtValue(address user) public view returns (uint256) {
        Loan storage loan = loans[user];
        uint256 totalDebt = 0;
        for (uint256 i = 0; i < loan.borrowedAssetList.length; i++) {
            address asset = loan.borrowedAssetList[i];
            totalDebt +=
                (loan.borrowedAssets[asset] * 1e18) /
                exchangeRates[asset];
        }
        return totalDebt;
    }

    function liquidate(
        address borrower,
        address repayToken,
        uint256 liquidatorExchangeRate
    ) public returns (uint256) {
        // Lấy thông tin vị thế vay của Bob
        Loan storage loan = loans[borrower];

        // Kiểm tra người dùng có vị thế vay không
        require(loan.collateralAsset != address(0), "No active loan for user");
        require(
            loan.borrowedAssets[repayToken] > 0,
            "No debt to liquidate for this asset"
        );

        // Kiểm tra sức khoẻ vị thế vay
        uint256 borrowCapacity = getBorrowCapacity(borrower);
        uint256 debtValue = getDebtValue(borrower);
        uint256 healthFactor = borrowCapacity / debtValue;
        // if (borrowCapacity >= debtValue) {
        //     emit Liquidation(borrower, repayToken, 0, seizedToken, 0);
        //     return 0;
        // }

        // Liquidate
        //
        // x: seizedAmount - The collateral seized is transferred to the liquidator (liquidator receives)
        // y: repayAmount - The amount of the underlying borrowed asset to repay (liquidator repays)
        //
        // Calculate to satisfy:
        //
        // newBorrowCapacity = (collateralAmount - x) * collateralFactorX / exchangeRateX
        // newDebtValue = debtValue - y / exchangeRateY
        // newBorrowCapacity >= newDebtValue
        // x / y == liquidatorExchangeRate
        uint256 collateralFactorX = collateralFactors[loan.collateralAsset];
        uint256 exchangeRateX = exchangeRates[loan.collateralAsset];
        uint256 exchangeRateY = exchangeRates[repayToken];
        // uint256 repayAmount = ((collateralAmount * collateralFactorX) /
        //     exchangeRateX -
        //     debtValue) /
        //     ((liquidatorExchangeRate * collateralFactorX) /
        //         exchangeRateX +
        //         1 /
        //         exchangeRateY);
        uint256 repayAmount = 0;
        uint256 seizedAmount = 0;
        uint256 df = 0;
        while (healthFactor < 1) {
            df++;
            // repayAmount++;
            // seizedAmount = liquidatorExchangeRate * repayAmount;
            seizedAmount += 1e18 * df;
            repayAmount = (seizedAmount * 1e18) / liquidatorExchangeRate;
            // seizedAmount++;
            // borrowCapacity -=
            //     (seizedAmount * collateralFactorX) /
            //     exchangeRateX;
            // debtValue -= (repayAmount * 1e18) / exchangeRateY;
            // healthFactor = (borrowCapacity - (seizedAmount * collateralFactorX) /
            //     exchangeRateX)/(debtValue - (repayAmount * 1e18) / exchangeRateY);
            healthFactor =
                ((borrowCapacity *
                    exchangeRateX -
                    seizedAmount *
                    collateralFactorX) * exchangeRateY) /
                exchangeRateX /
                (debtValue * exchangeRateY - repayAmount * 1e18);
        }

        require(
            repayAmount <= loan.borrowedAssets[repayToken],
            "LIQUIDATE_REPAY_MORE_THAN_BORROW"
        );

        // Kiểm tra xem Bob có đủ tài sản thế chấp để thanh lý không
        require(
            seizedAmount <= loan.collateralAmount,
            "LIQUIDATE_SEIZE_MORE_THAN_COLLATERAL"
        );

        // Khấu trừ tài sản thế chấp của Bob
        loan.collateralAmount -= seizedAmount;

        // Tịch thu 1 phần khoản vay của Bob
        loan.borrowedAssets[repayToken] -= repayAmount;

        // TODO: Chuyển phần tài sản tịch thu cho liquidator

        // TODO: Khấu trừ khoản repay của liquidator

        emit Liquidation(
            borrower,
            repayToken,
            repayAmount,
            loan.collateralAsset,
            seizedAmount
        );
        return seizedAmount;
    }

    function setExchangeRate(address tokenType, uint256 rate) external {
        exchangeRates[tokenType] = rate;
        emit ExchangeRateUpdated(tokenType, rate);
    }

    function getExchangeRate(address tokenType) public view returns (uint256) {
        return exchangeRates[tokenType];
    }

    function getLoan(
        address borrower
    )
        public
        view
        returns (
            address collateralAsset,
            uint256 collateralAmount,
            address[] memory borrowedAssetList,
            uint256[] memory borrowedAmounts
        )
    {
        Loan storage loan = loans[borrower];

        // Initialize arrays to store borrowed assets and amounts
        uint256[] memory amounts = new uint256[](loan.borrowedAssetList.length);

        // Loop through the borrowedAssetList and retrieve amounts from the borrowedAssets mapping
        for (uint i = 0; i < loan.borrowedAssetList.length; i++) {
            amounts[i] = loan.borrowedAssets[loan.borrowedAssetList[i]];
        }

        return (
            loan.collateralAsset,
            loan.collateralAmount,
            loan.borrowedAssetList,
            amounts
        );
    }
}
