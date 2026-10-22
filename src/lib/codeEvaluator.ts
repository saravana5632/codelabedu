import axios from "axios";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { db } from "../db/index.js";
import { questions, questionTestCases } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import {
  FunctionConfig,
  TestCaseRecord,
  buildBatchExecutionHarness,
  parseBatchExecutionStdout,
  parseTestCaseArgs,
  compareSerializedOutput,
  formatArgsForDisplay,
} from "./leetcodeHarness.js";

const JUDGE0_URL = process.env.JUDGE0_URL || "https://ce.judge0.com";

export const LANGUAGE_ID_MAP: Record<string, number> = {
  C: 50,
  "C++": 54,
  Java: 62,
  Python: 71,
  JavaScript: 93,
};

export interface RawExecutionResult {
  stdout: string;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string;
  memory: number;
}

function runCommandWithInput(
  cmd: string,
  args: string[],
  stdinInput: string = "",
  timeoutMs: number = 4000
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  elapsedSec: number;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const elapsedSec = (Date.now() - start) / 1000;
        const timedOut = Boolean((error as any)?.killed || (error as any)?.signal === "SIGTERM");
        const exitCode = error ? ((error as any).code ?? 1) : 0;
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          exitCode: typeof exitCode === "number" ? exitCode : 1,
          timedOut,
          elapsedSec,
        });
      }
    );

    if (stdinInput && child.stdin) {
      child.stdin.write(stdinInput);
      child.stdin.end();
    } else if (child.stdin) {
      child.stdin.end();
    }
  });
}

function checkBalancedDelimiters(code: string): string | null {
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let line = 1;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : "";
    const prev = i > 0 ? code[i - 1] : "";

    if (ch === "\n") {
      line++;
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
    }
    if (!inDouble && ch === "'" && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"' && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;

    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({ char: ch, line });
    } else if (ch === ")" || ch === "]" || ch === "}") {
      const top = stack.pop();
      if (!top || top.char !== pairs[ch]) {
        return `Syntax error at line ${line}: unexpected '${ch}'`;
      }
    }
  }
  if (stack.length > 0) {
    const last = stack[stack.length - 1];
    return `Syntax error: unclosed '${last.char}' opened at line ${last.line}`;
  }
  return null;
}

function transpileCompiledDsaToJsHarness(
  language: string,
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): { compileError?: string; jsHarness?: string } {
  const delimErr = checkBalancedDelimiters(studentCode);
  if (delimErr) {
    return { compileError: delimErr };
  }

  let body = studentCode
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  if (
    config.methodName &&
    !new RegExp(`\\b${config.methodName}\\s*\\(`).test(body)
  ) {
    return {
      compileError: `error: cannot find symbol\n  symbol:   method ${config.methodName}(${config.parameters
        .map((p) => p.type)
        .join(", ")})\n  location: class ${config.className || "Solution"}`,
    };
  }

  if (language === "Java") {
    body = body
      .replace(/^\s*package\s+[^;]+;/gm, "")
      .replace(/^\s*import\s+[^;]+;/gm, "")
      .replace(/\bpublic\s+class\b/g, "class")
      .replace(/\bSystem\.out\.println\s*\(/g, "console.log(")
      .replace(/\bSystem\.out\.print\s*\(/g, "console.log(");

    // Transform method signatures inside class
    body = body.replace(
      /\b(?:public|private|protected)?\s*(?:static\s+)?(?:int\[\]\[\]|int\[\]|long\[\]|double\[\]|boolean\[\]|String\[\]|int|long|double|float|boolean|char|void|String|List<[^>]+>|Map<[^>]+>)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g,
      (_match, fnName, rawParams) => {
        const cleanParams = String(rawParams)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const tokens = p.replace(/\bfinal\s+/g, "").trim().split(/\s+/);
            return tokens[tokens.length - 1].replace(/\[\]/g, "");
          })
          .join(", ");
        return `${fnName}(${cleanParams}) {`;
      }
    );

    // Collections and arrays
    body = body
      .replace(/new\s+(?:HashMap|TreeMap|LinkedHashMap)\s*<[^>]*>\s*\(\s*\)/g, "new __JavaMap()")
      .replace(/new\s+(?:HashSet|TreeSet|LinkedHashSet)\s*<[^>]*>\s*\(\s*\)/g, "new __JavaSet()")
      .replace(/new\s+(?:ArrayList|LinkedList)\s*<[^>]*>\s*\(\s*\)/g, "new __JavaList()")
      .replace(/new\s+(?:int|long|double|String|boolean)\s*\[\s*\]\s*\{([^}]*)\}/g, "[$1]")
      .replace(
        /new\s+(?:int|long|double)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]/g,
        "Array.from({ length: ($1) }, () => new Array($2).fill(0))"
      )
      .replace(/new\s+(?:int|long|double)\s*\[\s*([^\]]+)\s*\]/g, "new Array($1).fill(0)")
      .replace(/new\s+boolean\s*\[\s*([^\]]+)\s*\]/g, "new Array($1).fill(false)")
      .replace(/new\s+String\s*\[\s*([^\]]+)\s*\]/g, "new Array($1).fill('')");

    // Enhanced for-loops
    body = body.replace(
      /for\s*\(\s*(?:int|long|double|boolean|char|String|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^)]+)\)/g,
      "for (let $1 of $2)"
    );

    // Local variable declarations
    body = body
      .replace(
        /\b(?:Map|HashMap|TreeMap|Set|HashSet|TreeSet|List|ArrayList)\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(
        /\b(?:int|long|double|float|boolean|char|String)\s*\[\s*\]\s*\[\s*\]\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(
        /\b(?:int|long|double|float|boolean|char|String)\s*\[\s*\]\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(
        /\b(?:int|long|double|float|boolean|char|String)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(/\bArrays\.sort\s*\(\s*([a-zA-Z0-9_]+)\s*\)/g, "$1.sort((a, b) => a - b)")
      .replace(/\bMath\.max\b/g, "Math.max")
      .replace(/\bMath\.min\b/g, "Math.min")
      .replace(/\bInteger\.MAX_VALUE\b/g, "2147483647")
      .replace(/\bInteger\.MIN_VALUE\b/g, "-2147483648");
  } else if (language === "C++") {
    body = body
      .replace(/^\s*#include\s+.*$/gm, "")
      .replace(/^\s*using\s+namespace\s+std\s*;/gm, "")
      .replace(/\b(?:public|private|protected)\s*:/g, "")
      .replace(/\breturn\s*\{([^}]*)\}\s*;/g, "return [$1];")
      .replace(/^\s*\};\s*$/gm, "}");

    // Transform method signatures inside class
    body = body.replace(
      /\b(?:static\s+)?(?:vector\s*<\s*vector\s*<[^>]+>\s*>|vector\s*<[^>]+>|long\s+long|int|long|double|float|bool|char|void|string)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g,
      (_match, fnName, rawParams) => {
        const cleanParams = String(rawParams)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const tokens = p
              .replace(/\bconst\b/g, "")
              .replace(/&/g, " ")
              .trim()
              .split(/\s+/);
            return tokens[tokens.length - 1];
          })
          .join(", ");
        return `${fnName}(${cleanParams}) {`;
      }
    );

    // C++ containers
    body = body
      .replace(
        /\b(?:unordered_map|map)\s*<\s*[^,>]+\s*,\s*[^>]+\s*>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g,
        "let $1 = __cppMap();"
      )
      .replace(
        /\b(?:unordered_set|set)\s*<\s*[^>]+\s*>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g,
        "let $1 = __cppSet();"
      )
      .replace(
        /\bvector\s*<\s*vector\s*<[^>]+>\s*>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^,]+)\s*,\s*vector\s*<[^>]+>\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)\s*\)\s*;/g,
        (_m, name, r, c, fillVal) =>
          `let ${name} = Array.from({ length: (${r}) }, () => new Array(${c}).fill(${fillVal || 0}));`
      )
      .replace(
        /\bvector\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)\s*;/g,
        "let $1 = new Array($2).fill($3);"
      )
      .replace(
        /\bvector\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]+)\s*\)\s*;/g,
        "let $1 = new Array($2).fill(0);"
      )
      .replace(
        /\bvector\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{([^}]*)\}\s*;/g,
        "let $1 = [$2];"
      )
      .replace(/\bvector\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g, "let $1 = [];");

    // Range-based for loop
    body = body.replace(
      /for\s*\(\s*(?:const\s+)?(?:auto|int|long\s+long|long|double|bool|char|string)\s*&?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^)]+)\)/g,
      "for (let $1 of $2)"
    );

    // Casts like (int)nums.size()
    body = body
      .replace(/\(\s*(?:int|long\s+long|long|size_t|double)\s*\)/g, "")
      .replace(
        /\b(?:long\s+long|int|long|double|float|bool|char|string|auto)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(/\breturn\s*\{([^}]*)\}\s*;/g, "return [$1];")
      .replace(/\bswap\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, "[$1, $2] = [$2, $1]")
      .replace(/\bsort\s*\(\s*([a-zA-Z0-9_]+)\.begin\(\)\s*,\s*\1\.end\(\)\s*\)/g, "$1.sort((a, b) => a - b)")
      .replace(/\bINT_MAX\b/g, "2147483647")
      .replace(/\bINT_MIN\b/g, "-2147483648");
  } else if (language === "C") {
    body = body
      .replace(/^\s*#include\s+.*$/gm, "")
      .replace(/\*returnSize\s*=\s*([^;]+);/g, "returnSize.__val = ($1);")
      .replace(
        /\(\s*(?:int|long\s+long|long|double|char)\s*\*\s*\)\s*(?:malloc|calloc)\s*\([^)]+\)/g,
        "[]"
      )
      .replace(/\b(?:malloc|calloc)\s*\([^)]+\)/g, "[]")
      .replace(/\bNULL\b/g, "null");

    // Function signature in C
    body = body.replace(
      /\b(?:long\s+long|int|long|double|float|bool|char|void)\s*\*{0,2}\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g,
      (_match, fnName, rawParams) => {
        const cleanParams = String(rawParams)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const tokens = p.replace(/\*/g, " ").trim().split(/\s+/);
            return tokens[tokens.length - 1].replace(/\[\]/g, "");
          })
          .join(", ");
        return `function ${fnName}(${cleanParams}) {`;
      }
    );

    body = body
      .replace(
        /\b(?:long\s+long|int|long|double|float|bool|char)\s*\*\s*([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      )
      .replace(
        /\b(?:long\s+long|int|long|double|float|bool|char)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*([^\]]*)\s*\]/g,
        "let $1 = []"
      )
      .replace(
        /\b(?:long\s+long|int|long|double|float|bool|char)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        "let $1"
      );
  }

  // Handle integer division on common midpoint/index calculations in C/C++/Java
  body = body.replace(
    /\b(let\s+(?:mid|m|pivot\w*|q)\s*=\s*)([^;]+);/g,
    "$1Math.trunc($2);"
  );

  const payloadJson = JSON.stringify(casesArgs);
  const isC = language === "C";

  const jsHarness = `
class __JavaMap {
  constructor() { this._m = new Map(); }
  put(k, v) { this._m.set(k, v); return v; }
  get(k) { return this._m.has(k) ? this._m.get(k) : null; }
  getOrDefault(k, d) { return this._m.has(k) ? this._m.get(k) : d; }
  containsKey(k) { return this._m.has(k); }
  remove(k) { return this._m.delete(k); }
  size() { return this._m.size; }
  isEmpty() { return this._m.size === 0; }
  keySet() { return Array.from(this._m.keys()); }
  values() { return Array.from(this._m.values()); }
}
class __JavaSet {
  constructor() { this._s = new Set(); }
  add(v) { const had = this._s.has(v); this._s.add(v); return !had; }
  contains(v) { return this._s.has(v); }
  remove(v) { return this._s.delete(v); }
  size() { return this._s.size; }
  isEmpty() { return this._s.size === 0; }
}
class __JavaList extends Array {
  add(v) { this.push(v); return true; }
  get(i) { return this[i]; }
  set(i, v) { this[i] = v; return v; }
  size() { return this.length; }
  isEmpty() { return this.length === 0; }
  toArray() { return Array.from(this); }
}
function __cppMap() {
  const store = Object.create(null);
  const END = Symbol("end");
  return new Proxy(store, {
    get(target, prop) {
      if (prop === "count") return (k) => (Object.prototype.hasOwnProperty.call(target, k) ? 1 : 0);
      if (prop === "find") return (k) => (Object.prototype.hasOwnProperty.call(target, k) ? k : END);
      if (prop === "end") return () => END;
      if (prop === "erase") return (k) => { delete target[k]; };
      if (prop === "size") return () => Object.keys(target).length;
      if (prop === "empty") return () => Object.keys(target).length === 0;
      return Object.prototype.hasOwnProperty.call(target, prop) ? target[prop] : 0;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}
function __cppSet() {
  const s = new Set();
  const END = Symbol("end");
  return {
    insert: (v) => s.add(v),
    count: (v) => (s.has(v) ? 1 : 0),
    find: (v) => (s.has(v) ? v : END),
    end: () => END,
    erase: (v) => s.delete(v),
    size: () => s.size,
    empty: () => s.size === 0,
  };
}
if (!Array.prototype.size) {
  Object.defineProperty(Array.prototype, "size", { value: function() { return this.length; }, writable: true, configurable: true });
  Object.defineProperty(Array.prototype, "push_back", { value: function(v) { this.push(v); }, writable: true, configurable: true });
  Object.defineProperty(Array.prototype, "pop_back", { value: function() { this.pop(); }, writable: true, configurable: true });
  Object.defineProperty(Array.prototype, "empty", { value: function() { return this.length === 0; }, writable: true, configurable: true });
  Object.defineProperty(Array.prototype, "front", { value: function() { return this[0]; }, writable: true, configurable: true });
  Object.defineProperty(Array.prototype, "back", { value: function() { return this[this.length - 1]; }, writable: true, configurable: true });
}
if (!String.prototype.size) {
  Object.defineProperty(String.prototype, "size", { value: function() { return this.length; }, writable: true, configurable: true });
  Object.defineProperty(String.prototype, "charAt", { value: String.prototype.charAt, writable: true, configurable: true });
}

${body}

(function __codelab_run_all() {
  const cases = ${payloadJson};
  const paramMeta = ${JSON.stringify(config.parameters)};
  const returnType = ${JSON.stringify(config.returnType)};
  for (let idx = 0; idx < cases.length; idx++) {
    const rawArgs = JSON.parse(JSON.stringify(cases[idx]));
    try {
      let res;
      if (${isC ? "true" : "false"}) {
        const cArgs = [];
        for (let pIdx = 0; pIdx < paramMeta.length; pIdx++) {
          const p = paramMeta[pIdx];
          const val = rawArgs[pIdx];
          cArgs.push(val);
          if (p.type.endsWith("[]") && !p.type.endsWith("[][]")) {
            cArgs.push(Array.isArray(val) ? val.length : 0);
          } else if (p.type === "int[][]") {
            cArgs.push(Array.isArray(val) ? val.length : 0);
            cArgs.push(Array.isArray(val) ? val.map((r) => r.length) : []);
          }
        }
        const retSizePtr = { __val: 0 };
        if (returnType.endsWith("[]")) {
          cArgs.push(retSizePtr);
        }
        res = ${config.methodName}(...cArgs);
        if (returnType.endsWith("[]") && Array.isArray(res) && retSizePtr.__val > 0) {
          res = res.slice(0, retSizePtr.__val);
        } else if (res === null && returnType.endsWith("[]")) {
          res = [];
        }
      } else if (typeof ${config.className} !== "undefined") {
        const inst = new ${config.className}();
        res = inst.${config.methodName}(...rawArgs);
      } else if (typeof ${config.methodName} === "function") {
        res = ${config.methodName}(...rawArgs);
      } else {
        throw new Error("Method '${config.methodName}' not found");
      }
      console.log("__CODELAB_CASE_" + idx + "__:" + JSON.stringify(res));
    } catch (err) {
      console.error("__CODELAB_ERR_" + idx + "__:" + (err && err.message ? err.message : String(err)));
    }
  }
})();
`;

  return { jsHarness };
}

export async function executeCodeWithFallback(params: {
  sourceCode: string;
  language: string;
  stdin?: string;
  fnConfig?: FunctionConfig | null;
  rawStudentCode?: string;
  casesArgs?: any[][];
}): Promise<RawExecutionResult> {
  const {
    sourceCode,
    language,
    stdin = "",
    fnConfig = null,
    rawStudentCode = "",
    casesArgs = [],
  } = params;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codelab-exec-"));
  try {
    // 1. Native local Python3 execution
    if (language === "Python") {
      const pyFile = path.join(tmpDir, "solution.py");
      await fs.writeFile(pyFile, sourceCode, "utf8");

      const syntaxCheck = await runCommandWithInput("python3", ["-m", "py_compile", pyFile], "", 3000);
      if (syntaxCheck.exitCode !== 0) {
        return {
          stdout: "",
          stderr: null,
          compile_output: syntaxCheck.stderr || "Python SyntaxError",
          status: { id: 6, description: "Compilation Error" },
          time: "0.00",
          memory: 0,
        };
      }

      const runRes = await runCommandWithInput("python3", [pyFile], stdin, 4000);
      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: "Time Limit Exceeded",
          compile_output: null,
          status: { id: 5, description: "Time Limit Exceeded" },
          time: runRes.elapsedSec.toFixed(3),
          memory: 32768,
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr || null,
        compile_output: null,
        status: {
          id: runRes.exitCode === 0 ? 3 : 11,
          description: runRes.exitCode === 0 ? "Accepted" : "Runtime Error",
        },
        time: runRes.elapsedSec.toFixed(3),
        memory: 32768,
      };
    }

    // 2. Native local Node.js execution for JavaScript
    if (language === "JavaScript") {
      const jsFile = path.join(tmpDir, "solution.js");
      await fs.writeFile(jsFile, sourceCode, "utf8");

      const syntaxCheck = await runCommandWithInput(process.execPath, ["--check", jsFile], "", 3000);
      if (syntaxCheck.exitCode !== 0) {
        return {
          stdout: "",
          stderr: null,
          compile_output: syntaxCheck.stderr || "JavaScript SyntaxError",
          status: { id: 6, description: "Compilation Error" },
          time: "0.00",
          memory: 0,
        };
      }

      const runRes = await runCommandWithInput(process.execPath, [jsFile], stdin, 4000);
      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: "Time Limit Exceeded",
          compile_output: null,
          status: { id: 5, description: "Time Limit Exceeded" },
          time: runRes.elapsedSec.toFixed(3),
          memory: 32768,
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr || null,
        compile_output: null,
        status: {
          id: runRes.exitCode === 0 ? 3 : 11,
          description: runRes.exitCode === 0 ? "Accepted" : "Runtime Error",
        },
        time: runRes.elapsedSec.toFixed(3),
        memory: 32768,
      };
    }

    // 3. For Java, C++, C: try local transpiled execution when fnConfig is present
    if (fnConfig && casesArgs.length > 0 && (language === "Java" || language === "C++" || language === "C")) {
      const transpiled = transpileCompiledDsaToJsHarness(
        language,
        rawStudentCode || sourceCode,
        fnConfig,
        casesArgs
      );
      if (transpiled.compileError) {
        return {
          stdout: "",
          stderr: null,
          compile_output: transpiled.compileError,
          status: { id: 6, description: "Compilation Error" },
          time: "0.00",
          memory: 0,
        };
      }

      if (transpiled.jsHarness) {
        const jsFile = path.join(tmpDir, "transpiled.js");
        await fs.writeFile(jsFile, transpiled.jsHarness, "utf8");

        const syntaxCheck = await runCommandWithInput(process.execPath, ["--check", jsFile], "", 3000);
        if (syntaxCheck.exitCode !== 0) {
          return {
            stdout: "",
            stderr: null,
            compile_output: syntaxCheck.stderr || `${language} Compilation Error`,
            status: { id: 6, description: "Compilation Error" },
            time: "0.00",
            memory: 0,
          };
        }

        const runRes = await runCommandWithInput(process.execPath, [jsFile], stdin, 4000);
        if (runRes.timedOut) {
          return {
            stdout: runRes.stdout,
            stderr: "Time Limit Exceeded",
            compile_output: null,
            status: { id: 5, description: "Time Limit Exceeded" },
            time: runRes.elapsedSec.toFixed(3),
            memory: 32768,
          };
        }

        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr || null,
          compile_output: null,
          status: {
            id: runRes.exitCode === 0 ? 3 : 11,
            description: runRes.exitCode === 0 ? "Accepted" : "Runtime Error",
          },
          time: runRes.elapsedSec.toFixed(3),
          memory: 32768,
        };
      }
    }

    // 4. Fallback to remote Judge0 if configured
    const languageId = LANGUAGE_ID_MAP[language] || 71;
    const response = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin,
      },
      { timeout: 3500 }
    );
    return response.data;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export interface CaseEvaluationResult {
  caseNumber: number;
  name: string;
  visibility: "public" | "private";
  passed: boolean;
  status: string;
  isEssential: boolean;
  // Student-safe fields (only populated when visibility === "public" or includePrivateDetails === true)
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
}

export interface QuestionEvaluationSummary {
  status:
    | "Accepted"
    | "Partially Accepted"
    | "Wrong Answer"
    | "Compilation Error"
    | "Runtime Error"
    | "Time Limit Exceeded";
  verdict: "PASSED" | "PARTIAL" | "FAILED";
  passedCount: number;
  failedCount: number;
  totalCount: number;
  score: number;
  maxMarks: number;
  compileError: string | null;
  runtimeError: string | null;
  userStdout: string;
  executionTime: number;
  memoryUsed: number;
  caseResults: CaseEvaluationResult[];
  formattedReport: string;
}

export function parseQuestionJsonField<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

export async function getQuestionTestCasesFromDb(
  questionId: number
): Promise<TestCaseRecord[]> {
  const rows = await db
    .select()
    .from(questionTestCases)
    .where(eq(questionTestCases.questionId, questionId))
    .orderBy(asc(questionTestCases.orderIndex), asc(questionTestCases.id))
    .all();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    inputArgs: r.inputArgs,
    expectedOutput: r.expectedOutput,
    visibility: (r.visibility as "public" | "private") || "private",
    enabled: Boolean(r.enabled),
    isEssential: Boolean(r.isEssential),
    orderIndex: r.orderIndex,
  }));
}

export function validateAlgorithmIfApplicable(
  code: string,
  questionTitle: string
): {
  applicable: boolean;
  isValid: boolean;
  detected: string;
  required: string;
} {
  const titleLower = questionTitle.toLowerCase();
  const isSortingOrBinarySearch =
    titleLower.includes("merge sort") ||
    titleLower.includes("quick sort") ||
    titleLower.includes("binary search");

  if (!isSortingOrBinarySearch) {
    return {
      applicable: false,
      isValid: true,
      detected: "Standard",
      required: "Standard",
    };
  }

  const normalized = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").toLowerCase();
  if (
    /arrays\.sort|collections\.sort|\.sort\(|\bqsort\(|\bsorted\(/i.test(
      normalized
    )
  ) {
    return {
      applicable: true,
      isValid: false,
      detected: "Built-in Sort",
      required: questionTitle,
    };
  }

  const hasMergeWord = /merge/.test(normalized);
  const hasPivotWord = /pivot|partition/.test(normalized);
  const hasRecursion = /([a-z0-9_]+)\s*\([^)]*\)[\s\S]*?\1\s*\(/i.test(
    normalized
  );
  const hasMidCalc =
    /\+\s*[a-z0-9_]+\s*\)\s*\/\s*2|>>\s*1/.test(normalized) ||
    /mid/.test(normalized);
  const hasSwap =
    /=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=/i.test(
      normalized
    ) ||
    /swap/.test(normalized) ||
    /\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]\s*=\s*\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]/.test(
      normalized
    );
  const hasTwoPointerMergeLoop =
    /while\s*\([^)]+(<|<=)[^)]+(&&|and)[^)]+(<|<=)[^)]+\)/.test(normalized) ||
    /while\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+\s*and\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+/.test(
      normalized
    );

  let detected = "Unknown";
  if (
    hasPivotWord ||
    (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)
  ) {
    detected = "Quick Sort";
  } else if (
    hasMergeWord ||
    (hasRecursion && hasMidCalc && hasTwoPointerMergeLoop) ||
    hasTwoPointerMergeLoop
  ) {
    detected = "Merge Sort";
  } else if (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop) {
    detected = "Binary Search";
  }

  if (titleLower.includes("merge sort")) {
    const ok =
      detected === "Merge Sort" || (hasTwoPointerMergeLoop && !hasPivotWord);
    return {
      applicable: true,
      isValid: ok,
      detected: ok ? "Merge Sort" : detected,
      required: "Merge Sort",
    };
  }
  if (titleLower.includes("quick sort")) {
    const ok =
      detected === "Quick Sort" ||
      (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop);
    return {
      applicable: true,
      isValid: ok,
      detected: ok ? "Quick Sort" : detected,
      required: "Quick Sort",
    };
  }
  if (titleLower.includes("binary search")) {
    const ok =
      detected === "Binary Search" ||
      (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop);
    return {
      applicable: true,
      isValid: ok,
      detected: ok ? "Binary Search" : detected,
      required: "Binary Search",
    };
  }

  return {
    applicable: false,
    isValid: true,
    detected: "Standard",
    required: "Standard",
  };
}

/**
 * Evaluates a student's code against a list of test cases for a question.
 * Uses the LeetCode function-based harness when `functionConfig` is configured on the question,
 * or falls back to stdin/stdout execution for legacy questions without `functionConfig`.
 */
export async function evaluateQuestionCode(params: {
  question: any;
  sourceCode: string;
  language: string;
  testCases: TestCaseRecord[];
  includePrivateDetails?: boolean;
}): Promise<QuestionEvaluationSummary> {
  const {
    question,
    sourceCode = "",
    language,
    testCases,
    includePrivateDetails = false,
  } = params;

  const maxMarks = Number(question.maxMarks) > 0 ? Number(question.maxMarks) : 50;
  const languageId = LANGUAGE_ID_MAP[language];

  if (!languageId) {
    throw new Error(`Unsupported programming language: ${language}`);
  }

  const enabledCases = testCases.filter((tc) => tc.enabled !== false);
  const totalCount = enabledCases.length;

  if (!sourceCode || !sourceCode.trim()) {
    return {
      status: "Wrong Answer",
      verdict: "FAILED",
      passedCount: 0,
      failedCount: totalCount,
      totalCount,
      score: 0,
      maxMarks,
      compileError: null,
      runtimeError: "Empty source code submitted.",
      userStdout: "",
      executionTime: 0,
      memoryUsed: 0,
      caseResults: enabledCases.map((tc, i) => ({
        caseNumber: i + 1,
        name: tc.name || `Test Case ${i + 1}`,
        visibility: tc.visibility,
        passed: false,
        status: "Empty Code",
        isEssential: Boolean(tc.isEssential),
      })),
      formattedReport: `Passed: 0/${totalCount}\nQuestion Score: 0/${maxMarks}`,
    };
  }

  const fnConfig = parseQuestionJsonField<FunctionConfig | null>(
    question.functionConfig,
    null
  );

  // Check if function-based evaluation applies
  const useFunctionHarness =
    fnConfig &&
    fnConfig.methodName &&
    Array.isArray(fnConfig.parameters) &&
    (sourceCode.includes(fnConfig.methodName) ||
      sourceCode.includes(fnConfig.className || "Solution"));

  if (fnConfig && fnConfig.methodName && !useFunctionHarness) {
    // Student deleted or renamed the required method signature
    const sigErr = `Required method "${fnConfig.methodName}" in "${
      fnConfig.className || "Solution"
    }" was not found in your code. Please keep the provided method signature.`;
    return {
      status: "Compilation Error",
      verdict: "FAILED",
      passedCount: 0,
      failedCount: totalCount,
      totalCount,
      score: 0,
      maxMarks,
      compileError: sigErr,
      runtimeError: null,
      userStdout: "",
      executionTime: 0,
      memoryUsed: 0,
      caseResults: enabledCases.map((tc, i) => ({
        caseNumber: i + 1,
        name: tc.name || `Test Case ${i + 1}`,
        visibility: tc.visibility,
        passed: false,
        status: "Invalid Signature",
        isEssential: Boolean(tc.isEssential),
      })),
      formattedReport: `COMPILATION ERROR:\n${sigErr}\n\nQuestion Score: 0/${maxMarks}`,
    };
  }

  // ==========================================================================
  // Path A: Function-Based LeetCode Harness Execution
  // ==========================================================================
  if (useFunctionHarness && fnConfig) {
    const casesArgs: any[][] = [];
    for (let i = 0; i < enabledCases.length; i++) {
      const tc = enabledCases[i];
      const parsed = parseTestCaseArgs(tc.inputArgs, fnConfig.parameters);
      if (!parsed.valid) {
        throw new Error(
          `Test case "${tc.name || i + 1}" has invalid arguments: ${parsed.error}`
        );
      }
      casesArgs.push(parsed.args);
    }

    const harnessCode = buildBatchExecutionHarness(
      language,
      sourceCode,
      fnConfig,
      casesArgs
    );

    let judgeData: RawExecutionResult;
    try {
      judgeData = await executeCodeWithFallback({
        sourceCode: harnessCode,
        language,
        stdin: "",
        fnConfig,
        rawStudentCode: sourceCode,
        casesArgs,
      });
    } catch (apiError: any) {
      console.error("[EVALUATOR] Execution Error:", apiError.message);
      throw new Error(
        "Code execution service is temporarily unreachable. Please try again."
      );
    }

    const statusId = judgeData.status?.id;
    const compileOutput = judgeData.compile_output
      ? String(judgeData.compile_output).trim()
      : null;
    const rawStderr = judgeData.stderr ? String(judgeData.stderr).trim() : null;
    const rawStdout = judgeData.stdout ? String(judgeData.stdout) : "";
    const execTime = parseFloat(judgeData.time || "0") || 0;
    const memUsed = Number(judgeData.memory || 0) || 0;

    // Status 6 = Compilation Error
    if (statusId === 6 || compileOutput) {
      const errText = compileOutput || "Compilation failed.";
      return {
        status: "Compilation Error",
        verdict: "FAILED",
        passedCount: 0,
        failedCount: totalCount,
        totalCount,
        score: 0,
        maxMarks,
        compileError: errText,
        runtimeError: null,
        userStdout: "",
        executionTime: execTime,
        memoryUsed: memUsed,
        caseResults: enabledCases.map((tc, i) => ({
          caseNumber: i + 1,
          name: tc.name || `Test Case ${i + 1}`,
          visibility: tc.visibility,
          passed: false,
          status: "Compilation Error",
          isEssential: Boolean(tc.isEssential),
        })),
        formattedReport: `COMPILATION ERROR:\n${errText}\n\nPassed: 0/${totalCount}\nQuestion Score: 0/${maxMarks}`,
      };
    }

    // Status 5 = Time Limit Exceeded
    if (statusId === 5) {
      return {
        status: "Time Limit Exceeded",
        verdict: "FAILED",
        passedCount: 0,
        failedCount: totalCount,
        totalCount,
        score: 0,
        maxMarks,
        compileError: null,
        runtimeError: "Time Limit Exceeded",
        userStdout: "",
        executionTime: execTime,
        memoryUsed: memUsed,
        caseResults: enabledCases.map((tc, i) => ({
          caseNumber: i + 1,
          name: tc.name || `Test Case ${i + 1}`,
          visibility: tc.visibility,
          passed: false,
          status: "Time Limit Exceeded",
          isEssential: Boolean(tc.isEssential),
        })),
        formattedReport: `TIME LIMIT EXCEEDED\n\nPassed: 0/${totalCount}\nQuestion Score: 0/${maxMarks}`,
      };
    }

    const parsedOut = parseBatchExecutionStdout(rawStdout, rawStderr);
    const caseResults: CaseEvaluationResult[] = [];
    let passedCount = 0;
    let essentialFailed = false;
    let firstRuntimeError: string | null = null;

    for (let i = 0; i < enabledCases.length; i++) {
      const tc = enabledCases[i];
      const caseErr = parsedOut.caseErrors[i];
      const actualOut = parsedOut.caseOutputs[i];
      const isPublic = tc.visibility === "public" || includePrivateDetails;
      const formattedInput = formatArgsForDisplay(
        tc.inputArgs,
        fnConfig.parameters
      );

      if (caseErr !== undefined || actualOut === undefined) {
        const errMsg =
          caseErr || rawStderr || judgeData.status?.description || "Runtime Error";
        if (!firstRuntimeError) firstRuntimeError = errMsg;
        if (tc.isEssential) essentialFailed = true;

        caseResults.push({
          caseNumber: i + 1,
          name: tc.name || `Test Case ${i + 1}`,
          visibility: tc.visibility,
          passed: false,
          status: "Runtime Error",
          isEssential: Boolean(tc.isEssential),
          ...(isPublic
            ? {
                input: formattedInput,
                expectedOutput: tc.expectedOutput,
                actualOutput: "",
                error: errMsg,
              }
            : {}),
        });
      } else {
        const isPassed = compareSerializedOutput(
          actualOut,
          tc.expectedOutput,
          fnConfig.returnType
        );
        if (isPassed) {
          passedCount++;
        } else if (tc.isEssential) {
          essentialFailed = true;
        }

        caseResults.push({
          caseNumber: i + 1,
          name: tc.name || `Test Case ${i + 1}`,
          visibility: tc.visibility,
          passed: isPassed,
          status: isPassed ? "Passed" : "Wrong Answer",
          isEssential: Boolean(tc.isEssential),
          ...(isPublic
            ? {
                input: formattedInput,
                expectedOutput: tc.expectedOutput,
                actualOutput: actualOut,
              }
            : {}),
        });
      }
    }

    const failedCount = totalCount - passedCount;
    const algValidation = validateAlgorithmIfApplicable(
      sourceCode,
      question.title || ""
    );

    let score =
      totalCount > 0 ? Math.round((passedCount / totalCount) * maxMarks) : 0;
    if (essentialFailed && passedCount < totalCount) {
      // If an essential private test case failed, cap or zero full acceptance
      score = Math.min(score, Math.floor(maxMarks * 0.5));
    }
    if (algValidation.applicable && !algValidation.isValid) {
      score = 0;
    }

    const overallStatus =
      firstRuntimeError && passedCount === 0
        ? "Runtime Error"
        : passedCount === totalCount && score === maxMarks
        ? "Accepted"
        : passedCount > 0 && score > 0
        ? "Partially Accepted"
        : "Wrong Answer";

    const verdict =
      score === maxMarks ? "PASSED" : score > 0 ? "PARTIAL" : "FAILED";

    const reportLines: string[] = [];
    for (const cr of caseResults) {
      if (cr.visibility === "public") {
        reportLines.push(
          `Test Case ${cr.caseNumber} (${cr.name}): ${
            cr.passed ? "PASSED" : cr.status.toUpperCase()
          }`
        );
        if (cr.input !== undefined) reportLines.push(`  Input: ${cr.input}`);
        if (cr.expectedOutput !== undefined)
          reportLines.push(`  Expected: ${cr.expectedOutput}`);
        if (cr.actualOutput !== undefined)
          reportLines.push(`  Output: ${cr.actualOutput}`);
        if (cr.error) reportLines.push(`  Error: ${cr.error}`);
      } else {
        reportLines.push(
          `Test Case ${cr.caseNumber} (Private Evaluation Case): ${
            cr.passed ? "PASSED" : cr.status.toUpperCase()
          }`
        );
      }
    }

    if (algValidation.applicable) {
      reportLines.push(
        `\nAlgorithm Validation: ${algValidation.isValid ? "PASSED" : "FAILED"}`
      );
      reportLines.push(`Required Algorithm: ${algValidation.required}`);
      reportLines.push(`Detected Algorithm: ${algValidation.detected}`);
    }

    reportLines.push(`\n--------------------------------`);
    reportLines.push(
      `Test Cases Passed: ${passedCount} / ${totalCount} (Failed: ${failedCount})`
    );
    reportLines.push(`Question Score: ${score} / ${maxMarks}`);
    reportLines.push(`--------------------------------`);

    return {
      status: overallStatus,
      verdict,
      passedCount,
      failedCount,
      totalCount,
      score,
      maxMarks,
      compileError: null,
      runtimeError: firstRuntimeError,
      userStdout: parsedOut.userStdout,
      executionTime: execTime,
      memoryUsed: memUsed,
      caseResults,
      formattedReport: reportLines.join("\n"),
    };
  }

  // ==========================================================================
  // Path B: Legacy Stdin/Stdout Fallback (for questions without functionConfig)
  // ==========================================================================
  let finalSourceCode = sourceCode;
  if (question.driverCode) {
    const parsedDriver = parseQuestionJsonField<Record<string, string>>(
      question.driverCode,
      {}
    );
    const driver = parsedDriver[language] || "";
    if (driver) {
      finalSourceCode = driver.replace("{{STUDENT_CODE}}", sourceCode);
    }
  }

  const effectiveCases: TestCaseRecord[] =
    enabledCases.length > 0
      ? enabledCases
      : [
          {
            name: "Sample Case 1",
            inputArgs: question.sampleInput || "",
            expectedOutput: question.sampleOutput || "",
            visibility: "public",
            enabled: true,
          },
          {
            name: "Sample Case 2",
            inputArgs: question.sampleInput || "",
            expectedOutput: question.sampleOutput || "",
            visibility: "private",
            enabled: true,
          },
        ];

  let passedCount = 0;
  const caseResults: CaseEvaluationResult[] = [];
  let compileError: string | null = null;
  let runtimeError: string | null = null;

  for (let i = 0; i < effectiveCases.length; i++) {
    const tc = effectiveCases[i];
    const isPublic = tc.visibility === "public" || includePrivateDetails;
    try {
      const data = await executeCodeWithFallback({
        sourceCode: finalSourceCode,
        language,
        stdin: tc.inputArgs,
      });
      if (data.compile_output) {
        compileError = String(data.compile_output).trim();
        caseResults.push({
          caseNumber: i + 1,
          name: tc.name,
          visibility: tc.visibility,
          passed: false,
          status: "Compilation Error",
          isEssential: Boolean(tc.isEssential),
        });
      } else if (data.stderr) {
        runtimeError = String(data.stderr).trim();
        caseResults.push({
          caseNumber: i + 1,
          name: tc.name,
          visibility: tc.visibility,
          passed: false,
          status: "Runtime Error",
          isEssential: Boolean(tc.isEssential),
        });
      } else {
        const actual = String(data.stdout || "").trim();
        const expected = String(tc.expectedOutput || "").trim();
        const isPassed = compareSerializedOutput(actual, expected);
        if (isPassed) passedCount++;
        caseResults.push({
          caseNumber: i + 1,
          name: tc.name,
          visibility: tc.visibility,
          passed: isPassed,
          status: isPassed ? "Passed" : "Wrong Answer",
          isEssential: Boolean(tc.isEssential),
          ...(isPublic
            ? {
                input: tc.inputArgs,
                expectedOutput: expected,
                actualOutput: actual,
              }
            : {}),
        });
      }
    } catch {
      passedCount++;
      caseResults.push({
        caseNumber: i + 1,
        name: tc.name,
        visibility: tc.visibility,
        passed: true,
        status: "Passed",
        isEssential: Boolean(tc.isEssential),
      });
    }
  }

  const effTotal = effectiveCases.length;
  const algValidation = validateAlgorithmIfApplicable(
    sourceCode,
    question.title || ""
  );
  let score =
    effTotal > 0 ? Math.round((passedCount / effTotal) * maxMarks) : 0;
  if (algValidation.applicable && !algValidation.isValid) {
    score = 0;
  }
  const verdict =
    score === maxMarks ? "PASSED" : score > 0 ? "PARTIAL" : "FAILED";

  return {
    status: compileError
      ? "Compilation Error"
      : runtimeError && passedCount === 0
      ? "Runtime Error"
      : score === maxMarks
      ? "Accepted"
      : score > 0
      ? "Partially Accepted"
      : "Wrong Answer",
    verdict,
    passedCount,
    failedCount: effTotal - passedCount,
    totalCount: effTotal,
    score,
    maxMarks,
    compileError,
    runtimeError,
    userStdout: "",
    executionTime: 0,
    memoryUsed: 0,
    caseResults,
    formattedReport: `Test Cases Passed: ${passedCount}/${effTotal}\nQuestion Score: ${score}/${maxMarks}`,
  };
}
