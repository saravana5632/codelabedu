export type DataType = 
  | 'int' | 'long' | 'float' | 'double' | 'boolean' | 'char' | 'String'
  | 'int[]' | 'long[]' | 'float[]' | 'double[]' | 'boolean[]' | 'char[]' | 'String[]'
  | 'int[][]' | 'long[][]' | 'float[][]' | 'double[][]' | 'boolean[][]' | 'char[][]' | 'String[][]'
  | 'List<Integer>' | 'List<Long>' | 'List<Float>' | 'List<Double>' | 'List<Boolean>' | 'List<String>'
  | 'List<List<Integer>>' | 'List<List<String>>' | 'List<List<Long>>' | 'List<List<Double>>';

export interface Param {
  name: string;
  type: DataType;
}

export interface FunctionMeta {
  name: string;
  returnType: DataType | 'void';
  params: Param[];
}

export const generateStarterCode = (meta: FunctionMeta, language: string): string => {
  switch (language) {
    case "Java":
      return generateJavaStarter(meta);
    case "Python":
      return generatePythonStarter(meta);
    case "C":
      return generateCStarter(meta);
    case "C++":
      return generateCppStarter(meta);
    default:
      throw new Error(`Unsupported language for starter code: ${language}`);
  }
};

export const generateWrapperCode = (meta: FunctionMeta, userCode: string, language: string): string => {
  switch (language) {
    case "Java":
      return generateJavaWrapper(meta, userCode);
    case "Python":
      return generatePythonWrapper(meta, userCode);
    case "C":
      return generateCWrapper(meta, userCode);
    case "C++":
      return generateCppWrapper(meta, userCode);
    default:
      throw new Error(`Unsupported language for wrapper code: ${language}`);
  }
};

// ------------------------------------------------------------------
// JAVA
// ------------------------------------------------------------------

const generateJavaStarter = (meta: FunctionMeta): string => {
  const params = meta.params.map(p => `${p.type} ${p.name}`).join(", ");
  return `class Solution {
    public ${meta.returnType} ${meta.name}(${params}) {
        // Write your code here
        
    }
}`;
};

const generateJavaWrapper = (meta: FunctionMeta, userCode: string): string => {
  const parseCalls = meta.params.map((p, i) => {
    let parseMethod = "";
    if (p.type === 'int') parseMethod = "Integer.parseInt(line)";
    else if (p.type === 'long') parseMethod = "Long.parseLong(line)";
    else if (p.type === 'double') parseMethod = "Double.parseDouble(line)";
    else if (p.type === 'float') parseMethod = "Float.parseFloat(line)";
    else if (p.type === 'boolean') parseMethod = "Boolean.parseBoolean(line)";
    else if (p.type === 'char') parseMethod = "line.replace(\"\\\"\", \"\").replace(\"'\", \"\").charAt(0)";
    else if (p.type === 'String') parseMethod = "line.length() >= 2 ? line.substring(1, line.length()-1) : line";
    else if (p.type === 'int[]') parseMethod = "parseIntArray(line)";
    else if (p.type === 'int[][]') parseMethod = "parseInt2DArray(line)";
    else if (p.type === 'String[]') parseMethod = "parseStringArray(line)";
    else if (p.type === 'List<Integer>') parseMethod = "parseIntegerList(line)";
    else if (p.type === 'List<List<Integer>>') parseMethod = "parseInteger2DList(line)";
    else parseMethod = "null"; // fallback

    return `
            ${p.type} ${p.name} = ${parseMethod};
            ${i < meta.params.length - 1 ? `line = reader.readLine(); if(line != null) line = line.trim();` : ''}`;
  }).join("");

  return `import java.util.*;
import java.io.*;

${userCode}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        Solution solution = new Solution();
        
        String line;
        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            
            // Read inputs${parseCalls}
            
            ${meta.returnType === 'void' 
              ? `solution.${meta.name}(${meta.params.map(p => p.name).join(', ')});` 
              : `${meta.returnType} result = solution.${meta.name}(${meta.params.map(p => p.name).join(', ')});
            System.out.println(formatOutput(result));`}
        }
    }
    
    // Parsers
    private static int[] parseIntArray(String s) {
        s = s.substring(1, s.length() - 1).trim();
        if (s.isEmpty()) return new int[0];
        String[] parts = s.split(",");
        int[] arr = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            arr[i] = Integer.parseInt(parts[i].trim());
        }
        return arr;
    }
    
    private static int[][] parseInt2DArray(String s) {
        s = s.substring(1, s.length() - 1).trim();
        if (s.isEmpty()) return new int[0][0];
        List<int[]> list = new ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            if (s.charAt(i) == '[') {
                int j = i;
                int brackets = 0;
                while (j < s.length()) {
                    if (s.charAt(j) == '[') brackets++;
                    else if (s.charAt(j) == ']') {
                        brackets--;
                        if (brackets == 0) break;
                    }
                    j++;
                }
                list.add(parseIntArray(s.substring(i, j + 1)));
                i = j + 1;
            } else {
                i++;
            }
        }
        return list.toArray(new int[list.size()][]);
    }

    private static String[] parseStringArray(String s) {
        s = s.substring(1, s.length() - 1).trim();
        if (s.isEmpty()) return new String[0];
        // naive split, real parsing needs to handle quoted commas
        String[] parts = s.split(",");
        for (int i = 0; i < parts.length; i++) {
            parts[i] = parts[i].trim().replace("\"", "").replace("\"", "");
        }
        return parts;
    }

    private static List<Integer> parseIntegerList(String s) {
        int[] arr = parseIntArray(s);
        List<Integer> list = new ArrayList<>();
        for (int v : arr) list.add(v);
        return list;
    }

    private static List<List<Integer>> parseInteger2DList(String s) {
        int[][] arr = parseInt2DArray(s);
        List<List<Integer>> list = new ArrayList<>();
        for (int[] row : arr) {
            List<Integer> r = new ArrayList<>();
            for (int v : row) r.add(v);
            list.add(r);
        }
        return list;
    }

    public static String formatOutput(Object o) {
        if (o == null) return "null";
        if (o instanceof int[]) return Arrays.toString((int[])o).replace(" ", "");
        if (o instanceof int[][]) return Arrays.deepToString((Object[])o).replace(" ", "");
        if (o instanceof Object[]) return Arrays.deepToString((Object[])o).replace(" ", "");
        if (o instanceof List) {
            return o.toString().replace(" ", "");
        }
        return o.toString();
    }
}
`;
};

// ------------------------------------------------------------------
// PYTHON
// ------------------------------------------------------------------

const generatePythonStarter = (meta: FunctionMeta): string => {
  const params = ['self', ...meta.params.map(p => p.name)].join(", ");
  return `class Solution:
    def ${meta.name}(${params}):
        # Write your code here
        pass
`;
};

const generatePythonWrapper = (meta: FunctionMeta, userCode: string): string => {
  return `import sys
import json
from typing import *

${userCode}

if __name__ == '__main__':
    raw_input = sys.stdin.read().strip()
    if raw_input:
        lines = [l.strip() for l in raw_input.splitlines() if l.strip()]
        if not lines:
            sys.exit(0)
            
        sol = Solution()
        num_params = ${meta.params.length}
        
        for i in range(0, len(lines), num_params):
            if i + num_params > len(lines):
                break
                
            args = []
            for j in range(num_params):
                args.append(json.loads(lines[i+j]))
                
            result = sol.${meta.name}(*args)
            if result is not None:
                # Format to strict json representation, without spaces for easy comparison
                print(json.dumps(result, separators=(',', ':')))
`;
};

// ------------------------------------------------------------------
// C
// ------------------------------------------------------------------

const mapCType = (type: DataType): string => {
  switch (type) {
    case 'int': return 'int';
    case 'long': return 'long long';
    case 'float': return 'float';
    case 'double': return 'double';
    case 'char': return 'char';
    case 'boolean': return 'bool';
    case 'String': return 'char*';
    case 'int[]': return 'int*';
    // Add sizes to params in C
    default: return 'void*';
  }
};

const generateCStarter = (meta: FunctionMeta): string => {
  let params = meta.params.map(p => `${mapCType(p.type)} ${p.name}`).join(", ");
  if (meta.params.length === 0) params = 'void';
  return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

${mapCType(meta.returnType as DataType)} ${meta.name}(${params}) {
    // Write your code here
    
}
`;
};

const generateCWrapper = (meta: FunctionMeta, userCode: string): string => {
  // C requires manual memory management and lengths. 
  // We'll provide a basic implementation for primitives and 1D int arrays.
  
  const parseCalls = meta.params.map((p, i) => {
    let parseCode = "";
    if (p.type === 'int') {
        parseCode = `
        int ${p.name} = 0;
        scanf("%d", &${p.name});`;
    } else if (p.type === 'double') {
        parseCode = `
        double ${p.name} = 0;
        scanf("%lf", &${p.name});`;
    } else if (p.type === 'int[]') {
        // Reads standard json format for int array [1,2,3]
        parseCode = `
        char buffer_${p.name}[4096];
        scanf("%4095s", buffer_${p.name});
        int* ${p.name} = parse_int_array(buffer_${p.name});`;
    } else {
        parseCode = `// Unsupported type in C auto-wrapper: ${p.type}`;
    }

    return parseCode;
  }).join("");

  return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

${userCode}

// Basic parsers for C
int* parse_int_array(char* s) {
    if (strlen(s) < 2) return NULL;
    int* arr = malloc(sizeof(int) * 1024); // simplistic
    int count = 0;
    char* ptr = s + 1; // skip '['
    while (*ptr && *ptr != ']') {
        arr[count++] = atoi(ptr);
        while (*ptr && *ptr != ',' && *ptr != ']') ptr++;
        if (*ptr == ',') ptr++;
    }
    return arr;
}

void print_int_array(int* arr, int size) {
    printf("[");
    for(int i = 0; i < size; i++) {
        printf("%d%s", arr[i], i < size - 1 ? "," : "");
    }
    printf("]\\n");
}

int main() {
    // Read input and call ${meta.name}
    ${parseCalls}
    
    ${meta.returnType === 'void' 
        ? `${meta.name}(${meta.params.map(p => p.name).join(', ')});` 
        : `${mapCType(meta.returnType as DataType)} result = ${meta.name}(${meta.params.map(p => p.name).join(', ')});
    // NOTE: In C, printing the result automatically depends on the type.
    // For int:
    printf("%d\\n", result);`}
    return 0;
}
`;
};

// ------------------------------------------------------------------
// C++
// ------------------------------------------------------------------

const mapCppType = (type: DataType): string => {
  switch (type) {
    case 'int': return 'int';
    case 'long': return 'long long';
    case 'float': return 'float';
    case 'double': return 'double';
    case 'char': return 'char';
    case 'boolean': return 'bool';
    case 'String': return 'string';
    case 'int[]': return 'vector<int>';
    case 'int[][]': return 'vector<vector<int>>';
    case 'String[]': return 'vector<string>';
    case 'List<Integer>': return 'vector<int>';
    case 'List<List<Integer>>': return 'vector<vector<int>>';
    default: return 'void*'; // fallback
  }
};

const generateCppStarter = (meta: FunctionMeta): string => {
  const params = meta.params.map(p => `${mapCppType(p.type)} ${p.name}`).join(", ");
  return `#include <iostream>
#include <vector>
#include <string>

using namespace std;

class Solution {
public:
    ${meta.returnType === 'void' ? 'void' : mapCppType(meta.returnType as DataType)} ${meta.name}(${params}) {
        // Write your code here
        
    }
};
`;
};

const generateCppWrapper = (meta: FunctionMeta, userCode: string): string => {
  const parseCalls = meta.params.map((p, i) => {
    let parseMethod = "";
    if (p.type === 'int') parseMethod = "stoi(line)";
    else if (p.type === 'long') parseMethod = "stoll(line)";
    else if (p.type === 'double') parseMethod = "stod(line)";
    else if (p.type === 'float') parseMethod = "stof(line)";
    else if (p.type === 'boolean') parseMethod = "line == \"true\"";
    else if (p.type === 'char') parseMethod = "line.length() >= 3 ? line[1] : line[0]";
    else if (p.type === 'String') parseMethod = "line.length() >= 2 ? line.substr(1, line.length()-2) : line";
    else if (p.type === 'int[]' || p.type === 'List<Integer>') parseMethod = "parseInt1D(line)";
    else if (p.type === 'int[][]' || p.type === 'List<List<Integer>>') parseMethod = "parseInt2D(line)";
    else if (p.type === 'String[]') parseMethod = "parseString1D(line)";
    else parseMethod = "{}"; // fallback

    return `
        ${mapCppType(p.type)} ${p.name} = ${parseMethod};
        ${i < meta.params.length - 1 ? `getline(cin, line); while(line.empty() && !cin.eof()) getline(cin, line);` : ''}`;
  }).join("");

  return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

${userCode}

// Parsers
vector<int> parseInt1D(string s) {
    vector<int> res;
    if (s.length() < 2) return res;
    s = s.substr(1, s.length() - 2);
    stringstream ss(s);
    string item;
    while (getline(ss, item, ',')) {
        if(item.empty()) continue;
        res.push_back(stoi(item));
    }
    return res;
}

vector<vector<int>> parseInt2D(string s) {
    vector<vector<int>> res;
    if (s.length() < 2) return res;
    s = s.substr(1, s.length() - 2);
    int i = 0;
    while (i < s.length()) {
        if (s[i] == '[') {
            int j = i;
            int brackets = 0;
            while (j < s.length()) {
                if (s[j] == '[') brackets++;
                else if (s[j] == ']') {
                    brackets--;
                    if (brackets == 0) break;
                }
                j++;
            }
            res.push_back(parseInt1D(s.substr(i, j - i + 1)));
            i = j + 1;
        } else {
            i++;
        }
    }
    return res;
}

vector<string> parseString1D(string s) {
    vector<string> res;
    if (s.length() < 2) return res;
    s = s.substr(1, s.length() - 2);
    stringstream ss(s);
    string item;
    while (getline(ss, item, ',')) {
        if(item.empty()) continue;
        if(item.length() >= 2 && item.front() == '"' && item.back() == '"') {
            item = item.substr(1, item.length() - 2);
        }
        res.push_back(item);
    }
    return res;
}

string formatOutput(int val) { return to_string(val); }
string formatOutput(long long val) { return to_string(val); }
string formatOutput(double val) { return to_string(val); }
string formatOutput(float val) { return to_string(val); }
string formatOutput(bool val) { return val ? "true" : "false"; }
string formatOutput(char val) { string s(1, val); return s; }
string formatOutput(string val) { return val; }

template<typename T>
string formatOutput(const vector<T>& vec) {
    string res = "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        res += formatOutput(vec[i]);
        if (i != vec.size() - 1) res += ",";
    }
    res += "]";
    return res;
}

int main() {
    Solution sol;
    string line;
    
    while (getline(cin, line)) {
        if (line.empty()) continue;
        
        // Parse inputs${parseCalls}
        
        ${meta.returnType === 'void' 
          ? `sol.${meta.name}(${meta.params.map(p => p.name).join(', ')});` 
          : `auto result = sol.${meta.name}(${meta.params.map(p => p.name).join(', ')});
        cout << formatOutput(result) << endl;`}
    }
    return 0;
}
`;
};

// ------------------------------------------------------------------
// OUTPUT COMPARISON LOGIC
// ------------------------------------------------------------------

export interface CompareOptions {
  mode: 'exact' | 'float' | 'ignoreCase';
  floatTolerance?: number;
}

export const compareOutput = (actual: string = '', expected: string = '', options: CompareOptions): boolean => {
  const act = (actual || '').trim();
  const exp = (expected || '').trim();
  
  if (options.mode === 'exact') {
    return act === exp;
  }
  
  if (options.mode === 'ignoreCase') {
    return act.toLowerCase() === exp.toLowerCase();
  }
  
  if (options.mode === 'float') {
    const actFloat = parseFloat(act);
    const expFloat = parseFloat(exp);
    const tol = options.floatTolerance || 1e-6;
    if (!isNaN(actFloat) && !isNaN(expFloat)) {
      return Math.abs(actFloat - expFloat) <= tol;
    }
  }
  
  return false;
};
