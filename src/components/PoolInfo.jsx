import React, { useEffect, useState } from 'react';
import { createPublicClient, http, getContract } from 'viem';
import { polygon } from 'viem/chains';

// Custom replacer function for JSON.stringify to handle BigInt
const bigIntReplacer = (key, value) => {
  // Convert BigInt to string with a suffix to indicate it was a BigInt
  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }
  return value;
};

const PoolInfo = () => {
  const [poolInfo, setPoolInfo] = useState({
    loading: true,
    error: null,
    wbtcPerPrana: null
  });

  useEffect(() => {
    const fetchPoolInfo = async () => {
      try {
        // Initialize the client with Polygon network (not mainnet)
        const client = createPublicClient({
          chain: polygon,
          transport: http()
        });

        const poolId = '0x55f29aa6c65f8a762795b3643432daa984d752b36610b1ca485796d5714e1e15';
        
        const stateViewABI = [{"inputs":[{"internalType":"PoolId","name":"poolId","type":"bytes32"}],"name":"getSlot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint24","name":"protocolFee","type":"uint24"},{"internalType":"uint24","name":"lpFee","type":"uint24"}],"stateMutability":"view","type":"function"}];

        // Set up StateView contract instance
        const stateView = getContract({
          address: '0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a',
          abi: stateViewABI,
          client
        });
        
        // Make the contract call and get the response
        const response = await stateView.read.getSlot0([poolId]);
        
        const sqrtPriceX96 = response[0];
        let wbtcPerPrana = 'Not available';
        
        if (sqrtPriceX96) {
          try {
            // Token decimals
            const WBTC_DECIMALS = 8;
            const PRANA_DECIMALS = 9;
            
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

  return (
    <div className="pool-info-card">
      <h2>WBTC/PRANA Pool Information</h2>
      <div className="pool-tokens">
        <p><strong>WBTC:</strong> 0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6</p>
        <p><strong>PRANA:</strong> 0x928277e774F34272717EADFafC3fd802dAfBD0F5</p>
        <p><strong>Pool ID:</strong> 0x55f29aa6c65f8a762795b3643432daa984d752b36610b1ca485796d5714e1e15</p>
      </div>
      
      {poolInfo.loading ? (
        <p>Loading pool information...</p>
      ) : poolInfo.error ? (
        <div className="error">
          <p><strong>Error:</strong> {poolInfo.error}</p>
        </div>
      ) : (
        <div className="pool-data">
          <p><strong>WBTC per PRANA:</strong> {poolInfo.wbtcPerPrana} sats</p>
        </div>
      )}
    </div>
  );
};

export default PoolInfo; 