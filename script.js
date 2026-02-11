// Standard gage block set (81 pieces)
const STANDARD_SET = [
    // 0.1001 to 0.1009 series
    0.1001, 0.1002, 0.1003, 0.1004, 0.1005, 0.1006, 0.1007, 0.1008, 0.1009,
    // 0.101 to 0.109 series
    0.101, 0.102, 0.103, 0.104, 0.105, 0.106, 0.107, 0.108, 0.109,
    // 0.11 to 0.19 series
    0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19,
    // 0.2 to 0.9 series (0.1 increments)
    0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    // 1 to 8 series (1 inch increments)
    1, 2, 3, 4, 5, 6, 7, 8,
    // Adders
    0.0625, 0.0875, 0.0905, 0.2125, 0.2375, 0.2625, 0.2875, 0.3125, 0.3375, 0.3625, 0.3875, 0.4125, 0.4375, 0.4625, 0.4875
];

// Metric gage block set
const METRIC_SET = [
    0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 10, 15, 20, 25, 30, 40, 50, 75, 100
];

// State
let currentBlockSet = [...STANDARD_SET];
let results = [];

// DOM Elements
const targetDimensionInput = document.getElementById('targetDimension');
const gageBlockSetSelect = document.getElementById('gageBlockSet');
const customBlocksInput = document.getElementById('customBlocks');
const customSetGroup = document.getElementById('customSetGroup');
const maxBlocksInput = document.getElementById('maxBlocks');
const calculateBtn = document.getElementById('calculateBtn');
const resetBtn = document.getElementById('resetBtn');
const resultsSection = document.getElementById('resultsSection');
const stackList = document.getElementById('stackList');
const alternativesList = document.getElementById('alternativesList');
const alternativeSolutions = document.getElementById('alternativeSolutions');
const printBtn = document.getElementById('printBtn');
const exportBtn = document.getElementById('exportBtn');

// Event Listeners
gageBlockSetSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customSetGroup.style.display = 'block';
    } else {
        customSetGroup.style.display = 'none';
        updateBlockSet(e.target.value);
    }
});
customBlocksInput.addEventListener('change', updateCustomSet);
calculateBtn.addEventListener('click', calculate);
resetBtn.addEventListener('click', reset);
printBtn.addEventListener('click', printResults);
exportBtn.addEventListener('click', exportCSV);

// Initialize function
function init() {
    updateBlockSet('standard');
}

function updateBlockSet(setType) {
    if (setType === 'standard') {
        currentBlockSet = [...STANDARD_SET];
    } else if (setType === 'metric') {
        currentBlockSet = [...METRIC_SET];
    }
}

function updateCustomSet() {
    const customInput = customBlocksInput.value;
    try {
        currentBlockSet = customInput
            .split(',')
            .map(val => parseFloat(val.trim()))
            .filter(val => !isNaN(val) && val > 0)
            .sort((a, b) => a - b);
        if (currentBlockSet.length === 0) {
            alert('Please enter at least one valid number');
            currentBlockSet = [...STANDARD_SET];
        }
    } catch (e) {
        alert('Invalid input format');
        currentBlockSet = [...STANDARD_SET];
    }
}

function calculate() {
    const target = parseFloat(targetDimensionInput.value);
    const maxBlocks = parseInt(maxBlocksInput.value);
    if (isNaN(target) || target <= 0) {
        alert('Please enter a valid target dimension');
        return;
    }
    if (gageBlockSetSelect.value === 'custom') {
        updateCustomSet();
    }
    // Find the best combination using greedy algorithm with refinement
    results = findBestCombination(target, maxBlocks);
    if (results.length === 0) {
        alert('No solution found with the current constraints');
        resultsSection.style.display = 'none';
        return;
    }
    displayResults(target);
}

function findBestCombination(target, maxBlocks) {
    const solutions = [];
    // Use recursive combination finding
    function findCombinations(remaining, currentStack, depth) {
        if (depth > maxBlocks) return;
        // Check if we found an exact match
        if (Math.abs(remaining) < 0.0001) {
            solutions.push({ stack: [...currentStack], total: target - remaining, error: remaining });
            return;
        }
        // If remaining is negative, we've exceeded target
        if (remaining < 0) return;
        // Try each available block
        for (let block of currentBlockSet) {
            if (block <= remaining + 0.0001) {
                currentStack.push(block);
                findCombinations(remaining - block, currentStack, depth + 1);
                currentStack.pop();
            }
        }
    }
    findCombinations(target, [], 0);
    // Sort solutions by error (closest first), then by number of blocks
    solutions.sort((a, b) => {
        const errorDiff = Math.abs(a.error) - Math.abs(b.error);
        if (Math.abs(errorDiff) > 0.00001) return errorDiff;
        return a.stack.length - b.stack.length;
    });
    return solutions.slice(0, 5); // Return top 5 solutions
}

function displayResults(target) {
    if (results.length === 0) return;
    const best = results[0];
    // Update summary info
    document.getElementById('resultTarget').textContent = target.toFixed(4) + '"';
    document.getElementById('resultTotal').textContent = best.total.toFixed(4) + '"';
    document.getElementById('resultError').textContent = (best.error * 1000000).toFixed(2) + ' µ"';
    // Display the best stack
    stackList.innerHTML = '';
    const sortedStack = [...best.stack].sort((a, b) => a - b);
    sortedStack.forEach(block => {
        const blockElement = document.createElement('div');
        blockElement.className = 'block-item';
        blockElement.innerHTML = `
            <div class="size">${block.toFixed(4)}</div>
            <div class="unit">inches</div>
        `;
        stackList.appendChild(blockElement);
    });
    // Display alternative solutions if more than one
    if (results.length > 1) {
        alternativeSolutions.style.display = 'block';
        alternativesList.innerHTML = '';
        for (let i = 1; i < results.length; i++) {
            const alt = results[i];
            const sortedAltStack = [...alt.stack].sort((a, b) => a - b);
            const altElement = document.createElement('div');
            altElement.className = 'alternative-item';
            altElement.innerHTML = `
                <strong>Option ${i + 1}</strong> (${sortedAltStack.length} blocks) - Error: ${(alt.error * 1000000).toFixed(2)} µ"
                <div class="alt-blocks">${sortedAltStack.map(b => b.toFixed(4)).join(' + ')}</div>
            `;
            alternativesList.appendChild(altElement);
        }
    } else {
        alternativeSolutions.style.display = 'none';
    }
    resultsSection.style.display = 'block';
}

function reset() {
    targetDimensionInput.value = '';
    maxBlocksInput.value = '9';
    customBlocksInput.value = '';
    customSetGroup.style.display = 'none';
    gageBlockSetSelect.value = 'standard';
    resultsSection.style.display = 'none';
    results = [];
    updateBlockSet('standard');
}

function printResults() {
    window.print();
}

function exportCSV() {
    if (results.length === 0) {
        alert('No results to export');
        return;
    }
    const target = parseFloat(targetDimensionInput.value);
    let csv = 'Gage Block Stack Calculator Results\n';
    csv += `Target Dimension,${target.toFixed(4)} inches\n`;
    csv += `Date,${new Date().toLocaleString()}\n\n`;
    results.forEach((result, index) => {
        csv += `Solution ${index + 1},Error (µ\"),Number of Blocks\n`;
        csv += `,${(result.error * 1000000).toFixed(2)},${result.stack.length}\n`;
        const sortedStack = [...result.stack].sort((a, b) => a - b);
        sortedStack.forEach(block => {
            csv += `${block.toFixed(4)} inches,,\n`;
        });
        csv += '\n';
    });
    // Download CSV
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', 'gage_block_results.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Initialize the app
init();