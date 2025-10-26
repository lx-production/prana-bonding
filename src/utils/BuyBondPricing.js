import { FullMath } from './FullMath';
import { BUY_BOND_ADDRESS, BUY_BOND_ABI } from '../constants/buyBondContract';
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
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'impactedWbtcReserve'
      },
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'impactedPranaReserve'
      },
      {
        address: BUY_BOND_ADDRESS,
        abi: BUY_BOND_ABI,
        functionName: 'lastImpactedSync'
      }
    ],
    allowFailure: false
  });

  return {
    impactedWbtcReserve: toBigInt(extractResult(wbtcRes)),
    impactedPranaReserve: toBigInt(extractResult(pranaRes)),
    lastImpactedSync: toBigInt(extractResult(lastSync))
  };
};


const fetchPoolReserves = async (publicClient) => {
  const [slot0Result, liquidityResult] = await publicClient.multicall({
    contracts: [
      {
        address: WBTC_PRANA_V3_POOL,
        abi: V3_POOL_SLOT0_ABI,
        functionName: 'slot0'
      },
      {
        address: WBTC_PRANA_V3_POOL,
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
};


const ensurePositiveReserve = (value) => {
  const bigValue = toBigInt(value);
  return bigValue <= 0n ? 1n : bigValue;
};

const computeRegularWbtcFromImpacted = (impactedWbtc, impactedPrana, pranaAmount) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = impactedPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(impactedWbtcBig, pranaAmountBig, denominator);
};

const computeRegularPranaFromImpacted = (impactedWbtc, impactedPrana, wbtcAfterFee) => {
  const impactedWbtcBig = toBigInt(impactedWbtc);
  const impactedPranaBig = toBigInt(impactedPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(impactedPranaBig, wbtcAfterFeeBig, impactedWbtcBig + wbtcAfterFeeBig);
};

const computeMarketWbtc = (poolWbtc, poolPrana, pranaAmount) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const pranaAmountBig = toBigInt(pranaAmount);

  const denominator = poolPranaBig - pranaAmountBig;
  if (denominator <= 0n) {
    return null;
  }
  return FullMath.mulDiv(poolWbtcBig, pranaAmountBig, denominator);
};

const computeMarketPrana = (poolWbtc, poolPrana, wbtcAfterFee) => {
  const poolWbtcBig = toBigInt(poolWbtc);
  const poolPranaBig = toBigInt(poolPrana);
  const wbtcAfterFeeBig = toBigInt(wbtcAfterFee);

  return FullMath.mulDiv(poolPranaBig, wbtcAfterFeeBig, poolWbtcBig + wbtcAfterFeeBig);
};


export const calculateWbtcQuote = async ({ pranaAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { wbtcQuote: 0n, reservesSynced: false };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcReserve);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaReserve);

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcSafe = ensurePositiveReserve(poolWbtcReserve);
  const poolPranaSafe = ensurePositiveReserve(poolPranaReserve);

  const marketWbtc = computeMarketWbtc(poolWbtcSafe, poolPranaSafe, pranaAmountWei);
  let regularBaseline = computeRegularWbtcFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    pranaAmountWei
  );
  let reservesSynced = false;

  if (regularBaseline === null) {
    if (marketWbtc === null) {
      return { wbtcQuote: 0n, reservesSynced: false };
    }
    regularBaseline = marketWbtc;
    reservesSynced = true;
  } else if (marketWbtc !== null && regularBaseline < marketWbtc) {
    regularBaseline = marketWbtc;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'bondRates',
    args: [period]
  });

  const discountRate = BigInt(rate);
  const discountedWbtc = FullMath.mulDiv(regularBaseline, 10000n - discountRate, 10000n);
  const wbtcAfterFee = FullMath.mulDiv(discountedWbtc, 100n, 99n);

  return { wbtcQuote: wbtcAfterFee, reservesSynced };
};


export const calculatePranaQuote = async ({ wbtcAmountWei, period, publicClient }) => {
  if (!publicClient) {
    return { pranaQuote: 0n, reservesSynced: false };
  }

  const { impactedWbtcReserve, impactedPranaReserve } = await fetchImpactedReserves(publicClient);
  const impactedWbtcSafe = ensurePositiveReserve(impactedWbtcReserve);
  const impactedPranaSafe = ensurePositiveReserve(impactedPranaReserve);

  const wbtcAfterFee = FullMath.mulDiv(wbtcAmountWei, 99n, 100n);
  const regularPranaFromImpacted = computeRegularPranaFromImpacted(
    impactedWbtcSafe,
    impactedPranaSafe,
    wbtcAfterFee
  );

  const { poolWbtcReserve, poolPranaReserve } = await fetchPoolReserves(publicClient);
  const poolWbtcSafe = ensurePositiveReserve(poolWbtcReserve);
  const poolPranaSafe = ensurePositiveReserve(poolPranaReserve);

  const marketPrana = computeMarketPrana(poolWbtcSafe, poolPranaSafe, wbtcAfterFee);
  let regularBaseline = regularPranaFromImpacted;
  let reservesSynced = false;

  if (marketPrana !== null && regularBaseline > marketPrana) {
    regularBaseline = marketPrana;
    reservesSynced = true;
  }

  const [rate] = await publicClient.readContract({
    address: BUY_BOND_ADDRESS,
    abi: BUY_BOND_ABI,
    functionName: 'bondRates',
    args: [period]
  });

  const discountRate = BigInt(rate);
  const pranaQuote = FullMath.mulDiv(regularBaseline, 10000n, 10000n - discountRate);

  return { pranaQuote, reservesSynced };
};


