import { db } from "./src/db/index.js";
import { students, faculty, tests, questions } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

const data = `2024PECCB290,LALU PRASAD B.P,18-04-2007
2024PECCB291,LOGANATH.T,19-07-2006
2024PECCB292,LOKANADHAM S,22-06-2006
2024PECCB293,LOKESH.M,12-09-2006
2024PECCB295,LOKESHWARAN K,30-12-2006
2024PECCB296,MANOJ R,23-05-2007
2024PECCB297,MANOJ KRISHNA K S,07-01-2007
2024PECCB298,MATHESH J,07-01-2007
2024PECCB299,MOHAMED AASEEF.M,09-08-2006
2024PECCB300,MOHITH HARIHARAN V,28-10-2005
2024PECCB301,NARASIMHA CHOWDARY V.C,23-07-2006
2024PECCB302,NARESH.R,05-02-2005
2024PECCB303,NAREN M,12-03-2007
2024PECCB304,NIHAL.B,27-09-2006
2024PECCB305,NIKHIL S,18-08-2006
2024PECCB306,NITHEESH KUMAR K R,19-12-2006
2024PECCB307,NITHISH KUMAR G,28-09-2006
2024PECCB309,PAVAN K,15-02-2006
2024PECCB310,PRAVIN KUMAR.A,29-03-2007
2024PECCB311,PRABHA.K,28-01-2006
2024PECCB312,RAGURAMAN S,04-07-2006
2024PECCB313,RAHUL KAUSHIK .L,13-03-2006
2024PECCB314,RAJARAJAN N,19-08-2006
2024PECCB316,RITHICK MURUGAN,24-9-2006
2024PECCB317,ROHITH J,16-12-2006
2024PECCB318,ROHITH SARAVANAN,05-04-2007
2024PECCB319,ROHITH.V.K,01-04-2007
2024PECCB320,RUBEN HALL JASTER.F,14-10-2005
2024PECCB321,SABARISH J,02-11-2006
2024PECCB322,SABARISH R,08-10-2007
2024PECCB323,SACHIN A,30-01-2007
2024PECCB324,SAIKRISHNAN S,11-12-2005
2024PECCB325,SAMUEL T,03-02-2007
2024PECCB326,SANJAI R,29-08-2005
2024PECCB327,SANTHOSH B,23-09-2006
2024PECCB328,S SARANAESWAR,09-09-2006
2024PECCB329,SARAN KUMAR U,17-06-2006
2024PECCB330,SARAVANAKUMAR G,15-07-2006
2024PECCB331,SENGAN S,25-08-2006
2024PECCB332,SHAFEEQ S,11-02-2007
2024PECCB333,SHARAN M,08-12-2006
2024PECCB334,SHASHANK S,05-10-2006
2024PECCB335,SHESHANANTHAN G,15-07-2006
2024PECCB336,SIDDHARTH M,21-03-2007
2024PECCB337,SRIKESH R,16-09-2006
2024PECCB338,SURIYA M,25-04-2007
2024PECCB339,SURIYA PRAKASH BS,21-06-2006
2024PECCB340,SURYA R M,02-12-2006
2024PECCB341,TAMILSELVAN M,08-04-2007
2024PECCB342,TARUN.H,08-09-2006
2024PECCB343,THARUN KALATHI V,24-11-2006
2024PECCB344,THARUN.S,18-03-2006
2024PECCB345,VENKATA HANUMA PHANI DATTA BHASKARUNI,08-05-2007
2024PECCB346,VEMULA LAKSHMI NARAYANA,06-03-2005
2024PECCB347,VIGNESH R,24-02-2007
2024PECCB348,VIJAYAGOVINDH J,17-08-2006
2024PECCB349,VINESH S,24-03-2007
2024PECCB350,YAKESH SHARMA.P,05-05-2007
2024PECCB351,YOGAPRADEEP,23-11-2006
2024PECCB352,YUVARAJ M,23-11-2006`;

async function seed() {
  const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (const line of lines) {
    const [rollNumber, name, dob] = line.split(',');
    
    // Check if student exists
    const existing = await db.select().from(students).where(eq(students.rollNumber, rollNumber)).get();
    
    if (!existing) {
      await db.insert(students).values({
        rollNumber,
        name,
        dob,
        department: "Computer Science and Business Systems",
        year: 3,
        semester: 5
      });
      console.log(`Added ${rollNumber} - ${name}`);
    } else {
      await db.update(students).set({
        department: "Computer Science and Business Systems",
        year: 3,
        semester: 5
      }).where(eq(students.rollNumber, rollNumber));
      console.log(`Updated ${rollNumber} - ${name}`);
    }
  }

  // Check if faculty exists
  let adminFaculty = await db.select().from(faculty).where(eq(faculty.email, "admin@codelab.edu")).get();
  if (!adminFaculty) {
    adminFaculty = await db.insert(faculty).values({
      name: "Admin Faculty",
      email: "admin@codelab.edu",
      password: "password123"
    }).returning().get();
    console.log(`Added faculty admin@codelab.edu`);
  } else {
    // Ensure the password is updated if it already exists
    await db.update(faculty).set({ password: "password123" }).where(eq(faculty.email, "admin@codelab.edu"));
    console.log(`Updated faculty admin@codelab.edu password`);
  }
  
  // Seed predefined Data Structures test
  const existingTest = await db.select().from(tests).where(eq(tests.title, "Data Structures: Sorting & Searching")).get();
  if (!existingTest && adminFaculty) {
    const test = await db.insert(tests).values({
      title: "Data Structures: Sorting & Searching",
      subject: "Data Structures",
      facultyId: adminFaculty.id,
      duration: 120,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "published"
    }).returning().get();
    
    // Seed questions
    await db.insert(questions).values([
      {
        testId: test.id,
        title: "Binary Search",
        description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.",
        constraints: "- 1 <= nums.length <= 10^4\n- -10^4 < nums[i], target < 10^4\n- All the integers in nums are unique.\n- nums is sorted in ascending order.",
        inputFormat: "The first line contains the array of integers, space-separated.\nThe second line contains the target integer.",
        outputFormat: "Return the index of the target integer. If it doesn't exist, return -1.",
        sampleInput: "-1 0 3 5 9 12\n9",
        sampleOutput: "4",
        difficulty: "easy",
        starterCode: {
          "C": "int search(int* nums, int numsSize, int target) {\n    \n}",
          "C++": "class Solution { public: int search(vector<int>& nums, int target) {\n        \n    } };",
          "Java": "class Solution { public int search(int[] nums, int target) {\n        \n    } }",
          "Python": "class Solution:\n    def search(self, nums, target):\n        ",
          "JavaScript": "var search = function(nums, target) {\n    \n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n{{STUDENT_CODE}}\n\nint main() {\n    int capacity = 10;\n    int* nums = (int*)malloc(capacity * sizeof(int));\n    int size = 0;\n    int num;\n    char c;\n    while (scanf(\"%d%c\", &num, &c) == 2) {\n        if (size == capacity) {\n            capacity *= 2;\n            nums = (int*)realloc(nums, capacity * sizeof(int));\n        }\n        nums[size++] = num;\n        if (c == '\\n') break;\n    }\n    int target;\n    scanf(\"%d\", &target);\n    printf(\"%d\\n\", search(nums, size, target));\n    free(nums);\n    return 0;\n}",
          "C++": "#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\n\n{{STUDENT_CODE}}\n\nint main() {\n    string line;\n    if (!getline(cin, line)) return 0;\n    istringstream iss(line);\n    vector<int> nums;\n    int num;\n    while (iss >> num) nums.push_back(num);\n    int target;\n    if (!(cin >> target)) return 0;\n    Solution sol;\n    cout << sol.search(nums, target) << endl;\n    return 0;\n}",
          "Java": "import java.util.*;\n\n{{STUDENT_CODE}}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String line1 = sc.nextLine().trim();\n        int[] nums = new int[0];\n        if (!line1.isEmpty()) {\n            String[] parts = line1.split(\"\\\\s+\");\n            nums = new int[parts.length];\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        }\n        if (!sc.hasNextLine()) return;\n        int target = Integer.parseInt(sc.nextLine().trim());\n        Solution sol = new Solution();\n        System.out.println(sol.search(nums, target));\n    }\n}",
          "Python": "{{STUDENT_CODE}}\n\nimport sys\nif __name__ == '__main__':\n    lines = sys.stdin.read().splitlines()\n    if len(lines) >= 2:\n        nums = list(map(int, lines[0].split())) if lines[0].strip() else []\n        target = int(lines[1].strip())\n        sol = Solution()\n        print(sol.search(nums, target))",
          "JavaScript": "{{STUDENT_CODE}}\n\nconst fs = require('fs');\nfunction main() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split('\\n');\n    if (input.length < 2) return;\n    const nums = input[0].trim() ? input[0].trim().split(/\\s+/).map(Number) : [];\n    const target = Number(input[1].trim());\n    console.log(search(nums, target));\n}\nmain();"
        }
      },
      {
        testId: test.id,
        title: "Merge Sort",
        description: "Given an array of integers nums, sort the array in ascending order and return it.\n\nYou must solve the problem without using any built-in functions in O(nlog(n)) time complexity and with the smallest space complexity possible.",
        constraints: "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat: "A single line containing the array of integers, space-separated.",
        outputFormat: "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
        starterCode: {
          "C": "int* sortArray(int* nums, int numsSize, int* returnSize) {\n    \n}",
          "C++": "class Solution { public: vector<int> sortArray(vector<int>& nums) {\n        \n    } };",
          "Java": "class Solution { public int[] sortArray(int[] nums) {\n        \n    } }",
          "Python": "class Solution:\n    def sortArray(self, nums):\n        ",
          "JavaScript": "var sortArray = function(nums) {\n    \n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n{{STUDENT_CODE}}\n\nint main() {\n    int capacity = 10;\n    int* nums = (int*)malloc(capacity * sizeof(int));\n    int size = 0;\n    int num;\n    while (scanf(\"%d\", &num) == 1) {\n        if (size == capacity) {\n            capacity *= 2;\n            nums = (int*)realloc(nums, capacity * sizeof(int));\n        }\n        nums[size++] = num;\n    }\n    int returnSize = 0;\n    int* res = sortArray(nums, size, &returnSize);\n    for (int i = 0; i < returnSize; i++) {\n        printf(\"%d%s\", res[i], i == returnSize - 1 ? \"\" : \" \");\n    }\n    printf(\"\\n\");\n    free(nums);\n    if (res) free(res);\n    return 0;\n}",
          "C++": "#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\n\n{{STUDENT_CODE}}\n\nint main() {\n    string line;\n    if (!getline(cin, line)) return 0;\n    istringstream iss(line);\n    vector<int> nums;\n    int num;\n    while (iss >> num) nums.push_back(num);\n    Solution sol;\n    vector<int> res = sol.sortArray(nums);\n    for (size_t i = 0; i < res.size(); i++) {\n        cout << res[i] << (i == res.size() - 1 ? \"\" : \" \");\n    }\n    cout << endl;\n    return 0;\n}",
          "Java": "import java.util.*;\n\n{{STUDENT_CODE}}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String line = sc.nextLine().trim();\n        int[] nums = new int[0];\n        if (!line.isEmpty()) {\n            String[] parts = line.split(\"\\\\s+\");\n            nums = new int[parts.length];\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        }\n        Solution sol = new Solution();\n        int[] res = sol.sortArray(nums);\n        for (int i = 0; i < res.length; i++) {\n            System.out.print(res[i] + (i == res.length - 1 ? \"\" : \" \"));\n        }\n        System.out.println();\n    }\n}",
          "Python": "{{STUDENT_CODE}}\n\nimport sys\nif __name__ == '__main__':\n    content = sys.stdin.read().strip()\n    nums = list(map(int, content.split())) if content else []\n    sol = Solution()\n    res = sol.sortArray(nums)\n    print(\" \".join(map(str, res)))",
          "JavaScript": "{{STUDENT_CODE}}\n\nconst fs = require('fs');\nfunction main() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\n    const nums = input ? input.split(/\\s+/).map(Number) : [];\n    const res = sortArray(nums);\n    console.log(res.join(\" \"));\n}\nmain();"
        }
      },
      {
        testId: test.id,
        title: "Sort an Array (Quick Sort)",
        description: "Given an array of integers nums, sort the array in ascending order and return it.\n\nYou must implement Quick Sort (not a built-in sort) with average O(n log n) time complexity.",
        constraints: "- 1 <= nums.length <= 5 * 10^4\n- -5 * 10^4 <= nums[i] <= 5 * 10^4",
        inputFormat: "A single line containing the array of integers, space-separated.",
        outputFormat: "A single line containing the sorted array of integers, space-separated.",
        sampleInput: "5 2 3 1",
        sampleOutput: "1 2 3 5",
        difficulty: "medium",
        starterCode: {
          "C": "int* sortArray(int* nums, int numsSize, int* returnSize) {\n    \n}",
          "C++": "class Solution { public: vector<int> sortArray(vector<int>& nums) {\n        \n    } };",
          "Java": "class Solution { public int[] sortArray(int[] nums) {\n        \n    } }",
          "Python": "class Solution:\n    def sortArray(self, nums):\n        ",
          "JavaScript": "var sortArray = function(nums) {\n    \n};"
        },
        driverCode: {
          "C": "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n{{STUDENT_CODE}}\n\nint main() {\n    int capacity = 10;\n    int* nums = (int*)malloc(capacity * sizeof(int));\n    int size = 0;\n    int num;\n    while (scanf(\"%d\", &num) == 1) {\n        if (size == capacity) {\n            capacity *= 2;\n            nums = (int*)realloc(nums, capacity * sizeof(int));\n        }\n        nums[size++] = num;\n    }\n    int returnSize = 0;\n    int* res = sortArray(nums, size, &returnSize);\n    for (int i = 0; i < returnSize; i++) {\n        printf(\"%d%s\", res[i], i == returnSize - 1 ? \"\" : \" \");\n    }\n    printf(\"\\n\");\n    free(nums);\n    if (res) free(res);\n    return 0;\n}",
          "C++": "#include <iostream>\n#include <vector>\n#include <sstream>\nusing namespace std;\n\n{{STUDENT_CODE}}\n\nint main() {\n    string line;\n    if (!getline(cin, line)) return 0;\n    istringstream iss(line);\n    vector<int> nums;\n    int num;\n    while (iss >> num) nums.push_back(num);\n    Solution sol;\n    vector<int> res = sol.sortArray(nums);\n    for (size_t i = 0; i < res.size(); i++) {\n        cout << res[i] << (i == res.size() - 1 ? \"\" : \" \");\n    }\n    cout << endl;\n    return 0;\n}",
          "Java": "import java.util.*;\n\n{{STUDENT_CODE}}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String line = sc.nextLine().trim();\n        int[] nums = new int[0];\n        if (!line.isEmpty()) {\n            String[] parts = line.split(\"\\\\s+\");\n            nums = new int[parts.length];\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n        }\n        Solution sol = new Solution();\n        int[] res = sol.sortArray(nums);\n        for (int i = 0; i < res.length; i++) {\n            System.out.print(res[i] + (i == res.length - 1 ? \"\" : \" \"));\n        }\n        System.out.println();\n    }\n}",
          "Python": "{{STUDENT_CODE}}\n\nimport sys\nif __name__ == '__main__':\n    content = sys.stdin.read().strip()\n    nums = list(map(int, content.split())) if content else []\n    sol = Solution()\n    res = sol.sortArray(nums)\n    print(\" \".join(map(str, res)))",
          "JavaScript": "{{STUDENT_CODE}}\n\nconst fs = require('fs');\nfunction main() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\n    const nums = input ? input.split(/\\s+/).map(Number) : [];\n    const res = sortArray(nums);\n    console.log(res.join(\" \"));\n}\nmain();"
        }
      }
    ]);
    console.log(`Added predefined test and questions`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed();
