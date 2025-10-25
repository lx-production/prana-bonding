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
// to ensure progressive price impact across multiple buys.
contract BuyPranaBondV2 is AccessControl, ReentrancyGuard, Pausable {
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
        uint256 rate;     // Discount in basis points
        uint256 duration; // Vesting duration in seconds
    }

    mapping(BondTerm => BondRates) public bondRates;

    struct Bond {
        uint256 id;
        address owner;
        uint256 wbtcAmount;
        uint256 pranaAmount;
        uint256 maturityTime;
        uint256 creationTime;
        uint256 lastClaimTime;
        uint256 claimedPrana;
        bool claimed;
    }

    // Bonds (index 0 is a dummy)
    Bond[] public bonds;

    // Bond holders tracking
    address[] public bondHolders;
    mapping(address => bool) private isBondHolder;

    // Track committed PRANA for outstanding bonds
    uint256 public committedPrana;

    // Minimal buy size
    uint256 public minPranaBuyAmount = 100 * 10**9; // 100 PRANA (9 decimals)

    // V2: impacted reserves to enforce progressive price impact
    uint256 public impactedWbtcReserve;
    uint256 public impactedPranaReserve;
    uint256 public lastImpactedSync; // timestamp of last manager sync

    // Events
    event BondCreated(uint256 bondId, address owner, uint256 wbtcAmount, uint256 pranaAmount, uint256 maturityTime);
    event BondClaimed(uint256 bondId, address owner, uint256 pranaAmount);
    event MinBuyAmountUpdated(uint256 newMinBuyAmount);
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
        bondRates[BondTerm.WEEK] = BondRates({ rate: 25, duration: 7 days });
        bondRates[BondTerm.MONTH] = BondRates({ rate: 120, duration: 30 days });
        bondRates[BondTerm.QUARTER] = BondRates({ rate: 369, duration: 90 days });
        bondRates[BondTerm.HALF] = BondRates({ rate: 740, duration: 180 days });
        bondRates[BondTerm.YEAR] = BondRates({ rate: 1500, duration: 365 days });

        // Dummy bond at index 0
        bonds.push(Bond({
            id: 0,
            owner: address(0),
            wbtcAmount: 0,
            pranaAmount: 0,
            maturityTime: 0,
            creationTime: 0,
            lastClaimTime: 0,
            claimedPrana: 0,
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

    // Create a bond to buy discounted PRANA with WBTC by specifying PRANA amount
    function buyBondForPranaAmount(uint256 pranaAmount, BondTerm period) external nonReentrant whenNotPaused returns (uint256) {
        require(pranaAmount >= minPranaBuyAmount, "PRANA amount below minimum");
        require(pranaAmount < impactedPranaReserve, "PRANA amount exceeds impacted reserve");

        require(
            pranaAmount <= IERC20(PRANA).balanceOf(address(this)) - committedPrana,
            "Not enough PRANA available in treasury"
        );

        uint256 regularWbtcAmount;
        {
            // Scope live market variables to reduce stack pressure
            (uint256 poolWbtcReserve, uint256 poolPranaReserve) = UniswapV3Helper._getReserves(uniswapV3PoolAddress);
            require(pranaAmount < poolPranaReserve, "PRANA amount exceeds pool reserve");

            // Δx = (x × Δy) / (y - Δy) where Δy is net PRANA leaving the pool, Δx is net WBTC entering the pool
            regularWbtcAmount = FullMath.mulDiv(impactedWbtcReserve, pranaAmount, impactedPranaReserve - pranaAmount);
            uint256 marketWbtcAmount = FullMath.mulDiv(poolWbtcReserve, pranaAmount, poolPranaReserve - pranaAmount);

            if (regularWbtcAmount < marketWbtcAmount) {
                impactedWbtcReserve = poolWbtcReserve;
                impactedPranaReserve = poolPranaReserve;
                lastImpactedSync = block.timestamp;
                emit ImpactedReservesSynced(poolWbtcReserve, poolPranaReserve);
                regularWbtcAmount = marketWbtcAmount;
            }
        }

        uint256 wbtcAmount = calculateWbtcAmount(pranaAmount, period);

        IERC20(WBTC).safeTransferFrom(msg.sender, address(this), wbtcAmount);

        uint256 bondId = _createBondFor(
            msg.sender,
            wbtcAmount,
            pranaAmount,
            block.timestamp + bondRates[period].duration
        );

        impactedWbtcReserve += regularWbtcAmount;
        if (pranaAmount >= impactedPranaReserve) {
            impactedPranaReserve = 1;
        } else {
            impactedPranaReserve -= pranaAmount;
        }

        return bondId;
    }

    // Create a bond to buy discounted PRANA by specifying WBTC amount
    function buyBondForWbtcAmount(uint256 wbtcAmount, BondTerm period) external nonReentrant whenNotPaused returns (uint256) {
        require(wbtcAmount > 0, "WBTC amount must be greater than 0");

        uint256 netWbtcAmount = FullMath.mulDiv(wbtcAmount, 99, 100);

        // Δy = (y × Δx) / (x + Δx) where Δx is the net WBTC entering the pool
        uint256 regularPranaAmount = FullMath.mulDiv(impactedPranaReserve, netWbtcAmount, impactedWbtcReserve + netWbtcAmount);

        {
            // Scope live market variables to reduce stack pressure
            (uint256 poolWbtcReserve, uint256 poolPranaReserve) = UniswapV3Helper._getReserves(uniswapV3PoolAddress);
            uint256 marketPranaAmount = FullMath.mulDiv(poolPranaReserve, netWbtcAmount, poolWbtcReserve + netWbtcAmount);
            if (regularPranaAmount > marketPranaAmount) {
                impactedWbtcReserve = poolWbtcReserve;
                impactedPranaReserve = poolPranaReserve;
                lastImpactedSync = block.timestamp;
                emit ImpactedReservesSynced(poolWbtcReserve, poolPranaReserve);
                regularPranaAmount = marketPranaAmount;
            }
        }

        uint256 pranaAmount = calculatePranaAmount(wbtcAmount, period);

        require(pranaAmount >= minPranaBuyAmount, "Calculated PRANA amount below minimum");

        require(
            pranaAmount <= IERC20(PRANA).balanceOf(address(this)) - committedPrana,
            "Not enough PRANA available in treasury"
        );

        IERC20(WBTC).safeTransferFrom(msg.sender, address(this), wbtcAmount);

        uint256 bondId = _createBondFor(
            msg.sender,
            wbtcAmount,
            pranaAmount,
            block.timestamp + bondRates[period].duration
        );

        // Update impacted reserves to reflect this trade's price impact
        impactedWbtcReserve += netWbtcAmount;
        
        if (regularPranaAmount >= impactedPranaReserve) {
            impactedPranaReserve = 1;
        } else {
            impactedPranaReserve -= regularPranaAmount;
        }        

        return bondId;
    }

    // View quote for a given PRANA amount using impacted reserves
    // Δx = (x × Δy) / (y - Δy) where Δy is net PRANA leaving the pool
    function calculateWbtcAmount(uint256 pranaAmount, BondTerm period) public view returns (uint256) {
        require(pranaAmount < impactedPranaReserve, "PRANA amount exceeds impacted reserve");
        uint256 regularWbtcAmount = FullMath.mulDiv(impactedWbtcReserve, pranaAmount, impactedPranaReserve - pranaAmount);
        uint256 discountedWbtcAmount = FullMath.mulDiv(regularWbtcAmount, 10000 - bondRates[period].rate, 10000);
        uint256 wbtcAfterFee = FullMath.mulDiv(discountedWbtcAmount, 100, 99); // Fee = 1% on GROSS amount
        return wbtcAfterFee;
    }

    // View quote for a given WBTC amount using impacted reserves
    function calculatePranaAmount(uint256 wbtcAmount, BondTerm period) public view returns (uint256) {
        uint256 wbtcAfterFee = FullMath.mulDiv(wbtcAmount, 99, 100); // deduct 1% fee before swap impact
        uint256 rate = bondRates[period].rate;

        // Δy = (y × Δx) / (x + Δx) where Δx is the net WBTC entering the pool
        uint256 regularPranaAmount = FullMath.mulDiv(impactedPranaReserve, wbtcAfterFee, impactedWbtcReserve + wbtcAfterFee);
        uint256 premiumPranaAmount = FullMath.mulDiv(regularPranaAmount, 10000, 10000 - rate);
        return premiumPranaAmount;
    }

    // Internal helper to reduce local-variable pressure and centralize bond creation + event
    function _createBondFor(
        address owner,
        uint256 wbtcAmount,
        uint256 pranaAmount,
        uint256 maturityTime
    ) internal returns (uint256 bondId) {
        bondId = bonds.length;
        bonds.push(Bond({
            id: bondId,
            owner: owner,
            wbtcAmount: wbtcAmount,
            pranaAmount: pranaAmount,
            maturityTime: maturityTime,
            creationTime: block.timestamp,
            lastClaimTime: block.timestamp,
            claimedPrana: 0,
            claimed: false
        }));

        committedPrana += pranaAmount;

        if (!isBondHolder[owner]) {
            bondHolders.push(owner);
            isBondHolder[owner] = true;
        }

        emit BondCreated(bondId, owner, wbtcAmount, pranaAmount, maturityTime);
    }

    // Claim matured bond or partial amount during vesting
    function claimBond(uint256 bondId) external nonReentrant whenNotPaused {
        require(bondId > 0 && bondId < bonds.length, "Invalid bond ID");
        Bond storage bond = bonds[bondId];

        require(bond.owner == msg.sender, "Not bond owner");
        require(block.timestamp > bond.lastClaimTime, "No new amount to claim");
        require(!bond.claimed, "Bond fully claimed");

        uint256 claimablePRANA = 0;
        if (block.timestamp >= bond.maturityTime) {
            claimablePRANA = _claimMature(bond);
        } else {
            claimablePRANA = _claimVesting(bond);
        }

        bond.lastClaimTime = block.timestamp;
        emit BondClaimed(bondId, msg.sender, claimablePRANA);
    }

    function _claimMature(Bond storage bond) internal returns (uint256) {
        uint256 claimablePRANA = bond.pranaAmount - bond.claimedPrana;
        if (claimablePRANA > 0) {
            committedPrana -= claimablePRANA;
            bond.claimedPrana += claimablePRANA;
            IERC20(PRANA).safeTransfer(bond.owner, claimablePRANA);
        }
        bond.claimed = true;
        if (!_hasActiveBonds(bond.owner)) {
            _removeFromBondHolders(bond.owner);
        }
        return claimablePRANA;
    }

    function _claimVesting(Bond storage bond) internal returns (uint256) {
        uint256 totalVestingDuration = bond.maturityTime - bond.creationTime;
        uint256 elapsedSinceCreation = block.timestamp - bond.creationTime;
        uint256 totalReleasablePrana = FullMath.mulDiv(bond.pranaAmount, elapsedSinceCreation, totalVestingDuration);
        uint256 claimablePRANA = totalReleasablePrana > bond.claimedPrana ? totalReleasablePrana - bond.claimedPrana : 0;
        if (claimablePRANA > 0) {
            committedPrana -= claimablePRANA;
            bond.claimedPrana += claimablePRANA;
            IERC20(PRANA).safeTransfer(bond.owner, claimablePRANA);
        }
        return claimablePRANA;
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

    // Admin: min buy amount
    function updateMinBuyAmount(uint256 _minPranaBuyAmount) external onlyRole(BOND_MANAGER_ROLE) whenNotPaused {
        require(_minPranaBuyAmount > 0, "Min buy amount must be greater than 0");
        minPranaBuyAmount = _minPranaBuyAmount;
        emit MinBuyAmountUpdated(_minPranaBuyAmount);
    }

    function withdrawTreasury(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (token == PRANA) {
            require(amount <= IERC20(PRANA).balanceOf(address(this)) - committedPrana, "Cannot withdraw committed PRANA");
            IERC20(PRANA).safeTransfer(msg.sender, amount);
        } else if (token == WBTC) {
            IERC20(WBTC).safeTransfer(msg.sender, amount);
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
