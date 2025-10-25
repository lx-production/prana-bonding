export const BUY_BOND_ADDRESS = '0x431030E3A0703f0914bE26026ffDaD693F3a16cf';

export const BUY_BOND_ABI = [
  {
    "inputs": [],
    "name": "committedPrana",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minPranaBuyAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum BuyPranaBondV2.BondTerm",
        "name": "",
        "type": "uint8"
      }
    ],
    "name": "bondRates",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "rate",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "duration",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserActiveBonds",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "wbtcAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "pranaAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maturityTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "creationTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "lastClaimTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "claimedPrana",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "claimed",
            "type": "bool"
          }
        ],
        "internalType": "struct BuyPranaBondV2.Bond[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "wbtcAmount",
        "type": "uint256"
      },
      {
        "internalType": "enum BuyPranaBondV2.BondTerm",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "buyBondForWbtcAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pranaAmount",
        "type": "uint256"
      },
      {
        "internalType": "enum BuyPranaBondV2.BondTerm",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "buyBondForPranaAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      }
    ],
    "name": "claimBond",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "wbtcAmount",
        "type": "uint256"
      },
      {
        "internalType": "enum BuyPranaBondV2.BondTerm",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "calculatePranaAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pranaAmount",
        "type": "uint256"
      },
      {
        "internalType": "enum BuyPranaBondV2.BondTerm",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "calculateWbtcAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

