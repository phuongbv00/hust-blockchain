// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LendingProtocol {
    struct Loan {
        address collateralToken;
        uint256 collateralAmount;
        address[] borrowedTokens;
        mapping(address => uint256) borrowedAmounts;
    }

    mapping(address => Loan) private _loans;

    mapping(address => uint256) public collateralFactors;

    mapping(address => uint256) public exchangeRates;

    // Event
    event Borrow(
        address indexed borrower,
        address collateralAsset,
        uint256 collateralAmount,
        address[] borrowedTokens,
        uint256[] borrowedAmounts
    );
    event UpdateCollateralFactor(address token, uint256 factor);
    event UpdateExchangeRate(address token, uint256 rate);
    event Liquidate(
        address indexed borrower,
        address repayToken,
        uint256 repayAmount,
        address seizedToken,
        uint256 seizedAmount
    );

    function setCollateralFactor(address token, uint256 factor) external {
        require(
            factor > 0 && factor <= 1e18,
            "SET_COLLATERAL_FACTOR_INVALID_FACTOR"
        );
        collateralFactors[token] = factor;
        emit UpdateCollateralFactor(token, factor);
    }

    function borrow(
        address collateralToken,
        uint256 collateralAmount,
        address[] memory borrowTokens,
        uint256[] memory borrowAmounts
    ) external {
        require(collateralAmount > 0, "BORROW_INVALID_COLLATERAL_AMOUNT");
        require(
            collateralFactors[collateralToken] > 0,
            "BORROW_INVALID_COLLATERAL_FACTOR"
        );

        Loan storage loan = _loans[msg.sender];

        // Kiểm tra người dùng có vị thế vay nào trước đó hay không
        require(
            loan.collateralToken == address(0) && loan.collateralAmount == 0,
            "BORROW_LOAN_ALREADY_EXISTS"
        );

        // Tính khả năng vay
        uint256 borrowCapacity = (collateralAmount *
            collateralFactors[collateralToken]) /
            exchangeRates[collateralToken];

        // Tính giá trị khoản vay được yêu cầu
        uint256 totalBorrowValue = 0;
        for (uint256 i = 0; i < borrowTokens.length; i++) {
            address borrowToken = borrowTokens[i];
            uint256 borrowAmount = borrowAmounts[i];
            require(borrowAmount > 0, "BORROW_INVALID_BORROW_AMOUNT");

            uint256 exchangeRate = exchangeRates[borrowToken];
            require(exchangeRate > 0, "BORROW_INVALID_EXCHANGE_RATE");

            totalBorrowValue += (borrowAmount * 1e18) / exchangeRate;
        }

        // Kiểm tra tính hợp lệ của khoản vay
        require(totalBorrowValue <= borrowCapacity, "BORROW_LOW_CAPACITY");

        // Cập nhật thông tin khoản vay
        loan.collateralToken = collateralToken;
        loan.collateralAmount = collateralAmount;

        for (uint256 i = 0; i < borrowTokens.length; i++) {
            address borrowToken = borrowTokens[i];
            uint256 borrowAmount = borrowAmounts[i];
            loan.borrowedTokens.push(borrowToken);
            loan.borrowedAmounts[borrowToken] = borrowAmount;
        }

        emit Borrow(
            msg.sender,
            collateralToken,
            collateralAmount,
            borrowTokens,
            borrowAmounts
        );
    }

    function getBorrowCapacity(address user) public view returns (uint256) {
        Loan storage loan = _loans[user];
        return
            (loan.collateralAmount * collateralFactors[loan.collateralToken]) /
            exchangeRates[loan.collateralToken];
    }

    function getTotalDebt(address user) public view returns (uint256) {
        Loan storage loan = _loans[user];
        uint256 totalDebt = 0;
        for (uint256 i = 0; i < loan.borrowedTokens.length; i++) {
            address asset = loan.borrowedTokens[i];
            totalDebt +=
                (loan.borrowedAmounts[asset] * 1e18) /
                exchangeRates[asset];
        }
        return totalDebt;
    }

    function getHealthFactor(address user) public view returns (uint256) {
        return (getBorrowCapacity(user) * 1e18) / getTotalDebt(user);
    }

    function liquidate(
        address borrower,
        address repayToken,
        uint256 liquidatorExchangeRate
    ) public returns (uint256) {
        // Lấy thông tin vị thế vay của Bob
        Loan storage loan = _loans[borrower];

        // Kiểm tra người dùng có vị thế vay không
        require(
            loan.collateralToken != address(0),
            "LIQUIDATE_LOAN_DOES_NOT_EXIST"
        );
        require(
            loan.borrowedAmounts[repayToken] > 0,
            "LIQUIDATE_INVALID_BORROWED_AMOUNT"
        );

        // Kiểm tra sức khoẻ vị thế vay
        uint256 borrowCapacity = getBorrowCapacity(borrower);
        uint256 totalDebt = getTotalDebt(borrower);
        uint256 healthFactor = borrowCapacity / totalDebt;
        if (borrowCapacity >= totalDebt) {
            return 0;
        }

        // Liquidate
        //
        // x: seizedAmount - The collateral seized is transferred to the liquidator (liquidator receives)
        // y: repayAmount - The amount of the underlying borrowed asset to repay (liquidator repays)
        //
        // Calculate to satisfy:
        //
        // newBorrowCapacity = (collateralAmount - x) * collateralFactorX / exchangeRateX
        // newTotalDebt = totalDebt - y / exchangeRateY
        // healthFactor = newBorrowCapacity / newTotalDebt
        // healthFactor >= 1
        // x / y == liquidatorExchangeRate
        uint256 collateralFactorX = collateralFactors[loan.collateralToken];
        uint256 exchangeRateX = exchangeRates[loan.collateralToken];
        uint256 exchangeRateY = exchangeRates[repayToken];

        uint256 repayAmount = 0;
        uint256 seizedAmount = 0;
        uint256 step = 1e18; // TODO: optimize step
        while (healthFactor < 1) {
            seizedAmount += step;
            repayAmount = (seizedAmount * 1e18) / liquidatorExchangeRate;
            healthFactor =
                ((borrowCapacity *
                    exchangeRateX -
                    seizedAmount *
                    collateralFactorX) * exchangeRateY) /
                exchangeRateX /
                (totalDebt * exchangeRateY - repayAmount * 1e18);
        }

        require(
            repayAmount <= loan.borrowedAmounts[repayToken],
            "LIQUIDATE_REPAY_AMOUNT_MORE_THAN_BORROW_AMOUNT"
        );

        // Kiểm tra xem Bob có đủ tài sản thế chấp để thanh lý không
        require(
            seizedAmount <= loan.collateralAmount,
            "LIQUIDATE_SEIZE_AMOUNT_MORE_THAN_COLLATERAL_AMOUNT"
        );

        // Khấu trừ tài sản thế chấp của Bob
        loan.collateralAmount -= seizedAmount;

        // Tịch thu 1 phần khoản vay của Bob
        loan.borrowedAmounts[repayToken] -= repayAmount;

        // TODO: Chuyển phần tài sản tịch thu cho liquidator

        // TODO: Khấu trừ khoản repay từ ví của liquidator

        emit Liquidate(
            borrower,
            repayToken,
            repayAmount,
            loan.collateralToken,
            seizedAmount
        );
        return seizedAmount;
    }

    function setExchangeRate(address tokenType, uint256 rate) external {
        exchangeRates[tokenType] = rate;
        emit UpdateExchangeRate(tokenType, rate);
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
            address collateralToken,
            uint256 collateralAmount,
            address[] memory borrowedTokens,
            uint256[] memory borrowedAmounts
        )
    {
        Loan storage loan = _loans[borrower];

        uint256[] memory amounts = new uint256[](loan.borrowedTokens.length);

        for (uint i = 0; i < loan.borrowedTokens.length; i++) {
            amounts[i] = loan.borrowedAmounts[loan.borrowedTokens[i]];
        }

        return (
            loan.collateralToken,
            loan.collateralAmount,
            loan.borrowedTokens,
            amounts
        );
    }
}
