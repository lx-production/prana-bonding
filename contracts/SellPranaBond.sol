// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./FullMath.sol";
import "./UniswapV3Helper.sol";

contract SellPranaBond is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Define roles
    bytes32 public constant BOND_MANAGER_ROLE = keccak256("BOND_MANAGER_ROLE");
    
    // Token addresses
    address public immutable WBTC;
    address public immutable PRANA;    
    address public immutable uniswapV3PoolAddress;
    
    enum BondTerm {
        WEEK,    // 7 days
        MONTH,   // 30 days
        QUARTER, // 90 days
        HALF,    // 180 days
        YEAR     // 365 days
    }

    struct BondRates {
        uint256 rate;     // Rate used for premium (in basis points)
        uint256 duration; // Duration in seconds
    }

    mapping(BondTerm => BondRates) public bondRates;    
    
    // Bond registry
    struct Bond {
        uint256 id;
        address owner;
        uint256 pranaAmount;   // amount of PRANA deposited in the bond
        uint256 wbtcAmount;    // amount of WBTC to be received
        uint256 maturityTime;  // time when the bond matures
        uint256 creationTime;  // Track when the bond was created
        uint256 lastClaimTime; // Track the last time a claim was made
        uint256 claimedWbtc;   // Track how much WBTC has been claimed
        bool claimed;          // Track if the bond has been claimed completely
    }

    // Bond IDs start at 1, so we'll initialize with a dummy bond at index 0
    Bond[] public bonds;
    
    // Track all users who have bonds
    address[] public bondHolders;
    mapping(address => bool) private isBondHolder;
    
    // Track committed tokens for bonds
    uint256 public committedWbtc;
    
    // Trade size limits
    uint256 public minPranaSellAmount = 100 * 10**9; // 100 PRANA minimum sell (using PRANA 9 decimals)
    
    // Events
    event BondCreated(uint256 bondId, address owner, uint256 pranaAmount, uint256 wbtcAmount, uint256 maturityTime);
    event BondClaimed(uint256 bondId, address owner, uint256 wbtcAmount);
    event MinSellAmountUpdated(uint256 newMinSellAmount);
    
    constructor(address _wbtc, address _prana, address _uniswapV3PoolAddress) AccessControl() {
        require(_wbtc != address(0), "Invalid WBTC address");
        require(_prana != address(0), "Invalid PRANA address");
        require(_uniswapV3PoolAddress != address(0), "Invalid Pool address");

        WBTC = _wbtc;
        PRANA = _prana;
        uniswapV3PoolAddress = _uniswapV3PoolAddress;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOND_MANAGER_ROLE, msg.sender);
        
        // Initialize bond rates
        bondRates[BondTerm.WEEK] = BondRates({
            rate: 20,    // 0.20%
            duration: 7 days
        });
        
        bondRates[BondTerm.MONTH] = BondRates({
            rate: 80,   // 0.80%
            duration: 30 days
        });
        
        bondRates[BondTerm.QUARTER] = BondRates({
            rate: 250,   // 2.5%
            duration: 90 days
        });
        
        bondRates[BondTerm.HALF] = BondRates({
            rate: 500,   // 5%
            duration: 180 days
        });
        
        bondRates[BondTerm.YEAR] = BondRates({
            rate: 1000,  // 10%
            duration: 365 days
        });
        
        // Initialize bonds array with a dummy bond at index 0 since our bond IDs start at 1
        bonds.push(Bond({
            id: 0,
            owner: address(0),
            pranaAmount: 0,
            wbtcAmount: 0,
            maturityTime: 0,
            creationTime: 0,
            lastClaimTime: 0,
            claimedWbtc: 0,
            claimed: true
        }));
    }   

    // Create a bond to sell PRANA for premium WBTC
    function sellBondForPranaAmount(uint256 pranaAmount, BondTerm period) external nonReentrant whenNotPaused returns (uint256) {
        // Check minimum PRANA sell amount requirement
        require(pranaAmount >= minPranaSellAmount, "PRANA amount below minimum");
        
        // Calculate WBTC amount to be received with premium
        uint256 wbtcAmount = calculateWbtcAmount(pranaAmount, period);
        
        // Check treasury has enough WBTC
        uint256 availableWbtc = IERC20(WBTC).balanceOf(address(this)) - committedWbtc;
        require(wbtcAmount <= availableWbtc, "Not enough WBTC available in treasury");
        
        // Transfer PRANA from user to contract
        IERC20(PRANA).safeTransferFrom(msg.sender, address(this), pranaAmount);
        
        // Create bond
        uint256 bondId = bonds.length; // Next ID will be the current length
        bonds.push(Bond({
            id: bondId,
            owner: msg.sender,
            pranaAmount: pranaAmount,
            wbtcAmount: wbtcAmount,
            maturityTime: block.timestamp + bondRates[period].duration,
            creationTime: block.timestamp,
            lastClaimTime: block.timestamp,
            claimedWbtc: 0,
            claimed: false
        }));
        
        // Update committed tokens
        committedWbtc += wbtcAmount;
        
        // Track bond holder
        if (!isBondHolder[msg.sender]) {
            bondHolders.push(msg.sender);
            isBondHolder[msg.sender] = true;
        }
        
        emit BondCreated(bondId, msg.sender, pranaAmount, wbtcAmount, block.timestamp + bondRates[period].duration);
        
        return bondId;
    }    
    
    // Calculate WBTC output for a given PRANA input amount with premium
    function calculateWbtcAmount(uint256 pranaAmount, BondTerm period) public view returns (uint256) {
        // Get reserves from helper function using the configured pool address
        (uint256 wbtcReserve, uint256 pranaReserve) = UniswapV3Helper._getReserves(uniswapV3PoolAddress);
        
        // Apply constant product formula to determine regular WBTC output without any premium
        // Δy = (y × Δx) / (x + Δx)
        uint256 regularWbtcAmount = FullMath.mulDiv(wbtcReserve, pranaAmount, pranaReserve + pranaAmount);
        
        // Apply the premium rate (rate is in basis points)
        uint256 rate = bondRates[period].rate;
        uint256 premiumWbtcAmount = (regularWbtcAmount * (10000 + rate)) / 10000;
        
        // Apply 1.25% fee adjustment (1% LP fee + 0.25% Uniswap fee)
        uint256 finalWbtcAmount = (premiumWbtcAmount * 80) / 79;  // Adjust for fees
        
        return finalWbtcAmount;
    }
    
    // Claim matured bond or partial amount during vesting
    function claimBond(uint256 bondId) external nonReentrant whenNotPaused {
        require(bondId > 0 && bondId < bonds.length, "Invalid bond ID");
        Bond storage bond = bonds[bondId];
        
        require(bond.owner == msg.sender, "Not bond owner");
        require(block.timestamp > bond.lastClaimTime, "No new amount to claim");
        require(!bond.claimed, "Bond fully claimed");
        
        // Claim the bond based on maturity status
        uint256 claimableWBTC = 0;
        
        if (block.timestamp >= bond.maturityTime) {  // Bond fully matured
            claimableWBTC = _claimMature(bond);
        } else {  // Bond still vesting
            claimableWBTC = _claimVesting(bond);
        }
        
        // Update lastClaimTime
        bond.lastClaimTime = block.timestamp;
        
        emit BondClaimed(bondId, msg.sender, claimableWBTC);
    }
    
    // Handle mature bond claims
    function _claimMature(Bond storage bond) internal returns (uint256) {
        // Bond fully matured, claim all remaining amount
        uint256 claimableWBTC = bond.wbtcAmount - bond.claimedWbtc;
        
        if (claimableWBTC > 0) {
            // Effects: update state first
            committedWbtc -= claimableWBTC;
            bond.claimedWbtc += claimableWBTC;
            
            // Interaction: perform token transfer
            IERC20(WBTC).safeTransfer(bond.owner, claimableWBTC);
        }
        
        // Mark as fully claimed
        bond.claimed = true;
        
        // Check if user has any remaining active bonds
        if (!_hasActiveBonds(bond.owner)) {
            _removeFromBondHolders(bond.owner);
        }
        
        return claimableWBTC;
    }
    
    // Handle vesting bond claims
    function _claimVesting(Bond storage bond) internal returns (uint256) {
        // Partial vesting - calculate based on linear release
        uint256 totalVestingDuration = bond.maturityTime - bond.creationTime;
        uint256 elapsedSinceCreation = block.timestamp - bond.creationTime;
        
        // Calculate total WBTC that should be released by now using FullMath for safe calculation
        uint256 totalReleasableWbtc = FullMath.mulDiv(bond.wbtcAmount, elapsedSinceCreation, totalVestingDuration);
        
        // Calculate new claimable amount (total releasable minus what's already been claimed)
        uint256 claimableWBTC = totalReleasableWbtc > bond.claimedWbtc ? totalReleasableWbtc - bond.claimedWbtc : 0;
        
        if (claimableWBTC > 0) {
            // Effects: update state first
            committedWbtc -= claimableWBTC;
            bond.claimedWbtc += claimableWBTC;
            
            // Interaction: perform token transfer
            IERC20(WBTC).safeTransfer(bond.owner, claimableWBTC);
        }
        
        return claimableWBTC;
    }
    
    // Update bond parameters
    function updateBondRates(BondTerm period, uint256 _rate, uint256 _duration) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(_duration > 0, "Duration must be greater than 0");
        require(_rate <= 5000, "Rate cannot exceed 50%");
        
        bondRates[period] = BondRates({
            rate: _rate,
            duration: _duration
        });
    }
    
    // Updates multiple bond rates at once
    function updateMultipleBondRates(
        BondTerm[] calldata periods,
        uint256[] calldata rates,
        uint256[] calldata durations
    ) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(
            periods.length == rates.length && periods.length == durations.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < periods.length; i++) {
            require(durations[i] > 0, "Duration must be greater than 0");
            require(rates[i] <= 5000, "Rate cannot exceed 50%");
            
            bondRates[periods[i]] = BondRates({
                rate: rates[i],
                duration: durations[i]
            });
        }
    }
    
    // Update minimum sell amount
    function updateMinSellAmount(uint256 _minPranaSellAmount) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(_minPranaSellAmount > 0, "Min sell amount must be greater than 0");
        
        minPranaSellAmount = _minPranaSellAmount;
        
        emit MinSellAmountUpdated(_minPranaSellAmount);
    }
    
    function withdrawTreasury(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (token == WBTC) {
            require(
                amount <= IERC20(WBTC).balanceOf(address(this)) - committedWbtc, 
                "Cannot withdraw committed WBTC"
            );
            IERC20(WBTC).safeTransfer(msg.sender, amount);
        } else if (token == PRANA) {
            // For PRANA, owner can withdraw all PRANA as it's not committed
            IERC20(PRANA).safeTransfer(msg.sender, amount);
        } else {
            revert("Can only withdraw PRANA or WBTC");
        }
    }
    
    // Get active bonds for a specific user
    function getUserActiveBonds(address user) external view returns (Bond[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i < bonds.length; i++) {
            if (bonds[i].owner == user && !bonds[i].claimed) {
                activeCount++;
            }
        }
        
        Bond[] memory activeBonds = new Bond[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 1; i < bonds.length; i++) {
            if (bonds[i].owner == user && !bonds[i].claimed) {
                activeBonds[currentIndex] = bonds[i];
                currentIndex++;
            }
        }
        
        return activeBonds;
    }
    
    // Function to return all active bonds
    function getAllActiveBonds() external view returns (Bond[] memory) {
        // First, count how many active (unclaimed) bonds we have
        uint256 activeCount = 0;
        for (uint256 i = 1; i < bonds.length; i++) {
            if (!bonds[i].claimed) {
                activeCount++;
            }
        }

        // Create a memory array of the correct size
        Bond[] memory activeBonds = new Bond[](activeCount);
        uint256 index = 0;

        // Populate the memory array with active bonds
        for (uint256 i = 1; i < bonds.length; i++) {
            if (!bonds[i].claimed) {
                activeBonds[index] = bonds[i];
                index++;
            }
        }

        return activeBonds;
    }

    // Function to check if a user has any active bonds
    function _hasActiveBonds(address user) internal view returns (bool) {
        for (uint256 i = 1; i < bonds.length; i++) {
            if (bonds[i].owner == user && !bonds[i].claimed) {
                return true;
            }
        }
        return false;
    }

    // Function to remove a user from bondHolders array
    function _removeFromBondHolders(address user) internal {
        require(isBondHolder[user], "User is not a bond holder");
        
        // Find the user's index in the bondHolders array
        uint256 userIndex = 0;
        bool found = false;
        
        for (uint256 i = 0; i < bondHolders.length; i++) {
            if (bondHolders[i] == user) {
                userIndex = i;
                found = true;
                break;
            }
        }
        
        require(found, "User not found in bondHolders");
        
        // Swap with the last element and pop
        uint256 lastIndex = bondHolders.length - 1;
        if (userIndex != lastIndex) {
            bondHolders[userIndex] = bondHolders[lastIndex];
        }
        bondHolders.pop();
        
        // Update the mapping
        isBondHolder[user] = false;
    }

    // Function to return the current number of unique bondholders
    function getBondHoldersLength() public view returns (uint256) {
        return bondHolders.length;
    }

    // Function to return all bond rates information
    function getAllBondRates() external view returns (BondTerm[] memory, uint256[] memory, uint256[] memory) {
        BondTerm[] memory terms = new BondTerm[](5);
        uint256[] memory rates = new uint256[](5);
        uint256[] memory durations = new uint256[](5);
        
        terms[0] = BondTerm.WEEK;
        terms[1] = BondTerm.MONTH;
        terms[2] = BondTerm.QUARTER;
        terms[3] = BondTerm.HALF;
        terms[4] = BondTerm.YEAR;
        
        for (uint256 i = 0; i < 5; i++) {
            rates[i] = bondRates[terms[i]].rate;
            durations[i] = bondRates[terms[i]].duration;
        }
        
        return (terms, rates, durations);
    }

    // Emergency functions    
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }    
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}