import { useState, useEffect } from 'react';
import { createPublicClient, http, getContract } from 'viem';
import { polygon } from 'viem/chains';
import { WBTC_PRANA_V3_POOL, V3_POOL_SLOT0_ABI } from '../constants/sharedContracts';

/**
 * Custom hook to fetch WBTC/PRANA pool price information
 * @returns {Object} - { loading, error, wbtcPerPrana }
 */
export function usePoolInfo() {
  const [poolInfo, setPoolInfo] = useState({
    loading: true,
    error: null,
    wbtcPerPrana: null
  });

  useEffect(() => {
    const fetchPoolInfo = async () => {
      try {
        // Initialize the client with Polygon network
        const client = createPublicClient({
          chain: polygon,
          transport: http()
        });        

        // Set up V3 Pool contract instance using address and ABI from constants
        const poolContract = getContract({
          address: WBTC_PRANA_V3_POOL, // Use V3 pool address
          abi: V3_POOL_SLOT0_ABI,     // Use standard V3 slot0 ABI
          client
        });
        
        // Make the contract call to slot0 (no arguments needed)
        const response = await poolContract.read.slot0(); // Call slot0 instead of getSlot0
        
        const sqrtPriceX96 = response[0];
        let wbtcPerPrana = 'Not available';
        
        if (sqrtPriceX96) {
          try {
            // Token decimals
            const WBTC_DECIMALS = 8;
            const PRANA_DECIMALS = 9;
            
            // Calculation logic remains the same as it only depends on sqrtPriceX96
            const sqrtPriceDecimal = Number(sqrtPriceX96) / (2n ** 96n).toString();
            const rawPrice = sqrtPriceDecimal * sqrtPriceDecimal;
            const decimalAdjustment = Math.pow(10, WBTC_DECIMALS - PRANA_DECIMALS);
            const adjustedPrice = rawPrice * decimalAdjustment;
            
            // WBTC per 1 PRANA in Satoshis
            const satsPerPrana = (1 / adjustedPrice) * 100000000;
            
            wbtcPerPrana = satsPerPrana.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
            
          } catch (e) {
            console.error('Error calculating price:', e);
          }
        }
        
        setPoolInfo({
          loading: false,
          error: null,
          wbtcPerPrana
        });
      } catch (error) {
        console.error('Error fetching pool info:', error);
        
        setPoolInfo({
          loading: false,
          error: error.message,
          wbtcPerPrana: null
        });
      }
    };

    fetchPoolInfo();
  }, []);

  return poolInfo;
} 