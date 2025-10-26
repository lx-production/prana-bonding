import { FullMath } from './FullMath';
import { toBigInt, extractResult } from './bigint-utils';
import { V3_POOL_SLOT0_ABI, V3_POOL_LIQUIDITY_ABI, WBTC_PRANA_V3_POOL } from '../constants/sharedContracts';

/**
 * Fetches reserves from Uniswap V3 Pool using efficient multicall
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Address of the Uniswap V3 pool (defaults to WBTC_PRANA_V3_POOL)
 * @returns {Promise<{poolWbtcReserve: bigint, poolPranaReserve: bigint}>} Pool reserves for WBTC and PRANA
 */
export const fetchPoolReserves = async (publicClient, poolAddress = WBTC_PRANA_V3_POOL) => {
  if (!publicClient || !poolAddress) {
    return { poolWbtcReserve: 0n, poolPranaReserve: 0n };
  }

  try {
    const [slot0Result, liquidityResult] = await publicClient.multicall({
      contracts: [
        {
          address: poolAddress,
          abi: V3_POOL_SLOT0_ABI,
          functionName: 'slot0'
        },
        {
          address: poolAddress,
          abi: V3_POOL_LIQUIDITY_ABI,
          functionName: 'liquidity'
        }
      ],
      allowFailure: false
    });

    const slot0Data = extractResult(slot0Result);
    const liquidityData = extractResult(liquidityResult);

    const sqrtPriceSource = Array.isArray(slot0Data)
      ? slot0Data[0]
      : slot0Data?.sqrtPriceX96 ?? slot0Data;
    const sqrtPriceX96 = toBigInt(sqrtPriceSource);
    const liquidity = toBigInt(liquidityData);

    if (sqrtPriceX96 === 0n || liquidity === 0n) {
      return { poolWbtcReserve: 0n, poolPranaReserve: 0n };
    }

    const Q96 = 2n ** 96n;
    const poolWbtcReserve = FullMath.mulDiv(liquidity, Q96, sqrtPriceX96);
    const poolPranaReserve = FullMath.mulDiv(liquidity, sqrtPriceX96, Q96);

    return { poolWbtcReserve, poolPranaReserve };
  } catch (err) {
    console.error("Error fetching pool reserves:", err);
    return { poolWbtcReserve: 0n, poolPranaReserve: 0n };
  }
};

/**
 * @deprecated Use fetchPoolReserves instead. Kept for backward compatibility.
 */
export const getReserves = fetchPoolReserves;
