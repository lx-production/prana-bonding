// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPranaToken is IERC20, IERC20Permit {}

interface IInterestContract {
    function payInterest(address recipient, uint256 amount) external;
}

contract PranaStakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IPranaToken;

    IPranaToken public PRANA;
    IInterestContract public InterestContract;

    uint256 public MIN_STAKE = 100 * 1e9;             // 100 PRANA with 9 decimals
    uint256 public constant DAY = 86400;              // 24 hours in seconds
    uint8 public constant PERCENT_SCALE = 100;        // For percentage scaling (since APRs are integers like 10 for 10%)
    uint256 public gracePeriod = 7 * DAY;             // 7 days grace period after stake expires
    uint8 public earlyUnstakePenaltyPercent = 10;     // 10% penalty for unstaking early

    // Mapping of staking duration (in seconds) to APR (e.g., 10 for 10%)
    mapping(uint256 => uint8) public aprByDuration;

    // Add counter for unique IDs
    uint32 private nextStakeId = 1;

    // Structure to store each user's stake
    struct Stake {
        uint32 id;                  // Unique identifier for the stake
        uint256 amount;             // Principal staked
        uint256 startTime;          // Stake start timestamp
        uint256 duration;           // Staking duration in seconds
        uint8 apr;                  // APR at the time of staking (e.g., 5 for 5%)
        uint256 lastClaimTime;      // Last time interest was claimed
    }

    // Mapping of user address to their array of stakes
    mapping(address => Stake[]) public userStakes;    
    address[] public stakers;

    event StakedPRANA(address indexed user, uint32 indexed stakeId, uint256 amount, uint256 duration, uint8 apr, uint256 startTime);
    event InterestClaimed(address indexed user, uint32 indexed stakeId, uint256 amount, uint256 timePassed, uint256 claimTime);
    event UnstakedPRANA(address indexed user, uint32 indexed stakeId, uint256 amount, uint256 duration, uint256 unstakeTime);

    // Emergency pause functionality
    bool public paused;    // false by default, save gas by not setting explicitly

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // Set PRANA address and initial APRs
    constructor(address _pranaAddress, address _interestContract) Ownable(msg.sender) {
        PRANA = IPranaToken(_pranaAddress);
        InterestContract = IInterestContract(_interestContract);    // deploy InterestContract first

        aprByDuration[1 * DAY] = 7;      // 7% APR
        aprByDuration[7 * DAY] = 8;      // 8% APR
        aprByDuration[30 * DAY] = 9;     // 9% APR
        aprByDuration[90 * DAY] = 10;    // 10% APR
        aprByDuration[180 * DAY] = 11;   // 11% APR
        aprByDuration[365 * DAY] = 12;   // 10% APR
    }    

    // @dev This function is used to stake PRANA with a permit signature. Better UX for users.
    // @param amount The amount of PRANA to stake
    // @param duration The duration of the stake
    // @param deadline The deadline of the permit signature
    // @param v The v value of the permit signature
    // @param r The r value of the permit signature
    // @param s The s value of the permit signature  
    // deadline, v, r, s values are returned from wallet.signTypedData from the UI
    function stakeWithPermit(uint256 amount, uint256 duration, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant whenNotPaused {    
        require(amount >= MIN_STAKE, "Stake amount must be at least 100 PRANA");
        require(aprByDuration[duration] > 0, "Invalid staking duration");

        // Call permit to approve the transfer using the signature
        PRANA.permit(msg.sender, address(this), amount, deadline, v, r, s);

        // Transfer PRANA from the user to the contract
        PRANA.safeTransferFrom(msg.sender, address(this), amount);

        uint8 apr = aprByDuration[duration];

        if (userStakes[msg.sender].length == 0) {
            stakers.push(msg.sender);
        }
        
        uint32 newId = nextStakeId++;

        userStakes[msg.sender].push(Stake({
            id: newId,
            amount: amount,
            startTime: block.timestamp,
            duration: duration,
            apr: apr,
            lastClaimTime: block.timestamp
        }));

        emit StakedPRANA(msg.sender, newId, amount, duration, apr, block.timestamp);        
    }

    // @dev This function is used to claim interest for a specific stake
    function claimInterest(uint32 stakeId) external nonReentrant whenNotPaused {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "No stakes found");
        
        // Find the stake by ID using a loop
        uint32 stakeIndex = type(uint32).max;
        for (uint32 i = 0; i < stakes.length; i++) {
            if (stakes[i].id == stakeId) {
                stakeIndex = i;
                break;
            }
        }
        
        require(stakeIndex != type(uint32).max, "Stake ID not found");

        Stake storage userStake = stakes[stakeIndex];
        uint256 stakeEndTime = userStake.startTime + userStake.duration;
        
        // Check if within claim period (from stake start until grace period after expiry)
        require(
            block.timestamp <= stakeEndTime + gracePeriod,
            "Claim period ended"
        );
        
        // Calculate time passed, capping at stake end time if needed
        uint256 effectiveTime = block.timestamp < stakeEndTime ? block.timestamp : stakeEndTime;
        uint256 timePassed = effectiveTime - userStake.lastClaimTime;
        require(timePassed > 0, "No time passed since last claim");

        // Break down the calculation into smaller, safer parts
        // APR is in percentage points (e.g., 5 for 5%)
        // Calculate annual interest: principal * apr / PERCENT_SCALE (100)
        uint256 annualInterest = (userStake.amount * userStake.apr) / PERCENT_SCALE;
        
        // Calculate interest per second: annualInterest / seconds in a year
        // We use 365 days = 31,536,000 seconds
        uint256 interestPerSecond = annualInterest / (365 * 24 * 60 * 60);
        
        // Calculate the interest earned during the period
        uint256 interest = interestPerSecond * timePassed;
        
        // Call InterestContract to pay interest
        InterestContract.payInterest(msg.sender, interest);
        userStake.lastClaimTime = effectiveTime;

        emit InterestClaimed(msg.sender, stakeId, interest, timePassed, effectiveTime);
    }    

    function unstake(uint32 stakeId) external nonReentrant whenNotPaused {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "No stakes found");

        // Find the stake by ID using a loop
        uint32 stakeIndex = type(uint32).max;
        for (uint32 i = 0; i < stakes.length; i++) {
            if (stakes[i].id == stakeId) {
                stakeIndex = i;
                break;
            }
        }
        
        require(stakeIndex != type(uint32).max, "Stake ID not found");

        Stake memory userStake = stakes[stakeIndex];
        require(block.timestamp >= userStake.startTime + userStake.duration, "Staking period not ended");

        // When removing a stake
        uint32 lastIndex = uint32(stakes.length - 1);
        
        // Then do the array removal
        stakes[stakeIndex] = stakes[lastIndex];
        stakes.pop();

        // If this was the user's last stake, remove from stakers array
        if (stakes.length == 0) {
            _removeFromStakers(msg.sender);
        }

        // Return the principal
        PRANA.safeTransfer(msg.sender, userStake.amount);

        emit UnstakedPRANA(
            msg.sender,
            stakeId,
            userStake.amount,
            userStake.duration,
            block.timestamp
        );
    }

    // Function to unstake early with penalty
    function unstakeEarly(uint32 stakeId) external nonReentrant whenNotPaused {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "No stakes found");
        
        // Find the stake by ID using a loop
        uint32 stakeIndex = type(uint32).max;
        for (uint32 i = 0; i < stakes.length; i++) {
            if (stakes[i].id == stakeId) {
                stakeIndex = i;
                break;
            }
        }
        
        require(stakeIndex != type(uint32).max, "Stake ID not found");

        Stake memory userStake = stakes[stakeIndex];
        require(block.timestamp < userStake.startTime + userStake.duration, "Stake already matured, use unstake");

        // Calculate penalty based on configured percentage
        uint256 penalty = (userStake.amount * earlyUnstakePenaltyPercent) / 100;
        uint256 amountToReturn = userStake.amount - penalty;

        // When removing a stake
        uint32 lastIndex = uint32(stakes.length - 1);
        
        // Then do the array removal
        stakes[stakeIndex] = stakes[lastIndex];
        stakes.pop();

        // If this was the user's last stake, remove from stakers array
        if (stakes.length == 0) {
            _removeFromStakers(msg.sender);
        }

        // Return the principal minus penalty
        PRANA.safeTransfer(msg.sender, amountToReturn);
        
        // Transfer penalty to interest contract
        PRANA.safeTransfer(address(InterestContract), penalty);
    }

    // Helper function to remove address from stakers array
    function _removeFromStakers(address staker) internal {
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakers[i] == staker) {
                stakers[i] = stakers[stakers.length - 1];
                stakers.pop();
                break;
            }
        }
    }

    // Function to calculate total interest needed for all active stakes + Matured, within grace period, and has unclaimed interest
    function totalInterestNeeded() external view returns (uint256) {
        uint256 totalInterest = 0;
        
        // Loop through all stakers
        for (uint256 i = 0; i < stakers.length; i++) {
            address staker = stakers[i];
            Stake[] storage stakes = userStakes[staker];
            
            // Loop through each stake of the staker
            for (uint256 j = 0; j < stakes.length; j++) {
                Stake storage currentStake = stakes[j];
                uint256 stakeEndTime = currentStake.startTime + currentStake.duration;
                
                // Check if stake is either:
                // 1. Active (not yet matured)
                // 2. Matured but within grace period and has unclaimed interest
                if (block.timestamp < stakeEndTime || 
                    (block.timestamp <= stakeEndTime + gracePeriod && currentStake.lastClaimTime < stakeEndTime)) {
                    
                    // For active stakes, calculate interest from lastClaim to maturity
                    // For matured stakes, calculate interest from lastClaim to the stake end time
                    uint256 effectiveEndTime = stakeEndTime;
                    uint256 remainingTime = effectiveEndTime - currentStake.lastClaimTime;
                    
                    // Break down the calculation into smaller, safer parts
                    // APR is in percentage points (e.g., 5 for 5%)
                    // Calculate annual interest: principal * apr / PERCENT_SCALE (100)
                    uint256 annualInterest = (currentStake.amount * currentStake.apr) / PERCENT_SCALE;
                    
                    // Calculate interest per second: annualInterest / seconds in a year
                    // We use 365 days = 31,536,000 seconds
                    uint256 interestPerSecond = annualInterest / (365 * 24 * 60 * 60);
                    
                    // Calculate the interest for the remaining period
                    uint256 stakeInterest = interestPerSecond * remainingTime;
                    
                    totalInterest += stakeInterest;
                }
            }
        }
        
        return totalInterest;
    }    

    // Function to get all stakes for a specific staker
    function getStakerStakes(address staker) external view returns (Stake[] memory) {
        return userStakes[staker];
    }

    // Function to get all current APRs
    function getAllAPRs() external view returns (uint256[] memory durations, uint8[] memory aprs) {
        durations = new uint256[](6);
        aprs = new uint8[](6);
        
        durations[0] = 1 * DAY;
        durations[1] = 7 * DAY;
        durations[2] = 30 * DAY;
        durations[3] = 90 * DAY;
        durations[4] = 180 * DAY;
        durations[5] = 365 * DAY;
        
        for (uint256 i = 0; i < durations.length; i++) {
            aprs[i] = aprByDuration[durations[i]];
        }
        
        return (durations, aprs);
    }

    // Function to update APR for a specific duration
    function updateAPR(uint256 duration, uint8 newAPR) external onlyOwner {
        require(aprByDuration[duration] > 0, "Invalid duration");
        require(newAPR > 0 && newAPR <= 100, "APR must be between 1 and 100");
        
        // Update the APR for the specified duration
        aprByDuration[duration] = newAPR;
    }

    // Function to update multiple APRs at once
    function updateMultipleAPRs(uint256[] calldata durations, uint8[] calldata newAPRs) external onlyOwner {
        require(durations.length == newAPRs.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < durations.length; i++) {
            require(aprByDuration[durations[i]] > 0, "Invalid duration");
            require(newAPRs[i] > 0 && newAPRs[i] <= 100, "APR must be between 1 and 100");
            
            aprByDuration[durations[i]] = newAPRs[i];
        }
    }    

    function setMinStake(uint256 newMinStake) external onlyOwner {
        require(newMinStake > 0, "Min stake must be greater than 0");
        MIN_STAKE = newMinStake;
    }

    function setGracePeriod(uint256 _gracePeriod) external onlyOwner {
        gracePeriod = _gracePeriod;
    }

    function setEarlyUnstakePenalty(uint8 _percent) external onlyOwner {
        require(_percent <= 20, "Penalty too high");
        earlyUnstakePenaltyPercent = _percent;
    }    

    // Function to get all addresses that have active or matured but not unstaked stakes
    function getStakers() external view returns (address[] memory) {
        return stakers;
    }

    // Rescue accidentally sent tokens
    function rescueToken(address token, uint256 amount) external onlyOwner {
        require(token != address(PRANA), "Cannot rescue staked token");
        IERC20(token).transfer(owner(), amount);
    }
}