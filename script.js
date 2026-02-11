const MM_PER_INCH = 25.4;
const UNIT_SCALE = 1000000;
const MAX_SEARCH_MS = 1800;

const blockSets = {
    standard: buildStandardSetInches(),
    metric: buildMetricSetInches()
};

const elements = {
    targetDimension: document.getElementById('targetDimension'),
    targetUnits: document.getElementById('targetUnits'),
    gageBlockSet: document.getElementById('gageBlockSet'),
    customSetGroup: document.getElementById('customSetGroup'),
    customSetUnitsGroup: document.getElementById('customSetUnitsGroup'),
    customSetUnits: document.getElementById('customSetUnits'),
    customBlocks: document.getElementById('customBlocks'),
    maxBlocks: document.getElementById('maxBlocks'),
    calculateBtn: document.getElementById('calculateBtn'),
    resetBtn: document.getElementById('resetBtn'),
    resultsSection: document.getElementById('resultsSection'),
    resultTarget: document.getElementById('resultTarget'),
    resultTotal: document.getElementById('resultTotal'),
    resultError: document.getElementById('resultError'),
    stackList: document.getElementById('stackList'),
    sineAngle: document.getElementById('sineAngle'),
    sineLength: document.getElementById('sineLength'),
    sineLengthUnits: document.getElementById('sineLengthUnits'),
    calculateSineBtn: document.getElementById('calculateSineBtn'),
    calculateSineAndStackBtn: document.getElementById('calculateSineAndStackBtn'),
    sineResults: document.getElementById('sineResults'),
    resultSineAngle: document.getElementById('resultSineAngle'),
    resultSineLength: document.getElementById('resultSineLength'),
    resultSineHeight: document.getElementById('resultSineHeight')
};

initialize();

function initialize() {
    elements.gageBlockSet.addEventListener('change', toggleCustomSet);
    elements.calculateBtn.addEventListener('click', handleCalculate);
    elements.resetBtn.addEventListener('click', handleReset);
    elements.calculateSineBtn.addEventListener('click', handleSineCalculate);
    elements.calculateSineAndStackBtn.addEventListener('click', handleSineAndStackCalculate);
    toggleCustomSet();
}

function buildStandardSetInches() {
    const values = [];

    addRange(values, 0.1001, 0.1009, 0.0001);
    addRange(values, 0.101, 0.109, 0.001);
    addRange(values, 0.11, 0.19, 0.01);
    addRange(values, 0.2, 0.9, 0.1);
    addRange(values, 1, 4, 1);

    return [...new Set(values.map(roundToFour))].sort((a, b) => a - b);
}

function buildMetricSetInches() {
    // Common metric gage block inventory based on the standard 87-piece set.
    // Values are kept in mm and only converted to inches for search math,
    // so rendered metric sizes stay on true nominal values (for example 5.000 mm).
    const mmValues = [
        0.5,
        ...createNumericRange(1.001, 1.009, 0.001),
        ...createNumericRange(1.01, 1.49, 0.01),
        ...createNumericRange(1.5, 9.5, 0.5),
        ...createNumericRange(10, 100, 10)
    ];

    return [...new Set(mmValues.map(mmToInches))].sort((a, b) => a - b);
}

function toggleCustomSet() {
    const isCustom = elements.gageBlockSet.value === 'custom';
    elements.customSetGroup.style.display = isCustom ? 'block' : 'none';
    elements.customSetUnitsGroup.style.display = isCustom ? 'block' : 'none';
}

function handleCalculate() {
    const inputTarget = Number.parseFloat(elements.targetDimension.value);
    const targetUnits = elements.targetUnits.value;
    const maxBlocks = Number.parseInt(elements.maxBlocks.value, 10);

    if (!Number.isFinite(inputTarget) || inputTarget <= 0) {
        alert('Enter a valid target dimension greater than zero.');
        return;
    }

    if (!Number.isFinite(maxBlocks) || maxBlocks < 1 || maxBlocks > 20) {
        alert('Maximum blocks must be between 1 and 20.');
        return;
    }

    const targetInches = convertToInches(inputTarget, targetUnits);
    const blocksInches = getSelectedBlocksInches();

    if (blocksInches.length === 0) {
        alert('No valid blocks are available for the selected set.');
        return;
    }

    const solution = findBestSolution(blocksInches, targetInches, maxBlocks);
    if (!solution) {
        alert('No valid stack could be found with the selected constraints.');
        return;
    }

    renderResults(inputTarget, targetUnits, solution);
}

function handleSineCalculate() {
    const sineValues = getValidatedSineValues();
    if (!sineValues) {
        return;
    }

    renderSineResults(sineValues);
}

function handleSineAndStackCalculate() {
    const sineValues = getValidatedSineValues();
    if (!sineValues) {
        return;
    }

    renderSineResults(sineValues);

    elements.targetUnits.value = sineValues.lengthUnits;
    elements.targetDimension.value = sineValues.heightValue.toFixed(4);
    handleCalculate();
}

function getValidatedSineValues() {
    const angleDeg = Number.parseFloat(elements.sineAngle.value);
    const lengthValue = Number.parseFloat(elements.sineLength.value);
    const lengthUnits = elements.sineLengthUnits.value;

    if (!Number.isFinite(angleDeg) || angleDeg < 0 || angleDeg >= 90) {
        alert('Enter a valid angle between 0 and less than 90 degrees.');
        return null;
    }

    if (!Number.isFinite(lengthValue) || lengthValue <= 0) {
        alert('Enter a valid sine bar length greater than zero.');
        return null;
    }

    const heightValue = lengthValue * Math.sin((angleDeg * Math.PI) / 180);
    const heightInches = convertToInches(heightValue, lengthUnits);

    return {
        angleDeg,
        lengthValue,
        lengthUnits,
        heightValue,
        heightInches
    };
}

function renderSineResults(sineValues) {
    elements.sineResults.style.display = 'grid';
    elements.resultSineAngle.textContent = `${sineValues.angleDeg.toFixed(4)}°`;
    elements.resultSineLength.textContent = formatValueInBothUnits(
        convertToInches(sineValues.lengthValue, sineValues.lengthUnits),
        sineValues.lengthUnits,
        sineValues.lengthValue
    );
    elements.resultSineHeight.textContent = `${formatByUnits(sineValues.heightValue, sineValues.lengthUnits)} (${formatOppositeUnits(sineValues.heightInches, sineValues.lengthUnits)})`;
}

function handleReset() {
    elements.targetDimension.value = '';
    elements.targetUnits.value = 'inch';
    elements.gageBlockSet.value = 'standard';
    elements.customSetUnits.value = 'inch';
    elements.customBlocks.value = '';
    elements.maxBlocks.value = '9';
    elements.sineAngle.value = '';
    elements.sineLength.value = '';
    elements.sineLengthUnits.value = 'inch';
    elements.resultsSection.style.display = 'none';
    elements.sineResults.style.display = 'none';
    elements.stackList.innerHTML = '';
    toggleCustomSet();
}

function getSelectedBlocksInches() {
    if (elements.gageBlockSet.value !== 'custom') {
        return blockSets[elements.gageBlockSet.value] || [];
    }

    const customUnits = elements.customSetUnits.value;
    const parsed = elements.customBlocks.value
        .split(',')
        .map(item => Number.parseFloat(item.trim()))
        .filter(value => Number.isFinite(value) && value > 0)
        .map(value => convertToInches(value, customUnits))
        .map(roundToFour);

    return [...new Set(parsed)].sort((a, b) => a - b);
}

function findBestSolution(blocksInches, targetInches, maxBlocks) {
    const sortedUnits = [...blocksInches].map(toUnits).sort((a, b) => b - a);
    const targetUnits = toUnits(targetInches);
    const maxTotalUnits = toUnits(targetInches + 0.5);
    const prefixSums = [0];

    for (let i = 0; i < sortedUnits.length; i += 1) {
        prefixSums.push(prefixSums[i] + sortedUnits[i]);
    }

    const startTime = nowMs();
    let nodeCount = 0;
    let best = null;

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
        if (nodeCount % 2048 === 0 && shouldStop()) {
            return;
        }

        if (currentStack.length > 0) {
            const errorUnits = Math.abs(targetUnits - totalUnits);
            updateBest(currentStack, totalUnits, errorUnits);
            if (errorUnits === 0) {
                return;
            }
        }

        if (currentStack.length >= maxBlocks || startIndex >= sortedUnits.length) {
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

            if (best && nextTotal > targetUnits && nextTotal - targetUnits >= best.errorUnits) {
                continue;
            }

            currentStack.push(sortedUnits[i]);
            search(i + 1, currentStack, nextTotal);
            currentStack.pop();
        }
    }

    search(0, [], 0);

    if (!best) {
        return null;
    }

    return {
        stackInches: best.stackUnits.map(fromUnits),
        totalInches: fromUnits(best.totalUnits),
        errorInches: fromUnits(best.errorUnits)
    };
}

function getMaxAdditionalTotal(prefixSums, totalLength, startIndex, remainingSlots) {
    if (remainingSlots <= 0 || startIndex >= totalLength) {
        return 0;
    }

    const endExclusive = Math.min(totalLength, startIndex + remainingSlots);
    return prefixSums[endExclusive] - prefixSums[startIndex];
}

function renderResults(inputTarget, targetUnits, solution) {
    elements.resultsSection.style.display = 'block';

    const inputTargetInches = convertToInches(inputTarget, targetUnits);
    elements.resultTarget.textContent = `${formatByUnits(inputTarget, targetUnits)} (${formatOppositeUnits(inputTargetInches, targetUnits)})`;
    elements.resultTotal.textContent = `${formatByUnits(convertFromInches(solution.totalInches, targetUnits), targetUnits)} (${formatOppositeUnits(solution.totalInches, targetUnits)})`;
    elements.resultError.textContent = `${formatByUnits(convertFromInches(solution.errorInches, targetUnits), targetUnits)} (${formatOppositeUnits(solution.errorInches, targetUnits)})`;
    elements.resultError.style.color = solution.errorInches <= 0.0001 ? '#0d8f49' : '#c64c00';

    elements.stackList.innerHTML = '';
    solution.stackInches.forEach(blockInches => {
        const blockElement = document.createElement('div');
        blockElement.className = 'block-item';
        blockElement.innerHTML = `
            <div class="size">${formatInches(blockInches)}</div>
            <div class="unit">${formatMillimeters(inchesToMm(blockInches))}</div>
        `;
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

function convertToInches(value, units) {
    return units === 'mm' ? value / MM_PER_INCH : value;
}

function convertFromInches(inches, units) {
    return units === 'mm' ? inchesToMm(inches) : inches;
}

function mmToInches(mm) {
    return mm / MM_PER_INCH;
}

function inchesToMm(inches) {
    return inches * MM_PER_INCH;
}

function formatInches(value) {
    return `${value.toFixed(4)}\"`;
}

function formatMillimeters(value) {
    return `${value.toFixed(3)} mm`;
}

function formatByUnits(value, units) {
    return units === 'mm' ? formatMillimeters(value) : formatInches(value);
}

function formatOppositeUnits(inches, preferredUnits) {
    return preferredUnits === 'mm' ? formatInches(inches) : formatMillimeters(inchesToMm(inches));
}

function formatValueInBothUnits(inches, units, enteredValue) {
    return `${formatByUnits(enteredValue, units)} (${formatOppositeUnits(inches, units)})`;
}

function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }

    return Date.now();
}
