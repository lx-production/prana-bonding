// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FullMath.sol";
import "./UniswapV3Interfaces.sol";

library UniswapV3Helper {
    // Get reserves from the V3 pool using slot0 and liquidity
    function _getReserves(address poolAddress) internal view returns (uint256 wbtcReserve, uint256 pranaReserve) {
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        
        // Get current price and liquidity from the pool
        (uint256 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint256 liquidity = pool.liquidity();

        require(sqrtPriceX96 > 0, "Invalid price");
        require(liquidity > 0, "No liquidity");
        
        uint256 Q96 = 0x1000000000000000000000000; // 2^96
        
        // Calculate reserves according to Uniswap v3 math
        // For token0 (WBTC): L × (2^96) / sqrtP
        // For token1 (PRANA): L × sqrtP / (2^96)
        wbtcReserve = FullMath.mulDiv(liquidity, Q96, sqrtPriceX96);
        pranaReserve = FullMath.mulDiv(liquidity, sqrtPriceX96, Q96);
        
        return (wbtcReserve, pranaReserve);
    }
}