import React from 'react';
import { usePoolInfo } from '../hooks/usePoolInfo';

const PoolInfo = () => {
  const { loading, error, wbtcPerPrana } = usePoolInfo();

  return (
    <div className="pool-info-card">
      <h2>WBTC/PRANA Pool Information</h2>
      <div className="pool-tokens">
        <p><strong>WBTC:</strong> 0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6</p>
        <p><strong>PRANA:</strong> 0x928277e774F34272717EADFafC3fd802dAfBD0F5</p>
        <p><strong>WBTC/PRANA V3 Pool:</strong> 0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED</p>
      </div>
      
      {loading ? (
        <p>Loading pool information...</p>
      ) : error ? (
        <div className="error">
          <p><strong>Error:</strong> {error}</p>
        </div>
      ) : (
        <div className="pool-data">
          <p><strong>WBTC per PRANA:</strong> {wbtcPerPrana} sats</p>
        </div>
      )}
    </div>
  );
};

export default PoolInfo; 