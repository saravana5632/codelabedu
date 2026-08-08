const fs = require('fs');
const path = 'src/controllers/student.ts';
let code = fs.readFileSync(path, 'utf8');

const validateAlgoFunction = `
function validateAlgorithm(code: string, questionTitle: string) {
    const normalized = code.replace(/\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\//g, '').toLowerCase();
    
    if (/arrays\\.sort|collections\\.sort|\\.sort\\(|\\bqsort\\(|\\bsorted\\(/i.test(normalized)) {
        return { isValid: false, detected: "Built-in Sort", required: questionTitle };
    }

    const titleLower = questionTitle.toLowerCase();
    
    const hasMergeWord = /merge/.test(normalized);
    const hasPivotWord = /pivot|partition/.test(normalized);
    
    const hasRecursion = /([a-z0-9_]+)\\s*\\([^)]*\\)[\\s\\S]*?\\1\\s*\\(/i.test(normalized);
    const hasMidCalc = /\\+\\s*[a-z0-9_]+\\s*\\)\\s*\\/\\s*2|>>\\s*1/.test(normalized) || /mid/.test(normalized);
    const hasSwap = /=\\s*[a-z0-9_\\[\\]]+\\s*;\\s*[a-z0-9_\\[\\]]+\\s*=\\s*[a-z0-9_\\[\\]]+\\s*;\\s*[a-z0-9_\\[\\]]+\\s*=/i.test(normalized) || /swap/.test(normalized) || /\\[[a-z0-9_]+\\],\\s*\\[[a-z0-9_]+\\]\\s*=\\s*\\[[a-z0-9_]+\\],\\s*\\[[a-z0-9_]+\\]/.test(normalized);
    const hasTwoPointerMergeLoop = /while\\s*\\([^)]+(<|<=)[^)]+(&&|and)[^)]+(<|<=)[^)]+\\)/.test(normalized) || /while\\s*[a-z0-9_]+\\s*<\\s*[a-z0-9_]+\\s*and\\s*[a-z0-9_]+\\s*<\\s*[a-z0-9_]+/.test(normalized);

    let detected = "Unknown";
    
    if (hasPivotWord || (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)) {
        detected = "Quick Sort";
    } else if (hasMergeWord || (hasRecursion && hasMidCalc && hasTwoPointerMergeLoop) || hasTwoPointerMergeLoop) {
        detected = "Merge Sort";
    } else if (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop) {
        detected = "Binary Search";
    }

    if (titleLower.includes("merge sort")) {
        if (detected === "Merge Sort" || (hasTwoPointerMergeLoop && !hasPivotWord)) {
             return { isValid: true, detected: "Merge Sort", required: "Merge Sort" };
        }
        return { isValid: false, detected: detected, required: "Merge Sort" };
    }

    if (titleLower.includes("quick sort")) {
        if (detected === "Quick Sort" || (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)) {
             return { isValid: true, detected: "Quick Sort", required: "Quick Sort" };
        }
        return { isValid: false, detected: detected, required: "Quick Sort" };
    }

    if (titleLower.includes("binary search")) {
        if (detected === "Binary Search" || (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop)) {
             return { isValid: true, detected: "Binary Search", required: "Binary Search" };
        }
        return { isValid: false, detected: detected, required: "Binary Search" };
    }

    return { isValid: true, detected: "Unknown", required: "Unknown" };
}
`;

// Insert it at the top of the file, after imports
const topRegex = /import axios from "axios";/;
code = code.replace(topRegex, 'import axios from "axios";\n' + validateAlgoFunction);

fs.writeFileSync(path, code);
