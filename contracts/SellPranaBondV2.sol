// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./FullMath.sol";
import "./UniswapV3Helper.sol";

// V2: Uses impacted reserves that are updated on each bond creation
// to ensure progressive price impact across multiple sells.
contract SellPranaBondV2 is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant BOND_MANAGER_ROLE = keccak256("BOND_MANAGER_ROLE");

    // Token addresses
    address public immutable WBTC;
    address public immutable PRANA;
    address public immutable uniswapV3PoolAddress;

    enum BondTerm {
        WEEK,
        MONTH,
        QUARTER,
        HALF,
        YEAR
    }

    struct BondRates {
        uint256 rate;     // Premium in basis points
        uint256 duration; // Duration in seconds
    }

    mapping(BondTerm => BondRates) public bondRates;

    struct Bond {
        uint256 id;
        address owner;
        uint256 pranaAmount;
        uint256 wbtcAmount;
        uint256 maturityTime;
        uint256 creationTime;
        uint256 lastClaimTime;
        uint256 claimedWbtc;
        bool claimed;
    }

    // Bonds (index 0 is a dummy)
    Bond[] public bonds;

    // Bond holders tracking
    address[] public bondHolders;
    mapping(address => bool) private isBondHolder;

    // Track committed WBTC for outstanding bonds
    uint256 public committedWbtc;

    // Minimal sell size
    uint256 public minPranaSellAmount = 100 * 10**9; // 100 PRANA (9 decimals)

    // V2: impacted reserves to enforce progressive price impact
    uint256 public impactedWbtcReserve;
    uint256 public impactedPranaReserve;
    uint256 public lastImpactedSync;     // timestamp of last manager sync

    // Events
    event BondCreated(uint256 bondId, address owner, uint256 pranaAmount, uint256 wbtcAmount, uint256 maturityTime);
    event BondClaimed(uint256 bondId, address owner, uint256 wbtcAmount);
    event MinSellAmountUpdated(uint256 newMinSellAmount);
    event ImpactedReservesSynced(uint256 wbtcReserve, uint256 pranaReserve);
    event ImpactedReservesAdjusted(uint256 wbtcReserve, uint256 pranaReserve, address operator);

    constructor(
        address _wbtc,
        address _prana,
        address _uniswapV3PoolAddress
    ) {
        require(_wbtc != address(0), "Invalid WBTC address");
        require(_prana != address(0), "Invalid PRANA address");
        require(_uniswapV3PoolAddress != address(0), "Invalid Pool address");

        WBTC = _wbtc;
        PRANA = _prana;
        uniswapV3PoolAddress = _uniswapV3PoolAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BOND_MANAGER_ROLE, msg.sender);

        // Initialize bond rates (same defaults as V1)
        bondRates[BondTerm.WEEK] = BondRates({ rate: 20, duration: 7 days });
        bondRates[BondTerm.MONTH] = BondRates({ rate: 80, duration: 30 days });
        bondRates[BondTerm.QUARTER] = BondRates({ rate: 250, duration: 90 days });
        bondRates[BondTerm.HALF] = BondRates({ rate: 500, duration: 180 days });
        bondRates[BondTerm.YEAR] = BondRates({ rate: 1000, duration: 365 days });

        // Dummy bond at index 0
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

        (uint256 initialWbtcReserve, uint256 initialPranaReserve) = _syncImpactedReserves();
        emit ImpactedReservesSynced(initialWbtcReserve, initialPranaReserve);
    }

    // Manager can sync impacted reserves to current pool reserves
    function syncImpactedReserves() external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        (uint256 wbtcReserve, uint256 pranaReserve) = _syncImpactedReserves();
        emit ImpactedReservesSynced(wbtcReserve, pranaReserve);
    }

    // Allow manual adjustments so managers can bake in treasury targets.
    function setImpactedReserves(uint256 wbtcReserve, uint256 pranaReserve) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(wbtcReserve > 0 && pranaReserve > 0, "Reserves must be > 0");

        impactedWbtcReserve = wbtcReserve;
        impactedPranaReserve = pranaReserve;
        lastImpactedSync = block.timestamp;

        emit ImpactedReservesAdjusted(wbtcReserve, pranaReserve, msg.sender);
    }

    // Create a bond to sell PRANA for premium WBTC
    function sellBond(uint256 pranaAmount, BondTerm period) external nonReentrant whenNotPaused returns (uint256) {
        require(pranaAmount >= minPranaSellAmount, "PRANA amount below minimum");

        // Quote using impacted reserves (progressive price impact). Deduct 1% fee before swap impact
        uint256 netPranaAmount = FullMath.mulDiv(pranaAmount, 99, 100);
        
        // Δy = (y × Δx) / (x + Δx) where Δx is the net PRANA entering the pool
        uint256 regularWbtcAmount = FullMath.mulDiv(impactedWbtcReserve, netPranaAmount, impactedPranaReserve + netPranaAmount);

        {
            // Scope live market variables to reduce stack pressure
            (uint256 poolWbtcReserve, uint256 poolPranaReserve) = UniswapV3Helper._getReserves(uniswapV3PoolAddress);
            uint256 marketWbtcAmount = FullMath.mulDiv(poolWbtcReserve, netPranaAmount, poolPranaReserve + netPranaAmount);
            if (regularWbtcAmount > marketWbtcAmount) {
                impactedWbtcReserve = poolWbtcReserve;
                impactedPranaReserve = poolPranaReserve;
                lastImpactedSync = block.timestamp;
                emit ImpactedReservesSynced(poolWbtcReserve, poolPranaReserve);
                regularWbtcAmount = marketWbtcAmount;
            }
        }

        uint256 wbtcAmount = calculateWbtcAmount(pranaAmount, period);

        // Treasury capacity check
        require(
            wbtcAmount <= IERC20(WBTC).balanceOf(address(this)) - committedWbtc,
            "Not enough WBTC available in treasury"
        );

        // Transfer PRANA from user
        IERC20(PRANA).safeTransferFrom(msg.sender, address(this), pranaAmount);

        // Create bond
        uint256 bondId = _createBondFor(
            msg.sender,
            pranaAmount,
            wbtcAmount,
            block.timestamp + bondRates[period].duration
        );

        // Update impacted reserves to reflect this trade's price impact
        // IMPORTANT: update using regular (pre-premium) amount to mimic AMM impact
        impactedPranaReserve += netPranaAmount;
        if (regularWbtcAmount > 0) {
            // Guard against underflow (shouldn't happen due to formula)
            if (regularWbtcAmount >= impactedWbtcReserve) {
                impactedWbtcReserve = 1; // minimal positive reserve to avoid zero
            } else {
                impactedWbtcReserve -= regularWbtcAmount;
            }
        }

        return bondId;
    }

    // View quote for a given PRANA amount using impacted reserves
    function calculateWbtcAmount(uint256 pranaAmount, BondTerm period) public view returns (uint256) {
        uint256 wbtcRes = impactedWbtcReserve;
        uint256 pranaRes = impactedPranaReserve;
        uint256 netPranaAmount = FullMath.mulDiv(pranaAmount, 99, 100); // deduct 1% fee like DEX swap
        uint256 regularWbtcAmount = FullMath.mulDiv(wbtcRes, netPranaAmount, pranaRes + netPranaAmount);
        uint256 rate = bondRates[period].rate;
        uint256 premiumWbtcAmount = FullMath.mulDiv(regularWbtcAmount, 10000 + rate, 10000);
        return premiumWbtcAmount;
    }

    // Internal helper to reduce local-variable pressure and centralize bond creation + event
    function _createBondFor(
        address owner,
        uint256 pranaAmount,
        uint256 wbtcAmount,
        uint256 maturityTime
    ) internal returns (uint256 bondId) {
        bondId = bonds.length;
        bonds.push(Bond({
            id: bondId,
            owner: owner,
            pranaAmount: pranaAmount,
            wbtcAmount: wbtcAmount,
            maturityTime: maturityTime,
            creationTime: block.timestamp,
            lastClaimTime: block.timestamp,
            claimedWbtc: 0,
            claimed: false
        }));

        committedWbtc += wbtcAmount;

        if (!isBondHolder[owner]) {
            bondHolders.push(owner);
            isBondHolder[owner] = true;
        }

        emit BondCreated(bondId, owner, pranaAmount, wbtcAmount, maturityTime);
    }

    // Claim matured bond or partial amount during vesting
    function claimBond(uint256 bondId) external nonReentrant whenNotPaused {
        require(bondId > 0 && bondId < bonds.length, "Invalid bond ID");
        Bond storage bond = bonds[bondId];

        require(bond.owner == msg.sender, "Not bond owner");
        require(block.timestamp > bond.lastClaimTime, "No new amount to claim");
        require(!bond.claimed, "Bond fully claimed");

        uint256 claimableWBTC = 0;
        if (block.timestamp >= bond.maturityTime) {
            claimableWBTC = _claimMature(bond);
        } else {
            claimableWBTC = _claimVesting(bond);
        }

        bond.lastClaimTime = block.timestamp;
        emit BondClaimed(bondId, msg.sender, claimableWBTC);
    }

    function _claimMature(Bond storage bond) internal returns (uint256) {
        uint256 claimableWBTC = bond.wbtcAmount - bond.claimedWbtc;
        if (claimableWBTC > 0) {
            committedWbtc -= claimableWBTC;
            bond.claimedWbtc += claimableWBTC;
            IERC20(WBTC).safeTransfer(bond.owner, claimableWBTC);
        }
        bond.claimed = true;
        if (!_hasActiveBonds(bond.owner)) {
            _removeFromBondHolders(bond.owner);
        }
        return claimableWBTC;
    }

    function _claimVesting(Bond storage bond) internal returns (uint256) {
        uint256 totalVestingDuration = bond.maturityTime - bond.creationTime;
        uint256 elapsedSinceCreation = block.timestamp - bond.creationTime;
        uint256 totalReleasableWbtc = FullMath.mulDiv(bond.wbtcAmount, elapsedSinceCreation, totalVestingDuration);
        uint256 claimableWBTC = totalReleasableWbtc > bond.claimedWbtc ? totalReleasableWbtc - bond.claimedWbtc : 0;
        if (claimableWBTC > 0) {
            committedWbtc -= claimableWBTC;
            bond.claimedWbtc += claimableWBTC;
            IERC20(WBTC).safeTransfer(bond.owner, claimableWBTC);
        }
        return claimableWBTC;
    }

    // Admin: update bond parameters
    function updateBondRates(BondTerm period, uint256 _rate, uint256 _duration) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(_duration > 0, "Duration must be greater than 0");
        require(_rate <= 5000, "Rate cannot exceed 50%");
        bondRates[period] = BondRates({ rate: _rate, duration: _duration });
    }

    function updateMultipleBondRates(
        BondTerm[] calldata periods,
        uint256[] calldata rates,
        uint256[] calldata durations
    ) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(periods.length == rates.length && periods.length == durations.length, "Array lengths must match");
        for (uint256 i = 0; i < periods.length; i++) {
            require(durations[i] > 0, "Duration must be greater than 0");
            require(rates[i] <= 5000, "Rate cannot exceed 50%");
            bondRates[periods[i]] = BondRates({ rate: rates[i], duration: durations[i] });
        }
    }

    // Admin: min sell amount
    function updateMinSellAmount(uint256 _minPranaSellAmount) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(_minPranaSellAmount > 0, "Min sell amount must be greater than 0");
        minPranaSellAmount = _minPranaSellAmount;
        emit MinSellAmountUpdated(_minPranaSellAmount);
    }

    function withdrawTreasury(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (token == WBTC) {
            require(amount <= IERC20(WBTC).balanceOf(address(this)) - committedWbtc, "Cannot withdraw committed WBTC");
            IERC20(WBTC).safeTransfer(msg.sender, amount);
        } else if (token == PRANA) {
            IERC20(PRANA).safeTransfer(msg.sender, amount);
        } else {
            revert("Can only withdraw PRANA or WBTC");
        }
    }

    // Views
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

    function getAllActiveBonds() external view returns (Bond[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i < bonds.length; i++) {
            if (!bonds[i].claimed) {
                activeCount++;
            }
        }
        Bond[] memory activeBonds = new Bond[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i < bonds.length; i++) {
            if (!bonds[i].claimed) {
                activeBonds[index] = bonds[i];
                index++;
            }
        }
        return activeBonds;
    }

    function getBondHoldersLength() public view returns (uint256) {
        return bondHolders.length;
    }

    // Internals
    function _hasActiveBonds(address user) internal view returns (bool) {
        for (uint256 i = 1; i < bonds.length; i++) {
            if (bonds[i].owner == user && !bonds[i].claimed) {
                return true;
            }
        }
        return false;
    }

    function _removeFromBondHolders(address user) internal {
        require(isBondHolder[user], "User is not a bond holder");
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
        uint256 lastIndex = bondHolders.length - 1;
        if (userIndex != lastIndex) {
            bondHolders[userIndex] = bondHolders[lastIndex];
        }
        bondHolders.pop();
        isBondHolder[user] = false;
    }

    function _syncImpactedReserves() internal returns (uint256 wbtcReserve, uint256 pranaReserve) {
        (wbtcReserve, pranaReserve) = UniswapV3Helper._getReserves(uniswapV3PoolAddress);
        require(wbtcReserve > 0 && pranaReserve > 0, "Reserves must be > 0");
        impactedWbtcReserve = wbtcReserve;
        impactedPranaReserve = pranaReserve;
        lastImpactedSync = block.timestamp;
    }

    // Emergency
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
