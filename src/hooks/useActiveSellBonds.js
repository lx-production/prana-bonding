import { useState, useEffect, useMemo } from 'react';
import { useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { SELL_BOND_ADDRESS, SELL_BOND_ABI } from '../constants/sellBondContract';
import { PRANA_DECIMALS, WBTC_DECIMALS } from '../constants/sharedContracts';

/**
 * Custom hook for bond-related actions based on SellPranaBond contract
 * @param {Array} bondsData - Raw bonds data from the contract (e.g., from getUserActiveBonds)
 * @returns {object} - Contains action functions and processed bond states
 */
const useActiveSellBonds = (
  bondsData,
  {
    contractAddress = SELL_BOND_ADDRESS,
    contractAbi = SELL_BOND_ABI,
  } = {}
) => {
  const { writeContractAsync } = useWriteContract();
  const [actionLoading, setActionLoading] = useState({ bondId: null, action: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [localBondsData, setLocalBondsData] = useState(() => bondsData || []);

  // Helper function to format timestamps to Vietnam time with 24h format
  const formatVietnamTime = (timestamp) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Update time every second for progress and claimable amount updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocalBondsData(bondsData || []);
  }, [bondsData]);

  // Helper function to calculate claimable WBTC based on contract logic
  const calculateClaimableWbtc = (bond, now) => { // Renamed function and updated logic for WBTC
      const currentTimeBigInt = BigInt(now);
      const creationTime = BigInt(bond.creationTime);
      const maturityTime = BigInt(bond.maturityTime);
      const wbtcAmount = BigInt(bond.wbtcAmount); // Use wbtcAmount
      const claimedWbtc = BigInt(bond.claimedWbtc); // Use claimedWbtc
      const lastClaimTime = BigInt(bond.lastClaimTime);

      // Cannot claim if already fully claimed or no time has passed since last claim
      if (bond.claimed || currentTimeBigInt <= lastClaimTime) {
          return BigInt(0);
      }

      let totalReleasableWbtc; // Renamed variable

      if (currentTimeBigInt >= maturityTime) {
          // Mature bond: Total releasable is the full amount
          totalReleasableWbtc = wbtcAmount;
      } else {
          // Vesting bond: Calculate linearly vested amount
          const totalVestingDuration = maturityTime - creationTime;
          const elapsedSinceCreation = currentTimeBigInt > creationTime ? currentTimeBigInt - creationTime : BigInt(0);

          if (totalVestingDuration <= 0 || elapsedSinceCreation <= 0) {
              return BigInt(0); // Avoid division by zero or negative time
          }

          // Mimic FullMath.mulDiv: (wbtcAmount * elapsedSinceCreation) / totalVestingDuration
          // Use BigInt division for precision
          totalReleasableWbtc = (wbtcAmount * elapsedSinceCreation) / totalVestingDuration;
      }

      // Claimable now is the difference between total releasable and what's already claimed
      const potentiallyClaimable = totalReleasableWbtc > claimedWbtc ? totalReleasableWbtc - claimedWbtc : BigInt(0);

      // Ensure we don't calculate more than the remaining total amount
      const remainingWbtc = wbtcAmount - claimedWbtc; // Renamed variable
      return potentiallyClaimable < remainingWbtc ? potentiallyClaimable : remainingWbtc;
  };


  // Process bonds data
  const processedSellBonds = useMemo(() => {
    if (!localBondsData) return [];
    return localBondsData.map((bond) => {
      const now = currentTime;
      const creationTimeNum = Number(bond.creationTime);
      const maturityTimeNum = Number(bond.maturityTime);
      const duration = maturityTimeNum - creationTimeNum;
      const isMature = now >= maturityTimeNum;
      const claimableWbtcRaw = calculateClaimableWbtc(bond, now); // Updated function call and variable name
      const canClaim = !bond.claimed && claimableWbtcRaw > 0; // Can claim if not fully claimed and there's a non-zero amount claimable

      return {
        ...bond,
        id: Number(bond.id), // Convert BigInt ID to number for easier handling in React keys
        pranaAmountFormatted: formatUnits(bond.pranaAmount, PRANA_DECIMALS), // Keep PRANA formatting for display
        wbtcAmountFormatted: formatUnits(bond.wbtcAmount, WBTC_DECIMALS), // Keep WBTC formatting for display
        claimedWbtcFormatted: formatUnits(bond.claimedWbtc, WBTC_DECIMALS), // Format claimed WBTC
        creationTimeFormatted: formatVietnamTime(creationTimeNum),
        maturityTimeFormatted: formatVietnamTime(maturityTimeNum),
        isMature,
        progress: duration > 0 ? Math.min(
            100,
            Math.floor(((now - creationTimeNum) / duration) * 100)
        ) : (isMature ? 100 : 0),
        claimableWbtcRaw: claimableWbtcRaw, // Keep raw BigInt for potential use - Renamed
        claimableWbtcFormatted: formatUnits(claimableWbtcRaw, WBTC_DECIMALS), // Format claimable WBTC - Renamed and updated decimals
        canClaim: canClaim,
        status: bond.claimed ? 'Claimed' : (isMature ? 'Mature' : 'Vesting'),
      };
    }).sort((a, b) => a.id - b.id); // Sort by ID for consistent display
  }, [localBondsData, currentTime]); // Recalculate when bonds data or time changes

  // Reset messages after 10 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle claim bond
  const handleSellClaim = async (bondId) => {
    try {
      setActionLoading({ bondId, action: 'claim' });
      setError('');
      setSuccess('');

      // Find the bond to potentially display info in success/error message
      const bond = processedSellBonds.find(b => b.id === bondId);
      const claimableAmount = bond ? bond.claimableWbtcFormatted : 'some'; // Use claimableWbtcFormatted

      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'claimBond',
        args: [BigInt(bondId)] // Ensure bondId is passed as BigInt if required by ABI
      });

      setSuccess(`Successfully sent claim transaction for bond #${bondId} (${claimableAmount} WBTC). Tx: ${txHash}. Giao dịch claim bond #${bondId} (${claimableAmount} WBTC) đã gửi thành công.`);
      if (bond) {
        const claimableRaw = bond.claimableWbtcRaw || BigInt(0);
        const remainingRaw = BigInt(bond.wbtcAmount) - BigInt(bond.claimedWbtc);
        const isFullClaim = claimableRaw >= remainingRaw;

        setLocalBondsData((prevBonds) => {
          if (!prevBonds) return prevBonds;
          return prevBonds.reduce((acc, currentBond) => {
            if (Number(currentBond.id) !== bondId) {
              acc.push(currentBond);
              return acc;
            }

            if (isFullClaim) {
              return acc;
            }

            const updatedClaimedWbtc = BigInt(currentBond.claimedWbtc) + claimableRaw;
            const updatedBond = {
              ...currentBond,
              claimedWbtc: updatedClaimedWbtc,
              lastClaimTime: BigInt(currentTime),
            };

            acc.push(updatedBond);
            return acc;
          }, []);
        });
      }
    } catch (err) {
      console.error('Claim bond error:', err);
      // Attempt to provide a more user-friendly error
      let message = err.shortMessage || err.message || 'An unknown error occurred.';
      // Customize message based on common contract errors if possible
      if (message.includes("Not bond owner")) {
          message = "You are not the owner of this bond.";
      } else if (message.includes("Bond fully claimed")) {
          message = "This bond has already been fully claimed.";
      } else if (message.includes("No new amount to claim")) {
          message = "No additional WBTC is available to claim at this time."; // Updated message for WBTC
      }
      setError(`Failed to claim bond #${bondId}: ${message}`);
    } finally {
      setActionLoading({ bondId: null, action: null });
    }
  };

  return {
    processedSellBonds,
    handleSellClaim,
    actionLoading,
    error,
    success,
    setError, // Allow parent component to set messages if needed
    setSuccess,
  };
};

export default useActiveSellBonds; // Updated export