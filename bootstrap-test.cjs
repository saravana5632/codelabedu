// bootstrap-test.cjs
//
// Creates a published test (if none exists with the given title) and seeds
// Binary Search, Merge Sort, and Quick Sort questions into it.
//
// Usage:
//   node bootstrap-test.cjs
//
// Safe to re-run: skips creating the test if one with the same title already
// exists, and skips any question that's already on that test.

require("dotenv").config();
const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.DATABASE_URL || "file:data/codelab.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const TEST_TITLE = "Sorting and Searching Algorithms";
const TEST_SUBJECT = "Data Structures and Algorithms";
const TEST_DURATION_MINUTES = 60;

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
#include <string.h>

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

function isoNow(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60000).toISOString();
}

async function main() {
  let testRow = await client.execute({
    sql: `SELECT id, status FROM tests WHERE title = ?`,
    args: [TEST_TITLE],
  });

  let testId;
  if (testRow.rows.length > 0) {
    testId = testRow.rows[0].id;
    console.log(`Found existing test "${TEST_TITLE}" (id ${testId}, status: ${testRow.rows[0].status})`);
  } else {
    const startTime = isoNow(-5); // started 5 min ago so it's immediately available
    const endTime = isoNow(60 * 24 * 30); // open for 30 days
    const insert = await client.execute({
      sql: `INSERT INTO tests (title, subject, duration, start_time, end_time, status)
            VALUES (?, ?, ?, ?, ?, 'published')`,
      args: [TEST_TITLE, TEST_SUBJECT, TEST_DURATION_MINUTES, startTime, endTime],
    });
    testId = insert.lastInsertRowid;
    console.log(`Created test "${TEST_TITLE}" (id ${testId}), status: published`);
  }

  // Make sure it's published either way
  await client.execute({
    sql: `UPDATE tests SET status = 'published' WHERE id = ?`,
    args: [testId],
  });

  for (const q of questions) {
    const existing = await client.execute({
      sql: `SELECT id FROM questions WHERE test_id = ? AND title = ?`,
      args: [testId, q.title],
    });
    if (existing.rows.length > 0) {
      console.log(`- "${q.title}" already exists (id ${existing.rows[0].id}) — skipping`);
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

  console.log(`\nDone. Test id: ${testId}, status: published.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
