// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Library for Uniswap constants
library Addresses {
    address public constant WBTC_PRANA_V3_POOL = 0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED;
}

// Interface for Uniswap V3 Pool
interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
    function liquidity() external view returns (uint128);
} 