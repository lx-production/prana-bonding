// This file contains the contract addresses and ABIs
// Replace placeholder addresses with actual deployed contract addresses

// PRANA Token contract (ERC20 with permit functionality)
export const PRANA_TOKEN_ADDRESS = '0x928277e774F34272717EADFafC3fd802dAfBD0F5'; // Replace with actual token address

// Contract ABIs - Using standard JSON format instead of human-readable format
export const PRANA_TOKEN_ABI = [
  // ERC20 standard functions
  {
    "name": "name",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "string"}]
  },
  {
    "name": "symbol",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "string"}]
  },
  {
    "name": "decimals",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint8"}]
  },
  {
    "name": "totalSupply",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "owner", "type": "address"}],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "allowance",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "approve",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"}
    ],
    "outputs": [{"type": "bool"}]
  },
  {
    "name": "transfer",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "value", "type": "uint256"}
    ],
    "outputs": [{"type": "bool"}]
  },
  {
    "name": "transferFrom",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "value", "type": "uint256"}
    ],
    "outputs": [{"type": "bool"}]
  },
  
  // ERC20Permit functions
  {
    "name": "permit",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "deadline", "type": "uint256"},
      {"name": "v", "type": "uint8"},
      {"name": "r", "type": "bytes32"},
      {"name": "s", "type": "bytes32"}
    ],
    "outputs": []
  },
  
  // Required for EIP-2612 permit signing
  {
    "name": "nonces",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "owner", "type": "address"}],
    "outputs": [{"type": "uint256"}]
  },
  
  // Events
  {
    "name": "Transfer",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "from", "type": "address"},
      {"indexed": true, "name": "to", "type": "address"},
      {"indexed": false, "name": "value", "type": "uint256"}
    ]
  },
  {
    "name": "Approval",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "owner", "type": "address"},
      {"indexed": true, "name": "spender", "type": "address"},
      {"indexed": false, "name": "value", "type": "uint256"}
    ]
  }
];

// Staking Contract
export const STAKING_CONTRACT_ADDRESS = '0x714425A4F4d624ef83fEff810a0EEC30B0847868'; // Replace with actual contract address

export const STAKING_CONTRACT_ABI = [
  // View functions
  {
    "name": "PRANA",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "address"}]
  },
  {
    "name": "MIN_STAKE",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "DAY",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "gracePeriod",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  {
    "name": "earlyUnstakePenaltyPercent",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint8"}]
  },
  {
    "name": "aprByDuration",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "duration", "type": "uint256"}],
    "outputs": [{"type": "uint8"}]
  },  
  {
    "name": "getAllAPRs",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {"name": "durations", "type": "uint256[]"},
      {"name": "aprs", "type": "uint8[]"}
    ]
  },
  {
    "name": "getStakerStakes",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "staker", "type": "address"}],
    "outputs": [{
      "type": "tuple[]",
      "components": [
        {"name": "id", "type": "uint32"},
        {"name": "amount", "type": "uint256"},
        {"name": "startTime", "type": "uint256"},
        {"name": "duration", "type": "uint256"},
        {"name": "apr", "type": "uint8"},
        {"name": "lastClaimTime", "type": "uint256"}
      ]
    }]
  },
  
  // Write functions
  {
    "name": "stakeWithPermit",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "amount", "type": "uint256"},
      {"name": "duration", "type": "uint256"},
      {"name": "deadline", "type": "uint256"},
      {"name": "v", "type": "uint8"},
      {"name": "r", "type": "bytes32"},
      {"name": "s", "type": "bytes32"}
    ],
    "outputs": []
  },
  {
    "name": "claimInterest",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "stakeId", "type": "uint32"}],
    "outputs": []
  },
  {
    "name": "unstake",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "stakeId", "type": "uint32"}],
    "outputs": []
  },
  {
    "name": "unstakeEarly",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "stakeId", "type": "uint32"}],
    "outputs": []
  },
  
  // Events
  {
    "name": "StakedPRANA",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": true, "name": "stakeId", "type": "uint32"},
      {"indexed": false, "name": "amount", "type": "uint256"},
      {"indexed": false, "name": "duration", "type": "uint256"},
      {"indexed": false, "name": "apr", "type": "uint8"},
      {"indexed": false, "name": "startTime", "type": "uint256"}
    ]
  },
  {
    "name": "InterestClaimed",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": true, "name": "stakeId", "type": "uint32"},
      {"indexed": false, "name": "amount", "type": "uint256"},
      {"indexed": false, "name": "timePassed", "type": "uint256"},
      {"indexed": false, "name": "claimTime", "type": "uint256"}
    ]
  },
  {
    "name": "UnstakedPRANA",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": true, "name": "stakeId", "type": "uint32"},
      {"indexed": false, "name": "amount", "type": "uint256"},
      {"indexed": false, "name": "duration", "type": "uint256"},
      {"indexed": false, "name": "unstakeTime", "type": "uint256"}
    ]
  }
];

// Interest Contract
export const INTEREST_CONTRACT_ADDRESS = '0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d'; // Replace with actual contract address

export const INTEREST_CONTRACT_ABI = [
  // View functions
  {
    "name": "PRANA",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "address"}]
  },
  {
    "name": "PranaStakingContract",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "address"}]
  },
  {
    "name": "stakingContractSet",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "bool"}]
  },
  {
    "name": "getWithdrawableAmount",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "uint256"}]
  },
  // Write functions
  {
    "name": "setStakingContract",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "stakingContract", "type": "address"}],
    "outputs": []
  },
  {
    "name": "payInterest",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "user", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": []
  },
  {
    "name": "withdrawExcessTokens",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [{"name": "amount", "type": "uint256"}],
    "outputs": []
  },
  // Events
  {
    "name": "StakingContractSet",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "stakingContract", "type": "address"}
    ]
  },
  {
    "name": "InterestPaid",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": false, "name": "amount", "type": "uint256"}
    ]
  },
  {
    "name": "ExcessWithdrawn",
    "type": "event",
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "owner", "type": "address"},
      {"indexed": false, "name": "amount", "type": "uint256"}
    ]
  }
]; 