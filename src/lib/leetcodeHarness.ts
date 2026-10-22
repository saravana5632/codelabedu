export const SUPPORTED_DSA_TYPES = [
  "int",
  "long",
  "double",
  "boolean",
  "String",
  "int[]",
  "long[]",
  "String[]",
  "int[][]",
] as const;

export type SupportedDsaType = (typeof SUPPORTED_DSA_TYPES)[number];

export const SUPPORTED_LANGUAGES = [
  "Java",
  "C++",
  "Python",
  "C",
  "JavaScript",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface ParameterConfig {
  name: string;
  type: SupportedDsaType;
}

export interface FunctionConfig {
  className: string;
  methodName: string;
  returnType: SupportedDsaType;
  parameters: ParameterConfig[];
  visibility?: "public" | "private" | "protected";
  isStatic?: boolean;
  enabledLanguages?: string[];
}

export interface QuestionExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCaseRecord {
  id?: number;
  name: string;
  inputArgs: string;
  expectedOutput: string;
  visibility: "public" | "private";
  enabled: boolean;
  isEssential?: boolean;
  orderIndex?: number;
}

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const RESERVED_KEYWORDS = new Set([
  "class",
  "public",
  "private",
  "protected",
  "return",
  "void",
  "int",
  "long",
  "double",
  "float",
  "boolean",
  "bool",
  "char",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "default",
  "def",
  "import",
  "from",
  "function",
  "var",
  "let",
  "const",
  "static",
  "struct",
  "sizeof",
]);

export function isSupportedDsaType(t: string): t is SupportedDsaType {
  return (SUPPORTED_DSA_TYPES as readonly string[]).includes(t);
}

export function validateFunctionConfig(config: Partial<FunctionConfig>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const className = (config.className || "").trim();
  const methodName = (config.methodName || "").trim();
  const returnType = (config.returnType || "").trim();
  const parameters = Array.isArray(config.parameters) ? config.parameters : [];

  if (!className) {
    errors.className = "Class name is required.";
  } else if (!IDENTIFIER_REGEX.test(className)) {
    errors.className =
      "Class name must be a valid identifier (letters, digits, underscores, not starting with a digit).";
  } else if (RESERVED_KEYWORDS.has(className)) {
    errors.className = `"${className}" is a reserved keyword and cannot be used as a class name.`;
  }

  if (!methodName) {
    errors.methodName = "Method/function name is required.";
  } else if (!IDENTIFIER_REGEX.test(methodName)) {
    errors.methodName =
      "Method name must be a valid identifier (letters, digits, underscores, not starting with a digit).";
  } else if (RESERVED_KEYWORDS.has(methodName)) {
    errors.methodName = `"${methodName}" is a reserved keyword and cannot be used as a method name.`;
  } else if (methodName === "main") {
    errors.methodName =
      'Method name cannot be "main" because the evaluation harness reserves main() as the entry point.';
  }

  if (!returnType || !isSupportedDsaType(returnType)) {
    errors.returnType = `Return type must be one of: ${SUPPORTED_DSA_TYPES.join(", ")}.`;
  }

  const seenNames = new Set<string>();
  parameters.forEach((param, idx) => {
    const pName = (param?.name || "").trim();
    const pType = (param?.type || "").trim();

    if (!pName) {
      errors[`param_${idx}_name`] = `Parameter #${idx + 1} name is required.`;
    } else if (!IDENTIFIER_REGEX.test(pName)) {
      errors[`param_${idx}_name`] = `Parameter "${pName}" is not a valid identifier.`;
    } else if (RESERVED_KEYWORDS.has(pName)) {
      errors[`param_${idx}_name`] = `Parameter "${pName}" is a reserved keyword.`;
    } else if (seenNames.has(pName)) {
      errors[`param_${idx}_name`] = `Duplicate parameter name "${pName}".`;
    } else {
      seenNames.add(pName);
    }

    if (!pType || !isSupportedDsaType(pType)) {
      errors[`param_${idx}_type`] = `Parameter #${idx + 1} has an unsupported type "${pType}".`;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// Starter Code Generation
// ============================================================================

function getJavaType(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "double":
      return "double";
    case "boolean":
      return "boolean";
    case "String":
      return "String";
    case "int[]":
      return "int[]";
    case "long[]":
      return "long[]";
    case "String[]":
      return "String[]";
    case "int[][]":
      return "int[][]";
  }
}

function getJavaDefaultReturn(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "0";
    case "long":
      return "0L";
    case "double":
      return "0.0";
    case "boolean":
      return "false";
    case "String":
      return '""';
    case "int[]":
      return "new int[]{}";
    case "long[]":
      return "new long[]{}";
    case "String[]":
      return "new String[]{}";
    case "int[][]":
      return "new int[][]{}";
  }
}

function getCppReturnType(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "String":
      return "string";
    case "int[]":
      return "vector<int>";
    case "long[]":
      return "vector<long long>";
    case "String[]":
      return "vector<string>";
    case "int[][]":
      return "vector<vector<int>>";
  }
}

function getCppParamType(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "String":
      return "string";
    case "int[]":
      return "vector<int>&";
    case "long[]":
      return "vector<long long>&";
    case "String[]":
      return "vector<string>&";
    case "int[][]":
      return "vector<vector<int>>&";
  }
}

function getCppDefaultReturn(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "0";
    case "long":
      return "0LL";
    case "double":
      return "0.0";
    case "boolean":
      return "false";
    case "String":
      return '""';
    case "int[]":
    case "long[]":
    case "String[]":
    case "int[][]":
      return "{}";
  }
}

function getPythonType(type: SupportedDsaType): string {
  switch (type) {
    case "int":
    case "long":
      return "int";
    case "double":
      return "float";
    case "boolean":
      return "bool";
    case "String":
      return "str";
    case "int[]":
    case "long[]":
      return "list[int]";
    case "String[]":
      return "list[str]";
    case "int[][]":
      return "list[list[int]]";
  }
}

function getPythonDefaultReturn(type: SupportedDsaType): string {
  switch (type) {
    case "int":
    case "long":
      return "0";
    case "double":
      return "0.0";
    case "boolean":
      return "False";
    case "String":
      return '""';
    case "int[]":
    case "long[]":
    case "String[]":
    case "int[][]":
      return "[]";
  }
}

function getCReturnType(type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "boolean":
      return "bool";
    case "String":
      return "char*";
    case "int[]":
      return "int*";
    case "long[]":
      return "long long*";
    case "String[]":
      return "char**";
    case "int[][]":
      return "int**";
  }
}

export function generateStarterCodeForLanguage(
  config: FunctionConfig,
  language: string
): string {
  const className = (config.className || "Solution").trim();
  const methodName = (config.methodName || "solve").trim();
  const returnType: SupportedDsaType = isSupportedDsaType(config.returnType)
    ? config.returnType
    : "int";
  const params = Array.isArray(config.parameters) ? config.parameters : [];
  const visibility = config.visibility || "public";
  const isStatic = Boolean(config.isStatic);

  if (language === "Java") {
    const javaParams = params
      .map((p) => `${getJavaType(p.type)} ${p.name}`)
      .join(", ");
    const staticKw = isStatic ? "static " : "";
    return `class ${className} {\n    ${visibility} ${staticKw}${getJavaType(
      returnType
    )} ${methodName}(${javaParams}) {\n        // Write your solution here\n\n        return ${getJavaDefaultReturn(
      returnType
    )};\n    }\n}`;
  }

  if (language === "C++") {
    const needsVector =
      returnType.includes("[") || params.some((p) => p.type.includes("["));
    const needsString =
      returnType.includes("String") ||
      params.some((p) => p.type.includes("String"));
    const includes: string[] = [];
    if (needsVector) includes.push("#include <vector>");
    if (needsString) includes.push("#include <string>");
    if (includes.length === 0) includes.push("#include <vector>");

    const cppParams = params
      .map((p) => `${getCppParamType(p.type)} ${p.name}`)
      .join(", ");
    const staticKw = isStatic ? "static " : "";
    return `${includes.join(
      "\n"
    )}\nusing namespace std;\n\nclass ${className} {\npublic:\n    ${staticKw}${getCppReturnType(
      returnType
    )} ${methodName}(${cppParams}) {\n        // Write your solution here\n\n        return ${getCppDefaultReturn(
      returnType
    )};\n    }\n};`;
  }

  if (language === "Python") {
    const pyParams = params
      .map((p) => `${p.name}: ${getPythonType(p.type)}`)
      .join(", ");
    const selfAndParams = pyParams ? `self, ${pyParams}` : "self";
    return `class ${className}:\n    def ${methodName}(${selfAndParams}) -> ${getPythonType(
      returnType
    )}:\n        # Write your solution here\n\n        return ${getPythonDefaultReturn(
      returnType
    )}`;
  }

  if (language === "C") {
    const cParams: string[] = [];
    for (const p of params) {
      if (p.type === "int") cParams.push(`int ${p.name}`);
      else if (p.type === "long") cParams.push(`long long ${p.name}`);
      else if (p.type === "double") cParams.push(`double ${p.name}`);
      else if (p.type === "boolean") cParams.push(`bool ${p.name}`);
      else if (p.type === "String") cParams.push(`char* ${p.name}`);
      else if (p.type === "int[]") {
        cParams.push(`int* ${p.name}`);
        cParams.push(`int ${p.name}Size`);
      } else if (p.type === "long[]") {
        cParams.push(`long long* ${p.name}`);
        cParams.push(`int ${p.name}Size`);
      } else if (p.type === "String[]") {
        cParams.push(`char** ${p.name}`);
        cParams.push(`int ${p.name}Size`);
      } else if (p.type === "int[][]") {
        cParams.push(`int** ${p.name}`);
        cParams.push(`int ${p.name}Size`);
        cParams.push(`int* ${p.name}ColSize`);
      }
    }

    if (
      returnType === "int[]" ||
      returnType === "long[]" ||
      returnType === "String[]"
    ) {
      cParams.push("int* returnSize");
    } else if (returnType === "int[][]") {
      cParams.push("int* returnSize");
      cParams.push("int** returnColumnSizes");
    }

    const needsBool =
      returnType === "boolean" || params.some((p) => p.type === "boolean");
    const headers = ["#include <stdlib.h>"];
    if (needsBool) headers.push("#include <stdbool.h>");

    let bodyReturn = "return 0;";
    if (returnType === "long") bodyReturn = "return 0LL;";
    else if (returnType === "double") bodyReturn = "return 0.0;";
    else if (returnType === "boolean") bodyReturn = "return false;";
    else if (returnType === "String") bodyReturn = 'return "";';
    else if (
      returnType === "int[]" ||
      returnType === "long[]" ||
      returnType === "String[]"
    ) {
      bodyReturn = "*returnSize = 0;\n    return NULL;";
    } else if (returnType === "int[][]") {
      bodyReturn =
        "*returnSize = 0;\n    *returnColumnSizes = NULL;\n    return NULL;";
    }

    return `${headers.join("\n")}\n\n${getCReturnType(
      returnType
    )} ${methodName}(${cParams.join(
      ", "
    )}) {\n    // Write your solution here\n\n    ${bodyReturn}\n}`;
  }

  if (language === "JavaScript") {
    const jsParams = params.map((p) => p.name).join(", ");
    const defaultVal =
      returnType.includes("[")
        ? "[]"
        : returnType === "String"
        ? '""'
        : returnType === "boolean"
        ? "false"
        : "0";
    return `class ${className} {\n    ${methodName}(${jsParams}) {\n        // Write your solution here\n\n        return ${defaultVal};\n    }\n}`;
  }

  return "";
}

export function generateAllStarterCodes(
  config: FunctionConfig
): Record<string, string> {
  const langs =
    Array.isArray(config.enabledLanguages) && config.enabledLanguages.length > 0
      ? config.enabledLanguages
      : [...SUPPORTED_LANGUAGES];

  const result: Record<string, string> = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    if (langs.includes(lang)) {
      result[lang] = generateStarterCodeForLanguage(config, lang);
    }
  }
  return result;
}

export function validateStarterCodeMap(
  starterCode: Record<string, string> | null | undefined,
  config: FunctionConfig
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const sigValidation = validateFunctionConfig(config);
  if (!sigValidation.valid) {
    return sigValidation;
  }

  const enabledLangs =
    Array.isArray(config.enabledLanguages) && config.enabledLanguages.length > 0
      ? config.enabledLanguages
      : ["Java", "C++", "Python", "C"];

  if (!starterCode || typeof starterCode !== "object") {
    errors.starterCode = "Starter code configuration is required.";
    return { valid: false, errors };
  }

  for (const lang of enabledLangs) {
    const code = (starterCode[lang] || "").trim();
    if (!code) {
      errors[`starter_${lang}`] = `Starter code for ${lang} cannot be empty.`;
      continue;
    }
    if (!code.includes(config.methodName)) {
      errors[
        `starter_${lang}`
      ] = `${lang} starter code must declare method/function "${config.methodName}".`;
    }
    if (
      (lang === "Java" || lang === "C++" || lang === "Python") &&
      !code.includes(config.className)
    ) {
      errors[
        `starter_${lang}`
      ] = `${lang} starter code must include class "${config.className}".`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// Argument & Expected Output Parsing / Validation
// ============================================================================

export function validateValueMatchesType(
  val: any,
  type: SupportedDsaType
): boolean {
  switch (type) {
    case "int":
      return (
        typeof val === "number" &&
        Number.isInteger(val) &&
        val >= -2147483648 &&
        val <= 2147483647
      );
    case "long":
      return typeof val === "number" && Number.isInteger(val);
    case "double":
      return typeof val === "number" && Number.isFinite(val);
    case "boolean":
      return typeof val === "boolean";
    case "String":
      return typeof val === "string";
    case "int[]":
      return (
        Array.isArray(val) &&
        val.every(
          (x) =>
            typeof x === "number" &&
            Number.isInteger(x) &&
            x >= -2147483648 &&
            x <= 2147483647
        )
      );
    case "long[]":
      return (
        Array.isArray(val) &&
        val.every((x) => typeof x === "number" && Number.isInteger(x))
      );
    case "String[]":
      return Array.isArray(val) && val.every((x) => typeof x === "string");
    case "int[][]":
      return (
        Array.isArray(val) &&
        val.every(
          (row) =>
            Array.isArray(row) &&
            row.every(
              (x) =>
                typeof x === "number" &&
                Number.isInteger(x) &&
                x >= -2147483648 &&
                x <= 2147483647
            )
        )
      );
    default:
      return false;
  }
}

/**
 * Splits a top-level comma-separated or newline-separated assignment string like:
 * `nums = [2, 7, 11, 15], target = 9` -> `["[2, 7, 11, 15]", "9"]`
 */
function splitTopLevelAssignments(raw: string, paramCount: number): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Check if it looks like `name = val, name2 = val2`
  const parts: string[] = [];
  let depthBracket = 0;
  let depthBrace = 0;
  let inQuotes = false;
  let quoteChar = "";
  let current = "";

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const prev = i > 0 ? trimmed[i - 1] : "";

    if (inQuotes) {
      current += ch;
      if (ch === quoteChar && prev !== "\\") {
        inQuotes = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuotes = true;
      quoteChar = ch;
      current += ch;
      continue;
    }

    if (ch === "[") depthBracket++;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);

    if (depthBracket === 0 && depthBrace === 0 && (ch === "," || ch === "\n")) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  // Strip leading `paramName = ` if present
  return parts.map((p) => {
    const eqMatch = p.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*([\s\S]+)$/);
    return eqMatch ? eqMatch[1].trim() : p.trim();
  });
}

function coerceSingleValue(rawToken: string, type: SupportedDsaType): any {
  const t = rawToken.trim();
  try {
    const parsed = JSON.parse(t);
    if (validateValueMatchesType(parsed, type)) {
      return parsed;
    }
  } catch {
    // Fallback for legacy space-separated arrays or unquoted strings
  }

  if (type === "String") {
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }

  if (type === "int[]" || type === "long[]") {
    if (!t.startsWith("[")) {
      const nums = t
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => Number(n));
      if (nums.every((n) => Number.isInteger(n))) {
        return nums;
      }
    }
  }

  if (type === "boolean") {
    if (t.toLowerCase() === "true") return true;
    if (t.toLowerCase() === "false") return false;
  }

  if (type === "int" || type === "long" || type === "double") {
    const num = Number(t);
    if (!Number.isNaN(num)) return num;
  }

  throw new Error(`Value "${rawToken}" does not match expected type ${type}.`);
}

/**
 * Parses a test case input string into a typed array of arguments matching `parameters`.
 * Supports:
 * 1) Canonical JSON: `{"args": [[2,7,11,15], 9]}`
 * 2) JSON array of args (when unambiguous): `[[2,7,11,15], 9]`
 * 3) LeetCode assignment format: `nums = [2,7,11,15], target = 9`
 * 4) Newline-separated arguments: `[2,7,11,15]\n9` or `-1 0 3 5 9 12\n9`
 */
export function parseTestCaseArgs(
  rawInput: string | object,
  parameters: ParameterConfig[]
): { valid: boolean; args: any[]; error?: string } {
  try {
    if (typeof rawInput === "object" && rawInput !== null) {
      const obj = rawInput as any;
      if (Array.isArray(obj.args)) {
        if (obj.args.length !== parameters.length) {
          return {
            valid: false,
            args: [],
            error: `Expected ${parameters.length} argument(s), but got ${obj.args.length}.`,
          };
        }
        for (let i = 0; i < parameters.length; i++) {
          if (!validateValueMatchesType(obj.args[i], parameters[i].type)) {
            return {
              valid: false,
              args: [],
              error: `Argument "${parameters[i].name}" (${parameters[i].type}) has invalid value: ${JSON.stringify(obj.args[i])}`,
            };
          }
        }
        return { valid: true, args: obj.args };
      }
    }

    const str = String(rawInput ?? "").trim();
    if (!str && parameters.length === 0) {
      return { valid: true, args: [] };
    }

    // 1. Try parsing as JSON `{ "args": [...] }`
    try {
      const parsedJson = JSON.parse(str);
      if (
        parsedJson &&
        typeof parsedJson === "object" &&
        !Array.isArray(parsedJson) &&
        Array.isArray(parsedJson.args)
      ) {
        if (parsedJson.args.length !== parameters.length) {
          return {
            valid: false,
            args: [],
            error: `Expected ${parameters.length} argument(s), but got ${parsedJson.args.length}.`,
          };
        }
        for (let i = 0; i < parameters.length; i++) {
          if (
            !validateValueMatchesType(parsedJson.args[i], parameters[i].type)
          ) {
            return {
              valid: false,
              args: [],
              error: `Argument "${parameters[i].name}" (${parameters[i].type}) has invalid value: ${JSON.stringify(parsedJson.args[i])}`,
            };
          }
        }
        return { valid: true, args: parsedJson.args };
      }

      // If single parameter and the JSON itself matches the parameter type
      if (
        parameters.length === 1 &&
        validateValueMatchesType(parsedJson, parameters[0].type)
      ) {
        return { valid: true, args: [parsedJson] };
      }

      // If JSON array whose elements match the parameter list
      if (
        Array.isArray(parsedJson) &&
        parsedJson.length === parameters.length &&
        parameters.every((p, i) => validateValueMatchesType(parsedJson[i], p.type))
      ) {
        return { valid: true, args: parsedJson };
      }
    } catch {
      // Not single JSON object; continue to assignment / line parser
    }

    // 2. Try newline-separated lines first if line count equals parameter count
    const lines = str
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === parameters.length && !str.includes("=")) {
      const coerced = lines.map((line, idx) =>
        coerceSingleValue(line, parameters[idx].type)
      );
      for (let i = 0; i < parameters.length; i++) {
        if (!validateValueMatchesType(coerced[i], parameters[i].type)) {
          return {
            valid: false,
            args: [],
            error: `Argument "${parameters[i].name}" does not match type ${parameters[i].type}.`,
          };
        }
      }
      return { valid: true, args: coerced };
    }

    // 3. Try splitting top-level `param = val, param2 = val2`
    const parts = splitTopLevelAssignments(str, parameters.length);
    if (parts.length !== parameters.length) {
      return {
        valid: false,
        args: [],
        error: `Expected ${parameters.length} argument(s) (${parameters
          .map((p) => `${p.name}: ${p.type}`)
          .join(", ")}), but found ${parts.length}.`,
      };
    }

    const args = parts.map((part, idx) =>
      coerceSingleValue(part, parameters[idx].type)
    );
    for (let i = 0; i < parameters.length; i++) {
      if (!validateValueMatchesType(args[i], parameters[i].type)) {
        return {
          valid: false,
          args: [],
          error: `Argument "${parameters[i].name}" does not match type ${parameters[i].type}.`,
        };
      }
    }

    return { valid: true, args };
  } catch (err: any) {
    return {
      valid: false,
      args: [],
      error: err?.message || "Invalid test case arguments format.",
    };
  }
}

export function normalizeTestCaseInputToJson(
  rawInput: string | object,
  parameters: ParameterConfig[]
): { valid: boolean; json: string; args: any[]; error?: string } {
  const parsed = parseTestCaseArgs(rawInput, parameters);
  if (!parsed.valid) {
    return { valid: false, json: "", args: [], error: parsed.error };
  }
  return {
    valid: true,
    json: JSON.stringify({ args: parsed.args }),
    args: parsed.args,
  };
}

export function validateExpectedOutput(
  rawExpected: string,
  returnType: SupportedDsaType
): { valid: boolean; normalized: string; value?: any; error?: string } {
  try {
    const val = coerceSingleValue(String(rawExpected ?? "").trim(), returnType);
    if (!validateValueMatchesType(val, returnType)) {
      return {
        valid: false,
        normalized: "",
        error: `Expected output "${rawExpected}" does not match return type ${returnType}.`,
      };
    }
    return {
      valid: true,
      normalized: JSON.stringify(val),
      value: val,
    };
  } catch (err: any) {
    return {
      valid: false,
      normalized: "",
      error:
        err?.message ||
        `Expected output "${rawExpected}" is not valid for return type ${returnType}.`,
    };
  }
}

export function formatArgsForDisplay(
  rawInput: string,
  parameters: ParameterConfig[]
): string {
  const parsed = parseTestCaseArgs(rawInput, parameters);
  if (!parsed.valid) return rawInput;
  return parameters
    .map((p, i) => `${p.name} = ${JSON.stringify(parsed.args[i])}`)
    .join(", ");
}

// ============================================================================
// Output Comparison
// ============================================================================

export function compareSerializedOutput(
  actualRaw: string,
  expectedRaw: string,
  returnType?: SupportedDsaType
): boolean {
  const aTrim = (actualRaw || "").trim();
  const eTrim = (expectedRaw || "").trim();

  if (aTrim === eTrim) return true;

  try {
    const aVal = returnType
      ? coerceSingleValue(aTrim, returnType)
      : JSON.parse(aTrim);
    const eVal = returnType
      ? coerceSingleValue(eTrim, returnType)
      : JSON.parse(eTrim);

    if (returnType === "double") {
      return (
        typeof aVal === "number" &&
        typeof eVal === "number" &&
        Math.abs(aVal - eVal) <= 1e-5
      );
    }

    return JSON.stringify(aVal) === JSON.stringify(eVal);
  } catch {
    const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    return norm(aTrim) === norm(eTrim);
  }
}

// ============================================================================
// Multi-Language Test Harness Generator
// ============================================================================

function escapeCLiteralString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function buildPythonBatchHarness(
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  const payloadJson = JSON.stringify(casesArgs);
  const cleanedStudentCode = studentCode.replace(
    /^\s*from\s+__future__\s+import\s+annotations\s*$/gm,
    ""
  );
  return `from __future__ import annotations
from typing import *
import json
import sys
import math
import collections
import heapq
import bisect
import itertools
import functools

${cleanedStudentCode}

def __codelab_run_all():
    cases = json.loads(${JSON.stringify(payloadJson)})
    for idx, args in enumerate(cases):
        try:
            if "${config.className}" in globals():
                cls_obj = globals()["${config.className}"]
                instance = cls_obj()
                fn = getattr(instance, "${config.methodName}")
            elif "${config.methodName}" in globals():
                fn = globals()["${config.methodName}"]
            else:
                raise AttributeError("Method '${config.methodName}' not found in '${config.className}'")
            res = fn(*args)
            print(f"__CODELAB_CASE_{idx}__:" + json.dumps(res, separators=(',', ':')))
        except Exception as e:
            print(f"__CODELAB_ERR_{idx}__:" + f"{type(e).__name__}: {e}", file=sys.stderr)

if __name__ == "__main__":
    __codelab_run_all()
`;
}

function buildJavaScriptBatchHarness(
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  const payloadJson = JSON.stringify(casesArgs);
  return `${studentCode}

(function __codelab_run_all() {
  const cases = ${payloadJson};
  for (let idx = 0; idx < cases.length; idx++) {
    const args = JSON.parse(JSON.stringify(cases[idx]));
    try {
      let res;
      if (typeof ${config.className} !== "undefined") {
        const inst = new ${config.className}();
        if (typeof inst.${config.methodName} === "function") {
          res = inst.${config.methodName}(...args);
        } else if (typeof ${config.className}.${config.methodName} === "function") {
          res = ${config.className}.${config.methodName}(...args);
        } else {
          throw new Error("Method '${config.methodName}' not found on class '${config.className}'");
        }
      } else if (typeof ${config.methodName} === "function") {
        res = ${config.methodName}(...args);
      } else {
        throw new Error("Class '${config.className}' or function '${config.methodName}' not found");
      }
      console.log("__CODELAB_CASE_" + idx + "__:" + JSON.stringify(res));
    } catch (err) {
      console.error("__CODELAB_ERR_" + idx + "__:" + (err && err.message ? err.message : String(err)));
    }
  }
})();
`;
}

function formatJavaLiteral(val: any, type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return String(Number(val) | 0);
    case "long":
      return `${Number(val)}L`;
    case "double":
      return String(Number(val));
    case "boolean":
      return val ? "true" : "false";
    case "String":
      return `"${escapeCLiteralString(String(val))}"`;
    case "int[]":
      return `new int[]{${(val as number[]).map((x) => Number(x) | 0).join(", ")}}`;
    case "long[]":
      return `new long[]{${(val as number[]).map((x) => `${Number(x)}L`).join(", ")}}`;
    case "String[]":
      return `new String[]{${(val as string[])
        .map((s) => `"${escapeCLiteralString(String(s))}"`)
        .join(", ")}}`;
    case "int[][]":
      return `new int[][]{${(val as number[][])
        .map((row) => `{${row.map((x) => Number(x) | 0).join(", ")}}`)
        .join(", ")}}`;
  }
}

function buildJavaBatchHarness(
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  // Extract student imports so they appear at the top of Main.java
  const lines = studentCode.split(/\r?\n/);
  const userImports: string[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    if (/^\s*import\s+[^;]+;/.test(line)) {
      userImports.push(line.trim());
    } else if (/^\s*package\s+[^;]+;/.test(line)) {
      // Strip package declarations in Judge0 single-file execution
    } else {
      bodyLines.push(line);
    }
  }

  const sanitizedStudentCode = bodyLines
    .join("\n")
    .replace(
      new RegExp(`\\bpublic\\s+class\\s+${config.className}\\b`, "g"),
      `class ${config.className}`
    );

  const caseBlocks = casesArgs
    .map((args, idx) => {
      const argDecls = config.parameters
        .map(
          (p, pIdx) =>
            `            ${getJavaType(p.type)} arg_${idx}_${pIdx} = ${formatJavaLiteral(
              args[pIdx],
              p.type
            )};`
        )
        .join("\n");
      const argNames = config.parameters
        .map((_, pIdx) => `arg_${idx}_${pIdx}`)
        .join(", ");
      const callExpr = config.isStatic
        ? `${config.className}.${config.methodName}(${argNames})`
        : `new ${config.className}().${config.methodName}(${argNames})`;

      return `        try {
${argDecls}
            ${getJavaType(config.returnType)} res_${idx} = ${callExpr};
            System.out.println("__CODELAB_CASE_${idx}__:" + __toJson(res_${idx}));
        } catch (Throwable t) {
            System.err.println("__CODELAB_ERR_${idx}__:" + t.toString());
        }`;
    })
    .join("\n");

  return `import java.util.*;
import java.io.*;
import java.math.*;
${userImports.join("\n")}

${sanitizedStudentCode}

public class Main {
    private static String __escapeJson(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder("\\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\\\') sb.append("\\\\\\\\");
            else if (c == '\\"') sb.append("\\\\\\"");
            else if (c == '\\n') sb.append("\\\\n");
            else if (c == '\\r') sb.append("\\\\r");
            else if (c == '\\t') sb.append("\\\\t");
            else sb.append(c);
        }
        sb.append("\\"");
        return sb.toString();
    }

    private static String __toJson(int v) { return String.valueOf(v); }
    private static String __toJson(long v) { return String.valueOf(v); }
    private static String __toJson(double v) { return String.valueOf(v); }
    private static String __toJson(boolean v) { return v ? "true" : "false"; }
    private static String __toJson(String v) { return __escapeJson(v); }
    private static String __toJson(int[] arr) {
        if (arr == null) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    private static String __toJson(long[] arr) {
        if (arr == null) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    private static String __toJson(String[] arr) {
        if (arr == null) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(__escapeJson(arr[i]));
        }
        sb.append("]");
        return sb.toString();
    }
    private static String __toJson(int[][] mat) {
        if (mat == null) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < mat.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(__toJson(mat[i]));
        }
        sb.append("]");
        return sb.toString();
    }

    public static void main(String[] args) {
${caseBlocks}
    }
}
`;
}

function formatCppLiteral(val: any, type: SupportedDsaType): string {
  switch (type) {
    case "int":
      return String(Number(val) | 0);
    case "long":
      return `${Number(val)}LL`;
    case "double":
      return String(Number(val));
    case "boolean":
      return val ? "true" : "false";
    case "String":
      return `string("${escapeCLiteralString(String(val))}")`;
    case "int[]":
      return `vector<int>{${(val as number[]).map((x) => Number(x) | 0).join(", ")}}`;
    case "long[]":
      return `vector<long long>{${(val as number[])
        .map((x) => `${Number(x)}LL`)
        .join(", ")}}`;
    case "String[]":
      return `vector<string>{${(val as string[])
        .map((s) => `"${escapeCLiteralString(String(s))}"`)
        .join(", ")}}`;
    case "int[][]":
      return `vector<vector<int>>{${(val as number[][])
        .map((row) => `{${row.map((x) => Number(x) | 0).join(", ")}}`)
        .join(", ")}}`;
  }
}

function buildCppBatchHarness(
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  const caseBlocks = casesArgs
    .map((args, idx) => {
      const argDecls = config.parameters
        .map(
          (p, pIdx) =>
            `        ${getCppReturnType(p.type)} arg_${idx}_${pIdx} = ${formatCppLiteral(
              args[pIdx],
              p.type
            )};`
        )
        .join("\n");
      const argNames = config.parameters
        .map((_, pIdx) => `arg_${idx}_${pIdx}`)
        .join(", ");
      const callExpr = config.isStatic
        ? `${config.className}::${config.methodName}(${argNames})`
        : `${config.className}().${config.methodName}(${argNames})`;

      return `    try {
${argDecls}
        auto res_${idx} = ${callExpr};
        cout << "__CODELAB_CASE_${idx}__:" << __codelab_to_json(res_${idx}) << "\\n";
    } catch (const exception& e) {
        cerr << "__CODELAB_ERR_${idx}__:" << e.what() << "\\n";
    }`;
    })
    .join("\n");

  return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <cmath>
#include <climits>
using namespace std;

${studentCode}

string __codelab_escape_str(const string& s) {
    string out = "\\"";
    for (char c : s) {
        if (c == '\\\\') out += "\\\\\\\\";
        else if (c == '\\"') out += "\\\\\\"";
        else if (c == '\\n') out += "\\\\n";
        else if (c == '\\r') out += "\\\\r";
        else if (c == '\\t') out += "\\\\t";
        else out += c;
    }
    out += "\\"";
    return out;
}

string __codelab_to_json(int v) { return to_string(v); }
string __codelab_to_json(long long v) { return to_string(v); }
string __codelab_to_json(double v) {
    ostringstream oss;
    oss << v;
    return oss.str();
}
string __codelab_to_json(bool v) { return v ? "true" : "false"; }
string __codelab_to_json(const string& v) { return __codelab_escape_str(v); }

template <typename T>
string __codelab_to_json(const vector<T>& vec) {
    string out = "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) out += ",";
        out += __codelab_to_json(vec[i]);
    }
    out += "]";
    return out;
}

int main() {
${caseBlocks}
    return 0;
}
`;
}

function buildCBatchHarness(
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  const caseBlocks = casesArgs
    .map((args, idx) => {
      const declLines: string[] = [];
      const callArgs: string[] = [];

      config.parameters.forEach((p, pIdx) => {
        const val = args[pIdx];
        const vName = `arg_${idx}_${pIdx}`;

        if (p.type === "int") {
          declLines.push(`        int ${vName} = ${Number(val) | 0};`);
          callArgs.push(vName);
        } else if (p.type === "long") {
          declLines.push(`        long long ${vName} = ${Number(val)}LL;`);
          callArgs.push(vName);
        } else if (p.type === "double") {
          declLines.push(`        double ${vName} = ${Number(val)};`);
          callArgs.push(vName);
        } else if (p.type === "boolean") {
          declLines.push(`        bool ${vName} = ${val ? "true" : "false"};`);
          callArgs.push(vName);
        } else if (p.type === "String") {
          declLines.push(
            `        char ${vName}_buf[] = "${escapeCLiteralString(String(val))}";\n        char* ${vName} = ${vName}_buf;`
          );
          callArgs.push(vName);
        } else if (p.type === "int[]") {
          const arr = Array.isArray(val) ? (val as number[]) : [];
          if (arr.length === 0) {
            declLines.push(
              `        int* ${vName} = NULL;\n        int ${vName}Size = 0;`
            );
          } else {
            declLines.push(
              `        int ${vName}_arr[] = {${arr
                .map((x) => Number(x) | 0)
                .join(", ")}};\n        int* ${vName} = ${vName}_arr;\n        int ${vName}Size = ${
                arr.length
              };`
            );
          }
          callArgs.push(vName, `${vName}Size`);
        } else if (p.type === "long[]") {
          const arr = Array.isArray(val) ? (val as number[]) : [];
          if (arr.length === 0) {
            declLines.push(
              `        long long* ${vName} = NULL;\n        int ${vName}Size = 0;`
            );
          } else {
            declLines.push(
              `        long long ${vName}_arr[] = {${arr
                .map((x) => `${Number(x)}LL`)
                .join(", ")}};\n        long long* ${vName} = ${vName}_arr;\n        int ${vName}Size = ${
                arr.length
              };`
            );
          }
          callArgs.push(vName, `${vName}Size`);
        } else if (p.type === "String[]") {
          const arr = Array.isArray(val) ? (val as string[]) : [];
          if (arr.length === 0) {
            declLines.push(
              `        char** ${vName} = NULL;\n        int ${vName}Size = 0;`
            );
          } else {
            declLines.push(
              `        char* ${vName}_arr[] = {${arr
                .map((s) => `"${escapeCLiteralString(String(s))}"`)
                .join(", ")}};\n        char** ${vName} = ${vName}_arr;\n        int ${vName}Size = ${
                arr.length
              };`
            );
          }
          callArgs.push(vName, `${vName}Size`);
        } else if (p.type === "int[][]") {
          const mat = Array.isArray(val) ? (val as number[][]) : [];
          if (mat.length === 0) {
            declLines.push(
              `        int** ${vName} = NULL;\n        int ${vName}Size = 0;\n        int* ${vName}ColSize = NULL;`
            );
          } else {
            mat.forEach((row, rIdx) => {
              declLines.push(
                `        int ${vName}_r${rIdx}[] = {${
                  row.length > 0
                    ? row.map((x) => Number(x) | 0).join(", ")
                    : "0"
                }};`
              );
            });
            declLines.push(
              `        int* ${vName}_rows[] = {${mat
                .map((_, rIdx) => `${vName}_r${rIdx}`)
                .join(", ")}};`
            );
            declLines.push(
              `        int ${vName}_cols[] = {${mat
                .map((row) => row.length)
                .join(", ")}};`
            );
            declLines.push(
              `        int** ${vName} = ${vName}_rows;\n        int ${vName}Size = ${mat.length};\n        int* ${vName}ColSize = ${vName}_cols;`
            );
          }
          callArgs.push(vName, `${vName}Size`, `${vName}ColSize`);
        }
      });

      const rt = config.returnType;
      let invokeAndPrint = "";
      if (rt === "int") {
        invokeAndPrint = `        int res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:%d\\n", res_${idx});`;
      } else if (rt === "long") {
        invokeAndPrint = `        long long res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:%lld\\n", res_${idx});`;
      } else if (rt === "double") {
        invokeAndPrint = `        double res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:%.6g\\n", res_${idx});`;
      } else if (rt === "boolean") {
        invokeAndPrint = `        bool res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:%s\\n", res_${idx} ? "true" : "false");`;
      } else if (rt === "String") {
        invokeAndPrint = `        char* res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:\\"%s\\"\\n", res_${idx} ? res_${idx} : "");`;
      } else if (rt === "int[]") {
        callArgs.push(`&retSize_${idx}`);
        invokeAndPrint = `        int retSize_${idx} = 0;
        int* res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:[");
        if (res_${idx} != NULL && retSize_${idx} > 0) {
            for (int i = 0; i < retSize_${idx}; i++) {
                if (i > 0) printf(",");
                printf("%d", res_${idx}[i]);
            }
        }
        printf("]\\n");`;
      } else if (rt === "long[]") {
        callArgs.push(`&retSize_${idx}`);
        invokeAndPrint = `        int retSize_${idx} = 0;
        long long* res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:[");
        if (res_${idx} != NULL && retSize_${idx} > 0) {
            for (int i = 0; i < retSize_${idx}; i++) {
                if (i > 0) printf(",");
                printf("%lld", res_${idx}[i]);
            }
        }
        printf("]\\n");`;
      } else if (rt === "String[]") {
        callArgs.push(`&retSize_${idx}`);
        invokeAndPrint = `        int retSize_${idx} = 0;
        char** res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:[");
        if (res_${idx} != NULL && retSize_${idx} > 0) {
            for (int i = 0; i < retSize_${idx}; i++) {
                if (i > 0) printf(",");
                printf("\\"%s\\"", res_${idx}[i] ? res_${idx}[i] : "");
            }
        }
        printf("]\\n");`;
      } else if (rt === "int[][]") {
        callArgs.push(`&retSize_${idx}`, `&retColSizes_${idx}`);
        invokeAndPrint = `        int retSize_${idx} = 0;
        int* retColSizes_${idx} = NULL;
        int** res_${idx} = ${config.methodName}(${callArgs.join(", ")});
        printf("__CODELAB_CASE_${idx}__:[");
        if (res_${idx} != NULL && retSize_${idx} > 0) {
            for (int i = 0; i < retSize_${idx}; i++) {
                if (i > 0) printf(",");
                printf("[");
                int cols = retColSizes_${idx} ? retColSizes_${idx}[i] : 0;
                for (int j = 0; j < cols; j++) {
                    if (j > 0) printf(",");
                    printf("%d", res_${idx}[i][j]);
                }
                printf("]");
            }
        }
        printf("]\\n");`;
      }

      return `    {\n${declLines.join("\n")}\n${invokeAndPrint}\n    }`;
    })
    .join("\n");

  return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <limits.h>
#include <math.h>

${studentCode}

int main() {
${caseBlocks}
    return 0;
}
`;
}

export function buildBatchExecutionHarness(
  language: string,
  studentCode: string,
  config: FunctionConfig,
  casesArgs: any[][]
): string {
  switch (language) {
    case "Python":
      return buildPythonBatchHarness(studentCode, config, casesArgs);
    case "JavaScript":
      return buildJavaScriptBatchHarness(studentCode, config, casesArgs);
    case "Java":
      return buildJavaBatchHarness(studentCode, config, casesArgs);
    case "C++":
      return buildCppBatchHarness(studentCode, config, casesArgs);
    case "C":
      return buildCBatchHarness(studentCode, config, casesArgs);
    default:
      throw new Error(`Unsupported language for harness generation: ${language}`);
  }
}

export interface ParsedBatchExecutionOutput {
  userStdout: string;
  caseOutputs: Record<number, string>;
  caseErrors: Record<number, string>;
}

export function parseBatchExecutionStdout(
  rawStdout: string | null | undefined,
  rawStderr: string | null | undefined
): ParsedBatchExecutionOutput {
  const caseOutputs: Record<number, string> = {};
  const caseErrors: Record<number, string> = {};
  const userLines: string[] = [];

  const stdoutLines = (rawStdout || "").split(/\r?\n/);
  for (const line of stdoutLines) {
    const match = line.match(/^__CODELAB_CASE_(\d+)__:(.*)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      caseOutputs[idx] = match[2].trim();
    } else if (line.trim() !== "") {
      userLines.push(line);
    }
  }

  const stderrLines = (rawStderr || "").split(/\r?\n/);
  const otherStderr: string[] = [];
  for (const line of stderrLines) {
    const match = line.match(/^__CODELAB_ERR_(\d+)__:(.*)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      caseErrors[idx] = match[2].trim();
    } else if (line.trim() !== "") {
      otherStderr.push(line);
    }
  }

  if (otherStderr.length > 0 && Object.keys(caseErrors).length === 0) {
    caseErrors[0] = otherStderr.join("\n");
  }

  return {
    userStdout: userLines.join("\n"),
    caseOutputs,
    caseErrors,
  };
}
