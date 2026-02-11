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
    stackList: document.getElementById('stackList'),
    alternativeSolutions: document.getElementById('alternativeSolutions'),
    alternativesList: document.getElementById('alternativesList'),
    printBtn: document.getElementById('printBtn'),
    exportBtn: document.getElementById('exportBtn')
};

let latestSolutions = [];
let latestTarget = null;
const UNIT_SCALE = 10000;

initialize();

function initialize() {
    elements.gageBlockSet.addEventListener('change', toggleCustomSet);
    elements.calculateBtn.addEventListener('click', handleCalculate);
    elements.resetBtn.addEventListener('click', handleReset);
    elements.printBtn.addEventListener('click', () => window.print());
    elements.exportBtn.addEventListener('click', exportResults);

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
    // Common metric set values converted to inches.
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

    const solutions = findBestSolutions(blocks, target, maxBlocks, 5);
    if (solutions.length === 0) {
        alert('No valid stack could be found with the selected constraints.');
        return;
    }

    latestSolutions = solutions;
    latestTarget = target;
    renderResults(target, solutions);
}

function handleReset() {
    elements.targetDimension.value = '';
    elements.gageBlockSet.value = 'standard';
    elements.customBlocks.value = '';
    elements.maxBlocks.value = '9';
    elements.resultsSection.style.display = 'none';
    elements.stackList.innerHTML = '';
    elements.alternativesList.innerHTML = '';
    elements.alternativeSolutions.style.display = 'none';
    latestSolutions = [];
    latestTarget = null;
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

function findBestSolutions(blocks, target, maxBlocks, limit) {
    const sorted = [...blocks].sort((a, b) => b - a);
    const sortedUnits = sorted.map(toUnits);
    const targetUnits = toUnits(target);
    const maxTotalUnits = toUnits(target + 0.5);
    const prefixSums = [0];
    const solutions = [];
    const seenStacks = new Set();

    for (let i = 0; i < sortedUnits.length; i += 1) {
        prefixSums.push(prefixSums[i] + sortedUnits[i]);
    }

    function search(startIndex, currentStack, totalUnits) {
        const errorUnits = Math.abs(targetUnits - totalUnits);

        if (currentStack.length > 0) {
            storeSolution(solutions, seenStacks, {
                stack: [...currentStack].sort((a, b) => a - b).map(fromUnits),
                total: fromUnits(totalUnits),
                error: fromUnits(errorUnits)
            }, limit);

            if (errorUnits <= 1) {
                return;
            }
        }

        if (currentStack.length >= maxBlocks || startIndex >= sorted.length) {
            return;
        }

        const worstAllowedError = solutions.length >= limit
            ? toUnits(solutions[solutions.length - 1].error)
            : Number.POSITIVE_INFINITY;
        if (totalUnits >= targetUnits && errorUnits >= worstAllowedError) {
            return;
        }

        const remainingSlots = maxBlocks - currentStack.length;
        const maxAdditional = getMaxAdditionalTotal(prefixSums, sortedUnits.length, startIndex, remainingSlots);
        const maxReachable = totalUnits + maxAdditional;
        const minPossibleError = getMinimumError(targetUnits, totalUnits, maxReachable);
        if (minPossibleError > worstAllowedError) {
            return;
        }

        for (let i = startIndex; i < sorted.length; i += 1) {
            const nextValueUnits = sortedUnits[i];
            const nextTotalUnits = totalUnits + nextValueUnits;

            if (nextTotalUnits > maxTotalUnits) {
                continue;
            }

            if (solutions.length >= limit) {
                const nextError = Math.abs(targetUnits - nextTotalUnits);
                if (nextTotalUnits >= targetUnits && nextError >= worstAllowedError) {
                    continue;
                }
            }

            currentStack.push(nextValueUnits);
            search(i + 1, currentStack, nextTotalUnits);
            currentStack.pop();
        }
    }

    search(0, [], 0);

    return solutions.sort((a, b) => {
        if (a.error !== b.error) {
            return a.error - b.error;
        }

        return a.stack.length - b.stack.length;
    });
}

function getMaxAdditionalTotal(prefixSums, totalLength, startIndex, remainingSlots) {
    if (remainingSlots <= 0 || startIndex >= totalLength) {
        return 0;
    }

    const endExclusive = Math.min(totalLength, startIndex + remainingSlots);
    return prefixSums[endExclusive] - prefixSums[startIndex];
}

function storeSolution(collection, seenStacks, candidate, limit) {
    const key = candidate.stack.join('|');
    if (seenStacks.has(key)) {
        return;
    }

    seenStacks.add(key);

    collection.push(candidate);
    collection.sort((a, b) => {
        if (a.error !== b.error) {
            return a.error - b.error;
        }

        return a.stack.length - b.stack.length;
    });

    if (collection.length > limit) {
        const removed = collection.pop();
        seenStacks.delete(removed.stack.join('|'));
    }
}

function getMinimumError(target, minimumTotal, maximumTotal) {
    if (target < minimumTotal) {
        return minimumTotal - target;
    }

    if (target > maximumTotal) {
        return target - maximumTotal;
    }

    return 0;
}

function toUnits(value) {
    return Math.round(value * UNIT_SCALE);
}

function fromUnits(value) {
    return value / UNIT_SCALE;
}

function renderResults(target, solutions) {
    const [best, ...alternatives] = solutions;
    elements.resultsSection.style.display = 'block';

    elements.resultTarget.textContent = formatInches(target);
    elements.resultTotal.textContent = formatInches(best.total);

    elements.resultError.textContent = formatInches(best.error);
    elements.resultError.style.color = best.error <= 0.0001 ? '#0d8f49' : '#c64c00';

    elements.stackList.innerHTML = '';
    best.stack.forEach(block => {
        const blockElement = document.createElement('div');
        blockElement.className = 'block-item';
        blockElement.innerHTML = `<div class="size">${formatInches(block)}</div><div class="unit">inch</div>`;
        elements.stackList.appendChild(blockElement);
    });

    renderAlternatives(alternatives);
}

function renderAlternatives(alternatives) {
    elements.alternativesList.innerHTML = '';

    if (alternatives.length === 0) {
        elements.alternativeSolutions.style.display = 'none';
        return;
    }

    alternatives.forEach((solution, index) => {
        const altItem = document.createElement('div');
        altItem.className = 'alternative-item';
        altItem.innerHTML = `
            <strong>Alternative ${index + 1}</strong><br>
            Total: ${formatInches(solution.total)} | Error: ${formatInches(solution.error)}
            <div class="alt-blocks">${solution.stack.map(formatInches).join(' + ')}</div>
        `;
        elements.alternativesList.appendChild(altItem);
    });

    elements.alternativeSolutions.style.display = 'block';
}

function exportResults() {
    if (!latestSolutions.length || latestTarget == null) {
        alert('Run a calculation before exporting results.');
        return;
    }

    const headers = ['Rank', 'Target (in)', 'Total (in)', 'Error (in)', 'Blocks'];
    const rows = latestSolutions.map((solution, index) => [
        index + 1,
        latestTarget.toFixed(4),
        solution.total.toFixed(4),
        solution.error.toFixed(4),
        solution.stack.map(value => value.toFixed(4)).join(' + ')
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'gage-block-stack-results.csv';
    link.click();
    URL.revokeObjectURL(link.href);
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

function roundToFour(value) {
    return Number.parseFloat(value.toFixed(4));
}

function formatInches(value) {
    return `${value.toFixed(4)}\"`;
}
