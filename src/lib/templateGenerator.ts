export type GenericType = 
  | 'int' | 'long' | 'float' | 'double' | 'boolean' 
  | 'char' | 'String' | 'int[]' | 'String[]';

export interface Param {
  name: string;
  type: string;
}

export interface QuestionMeta {
  functionName?: string;
  returnType?: string;
  parameters?: string | Param[];
  title?: string;
}

const typeMap: Record<string, Record<string, string>> = {
  'int': {
    'Java': 'int', 'Python': 'int', 'C++': 'int', 'C': 'int', 'JavaScript': 'number', 'TypeScript': 'number'
  },
  'long': {
    'Java': 'long', 'Python': 'int', 'C++': 'long long', 'C': 'long long', 'JavaScript': 'number', 'TypeScript': 'number'
  },
  'float': {
    'Java': 'float', 'Python': 'float', 'C++': 'float', 'C': 'float', 'JavaScript': 'number', 'TypeScript': 'number'
  },
  'double': {
    'Java': 'double', 'Python': 'float', 'C++': 'double', 'C': 'double', 'JavaScript': 'number', 'TypeScript': 'number'
  },
  'boolean': {
    'Java': 'boolean', 'Python': 'bool', 'C++': 'bool', 'C': 'bool', 'JavaScript': 'boolean', 'TypeScript': 'boolean'
  },
  'char': {
    'Java': 'char', 'Python': 'str', 'C++': 'char', 'C': 'char', 'JavaScript': 'string', 'TypeScript': 'string'
  },
  'String': {
    'Java': 'String', 'Python': 'str', 'C++': 'string', 'C': 'char*', 'JavaScript': 'string', 'TypeScript': 'string'
  },
  'int[]': {
    'Java': 'int[]', 'Python': 'List[int]', 'C++': 'vector<int>', 'C': 'int*', 'JavaScript': 'number[]', 'TypeScript': 'number[]'
  },
  'int[][]': {
    'Java': 'int[][]', 'Python': 'List[List[int]]', 'C++': 'vector<vector<int>>', 'C': 'int**', 'JavaScript': 'number[][]', 'TypeScript': 'number[][]'
  },
  'String[]': {
    'Java': 'String[]', 'Python': 'List[str]', 'C++': 'vector<string>', 'C': 'char**', 'JavaScript': 'string[]', 'TypeScript': 'string[]'
  }
};

export const mapType = (genericType: string, language: string): string => {
  const typeMapForLang = typeMap[genericType];
  if (typeMapForLang && typeMapForLang[language]) {
    return typeMapForLang[language];
  }
  
  // Fallback heuristic if it's not strictly one of the above
  const t = genericType.toLowerCase();
  if (language === 'Python') {
    if (t.includes('[]') || t.includes('array') || t.includes('list')) return `List[${t.includes('int') ? 'int' : 'str'}]`;
    if (t.includes('int') || t.includes('long')) return 'int';
    if (t.includes('float') || t.includes('double')) return 'float';
    if (t.includes('string') || t.includes('char')) return 'str';
    if (t.includes('bool')) return 'bool';
  } else if (language === 'Java') {
    if (t.includes('[]') || t.includes('array') || t.includes('list')) return `${t.includes('int') ? 'int' : 'String'}[]`;
    if (t.includes('string')) return 'String';
    if (t.includes('bool')) return 'boolean';
  } else if (language === 'C++') {
    if (t.includes('[]') || t.includes('array') || t.includes('list')) return `vector<${t.includes('int') ? 'int' : 'string'}>`;
    if (t.includes('string')) return 'string';
    if (t.includes('bool')) return 'bool';
  } else if (language === 'C') {
    if (t.includes('[]') || t.includes('array') || t.includes('list')) return `${t.includes('int') ? 'int' : 'char'}*`;
    if (t.includes('string')) return 'char*';
    if (t.includes('bool')) return 'bool';
  } else if (language === 'JavaScript' || language === 'TypeScript') {
    if (t.includes('[]') || t.includes('array') || t.includes('list')) return `${t.includes('int') ? 'number' : 'string'}[]`;
    if (t.includes('int') || t.includes('long') || t.includes('float') || t.includes('double')) return 'number';
    if (t.includes('string') || t.includes('char')) return 'string';
    if (t.includes('bool')) return 'boolean';
  }
  
  return genericType;
};

const getDefaultReturnVal = (genericType: string, lang: string): string => {
  const t = genericType.toLowerCase();
  if (t === 'void') return '';
  if (t === 'boolean' || t === 'bool') {
    return lang === 'Python' ? 'False' : 'false';
  }
  if (t.includes('string') || t === 'char*') return '""';
  if (t === 'char') return "' '";
  if (t.includes('[]') || t.includes('list') || t.includes('vector') || t.includes('array') || t.includes('*')) {
    if (lang === 'Java') {
        const mapped = mapType(genericType, lang);
        return `new ${mapped.replace('[]', '')}[0]`;
    }
    if (lang === 'C++') return '{}';
    if (lang === 'C') return 'NULL';
    return '[]';
  }
  return '0';
};

const titleToFuncName = (title?: string) => {
  if (!title) return "solution";
  const words = title.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "solution";
  return words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
};

export const generateTemplate = (lang: string, q: QuestionMeta): string => {
  if (!q) return "";
  
  const funcName = q.functionName || titleToFuncName(q.title);
  const genericRetType = q.returnType || "int";
  
  let params: Param[] = [];
  try {
    params = typeof q.parameters === 'string' ? JSON.parse(q.parameters) : (q.parameters || []);
  } catch(e) {
    params = [];
  }
  
  if (!params || params.length === 0) {
    params = [
      { name: "a", type: "int" },
      { name: "b", type: "int" }
    ];
  }

  const retTypeStr = mapType(genericRetType, lang);
  const defaultRet = getDefaultReturnVal(genericRetType, lang);

  if (lang === "Java") {
    const paramStr = params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    return `import java.util.*;\n\nclass Solution {\n    public ${retTypeStr} ${funcName}(${paramStr}) {\n\n    }\n}`;
  } 
  
  if (lang === "Python") {
    const paramStr = params.map(p => `${p.name}: ${mapType(p.type, lang)}`).join(", ");
    return `class Solution:\n    def ${funcName}(self${paramStr ? ', ' + paramStr : ''}) -> ${retTypeStr}:\n        pass`;
  } 
  
  if (lang === "C++") {
    const paramStr = params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    ${retTypeStr} ${funcName}(${paramStr}) {\n\n    }\n};`;
  } 
  
  if (lang === "C") {
    const paramStr = params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    return `#include <stdio.h>\n\n${retTypeStr} ${funcName}(${paramStr})\n{\n\n}`;
  } 
  
  if (lang === "JavaScript") {
    const paramStr = params.map(p => p.name).join(", ");
    return `class Solution {\n    ${funcName}(${paramStr}) {\n\n    }\n}\n\nmodule.exports = Solution;`;
  }
  
  if (lang === "TypeScript") {
    const paramStr = params.map(p => `${p.name}: ${mapType(p.type, lang)}`).join(", ");
    return `class Solution {\n    ${funcName}(${paramStr}): ${retTypeStr} {\n\n    }\n}\n\nexport default Solution;`;
  }

  return "";
};
