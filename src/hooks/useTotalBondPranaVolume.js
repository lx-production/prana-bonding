import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { PRANA_DECIMALS } from '../constants/sharedContracts';

const START_INDEX = 1n;

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error.shortMessage === 'string') return error.shortMessage.toLowerCase();
  if (typeof error.message === 'string') return error.message.toLowerCase();
  if (error?.cause) return getErrorMessage(error.cause);
  return String(error).toLowerCase();
};

const isOutOfRangeError = (error) => {
  if (error?.data === '0x') {
    return true;
  }

  const message = getErrorMessage(error);

  return (
    message.includes('index out of range') ||
    message.includes('out of bounds') ||
    message.includes('out-of-bounds') ||
    message.includes('missing revert data') ||
    message.includes('panic code 0x32') ||
    message.includes('panic: 0x32') ||
    message.includes('array empty') ||
    (message.includes('execution reverted') && message.includes('0x'))
  );
};

async function fetchTotalPranaFromContract({ client, address, abi, fieldName }) {
  let total = 0n;
  let index = START_INDEX;

  while (true) {
    try {
      const bond = await client.readContract({
        address,
        abi,
        functionName: 'bonds',
        args: [index],
      });

      const amount = bond?.[fieldName];

      if (amount !== undefined) {
        const normalizedAmount =
          typeof amount === 'bigint' ? amount : BigInt(amount?.toString?.() ?? '0');
        total += normalizedAmount;
      }

      index += 1n;
    } catch (error) {
      if (isOutOfRangeError(error)) {
        break;
      }
      throw error;
    }
  }

  return total;
}

export const useTotalBondPranaVolume = ({
  contracts,
  fieldName = 'pranaAmount',
  decimals = PRANA_DECIMALS,
} = {}) => {
  const publicClient = usePublicClient();
  const [totalRaw, setTotalRaw] = useState(0n);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedContracts = useMemo(() => contracts ?? [], [contracts]);

  const fetchVolume = useCallback(async () => {
    if (!publicClient) {
      throw new Error('Public client is not available');
    }

    let combinedTotal = 0n;

    for (const contract of normalizedContracts) {
      const abiToUse = contract.bondAbi ?? contract.abi;

      if (!abiToUse) {
        throw new Error('Bond ABI fragment is missing for contract');
      }

      combinedTotal += await fetchTotalPranaFromContract({
        client: publicClient,
        address: contract.address,
        abi: abiToUse,
        fieldName,
      });
    }

    return combinedTotal;
  }, [publicClient, normalizedContracts, fieldName]);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const combinedTotal = await fetchVolume();
      setTotalRaw(combinedTotal);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchVolume]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!normalizedContracts.length) {
        setTotalRaw(0n);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const combinedTotal = await fetchVolume();
        if (isMounted) {
          setTotalRaw(combinedTotal);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [fetchVolume, normalizedContracts.length]);

  const totalFormatted = useMemo(
    () => formatUnits(totalRaw, decimals),
    [totalRaw, decimals]
  );

  return {
    totalPranaRaw: totalRaw,
    totalPranaFormatted: totalFormatted,
    isLoading,
    error,
    refetch,
  };
};

export default useTotalBondPranaVolume;

