const blockSets = {
    standard: buildStandardSet(),
    metric: buildMetricSet()
};

const elements = {
    targetDimension: document.getElementById('targetDimension'),
    gageBlockSet: document.getElementById('gageBlockSet'),
    customSetGroup: document.getElementById('customSetGroup'),
    customBlocks: document.getElementById('customBlocks'),
    maxBlocks: document.getElementById('maxBlocks'),
    calculateBtn: document.getElementById('calculateBtn'),
    resetBtn: document.getElementById('resetBtn'),
    resultsSection: document.getElementById('resultsSection'),
    resultTarget: document.getElementById('resultTarget'),
    resultTotal: document.getElementById('resultTotal'),
    resultError: document.getElementById('resultError'),
    stackList: document.getElementById('stackList')
};

const UNIT_SCALE = 10000;
const MAX_SEARCH_MS = 1800;

initialize();

function initialize() {
    elements.gageBlockSet.addEventListener('change', toggleCustomSet);
    elements.calculateBtn.addEventListener('click', handleCalculate);
    elements.resetBtn.addEventListener('click', handleReset);
    toggleCustomSet();
}

function buildStandardSet() {
    const values = [];

    addRange(values, 0.1001, 0.1009, 0.0001);
    addRange(values, 0.101, 0.109, 0.001);
    addRange(values, 0.11, 0.19, 0.01);
    addRange(values, 0.2, 0.9, 0.1);
    addRange(values, 1, 4, 1);

    return values.map(roundToFour).sort((a, b) => a - b);
}

function buildMetricSet() {
    const mmValues = [
        0.5,
        ...createNumericRange(1, 9, 0.5),
        ...createNumericRange(10, 90, 10)
    ];

    return mmValues
        .map(mm => roundToFour(mm / 25.4))
        .sort((a, b) => a - b);
}

function toggleCustomSet() {
    const isCustom = elements.gageBlockSet.value === 'custom';
    elements.customSetGroup.style.display = isCustom ? 'block' : 'none';
}

function handleCalculate() {
    const target = Number.parseFloat(elements.targetDimension.value);
    const maxBlocks = Number.parseInt(elements.maxBlocks.value, 10);

    if (!Number.isFinite(target) || target <= 0) {
        alert('Enter a valid target dimension greater than zero.');
        return;
    }

    if (!Number.isFinite(maxBlocks) || maxBlocks < 1 || maxBlocks > 20) {
        alert('Maximum blocks must be between 1 and 20.');
        return;
    }

    const blocks = getSelectedBlocks();
    if (blocks.length === 0) {
        alert('No valid blocks are available for the selected set.');
        return;
    }

    const solution = findBestSolution(blocks, target, maxBlocks);
    if (!solution) {
        alert('No valid stack could be found with the selected constraints.');
        return;
    }

    renderResults(target, solution);
}

function handleReset() {
    elements.targetDimension.value = '';
    elements.gageBlockSet.value = 'standard';
    elements.customBlocks.value = '';
    elements.maxBlocks.value = '9';
    elements.resultsSection.style.display = 'none';
    elements.stackList.innerHTML = '';
    toggleCustomSet();
}

function getSelectedBlocks() {
    if (elements.gageBlockSet.value !== 'custom') {
        return blockSets[elements.gageBlockSet.value] || [];
    }

    const parsed = elements.customBlocks.value
        .split(',')
        .map(item => Number.parseFloat(item.trim()))
        .filter(value => Number.isFinite(value) && value > 0)
        .map(roundToFour);

    return [...new Set(parsed)].sort((a, b) => a - b);
}

function findBestSolution(blocks, target, maxBlocks) {
    const sortedUnits = [...blocks]
        .map(toUnits)
        .sort((a, b) => b - a);

    const targetUnits = toUnits(target);
    const maxTotalUnits = toUnits(target + 0.5);
    const prefixSums = [0];
    for (let i = 0; i < sortedUnits.length; i += 1) {
        prefixSums.push(prefixSums[i] + sortedUnits[i]);
    }

    const startTime = nowMs();
    let nodeCount = 0;
    let best = null;
    let exactFound = false;

    function shouldStop() {
        return nowMs() - startTime >= MAX_SEARCH_MS;
    }

    function updateBest(stackUnits, totalUnits, errorUnits) {
        if (
            !best
            || errorUnits < best.errorUnits
            || (errorUnits === best.errorUnits && stackUnits.length < best.stackUnits.length)
        ) {
            best = {
                stackUnits: [...stackUnits].sort((a, b) => a - b),
                totalUnits,
                errorUnits
            };
        }
    }

    function search(startIndex, currentStack, totalUnits) {
        nodeCount += 1;
        if (nodeCount % 1024 === 0 && shouldStop()) {
            return;
        }

        if (currentStack.length > 0) {
            const errorUnits = Math.abs(targetUnits - totalUnits);
            updateBest(currentStack, totalUnits, errorUnits);

            if (errorUnits === 0) {
                exactFound = true;
                return;
            }
        }

        if (exactFound || currentStack.length >= maxBlocks || startIndex >= sortedUnits.length) {
            return;
        }

        const currentError = Math.abs(targetUnits - totalUnits);
        if (best && totalUnits >= targetUnits && currentError >= best.errorUnits) {
            return;
        }

        const remainingSlots = maxBlocks - currentStack.length;
        const maxAdditional = getMaxAdditionalTotal(prefixSums, sortedUnits.length, startIndex, remainingSlots);
        const maxReachable = totalUnits + maxAdditional;
        if (best && targetUnits > maxReachable) {
            const minPossibleError = targetUnits - maxReachable;
            if (minPossibleError >= best.errorUnits) {
                return;
            }
        }

        for (let i = startIndex; i < sortedUnits.length; i += 1) {
            const nextTotal = totalUnits + sortedUnits[i];
            if (nextTotal > maxTotalUnits) {
                continue;
            }

            currentStack.push(sortedUnits[i]);
            search(i + 1, currentStack, nextTotal);
            currentStack.pop();

            if (exactFound) {
                return;
            }

            if (nodeCount % 1024 === 0 && shouldStop()) {
                return;
            }
        }
    }

    search(0, [], 0);

    if (!best) {
        return null;
    }

    return {
        stack: best.stackUnits.map(fromUnits),
        total: fromUnits(best.totalUnits),
        error: fromUnits(best.errorUnits)
    };
}

function getMaxAdditionalTotal(prefixSums, totalLength, startIndex, remainingSlots) {
    if (remainingSlots <= 0 || startIndex >= totalLength) {
        return 0;
    }

    const endExclusive = Math.min(totalLength, startIndex + remainingSlots);
    return prefixSums[endExclusive] - prefixSums[startIndex];
}

function renderResults(target, solution) {
    elements.resultsSection.style.display = 'block';

    elements.resultTarget.textContent = formatInches(target);
    elements.resultTotal.textContent = formatInches(solution.total);
    elements.resultError.textContent = formatInches(solution.error);
    elements.resultError.style.color = solution.error <= 0.0001 ? '#0d8f49' : '#c64c00';

    elements.stackList.innerHTML = '';
    solution.stack.forEach(block => {
        const blockElement = document.createElement('div');
        blockElement.className = 'block-item';
        blockElement.innerHTML = `<div class="size">${formatInches(block)}</div><div class="unit">inch</div>`;
        elements.stackList.appendChild(blockElement);
    });
}

function addRange(values, start, end, step) {
    for (let value = start; value <= end + step / 10; value += step) {
        values.push(value);
    }
}

function createNumericRange(start, end, step) {
    const values = [];

    for (let value = start; value <= end + step / 10; value += step) {
        values.push(value);
    }

    return values;
}

function toUnits(value) {
    return Math.round(value * UNIT_SCALE);
}

function fromUnits(value) {
    return value / UNIT_SCALE;
}

function roundToFour(value) {
    return Number.parseFloat(value.toFixed(4));
}

function formatInches(value) {
    return `${value.toFixed(4)}\"`;
}

function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }

    return Date.now();
}
