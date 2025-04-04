import { FullMath } from './FullMath';
import { V3_POOL_SLOT0_ABI, V3_POOL_LIQUIDITY_ABI, PRANA_DECIMALS } from '../constants/sharedContracts';
import { BOND_TERM_OPTIONS } from '../constants/bondingTerms';

/**
 * Lấy reserves từ Uniswap V3 Pool
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @returns {Promise<{wbtcReserve: bigint, pranaReserve: bigint}>} Reserves của WBTC và PRANA
 */
export const getReserves = async (publicClient, poolAddress) => {
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

/**
 * Tính toán số lượng WBTC cần thiết cho một lượng PRANA nhất định
 * @param {bigint|string|number} pranaAmount Số lượng PRANA muốn mua
 * @param {number} bondTermIndex Chỉ số của kỳ hạn bond (từ BOND_TERM_OPTIONS)
 * @param {object} bondRatesMap Map chứa các tỷ lệ chiết khấu bond { seconds: { rate: BigInt, duration: BigInt } }
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @param {Array} termOptions Array BOND_TERM_OPTIONS
 * @returns {Promise<bigint>} Số lượng WBTC cần thiết
 */
export const calculateWbtcAmount = async (
  pranaAmount,
  bondTermIndex,
  bondRatesMap,
  publicClient,
  poolAddress,
  termOptions = BOND_TERM_OPTIONS
) => {
  try {
    const pranaAmountBn = BigInt(pranaAmount);
    const { wbtcReserve, pranaReserve } = await getReserves(publicClient, poolAddress);

    if (wbtcReserve === 0n || pranaReserve === 0n) throw new Error("Zero reserves returned from pool");
    if (pranaAmountBn >= pranaReserve) throw new Error("PRANA amount must be less than pranaReserve");

    const regularWbtcAmount = FullMath.mulDiv(wbtcReserve, pranaAmountBn, pranaReserve - pranaAmountBn);

    // Get the correct term object using the index
    const selectedOption = termOptions[bondTermIndex];
    if (!selectedOption) throw new Error(`Invalid term index: ${bondTermIndex}`);

    // Use the term's seconds value as the key for the bondRatesMap
    const termInfo = bondRatesMap[selectedOption.seconds];
    if (!termInfo || typeof termInfo.rate === 'undefined') throw new Error(`Bond rate info not found for term seconds: ${selectedOption.seconds}`);

    const rate = BigInt(termInfo.rate); // Rate is already BigInt in the map

    const TEN_THOUSAND = 10000n;
    const discountedRegularAmount = (regularWbtcAmount * (TEN_THOUSAND - rate)) / TEN_THOUSAND;

    // Apply fee
    const finalWbtcAmount = (discountedRegularAmount * 80n) / 79n;

    return finalWbtcAmount;
  } catch (err) {
    console.error("Error calculating WBTC amount:", err);
    // Consider re-throwing or returning a specific error value/object
    throw err; // Re-throw for the caller (useBonding) to handle
  }
};

/**
 * Tính toán số lượng PRANA có thể mua với một lượng WBTC nhất định
 * @param {bigint|string|number} wbtcAmount Số lượng WBTC muốn dùng để mua
 * @param {number} bondTermIndex Chỉ số của kỳ hạn bond (từ BOND_TERM_OPTIONS)
 * @param {object} bondRatesMap Map chứa các tỷ lệ chiết khấu bond { seconds: { rate: BigInt, duration: BigInt } }
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @param {Array} termOptions Array BOND_TERM_OPTIONS
 * @returns {Promise<bigint>} Số lượng PRANA nhận được
 */
export const calculatePranaAmount = async (
  wbtcAmount,
  bondTermIndex,
  bondRatesMap,
  publicClient,
  poolAddress,
  termOptions = BOND_TERM_OPTIONS
) => {
  try {
    const wbtcAmountBn = BigInt(wbtcAmount);
    const { wbtcReserve, pranaReserve } = await getReserves(publicClient, poolAddress);

    if (wbtcReserve === 0n || pranaReserve === 0n) throw new Error("Zero reserves returned from pool");

    // Remove fee
    const amountWithoutFee = (wbtcAmountBn * 79n) / 80n;

    // Get the correct term object using the index
    const selectedOption = termOptions[bondTermIndex];
    if (!selectedOption) throw new Error(`Invalid term index: ${bondTermIndex}`);

    // Use the term's seconds value as the key for the bondRatesMap
    const termInfo = bondRatesMap[selectedOption.seconds];
     if (!termInfo || typeof termInfo.rate === 'undefined') throw new Error(`Bond rate info not found for term seconds: ${selectedOption.seconds}`);

    const rate = BigInt(termInfo.rate); // Rate is already BigInt

    const TEN_THOUSAND = 10000n;
    // Ensure rate is not 10000 (100%) or more, which would cause division by zero or negative
    if (rate >= TEN_THOUSAND) throw new Error(`Invalid discount rate >= 100%: ${rate}`);
    
    const regularWbtcAmount = (amountWithoutFee * TEN_THOUSAND) / (TEN_THOUSAND - rate);

    const pranaAmount = FullMath.mulDiv(pranaReserve, regularWbtcAmount, wbtcReserve + regularWbtcAmount);

    if (pranaAmount >= pranaReserve) throw new Error("Calculated PRANA amount exceeds reserve");

    return pranaAmount;
  } catch (err) {
    console.error("Error calculating PRANA amount:", err);
     // Consider re-throwing or returning a specific error value/object
    throw err; // Re-throw for the caller (useBonding) to handle
  }
};

/**
 * Tính toán giá ước tính của WBTC/PRANA
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @returns {Promise<bigint>} Giá của 1 PRANA theo WBTC (được điều chỉnh theo PRANA_DECIMALS)
 */
export const getEstimatedWbtcPerPrana = async (publicClient, poolAddress) => {
  if (!publicClient || !poolAddress) return 0n;
  
  try {
    // Lấy reserves từ pool
    const { wbtcReserve, pranaReserve } = await getReserves(publicClient, poolAddress);
    
    if (wbtcReserve === 0n || pranaReserve === 0n) {
      throw new Error("Zero reserves returned from pool");
    }

    // Tính giá của 1 PRANA theo WBTC
    // Điều chỉnh thập phân: (WBTC/PRANA) * 10^PRANA_DECIMALS để đảm bảo độ chính xác
    // WBTC có 8 chữ số thập phân, PRANA có 9 chữ số thập phân
    const price = FullMath.mulDiv(
      wbtcReserve * (10n ** BigInt(PRANA_DECIMALS)), 
      1n, 
      pranaReserve
    );
    
    return price;
  } catch (err) {
    console.error("Failed to fetch price from Uniswap V3 pool:", err);
    return 0n;
  }
};
