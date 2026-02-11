// JavaScript Calculator Logic

function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    if (b !== 0) {
        return a / b;
    } else {
        throw new Error('Cannot divide by zero');
    }
}

// Example of usage
// console.log(add(5, 3)); // 8
// console.log(subtract(5, 3)); // 2
// console.log(multiply(5, 3)); // 15
// console.log(divide(5, 3)); // 1.66667
