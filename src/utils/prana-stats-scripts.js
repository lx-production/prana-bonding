// Global variables
let latestSatPrice = null;
let btcPrice = null;
let usdToVndRate = null;
let latestUsdPrice = null;
let marketCapInterval;
let totalBuyBondVolumePrana = null;
let totalSellBondVolumePrana = null;

const POLYGON_RPC_URL = window.CONFIG?.POLYGON_RPC_URL;
const PRANA_TOKEN_ADDRESS = '0x928277e774F34272717EADFafC3fd802dAfBD0F5';
const STAKING_CONTRACT_ADDRESS = '0x714425A4F4d624ef83fEff810a0EEC30B0847868';
const BUY_BOND_CONTRACT_ADDRESS = '0xA3adf8952982Eac60C0E43d6F93C66E7363c6Fe2';
const SELL_BOND_CONTRACT_ADDRESS = '0x2A48215e134a9382e1eBAf96F2Fa47Ca1c2fa092';
const PRANA_DECIMALS = 9;

let provider = null;

const getEthersProvider = () => {
    if (!provider) {
        if (typeof ethers !== 'undefined' && POLYGON_RPC_URL) {
            provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        }
    }
    return provider;
};

// StakingContract ABI fragment for totalInterestNeeded function
const STAKING_CONTRACT_ABI_FRAGMENT = [
    {
        "inputs": [],
        "name": "totalInterestNeeded",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];
const PRANA_TOKEN_ABI_FRAGMENT = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

const BUY_BOND_CONTRACT_ABI = [
    "function bonds(uint256) view returns (uint256 id, address owner, uint256 wbtcAmount, uint256 pranaAmount, uint256 maturityTime, uint256 creationTime, uint256 lastClaimTime, uint256 claimedPrana, bool claimed)"
];

const SELL_BOND_CONTRACT_ABI = [
    "function bonds(uint256) view returns (uint256 id, address owner, uint256 pranaAmount, uint256 wbtcAmount, uint256 maturityTime, uint256 creationTime, uint256 lastClaimTime, uint256 claimedWbtc, bool claimed)"
];

function getErrorMessage(error) {
    if (!error) {
        return '';
    }

    if (typeof error === 'string') {
        return error.toLowerCase();
    }

    if (typeof error.message === 'string') {
        return error.message.toLowerCase();
    }

    if (typeof error.shortMessage === 'string') {
        return error.shortMessage.toLowerCase();
    }

    if (typeof error.reason === 'string') {
        return error.reason.toLowerCase();
    }

    return String(error).toLowerCase();
}

function isOutOfRangeError(error) {
    if (error && typeof error.data === 'string' && error.data === '0x') {
        return true;
    }

    const message = getErrorMessage(error);

    return (
        message.includes('out of bounds') ||
        message.includes('out-of-bounds') ||
        message.includes('index out of range') ||
        message.includes('missing revert data') ||
        message.includes('invalid array length') ||
        message.includes('panic code 0x32') ||
        message.includes('panic: 0x32')
    );
}

async function fetchTotalPranaViaContract(contract, pranaFieldName) {
    let total = 0n;
    let index = 1n; // Skip the dummy entry at position 0

    while (true) {
        try {
            const bond = await contract.bonds(index);
            const amount = bond?.[pranaFieldName];

            if (amount !== undefined) {
                const normalizedAmount = typeof amount === 'bigint' ? amount : BigInt(amount.toString());
                total += normalizedAmount;
            }

            index += 1n;
        } catch (error) {
            if (isOutOfRangeError(error)) {
                break;
            }
            throw error;
        }
    }

    return total;
}

async function fetchTotalBondVolumesFromContracts(provider) {
    const buyBondContract = new ethers.Contract(BUY_BOND_CONTRACT_ADDRESS, BUY_BOND_CONTRACT_ABI, provider);
    const sellBondContract = new ethers.Contract(SELL_BOND_CONTRACT_ADDRESS, SELL_BOND_CONTRACT_ABI, provider);

    const [buyPranaTotal, sellPranaTotal] = await Promise.all([
        fetchTotalPranaViaContract(buyBondContract, 'pranaAmount'),
        fetchTotalPranaViaContract(sellBondContract, 'pranaAmount')
    ]);

    return {
        totalBuyPrana: buyPranaTotal,
        totalSellPrana: sellPranaTotal
    };
}

const pranaInput = document.getElementById("pranaInput");
const otherInput = document.getElementById("otherInput");
const currencySelect = document.getElementById("currencySelect");
const cachedData = {}; // Object to store cached data
const ATL_PRICE = 0.0017;


// Initialize the App
document.addEventListener("DOMContentLoaded", initApp);

// Updated function to fetch staked value using ethers v6
async function fetchTotalStakedValue() {
    try {
        // Check if ethers is available
        if (typeof ethers === 'undefined') {
            console.error("ethers.js is not loaded.");
            return 'Error: ethers.js not loaded';
        }

        // Get the singleton provider instance
        const provider = getEthersProvider();
        if (!provider) {
            console.error("Failed to initialize ethers provider. Check RPC URL.");
            return 'Error initializing provider';
        }

        // Ethers v6 contract instantiation (remains similar)
        const tokenContract = new ethers.Contract(PRANA_TOKEN_ADDRESS, PRANA_TOKEN_ABI_FRAGMENT, provider);

        // Fetch balance (returns BigInt in v6)
        const balance = await tokenContract.balanceOf(STAKING_CONTRACT_ADDRESS);

        // Format the balance using hardcoded decimals (ethers v6 utility)
        const formattedBalance = ethers.formatUnits(balance, PRANA_DECIMALS);

        // Return formatted balance with locale string for commas
        // parseFloat is still needed for toLocaleString formatting
        return parseFloat(formattedBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PRANA';

    } catch (error) {
        console.error('Error fetching total staked value:', error);
        return 'Error loading value';
    }
}

// Function to fetch total interest needed from StakingContract
async function fetchTotalInterestNeeded() {
    try {
        // Check if ethers is available
        if (typeof ethers === 'undefined') {
            console.error("ethers.js is not loaded.");
            return 'Error: ethers.js not loaded';
        }

        // Get the singleton provider instance
        const provider = getEthersProvider();
        if (!provider) {
            console.error("Failed to initialize ethers provider. Check RPC URL.");
            return 'Error initializing provider';
        }

        // Ethers v6 contract instantiation
        const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI_FRAGMENT, provider);

        // Fetch total interest needed (returns BigInt in v6)
        const totalInterest = await stakingContract.totalInterestNeeded();

        // Format the interest using hardcoded decimals (ethers v6 utility)
        const formattedInterest = ethers.formatUnits(totalInterest, PRANA_DECIMALS);

        // Return formatted interest with locale string for commas
        return parseFloat(formattedInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' PRANA';

    } catch (error) {
        console.error('Error fetching total interest needed:', error);
        return 'Error loading value';
    }
}

async function fetchTotalBondVolumes() {
    if (typeof ethers === 'undefined') {
        console.error("ethers.js is not loaded.");
        return null;
    }

    const provider = getEthersProvider();
    if (!provider) {
        console.error("Failed to initialize ethers provider. Check RPC URL.");
        return null;
    }

    try {
        return await fetchTotalBondVolumesFromContracts(provider);
    } catch (error) {
        console.error('Error fetching total bond volumes:', error);
        return null;
    }
}

function updateBondVolumeVnd() {
    try {
        const buyVndElement = document.getElementById('totalBuyBondVnd');
        const sellVndElement = document.getElementById('totalSellBondVnd');

        if (!buyVndElement || !sellVndElement) {
            return;
        }

        if (totalBuyBondVolumePrana === null || totalSellBondVolumePrana === null) {
            return;
        }

        if (btcPrice === null || btcPrice === undefined || latestSatPrice === null || latestSatPrice === undefined || usdToVndRate === null || usdToVndRate === undefined) {
            buyVndElement.textContent = 'Loading...';
            sellVndElement.textContent = 'Loading...';
            return;
        }

        const pranaPriceVnd = (latestSatPrice / 1e8) * btcPrice * usdToVndRate;
        const buyVnd = totalBuyBondVolumePrana * pranaPriceVnd;
        const sellVnd = totalSellBondVolumePrana * pranaPriceVnd;

        buyVndElement.textContent = `≈ ${buyVnd.toLocaleString('en-US', { maximumFractionDigits: 0 })} VNĐ`;
        sellVndElement.textContent = `≈ ${sellVnd.toLocaleString('en-US', { maximumFractionDigits: 0 })} VNĐ`;
    } catch (error) {
        console.error('Error updating bond volume VND display:', error);
    }
}

async function initApp() {
    try {
        // Show loading state
        document.getElementById('marketCapDisplay').textContent = 'Calculating...';
        document.getElementById('totalStakedValue').textContent = 'Loading...';
        document.getElementById('totalInterestNeeded').textContent = 'Loading...';

        // Fetch all required data in parallel (RAW data only, no side effects)
        const [usdVndRate, btcPriceResult, satsData, data30, data90, data180, data365, totalStaked, totalInterestNeeded, bondVolumes] = await Promise.all([
            getLatestUsdVndRate(),
            fetchBitcoinPrice(),
            fetchData('/data_sats.json'),
            fetchData('/data_30_days.json'),
            fetchData('/data_90_days.json'),
            fetchData('/data_180_days.json'),
            fetchData('/data_365_days.json'),
            fetchTotalStakedValue(),
            fetchTotalInterestNeeded(),
            fetchTotalBondVolumes()
        ]);

        btcPrice = btcPriceResult; // Update global BTC price
        usdToVndRate = usdVndRate; // Update global exchange rate
        latestSatPrice = satsData[satsData.length - 1].p;
        latestUsdPrice = data30[data30.length - 1].p;

        if (!usdToVndRate || !btcPrice || !latestSatPrice || !latestUsdPrice) {
            throw new Error('Missing critical data during initialization!');
        }

        // Update the total staked value display
        document.getElementById('totalStakedValue').textContent = totalStaked;

        // Calculate and display the VND value for staked amount
        // Parse the PRANA value (remove commas and " PRANA")
        const stakedPrana = parseFloat(totalStaked.replace(/,/g, '').replace(' PRANA', ''));
        const pranaPriceVND = (latestSatPrice / 1e8) * btcPrice * usdToVndRate; // 1 PRANA in VND
        const stakedVND = stakedPrana * pranaPriceVND;
        document.getElementById('totalStakedValueVND').textContent = `≈ ${stakedVND.toLocaleString('en-US', {maximumFractionDigits: 0})} VNĐ`;

        // Update the total interest needed display
        document.getElementById('totalInterestNeeded').textContent = totalInterestNeeded;

        // Calculate and display the VND value for interest needed
        // Parse the PRANA value (remove commas and " PRANA")
        const interestPrana = parseFloat(totalInterestNeeded.replace(/,/g, '').replace(' PRANA', ''));
        const interestVND = interestPrana * pranaPriceVND;
        document.getElementById('totalInterestNeededVND').textContent = `≈ ${interestVND.toLocaleString('en-US', {maximumFractionDigits: 0})} VNĐ`;

        if (bondVolumes) {
            const buyPrana = parseFloat(ethers.formatUnits(bondVolumes.totalBuyPrana, PRANA_DECIMALS));
            const sellPrana = parseFloat(ethers.formatUnits(bondVolumes.totalSellPrana, PRANA_DECIMALS));

            if (Number.isFinite(buyPrana) && Number.isFinite(sellPrana)) {
                totalBuyBondVolumePrana = buyPrana;
                totalSellBondVolumePrana = sellPrana;

                const buyPranaElement = document.getElementById('totalBuyBondPrana');
                const sellPranaElement = document.getElementById('totalSellBondPrana');

                if (buyPranaElement && sellPranaElement) {
                    buyPranaElement.textContent = `${buyPrana.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRANA`;
                    sellPranaElement.textContent = `${sellPrana.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRANA`;
                }

                updateBondVolumeVnd();
            } else {
                const buyPranaElement = document.getElementById('totalBuyBondPrana');
                const sellPranaElement = document.getElementById('totalSellBondPrana');
                const buyVndElement = document.getElementById('totalBuyBondVnd');
                const sellVndElement = document.getElementById('totalSellBondVnd');

                if (buyPranaElement) {
                    buyPranaElement.textContent = 'Error loading volume';
                }
                if (sellPranaElement) {
                    sellPranaElement.textContent = 'Error loading volume';
                }
                if (buyVndElement) {
                    buyVndElement.textContent = '';
                }
                if (sellVndElement) {
                    sellVndElement.textContent = '';
                }
            }
        } else {
            const buyPranaElement = document.getElementById('totalBuyBondPrana');
            const sellPranaElement = document.getElementById('totalSellBondPrana');
            const buyVndElement = document.getElementById('totalBuyBondVnd');
            const sellVndElement = document.getElementById('totalSellBondVnd');

            if (buyPranaElement) {
                buyPranaElement.textContent = 'Error loading volume';
            }
            if (sellPranaElement) {
                sellPranaElement.textContent = 'Error loading volume';
            }
            if (buyVndElement) {
                buyVndElement.textContent = '';
            }
            if (sellVndElement) {
                sellVndElement.textContent = '';
            }
        }

        // Cache market data and update global variables
        cachedData['30_days'] = data30;
        cachedData['90_days'] = data90;
        cachedData['180_days'] = data180;
        cachedData['365_days'] = data365;

        // Start live updates
        startMarketCapUpdates();

        latestSatPriceUsd = latestSatPrice / 1e8 * btcPrice;

        const change1m = calcPercentageChange(data30[0].p, latestSatPriceUsd).toFixed(0);
        const change3m = calcPercentageChange(data90[0].p, latestSatPriceUsd).toFixed(0);
        const change6m = calcPercentageChange(data180[0].p, latestSatPriceUsd).toFixed(0);
        const change1y = calcPercentageChange(data365[0].p, latestSatPriceUsd).toFixed(0);
        const changeATL = calcPercentageChange(ATL_PRICE, latestSatPriceUsd).toFixed(0);

        // Helper function to color values based on their sign
        function colorValueBySign(elementId, value) {
            const element = document.getElementById(elementId);
            element.textContent = `${value}%`;
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                if (numValue > 0) {
                    element.style.color = '#22e100'; // Green for positive numbers
                } else if (numValue < 0) {
                    element.style.color = '#e10022'; // Red for negative numbers
                } else {
                    element.style.color = '#000000'; // Black for zero
                }
            }
        }

        // Apply coloring to all percentage change elements
        colorValueBySign('change1m', change1m);
        colorValueBySign('change3m', change3m);
        colorValueBySign('change6m', change6m);
        colorValueBySign('change1y', change1y);
        colorValueBySign('changeATL', changeATL);

        // Initialize input fields to empty
        document.getElementById("pranaInput").value = "";
        document.getElementById("otherInput").value = "";

        renderSatChart(satsData);
        loadFiatData('365_days', document.getElementById('1Y'));

        // Bind UI event listeners
        initEventListeners();

        // Set default currency
        currencySelect.value = "VND";

        console.log('App initialized successfully.');
    } catch (error) {
        // Handle initialization failure
        console.error('Error during app initialization:', error);
        document.getElementById('marketCapDisplay').textContent = 'Initialization failed. Please try again later.';
        document.getElementById('totalStakedValue').textContent = 'Error loading value';
        document.getElementById('totalInterestNeeded').textContent = 'Error loading value';
    }
}

function calcPercentageChange(oldValue, newValue) {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
}

async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        return [];
    }
}

// Update Market Cap on Interval
function startMarketCapUpdates() {
    async function updateData() {
        try {
            btcPrice = await fetchBitcoinPrice();
            updateMarketCap();
            updateBondVolumeVnd();
        } catch (error) {
            console.error('Error updating market data:', error);
        }
    }

    updateData();

    // Start the interval
    marketCapInterval = setInterval(updateData, 5000);

    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            clearInterval(marketCapInterval);  // Stop updates when tab is hidden
        } else if (document.visibilityState === 'visible') {
            updateData();  // Refresh once immediately when returning
            marketCapInterval = setInterval(updateData, 5000); // Restart the interval
        }
    });
}

function updateMarketCap() {
    const marketCapDisplay = document.getElementById("marketCapDisplay");
    const marketCap = Math.round((latestSatPrice / 1e8) * btcPrice * usdToVndRate * 1e7);
    marketCapDisplay.innerHTML = `${marketCap.toLocaleString("en-US")} VNĐ 
        <sup class="live-indicator">
            <span class="green-dot"></span>
            <span class="live-text">Live</span>
        </sup>`;
}

// Load + Render Fiat Chart
function loadFiatData(range, button) {
    try {
        // Deselect all range buttons
        document.querySelectorAll('.range-button').forEach(btn => btn.classList.remove('selected'));

        // Highlight the selected button if provided
        if (button) {
            button.classList.add('selected');
        }

        // Check if the data is already cached
        if (cachedData[range]) {
            console.log(`Using cached data for range: ${range}`);
            updateLatestFiatPrice(cachedData[range]);
            renderFiatChart(cachedData[range], range);
            return;
        }

        // Fetch new data for the selected range
        fetchData(`/data_${range}.json`)
            .then(data => {
                if (!data || data.length === 0) {
                    throw new Error(`No data available for the selected range: ${range}`);
                }

                // Cache and render the data
                cachedData[range] = data;
                updateLatestFiatPrice(data); 
                renderFiatChart(data, range);
            })
            .catch(error => {
                console.error(`Error fetching data for range ${range}:`, error);
                document.getElementById('marketCapDisplay').textContent = `Error loading data for ${range}. Please try again later.`;
            });
    } catch (error) {
        console.error("Error in loadFiatData:", error);
        document.getElementById('marketCapDisplay').textContent = `Unexpected error occurred. Please refresh the page.`;
    }
}

function updateLatestFiatPrice(data) {
    const latestFiatData = data[data.length - 1]; // Last item
    latestUsdPrice = latestFiatData.p; // Update global variable
    console.log(`Updated latest USD price: ${latestUsdPrice}`);
}

async function fetchBitcoinPrice() {
    const response = await fetch("https://api.livecoinwatch.com/coins/single", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": "b4cbac14-f3d3-4024-9921-fb4286f0fe6c"
        },
        body: JSON.stringify({
            currency: "USD",
            code: "BTC",
            meta: false
        })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data.rate;
}

async function getLatestUsdVndRate() {
    const API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
    const DEFAULT_RATE = 26000;
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("Unable to get USD-VND");
        const rateData = await res.json();
        return parseFloat(rateData.rates.VND);
    } catch (err) {
        console.error("Error fetching USD-VND rate:", err);
        return DEFAULT_RATE;
    }
}

function renderFiatChart(data, range) {
    const fiatChartData = data.map(entry => ({
        time: entry.t,
        value: Math.round(entry.p * usdToVndRate)  // Convert to VND and round to 0 decimal places
    }));

    areaSeriesFiat.setData(fiatChartData);
    fiatLineSeries.setData(fiatChartData);
    chartFiat.timeScale().fitContent();  // Render chart & Fit the entire data into view

    if (range === 'max') {
        handleMaxRange();
    } else {
        clearMaxRangeMarkers();
    }
}

function initEventListeners() {
    try {
        // Bind "input" event listeners for PRANA and other input fields
        pranaInput.addEventListener("input", () => updateValues("prana"));
        otherInput.addEventListener("input", () => updateValues("other"));
        currencySelect.addEventListener("change", () => updateValues("prana"));

        // Attach window resize listener for responsive charts
        window.addEventListener("resize", () => {
            chartFiat.resize(
                document.getElementById("chart-fiat").clientWidth,
                document.getElementById("chart-fiat").clientHeight
            );
            chartSats.resize(
                document.getElementById("chart-sats").clientWidth,
                document.getElementById("chart-sats").clientHeight
            );
        });

        console.log("Event listeners initialized successfully.");
    } catch (error) {
        console.error("Error initializing event listeners:", error);
    }
}

// Update input fields based on the source field
async function updateValues(source) {
    const prana = parseFloat(pranaInput.value.replace(/,/g, "")) || 0;
    const other = parseFloat(otherInput.value.replace(/,/g, "")) || 0;
    const selectedCurrency = currencySelect.value;

    // If both fields are empty, clear all fields and return
    if (!pranaInput.value && !otherInput.value) {
        otherInput.value = "";
        pranaInput.value = "";
        return;
    }

    // Ensure btcPrice and other globals are already set
    if (!btcPrice || !latestSatPrice || !usdToVndRate) {
        console.error("Prices not available yet.");
        return;
    }

    // Hàm format VND: trả về chuỗi có dấu phẩy
    function formatVND(num) {
        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    }

    if (source === "prana") {
        if (selectedCurrency === "SATs") {
            otherInput.value = (prana * latestSatPrice).toFixed(2);
        } else if (selectedCurrency === "USD") {
            otherInput.value = (prana * latestSatPrice / 100000000 * btcPrice).toFixed(5);
        } else if (selectedCurrency === "VND") {
            const vndValue = (prana * latestSatPrice / 100000000 * btcPrice * usdToVndRate).toFixed(0);
            otherInput.value = formatVND(vndValue);
        }
    } else if (source === "other") {
        if (selectedCurrency === "SATs") {
            pranaInput.value = (other / latestSatPrice).toFixed(2);
        } else if (selectedCurrency === "USD") {
            pranaInput.value = (other / (latestSatPrice / 100000000 * btcPrice)).toFixed(5);
        } else if (selectedCurrency === "VND") {
            const pranaValue = (other / (latestSatPrice / 100000000 * btcPrice * usdToVndRate)).toFixed(0);
            pranaInput.value = formatVND(pranaValue);
        }
    }
} 

const commonChartOptions = {
    grid: {
        vertLines: {
            color: '#ebebeb',
            style: 1 // 0: Solid, 1: Dotted, 2: Dashed
        },
        horzLines: {
            color: '#ebebeb',
            style: 1
        }
    },
    rightPriceScale: {
        borderColor: '#D3D3D3',
    },
    timeScale: {
        borderColor: '#D3D3D3',
        timeVisible: false,
        secondsVisible: false,
        allowBoldLabels: false,
        tickMarkFormatter: (time) => {
            const date = new Date(time * 1000);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            return `${day}/${month}/${year}`;
        },
    },
};
         
const chartSats = LightweightCharts.createChart(document.getElementById('chart-sats'), {
    width: document.getElementById('chart-sats').clientWidth,
    height: document.getElementById('chart-sats').clientHeight,
    ...commonChartOptions
});
 
const areaSeriesSats = chartSats.addSeries(LightweightCharts.AreaSeries, {
    topColor: 'rgba(255, 183, 0, 0.36)',
    bottomColor: 'rgba(255, 183, 0, 0.05)',
    lineColor: '#f5840c',
    lineWidth: 1.8,
    lastValueVisible: false
});

const lineSeriesSats = chartSats.addSeries(LightweightCharts.LineSeries, {
    color: 'rgb(255, 183, 0)',
    lineWidth: 1.8,
    priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01  // Set for sats precision
    }
});

// Create the PRANA-fiat chart with updated time scale settings
const chartFiat = LightweightCharts.createChart(document.getElementById('chart-fiat'), {
    width: document.getElementById('chart-fiat').clientWidth,
    height: document.getElementById('chart-fiat').clientHeight,
    ...commonChartOptions
});

// Add a new area series with a blue gradient for PRANA/VND
const areaSeriesFiat = chartFiat.addSeries(LightweightCharts.AreaSeries, {
    topColor: 'rgba(98, 255, 0, 0.2)',   // Blue gradient - top color
    bottomColor: 'rgba(98, 255, 0, 0.01)', // Blue gradient - bottom color, light transparency
    lineColor: '#007BFF',  // Line color (standard blue)
    lineWidth: 1.8,
    lastValueVisible: false,  // Hides the last value price label
    priceFormat: {
        type: 'price',
        precision: 0,  // Set precision for price axis to 0 decimal places for VND
        minMove: 1     // Smallest change that can be displayed (1 VND)
    }
});

// Add line series with specified color, line width, and price precision
const fiatLineSeries = chartFiat.addSeries(LightweightCharts.LineSeries, {
    color: '#28ee05',
    lineWidth: 1.8,
    priceFormat: {
        type: 'price',
        precision: 0,  // Set precision for price axis to 0 decimal places for VND
        minMove: 1     // Smallest change that can be displayed (1 VND)
    }
});

// Create a markers instance for fiatLineSeries with an initial empty array
const fiatLineSeriesMarkers = LightweightCharts.createSeriesMarkers(fiatLineSeries, []);

function renderSatChart(data) {
    const chartDataSats = data.map(entry => ({
        time: entry.t,
        value: entry.p
    }));

    areaSeriesSats.setData(chartDataSats);
    lineSeriesSats.setData(chartDataSats);
    chartSats.timeScale().fitContent();  // Render chart & Fit the entire data
}

function handleMaxRange() {
    const markers = [
        {
            time: 1628996429,
            position: 'aboveBar',
            color: '#160af5',
            shape: 'circle',
            id: 'max_marker_1',
            text: '➊',
            size: 1.5,
        },
        {
            time: 1662539947,
            position: 'aboveBar',
            color: 'red',
            shape: 'arrowDown',
            id: 'max_marker_2',
            text: '➋',
            size: 1.5,
        },
        {
            time: 1663149191,
            position: 'belowBar',
            color: '#49f54c',
            shape: 'arrowUp',
            id: 'max_marker_3',
            text: '➌',
            size: 1.5,
        },
        {
            time: 1713688933,
            position: 'aboveBar',
            color: '#1888ff',
            shape: 'circle',
            id: 'max_marker_4',
            text: '➍',
            size: 1.5,
        },
        {
            time: 1739927178,
            position: 'aboveBar',
            color: '#5d2ce6',
            shape: 'circle',
            id: 'max_marker_5',
            text: '➎',
            size: 1.5,
        },
        {
            time: 1742006710,
            position: 'aboveBar',
            color: '#FF1493',
            shape: 'circle',
            id: 'max_marker_6',
            text: '➏',
            size: 1.5,
        },
        {
            time: 1744423130,
            position: 'aboveBar',
            color: '#FF1493',
            shape: 'circle',
            id: 'max_marker_7',
            text: '➐',
            size: 1.5,
        }
    ];
    // Update markers via the markers primitive
    fiatLineSeriesMarkers.setMarkers(markers);
    document.getElementById('history').style.display = 'block';  // Show the notes div
}

function clearMaxRangeMarkers() {
    // Remove all markers using the markers primitive
    fiatLineSeriesMarkers.setMarkers([]);
    document.getElementById('history').style.display = 'none';  // Hide the notes div
}
