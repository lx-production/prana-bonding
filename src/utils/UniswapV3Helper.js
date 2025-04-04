import { FullMath } from './FullMath';
import { V3_POOL_SLOT0_ABI, V3_POOL_LIQUIDITY_ABI, PRANA_DECIMALS } from '../constants/sharedContracts';

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
 * @param {object} bondRatesMap Map chứa các tỷ lệ chiết khấu bond
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @returns {Promise<bigint>} Số lượng WBTC cần thiết
 */
export const calculateWbtcAmount = async (
  pranaAmount, 
  bondTermIndex, 
  bondRatesMap, 
  publicClient, 
  poolAddress
) => {
  try {
    // Chuyển đổi pranaAmount thành BigInt
    const pranaAmountBn = BigInt(pranaAmount);
    
    // Lấy reserves từ pool
    const { wbtcReserve, pranaReserve } = await getReserves(publicClient, poolAddress);
    
    if (wbtcReserve === 0n || pranaReserve === 0n) {
      throw new Error("Zero reserves returned from pool");
    }
    
    // Kiểm tra nếu pranaAmount lớn hơn hoặc bằng pranaReserve
    if (pranaAmountBn >= pranaReserve) {
      throw new Error("PRANA amount must be less than pranaReserve");
    }
    
    // Áp dụng công thức constant product để xác định lượng WBTC đầu vào thông thường
    // Δx = (x × Δy) / (y - Δy)
    const regularWbtcAmount = FullMath.mulDiv(
      wbtcReserve, 
      pranaAmountBn, 
      pranaReserve - pranaAmountBn
    );
    
    // Lấy rate từ map
    const selectedTerm = Object.keys(bondRatesMap)[bondTermIndex];
    if (!selectedTerm) {
      throw new Error("Invalid term index");
    }
    
    const rate = BigInt(bondRatesMap[selectedTerm].rate);
    
    // Áp dụng tỷ lệ chiết khấu (rate là basis points - 1/100 của 1%)
    const TEN_THOUSAND = 10000n;
    const discountedRegularAmount = (regularWbtcAmount * (TEN_THOUSAND - rate)) / TEN_THOUSAND;
    
    // Áp dụng phí 1.25% (1% phí LP + 0.25% phí Uniswap)
    // 1/0.9875 = 80/79
    const finalWbtcAmount = (discountedRegularAmount * 80n) / 79n;
    
    return finalWbtcAmount;
  } catch (err) {
    console.error("Error calculating WBTC amount:", err);
    throw err;
  }
};

/**
 * Tính toán số lượng PRANA có thể mua với một lượng WBTC nhất định
 * @param {bigint|string|number} wbtcAmount Số lượng WBTC muốn dùng để mua
 * @param {number} bondTermIndex Chỉ số của kỳ hạn bond (từ BOND_TERM_OPTIONS)
 * @param {object} bondRatesMap Map chứa các tỷ lệ chiết khấu bond
 * @param {object} publicClient Viem publicClient
 * @param {string} poolAddress Địa chỉ pool Uniswap V3
 * @returns {Promise<bigint>} Số lượng PRANA nhận được
 */
export const calculatePranaAmount = async (
  wbtcAmount, 
  bondTermIndex, 
  bondRatesMap, 
  publicClient, 
  poolAddress
) => {
  try {
    // Chuyển đổi wbtcAmount thành BigInt
    const wbtcAmountBn = BigInt(wbtcAmount);
    
    // Lấy reserves từ pool
    const { wbtcReserve, pranaReserve } = await getReserves(publicClient, poolAddress);
    
    if (wbtcReserve === 0n || pranaReserve === 0n) {
      throw new Error("Zero reserves returned from pool");
    }
    
    // Loại bỏ phí 1.25% (1% phí LP + 0.25% phí Uniswap)
    const amountWithoutFee = (wbtcAmountBn * 79n) / 80n;
    
    // Lấy rate từ map
    const selectedTerm = Object.keys(bondRatesMap)[bondTermIndex];
    if (!selectedTerm) {
      throw new Error("Invalid term index");
    }
    
    const rate = BigInt(bondRatesMap[selectedTerm].rate);
    
    // Áp dụng chiết khấu
    const TEN_THOUSAND = 10000n;
    const regularWbtcAmount = (amountWithoutFee * TEN_THOUSAND) / (TEN_THOUSAND - rate);
    
    // Áp dụng công thức inverse constant product để xác định output PRANA
    // Δy = (y × Δx) / (x + Δx)
    const pranaAmount = FullMath.mulDiv(
      pranaReserve, 
      regularWbtcAmount, 
      wbtcReserve + regularWbtcAmount
    );
    
    // Kiểm tra hợp lý
    if (pranaAmount >= pranaReserve) {
      throw new Error("Calculated PRANA amount exceeds reserve");
    }
    
    return pranaAmount;
  } catch (err) {
    console.error("Error calculating PRANA amount:", err);
    throw err;
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
