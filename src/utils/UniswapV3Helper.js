import { FullMath } from './FullMath';
import { V3_POOL_SLOT0_ABI, V3_POOL_LIQUIDITY_ABI, PRANA_DECIMALS, WBTC_PRANA_V3_POOL } from '../constants/sharedContracts';
import { BOND_TERMS } from '../constants/bondTerms';

/**
 * Lấy reserves từ Uniswap V3 Pool
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @returns {Promise<{wbtcReserve: bigint, pranaReserve: bigint}>} Reserves của WBTC và PRANA
 */
export const getReserves = async (publicClient, poolAddress = WBTC_PRANA_V3_POOL) => {
  if (!publicClient || !poolAddress) {
    return { wbtcReserve: 0n, pranaReserve: 0n };
  }

  try {
    const slot0Data = await publicClient.readContract({
      address: poolAddress,
      abi: V3_POOL_SLOT0_ABI,
      functionName: 'slot0',
    });
    
    // Trích xuất sqrtPriceX96 từ kết quả
    const sqrtPriceX96 = slot0Data[0];
    
    // Lấy liquidity
    const liquidityData = await publicClient.readContract({
      address: poolAddress,
      abi: V3_POOL_LIQUIDITY_ABI,
      functionName: 'liquidity',
    });
    
    const liquidity = liquidityData;

    // Kiểm tra dữ liệu
    if (!sqrtPriceX96 || sqrtPriceX96 === 0n || !liquidity || liquidity === 0n) {
      throw new Error("Invalid price or liquidity");
    }

    // Tính Q96 = 2^96
    const Q96 = 2n ** 96n;
    
    // Tính reserves theo công thức Uniswap v3
    // Với token0 (WBTC): L × (2^96) / sqrtP
    // Với token1 (PRANA): L × sqrtP / (2^96)
    const wbtcReserve = FullMath.mulDiv(liquidity, Q96, sqrtPriceX96);
    const pranaReserve = FullMath.mulDiv(liquidity, sqrtPriceX96, Q96);
    
    return { wbtcReserve, pranaReserve };
  } catch (err) {
    console.error("Error getting reserves:", err);
    return { wbtcReserve: 0n, pranaReserve: 0n };
  }
};
