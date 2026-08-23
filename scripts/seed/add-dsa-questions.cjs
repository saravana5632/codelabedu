// add-dsa-questions.cjs
//
// Adds "Binary Search", "Merge Sort" and "Quick Sort" questions to a test.
//
// Usage:
//   node add-dsa-questions.cjs            -> adds to the most recently created test
//   node add-dsa-questions.cjs <testId>   -> adds to a specific test id
//
// The titles MUST stay exactly "Binary Search", "Merge Sort", "Quick Sort"
// (lowercase-matched) because src/controllers/student.ts's validateAlgorithm()
// and src/pages/CodingPage.tsx's validateAlgorithm() both key off these exact
// substrings in the question title to decide which algorithm is required.
// If you rename them, students will get "Algorithm Validation: FAILED" even
// with a correct, working solution.

require("dotenv").config();
const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL || "file:data/codelab.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const questions = [
  {
    title: "Binary Search",
    description:
      "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.",
    constraints:
      "- 1 <= nums.length <= 10^4\n- -10^4 < nums[i], target < 10^4\n- All the integers in nums are unique.\n- nums is sorted in ascending order.",
    inputFormat:
      "The first line contains the array of integers, space-separated.\nThe second line contains the target integer.",
    outputFormat:
      "Return the index of the target integer. If it doesn't exist, return -1.",
    sampleInput: "-1 0 3 5 9 12\n9",
    sampleOutput: "4",
    difficulty: "easy",
    starterCode: {
      C: "int search(int* nums, int numsSize, int target) {\n    \n}",
      "C++":
        "class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        \n    }\n};",
      Java:
        "class Solution {\n    public int search(int[] nums, int target) {\n        \n    }\n}",
      Python: "class Solution:\n    def search(self, nums, target):\n        ",
      JavaScript: "var search = function(nums, target) {\n    \n};",
    },
    driverCode: {
      C: `#include <stdio.h>
#include <stdlib.h>

{{STUDENT_CODE}}

int main() {
    int capacity = 16, size = 0, num;
    int *nums = malloc(capacity * sizeof(int));
    char line[4096];
    fgets(line, sizeof(line), stdin);
    char *tok = strtok(line, " \\t\\n");
    while (tok) {
        if (size == capacity) { capacity *= 2; nums = realloc(nums, capacity * sizeof(int)); }
        nums[size++] = atoi(tok);
        tok = strtok(NULL, " \\t\\n");
    }
    int target;
    scanf("%d", &target);
    printf("%d\\n", search(nums, size, target));
    free(nums);
    return 0;
}`,
      "C++": `#include <iostream>
#include <vector>
#include <sstream>
using namespace std;

{{STUDENT_CODE}}

int main() {
    string line;
    getline(cin, line);
    istringstream iss(line);
    vector<int> nums; int num;
    while (iss >> num) nums.push_back(num);
    int target; cin >> target;
    Solution sol;
    cout << sol.search(nums, target) << endl;
    return 0;
}`,
      Java: `import java.util.*;

{{STUDENT_CODE}}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String[] parts = sc.nextLine().trim().split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        int target = Integer.parseInt(sc.nextLine().trim());
        Solution sol = new Solution();
        System.out.println(sol.search(nums, target));
    }
}`,
      Python: `{{STUDENT_CODE}}

import sys
lines = sys.stdin.read().splitlines()
nums = list(map(int, lines[0].split())) if lines[0].strip() else []
target = int(lines[1].strip())
sol = Solution()
print(sol.search(nums, target))`,
      JavaScript: `{{STUDENT_CODE}}

const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split('\\n');
const nums = input[0].trim() ? input[0].trim().split(/\\s+/).map(Number) : [];
const target = Number(input[1].trim());
console.log(search(nums, target));`,
    },
  },
  {
    title: "Merge Sort",
    description:
      "Given an array of integers nums, sort the array in ascending order using the Merge Sort algorithm and return it.\n\nYou must implement Merge Sort yourself (no built-in sort functions) in O(n log n) time.",
    constraints: "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
    inputFormat: "A single line containing the array of integers, space-separated.",
    outputFormat: "A single line containing the sorted array of integers, space-separated.",
    sampleInput: "5 2 3 1",
    sampleOutput: "1 2 3 5",
    difficulty: "medium",
    starterCode: {
      C: "int* sortArray(int* nums, int numsSize, int* returnSize) {\n    \n}",
      "C++":
        "class Solution {\npublic:\n    vector<int> sortArray(vector<int>& nums) {\n        \n    }\n};",
      Java: "class Solution {\n    public int[] sortArray(int[] nums) {\n        \n    }\n}",
      Python: "class Solution:\n    def sortArray(self, nums):\n        ",
      JavaScript: "var sortArray = function(nums) {\n    \n};",
    },
    driverCode: {
      C: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

{{STUDENT_CODE}}

int main() {
    int capacity = 16, size = 0, num;
    int *nums = malloc(capacity * sizeof(int));
    char line[65536];
    fgets(line, sizeof(line), stdin);
    char *tok = strtok(line, " \\t\\n");
    while (tok) {
        if (size == capacity) { capacity *= 2; nums = realloc(nums, capacity * sizeof(int)); }
        nums[size++] = atoi(tok);
        tok = strtok(NULL, " \\t\\n");
    }
    int returnSize = 0;
    int *res = sortArray(nums, size, &returnSize);
    for (int i = 0; i < returnSize; i++) printf("%d%s", res[i], i == returnSize - 1 ? "" : " ");
    printf("\\n");
    return 0;
}`,
      "C++": `#include <iostream>
#include <vector>
#include <sstream>
using namespace std;

{{STUDENT_CODE}}

int main() {
    string line;
    getline(cin, line);
    istringstream iss(line);
    vector<int> nums; int num;
    while (iss >> num) nums.push_back(num);
    Solution sol;
    vector<int> res = sol.sortArray(nums);
    for (size_t i = 0; i < res.size(); i++) cout << res[i] << (i + 1 == res.size() ? "" : " ");
    cout << endl;
    return 0;
}`,
      Java: `import java.util.*;

{{STUDENT_CODE}}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String line = sc.hasNextLine() ? sc.nextLine().trim() : "";
        int[] nums = line.isEmpty() ? new int[0] : Arrays.stream(line.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
        Solution sol = new Solution();
        int[] res = sol.sortArray(nums);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < res.length; i++) { sb.append(res[i]); if (i != res.length - 1) sb.append(" "); }
        System.out.println(sb.toString());
    }
}`,
      Python: `{{STUDENT_CODE}}

import sys
content = sys.stdin.read().strip()
nums = list(map(int, content.split())) if content else []
sol = Solution()
res = sol.sortArray(nums)
print(" ".join(map(str, res)))`,
      JavaScript: `{{STUDENT_CODE}}

const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();
const nums = input ? input.split(/\\s+/).map(Number) : [];
const res = sortArray(nums);
console.log(res.join(" "));`,
    },
  },
  {
    title: "Quick Sort",
    description:
      "Given an array of integers nums, sort the array in ascending order using the Quick Sort algorithm and return it.\n\nYou must implement Quick Sort yourself (no built-in sort functions) with average O(n log n) time complexity.",
    constraints: "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
    inputFormat: "A single line containing the array of integers, space-separated.",
    outputFormat: "A single line containing the sorted array of integers, space-separated.",
    sampleInput: "5 2 3 1",
    sampleOutput: "1 2 3 5",
    difficulty: "medium",
    starterCode: {
      C: "int* sortArray(int* nums, int numsSize, int* returnSize) {\n    \n}",
      "C++":
        "class Solution {\npublic:\n    vector<int> sortArray(vector<int>& nums) {\n        \n    }\n};",
      Java: "class Solution {\n    public int[] sortArray(int[] nums) {\n        \n    }\n}",
      Python: "class Solution:\n    def sortArray(self, nums):\n        ",
      JavaScript: "var sortArray = function(nums) {\n    \n};",
    },
    driverCode: {
      C: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

{{STUDENT_CODE}}

int main() {
    int capacity = 16, size = 0, num;
    int *nums = malloc(capacity * sizeof(int));
    char line[65536];
    fgets(line, sizeof(line), stdin);
    char *tok = strtok(line, " \\t\\n");
    while (tok) {
        if (size == capacity) { capacity *= 2; nums = realloc(nums, capacity * sizeof(int)); }
        nums[size++] = atoi(tok);
        tok = strtok(NULL, " \\t\\n");
    }
    int returnSize = 0;
    int *res = sortArray(nums, size, &returnSize);
    for (int i = 0; i < returnSize; i++) printf("%d%s", res[i], i == returnSize - 1 ? "" : " ");
    printf("\\n");
    return 0;
}`,
      "C++": `#include <iostream>
#include <vector>
#include <sstream>
using namespace std;

{{STUDENT_CODE}}

int main() {
    string line;
    getline(cin, line);
    istringstream iss(line);
    vector<int> nums; int num;
    while (iss >> num) nums.push_back(num);
    Solution sol;
    vector<int> res = sol.sortArray(nums);
    for (size_t i = 0; i < res.size(); i++) cout << res[i] << (i + 1 == res.size() ? "" : " ");
    cout << endl;
    return 0;
}`,
      Java: `import java.util.*;

{{STUDENT_CODE}}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String line = sc.hasNextLine() ? sc.nextLine().trim() : "";
        int[] nums = line.isEmpty() ? new int[0] : Arrays.stream(line.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
        Solution sol = new Solution();
        int[] res = sol.sortArray(nums);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < res.length; i++) { sb.append(res[i]); if (i != res.length - 1) sb.append(" "); }
        System.out.println(sb.toString());
    }
}`,
      Python: `{{STUDENT_CODE}}

import sys
content = sys.stdin.read().strip()
nums = list(map(int, content.split())) if content else []
sol = Solution()
res = sol.sortArray(nums)
print(" ".join(map(str, res)))`,
      JavaScript: `{{STUDENT_CODE}}

const fs = require('fs');
const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();
const nums = input ? input.split(/\\s+/).map(Number) : [];
const res = sortArray(nums);
console.log(res.join(" "));`,
    },
  },
];

async function main() {
  const argTestId = process.argv[2] ? Number(process.argv[2]) : null;

  let testId = argTestId;
  if (!testId) {
    const result = await client.execute(
      `SELECT id, title FROM tests ORDER BY id DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      console.error("No tests found. Create a test first, then re-run with: node add-dsa-questions.cjs <testId>");
      process.exit(1);
    }
    testId = result.rows[0].id;
    console.log(`No testId given — using most recent test: #${testId} (${result.rows[0].title})`);
  } else {
    const check = await client.execute({
      sql: `SELECT id, title FROM tests WHERE id = ?`,
      args: [testId],
    });
    if (check.rows.length === 0) {
      console.error(`Test #${testId} not found.`);
      process.exit(1);
    }
    console.log(`Adding questions to test #${testId} (${check.rows[0].title})`);
  }

  for (const q of questions) {
    // Avoid duplicate inserts if this question already exists on this test
    const existing = await client.execute({
      sql: `SELECT id FROM questions WHERE test_id = ? AND title = ?`,
      args: [testId, q.title],
    });
    if (existing.rows.length > 0) {
      console.log(`- "${q.title}" already exists on test #${testId} (id ${existing.rows[0].id}) — skipping`);
      continue;
    }

    const result = await client.execute({
      sql: `INSERT INTO questions
        (test_id, title, description, constraints, input_format, output_format, sample_input, sample_output, starter_code, driver_code, difficulty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testId,
        q.title,
        q.description,
        q.constraints,
        q.inputFormat,
        q.outputFormat,
        q.sampleInput,
        q.sampleOutput,
        JSON.stringify(q.starterCode),
        JSON.stringify(q.driverCode),
        q.difficulty,
      ],
    });
    console.log(`+ Added "${q.title}" (question id ${result.lastInsertRowid})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
