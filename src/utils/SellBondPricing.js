import { FullMath } from './FullMath';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { WBTC_PRANA_V3_POOL, V3_POOL_SLOT0_ABI, V3_POOL_LIQUIDITY_ABI } from '../constants/sharedContracts';

const toBigInt = (value) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) return BigInt(value);
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'object' && value !== null) {
    if ('result' in value) return toBigInt(value.result);
    if (Array.isArray(value)) {
      return value.reduce((acc, item) => (toBigInt(item) ? toBigInt(item) : acc), 0n);
    }
  }
  throw new TypeError(`Unsupported BigInt conversion for value: ${value}`);
};

const extractResult = (entry) => {
  if (entry === undefined || entry === null) return undefined;
  if (typeof entry === 'object' && entry !== null && 'result' in entry) {
    return entry.result;
  }
  return entry;
};

const fetchImpactedReserves = async (publicClient) => {
  const [wbtcRes, pranaRes, lastSync] = await publicClient.multicall({
    contracts: [
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'impactedWbtcReserve',
      },
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'impactedPranaReserve',
      },
      {
        address: SELL_BOND_ADDRESS,
        abi: SELL_BOND_ABI,
        functionName: 'lastImpactedSync',
      },
    ],
    allowFailure: false,
  });

  return {
    impactedWbtcReserve: toBigInt(extractResult(wbtcRes)),
    impactedPranaReserve: toBigInt(extractResult(pranaRes)),
    lastImpactedSync: toBigInt(extractResult(lastSync)),
  };
};

const fetchPoolReserves = async (publicClient) => {
  const [slot0Result, liquidityResult] = await publicClient.multicall({
    contracts: [
      {
        address: WBTC_PRANA_V3_POOL,
        abi: V3_POOL_SLOT0_ABI,
        functionName: 'slot0',
      },
      {
        address: WBTC_PRANA_V3_POOL,
        abi: V3_POOL_LIQUIDITY_ABI,
        functionName: 'liquidity',
      },
    ],
    allowFailure: false,
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
};

const ensurePositiveReserve = (value) => {
  const bigValue = toBigInt(value);
  return bigValue <= 0n ? 1n : bigValue;
};

const computeRegularWbtcFromImpacted = (impactedWbtc, impactedPrana, netPranaAmount) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const netPranaBig = toBigInt(netPranaAmount);

  const denominator = impactedPranaBig + netPranaBig;
  if (denominator <= 0n) {
    return null;
  }

  return FullMath.mulDiv(impactedWbtcBig, netPranaBig, denominator);
};

const computeMarketWbtc = (poolWbtc, poolPrana, netPranaAmount) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const netPranaBig = toBigInt(netPranaAmount);

  const denominator = poolPranaBig + netPranaBig;
  if (denominator <= 0n) {
    return null;
  }

  return FullMath.mulDiv(poolWbtcBig, netPranaBig, denominator);
};

export const calculateWbtcQuote = async ({ pranaAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { wbtcQuote: 0n, reservesSynced: false };
  }

  const pranaAmount = toBigInt(pranaAmountWei);
  if (pranaAmount <= 0n) {
    return { wbtcQuote: 0n, reservesSynced: false };
  }

  const netPranaAmount = FullMath.mulDiv(pranaAmount, 99n, 100n);
  if (netPranaAmount <= 0n) {
    return { wbtcQuote: 0n, reservesSynced: false };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcReserve);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaReserve);

  let regularBaseline = computeRegularWbtcFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    netPranaAmount,
  );

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcSafe = ensurePositiveReserve(poolWbtcReserve);
  const poolPranaSafe = ensurePositiveReserve(poolPranaReserve);

  const marketWbtc = computeMarketWbtc(poolWbtcSafe, poolPranaSafe, netPranaAmount);
  let reservesSynced = false;

  if (regularBaseline === null) {
    if (marketWbtc === null) {
      return { wbtcQuote: 0n, reservesSynced: false };
    }
    regularBaseline = marketWbtc;
    reservesSynced = true;
  } else if (marketWbtc !== null && regularBaseline > marketWbtc) {
    regularBaseline = marketWbtc;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: SELL_BOND_ADDRESS,
    abi: SELL_BOND_ABI,
    functionName: 'bondRates',
    args: [period],
  });

  const premiumRate = BigInt(rate);
  const wbtcQuote = FullMath.mulDiv(regularBaseline, 10000n + premiumRate, 10000n);

  return { wbtcQuote, reservesSynced };
};


