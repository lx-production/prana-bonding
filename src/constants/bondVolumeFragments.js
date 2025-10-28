export const BUY_BOND_BONDS_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'bonds',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'wbtcAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'pranaAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maturityTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'creationTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'lastClaimTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'claimedPrana',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'claimed',
            type: 'bool',
          },
        ],
        internalType: 'struct BuyPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const SELL_BOND_BONDS_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'bonds',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'pranaAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'wbtcAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maturityTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'creationTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'lastClaimTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'claimedWbtc',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'claimed',
            type: 'bool',
          },
        ],
        internalType: 'struct SellPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
