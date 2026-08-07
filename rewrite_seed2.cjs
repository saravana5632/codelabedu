const fs = require('fs');

let seed = fs.readFileSync('seed.ts', 'utf-8');

const replacement = `    // Seed questions
    await db.insert(questions).values([
      {
        testId: test.id,
        title: "Binary Search",
        description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\\n\\nYou must write an algorithm with O(log n) runtime complexity.",
        constraints: "- 1 <= nums.length <= 10^4\\n- -10^4 < nums[i], target < 10^4\\n- All the integers in nums are unique.\\n- nums is sorted in ascending order.",
        inputFormat: "The first line contains the array of integers, space-separated.\\nThe second line contains the target integer.",
        outputFormat: "Return the index of the target integer. If it doesn't exist, return -1.",
        sampleInput: "-1 0 3 5 9 12\\n9",
        sampleOutput: "4",
        difficulty: "easy",
        starterCode: {
          "C": "int search(int* nums, int numsSize, int target) {\\n    \\n}",
          "C++": "class Solution { public: int search(vector<int>& nums, int target) {\\n        \\n    } };",
          "Java": "class Solution { public int search(int[] nums, int target) {\\n        \\n    } }",
          "Python": "class Solution:\\n    def search(self, nums, target):\\n        ",
          "JavaScript": "var search = function(nums, target) {\\n    \\n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n#include <stdbool.h>\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    int capacity = 10;\\n    int* nums = (int*)malloc(capacity * sizeof(int));\\n    int size = 0;\\n    int num;\\n    char c;\\n    while (scanf(\\"%d%c\\", &num, &c) == 2) {\\n        if (size == capacity) {\\n            capacity *= 2;\\n            nums = (int*)realloc(nums, capacity * sizeof(int));\\n        }\\n        nums[size++] = num;\\n        if (c == '\\\\n') break;\\n    }\\n    int target;\\n    scanf(\\"%d\\", &target);\\n    printf(\\"%d\\\\n\\", search(nums, size, target));\\n    free(nums);\\n    return 0;\\n}",
          "C++": "#include <iostream>\\n#include <vector>\\n#include <sstream>\\nusing namespace std;\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    string line;\\n    if (!getline(cin, line)) return 0;\\n    istringstream iss(line);\\n    vector<int> nums;\\n    int num;\\n    while (iss >> num) nums.push_back(num);\\n    int target;\\n    if (!(cin >> target)) return 0;\\n    Solution sol;\\n    cout << sol.search(nums, target) << endl;\\n    return 0;\\n}",
          "Java": "import java.util.*;\\n\\n{{STUDENT_CODE}}\\n\\npublic class Main {\\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        if (!sc.hasNextLine()) return;\\n        String line1 = sc.nextLine().trim();\\n        int[] nums = new int[0];\\n        if (!line1.isEmpty()) {\\n            String[] parts = line1.split(\\"\\\\\\\\s+\\");\\n            nums = new int[parts.length];\\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\\n        }\\n        if (!sc.hasNextLine()) return;\\n        int target = Integer.parseInt(sc.nextLine().trim());\\n        Solution sol = new Solution();\\n        System.out.println(sol.search(nums, target));\\n    }\\n}",
          "Python": "{{STUDENT_CODE}}\\n\\nimport sys\\nif __name__ == '__main__':\\n    lines = sys.stdin.read().splitlines()\\n    if len(lines) >= 2:\\n        nums = list(map(int, lines[0].split())) if lines[0].strip() else []\\n        target = int(lines[1].strip())\\n        sol = Solution()\\n        print(sol.search(nums, target))",
          "JavaScript": "{{STUDENT_CODE}}\\n\\nconst fs = require('fs');\\nfunction main() {\\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split('\\\\n');\\n    if (input.length < 2) return;\\n    const nums = input[0].trim() ? input[0].trim().split(/\\\\s+/).map(Number) : [];\\n    const target = Number(input[1].trim());\\n    console.log(search(nums, target));\\n}\\nmain();"
        }
      },
      {
        testId: test.id,
        title: "Merge Sort",
        description: "Given an array of integers nums, sort the array in ascending order and return it.\\n\\nYou must solve the problem without using any built-in functions in O(nlog(n)) time complexity and with the smallest space complexity possible.",
        constraints: "- 1 <= nums.length <= 5 * 10^4\\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat: "A single line containing the array of integers, space-separated.",
        outputFormat: "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
        starterCode: {
          "C": "int* sortArray(int* nums, int numsSize, int* returnSize) {\\n    \\n}",
          "C++": "class Solution { public: vector<int> sortArray(vector<int>& nums) {\\n        \\n    } };",
          "Java": "class Solution { public int[] sortArray(int[] nums) {\\n        \\n    } }",
          "Python": "class Solution:\\n    def sortArray(self, nums):\\n        ",
          "JavaScript": "var sortArray = function(nums) {\\n    \\n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n#include <stdbool.h>\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    int capacity = 10;\\n    int* nums = (int*)malloc(capacity * sizeof(int));\\n    int size = 0;\\n    int num;\\n    while (scanf(\\"%d\\", &num) == 1) {\\n        if (size == capacity) {\\n            capacity *= 2;\\n            nums = (int*)realloc(nums, capacity * sizeof(int));\\n        }\\n        nums[size++] = num;\\n    }\\n    int returnSize = 0;\\n    int* res = sortArray(nums, size, &returnSize);\\n    for (int i = 0; i < returnSize; i++) {\\n        printf(\\"%d%s\\", res[i], i == returnSize - 1 ? \\"\\" : \\" \\");\\n    }\\n    printf(\\"\\\\n\\");\\n    free(nums);\\n    if (res) free(res);\\n    return 0;\\n}",
          "C++": "#include <iostream>\\n#include <vector>\\n#include <sstream>\\nusing namespace std;\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    string line;\\n    if (!getline(cin, line)) return 0;\\n    istringstream iss(line);\\n    vector<int> nums;\\n    int num;\\n    while (iss >> num) nums.push_back(num);\\n    Solution sol;\\n    vector<int> res = sol.sortArray(nums);\\n    for (size_t i = 0; i < res.size(); i++) {\\n        cout << res[i] << (i == res.size() - 1 ? \\"\\" : \\" \\");\\n    }\\n    cout << endl;\\n    return 0;\\n}",
          "Java": "import java.util.*;\\n\\n{{STUDENT_CODE}}\\n\\npublic class Main {\\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        if (!sc.hasNextLine()) return;\\n        String line = sc.nextLine().trim();\\n        int[] nums = new int[0];\\n        if (!line.isEmpty()) {\\n            String[] parts = line.split(\\"\\\\\\\\s+\\");\\n            nums = new int[parts.length];\\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\\n        }\\n        Solution sol = new Solution();\\n        int[] res = sol.sortArray(nums);\\n        for (int i = 0; i < res.length; i++) {\\n            System.out.print(res[i] + (i == res.length - 1 ? \\"\\" : \\" \\"));\\n        }\\n        System.out.println();\\n    }\\n}",
          "Python": "{{STUDENT_CODE}}\\n\\nimport sys\\nif __name__ == '__main__':\\n    content = sys.stdin.read().strip()\\n    nums = list(map(int, content.split())) if content else []\\n    sol = Solution()\\n    res = sol.sortArray(nums)\\n    print(\\" \\".join(map(str, res)))",
          "JavaScript": "{{STUDENT_CODE}}\\n\\nconst fs = require('fs');\\nfunction main() {\\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\\n    const nums = input ? input.split(/\\\\s+/).map(Number) : [];\\n    const res = sortArray(nums);\\n    console.log(res.join(\\" \\"));\\n}\\nmain();"
        }
      },
      {
        testId: test.id,
        title: "Sort an Array (Quick Sort)",
        description: "Given an array of integers nums, sort the array in ascending order and return it.\\n\\nYou must implement Quick Sort (not a built-in sort) with average O(n log n) time complexity.",
        constraints: "- 1 <= nums.length <= 5 * 10^4\\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat: "A single line containing the array of integers, space-separated.",
        outputFormat: "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
        starterCode: {
          "C": "int* sortArray(int* nums, int numsSize, int* returnSize) {\\n    \\n}",
          "C++": "class Solution { public: vector<int> sortArray(vector<int>& nums) {\\n        \\n    } };",
          "Java": "class Solution { public int[] sortArray(int[] nums) {\\n        \\n    } }",
          "Python": "class Solution:\\n    def sortArray(self, nums):\\n        ",
          "JavaScript": "var sortArray = function(nums) {\\n    \\n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\\n#include <stdlib.h>\\n#include <string.h>\\n#include <stdbool.h>\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    int capacity = 10;\\n    int* nums = (int*)malloc(capacity * sizeof(int));\\n    int size = 0;\\n    int num;\\n    while (scanf(\\"%d\\", &num) == 1) {\\n        if (size == capacity) {\\n            capacity *= 2;\\n            nums = (int*)realloc(nums, capacity * sizeof(int));\\n        }\\n        nums[size++] = num;\\n    }\\n    int returnSize = 0;\\n    int* res = sortArray(nums, size, &returnSize);\\n    for (int i = 0; i < returnSize; i++) {\\n        printf(\\"%d%s\\", res[i], i == returnSize - 1 ? \\"\\" : \\" \\");\\n    }\\n    printf(\\"\\\\n\\");\\n    free(nums);\\n    if (res) free(res);\\n    return 0;\\n}",
          "C++": "#include <iostream>\\n#include <vector>\\n#include <sstream>\\nusing namespace std;\\n\\n{{STUDENT_CODE}}\\n\\nint main() {\\n    string line;\\n    if (!getline(cin, line)) return 0;\\n    istringstream iss(line);\\n    vector<int> nums;\\n    int num;\\n    while (iss >> num) nums.push_back(num);\\n    Solution sol;\\n    vector<int> res = sol.sortArray(nums);\\n    for (size_t i = 0; i < res.size(); i++) {\\n        cout << res[i] << (i == res.size() - 1 ? \\"\\" : \\" \\");\\n    }\\n    cout << endl;\\n    return 0;\\n}",
          "Java": "import java.util.*;\\n\\n{{STUDENT_CODE}}\\n\\npublic class Main {\\n    public static void main(String[] args) {\\n        Scanner sc = new Scanner(System.in);\\n        if (!sc.hasNextLine()) return;\\n        String line = sc.nextLine().trim();\\n        int[] nums = new int[0];\\n        if (!line.isEmpty()) {\\n            String[] parts = line.split(\\"\\\\\\\\s+\\");\\n            nums = new int[parts.length];\\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\\n        }\\n        Solution sol = new Solution();\\n        int[] res = sol.sortArray(nums);\\n        for (int i = 0; i < res.length; i++) {\\n            System.out.print(res[i] + (i == res.length - 1 ? \\"\\" : \\" \\"));\\n        }\\n        System.out.println();\\n    }\\n}",
          "Python": "{{STUDENT_CODE}}\\n\\nimport sys\\nif __name__ == '__main__':\\n    content = sys.stdin.read().strip()\\n    nums = list(map(int, content.split())) if content else []\\n    sol = Solution()\\n    res = sol.sortArray(nums)\\n    print(\\" \\".join(map(str, res)))",
          "JavaScript": "{{STUDENT_CODE}}\\n\\nconst fs = require('fs');\\nfunction main() {\\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\\n    const nums = input ? input.split(/\\\\s+/).map(Number) : [];\\n    const res = sortArray(nums);\\n    console.log(res.join(\\" \\"));\\n}\\nmain();"
        }
      }
    ]);`;

const startIndex = seed.indexOf('    // Seed questions');
const endIndex = seed.indexOf('    console.log(`Added predefined test and questions`);');

if (startIndex !== -1 && endIndex !== -1) {
  const newSeed = seed.substring(0, startIndex) + replacement + '\n' + seed.substring(endIndex);
  fs.writeFileSync('seed.ts', newSeed);
  console.log('seed.ts successfully rewritten.');
} else {
  console.log('Failed to find start or end index in seed.ts');
}
