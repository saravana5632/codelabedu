const mapType = (type: string, lang: string) => {
  const t = type.toLowerCase();
  if (lang === "Python") {
    if (t.includes("array") || t.includes("list")) return `List[${t.includes("int") ? "int" : "str"}]`;
    if (t.includes("int")) return "int";
    if (t.includes("string") || t.includes("str")) return "str";
    if (t.includes("bool")) return "bool";
    return type; // fallback
  }
  if (lang === "Java") {
    if (t.includes("array") || t.includes("list")) return `${t.includes("int") ? "int" : "String"}[]`;
    if (t.includes("int")) return "int";
    if (t.includes("string") || t.includes("str")) return "String";
    if (t.includes("bool")) return "boolean";
    return type;
  }
  if (lang === "C++") {
    if (t.includes("array") || t.includes("list")) return `vector<${t.includes("int") ? "int" : "string"}>&`;
    if (t.includes("int")) return "int";
    if (t.includes("string") || t.includes("str")) return "string";
    if (t.includes("bool")) return "bool";
    return type;
  }
  if (lang === "C") {
    if (t.includes("array") || t.includes("list")) return `${t.includes("int") ? "int" : "char"}*`;
    if (t.includes("int")) return "int";
    if (t.includes("string") || t.includes("str")) return "char*";
    if (t.includes("bool")) return "bool";
    return type;
  }
  return type;
};

const generateTemplate = (lang: string, q: any) => {
  if (!q || !q.functionName) return "";
  
  const funcName = q.functionName;
  const retType = q.returnType || "void";
  const params = typeof q.parameters === 'string' ? JSON.parse(q.parameters) : (q.parameters || []);
  
  if (lang === "Python") {
    const paramStr = params.map((p: any) => `${p.name}: ${mapType(p.type, lang)}`).join(", ");
    const retTypeStr = mapType(retType, lang);
    return `class Solution:\n    def ${funcName}(self${paramStr ? ', ' + paramStr : ''}) -> ${retTypeStr}:\n        # Write your code here\n        pass\n`;
  } else if (lang === "Java") {
    const paramStr = params.map((p: any) => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    const retTypeStr = mapType(retType, lang);
    return `class Solution {\n    public ${retTypeStr} ${funcName}(${paramStr}) {\n\n        // Write your code here\n\n    }\n}\n`;
  } else if (lang === "C++") {
    const paramStr = params.map((p: any) => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    const retTypeStr = mapType(retType, lang);
    return `class Solution {\npublic:\n    ${retTypeStr} ${funcName}(${paramStr}) {\n\n        // Write your code here\n\n    }\n};\n`;
  } else if (lang === "C") {
    const paramStr = params.map((p: any) => `${mapType(p.type, lang)} ${p.name}`).join(", ");
    const retTypeStr = mapType(retType, lang);
    return `${retTypeStr} ${funcName}(${paramStr}) {\n\n    // Write your code here\n\n}\n`;
  } else if (lang === "JavaScript") {
    const paramStr = params.map((p: any) => `${p.name}`).join(", ");
    return `class Solution {\n    ${funcName}(${paramStr}) {\n\n        // Write your code here\n\n    }\n}\n`;
  }
  return "";
};

const q = {
  functionName: "twoSum",
  returnType: "integer array",
  parameters: [
    {name: "nums", type: "integer array"},
    {name: "target", type: "integer"}
  ]
};

console.log(generateTemplate("Python", q));
console.log(generateTemplate("Java", q));
console.log(generateTemplate("C++", q));
console.log(generateTemplate("JavaScript", q));
console.log(generateTemplate("C", q));
