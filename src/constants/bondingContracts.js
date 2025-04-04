export const BOND_CONTRACT_ADDRESS = '0x2e5299925cF81b540355c176b0D43E6FAF20e753';

// Bond Contract ABI - Updated based on BuyPranaBond.json for UI needs
export const BOND_CONTRACT_ABI = [
    // --- View Functions ---
    {
      "inputs": [],
      "name": "uniswapV3PoolAddress",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
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
      "inputs": [],
      "name": "getAllBondRates",
      "outputs": [
        { "internalType": "enum BuyPranaBond.BondTerm[]", "name": "", "type": "uint8[]" },
        { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
        { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
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
      "name": "getUserActiveBonds", // Corrected name
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
              "name": "owner", // Added field
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
              "name": "maturityTime", // Corrected name
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "creationTime", // Added field
              "type": "uint256"
            },
             {                            // Added field block
              "internalType": "uint256",
              "name": "lastClaimTime",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "claimedPrana", // Added field
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "claimed",
              "type": "bool"
            }
          ],
          "internalType": "struct BuyPranaBond.Bond[]",
          "name": "userBonds", // Adjusted name for clarity, was ""
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  
    // --- Write Functions ---
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "wbtcAmount",
          "type": "uint256"
        },
        {
          "internalType": "enum BuyPranaBond.BondTerm",
          "name": "period", // Corrected parameter name
          "type": "uint8"
        }
      ],
      "name": "buyBondForWbtcAmount", // Corrected name
      "outputs": [ // Added output
        {
          "internalType": "uint256",
          "name": "bondId", // Adjusted name for clarity, was ""
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
          "internalType": "enum BuyPranaBond.BondTerm",
          "name": "period", // Corrected parameter name
          "type": "uint8"
        }
      ],
      "name": "buyBondForPranaAmount", // Corrected name
      "outputs": [ // Added output
        {
          "internalType": "uint256",
          "name": "bondId", // Adjusted name for clarity, was ""
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
  
    // --- Events ---
     {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false, // Corrected: Not indexed in JSON for owner
          "internalType": "uint256",
          "name": "bondId",
          "type": "uint256"
        },
        {
          "indexed": false, // Corrected: Not indexed in JSON for owner
          "internalType": "address",
          "name": "owner", // Corrected name
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "wbtcAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "pranaAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "maturityTime", // Corrected name
          "type": "uint256"
        }
        // Removed startTime, endTime, term as they are not in the event per JSON
      ],
      "name": "BondCreated", // Corrected event name casing
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false, // Corrected: Not indexed in JSON for bondId
          "internalType": "uint256",
          "name": "bondId",
          "type": "uint256"
        },
         {
          "indexed": false, // Corrected: Not indexed in JSON for owner
          "internalType": "address",
          "name": "owner", // Corrected name
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "pranaAmount", // Corrected name
          "type": "uint256"
        }
        // Removed user, claimTime as they are not in the event per JSON
        // Note: The JSON specifies owner, pranaAmount. The old ABI had user, pranaAmount, claimTime.
        // Using JSON version.
      ],
      "name": "BondClaimed", // Corrected event name casing
      "type": "event"
    }
  ];