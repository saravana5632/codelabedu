import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill in student login (from seed)
  await page.fill('input[type="text"]', 'S001'); // student roll number
  await page.fill('input[type="password"]', 'password'); // password
  await page.click('button:has-text("Sign In")');
  
  // Wait for student dashboard
  await page.waitForURL('**/student');
  console.log("Logged in");
  
  // Click on a test
  await page.click('text=Take Test');
  
  // Wait for test to load
  await page.waitForSelector('text=Merge Sort');
  console.log("Test loaded");
  
  // Click Merge Sort
  await page.click('text=Merge Sort');
  await page.waitForTimeout(1000); // wait for state
  
  // Log the code
  const codeBefore = await page.evaluate(() => {
    return (window as any).monaco.editor.getModels()[0].getValue();
  });
  console.log("Code before:", codeBefore);
  
  // Change language to C++
  await page.selectOption('select', 'C++');
  await page.waitForTimeout(1000);
  
  const codeAfter = await page.evaluate(() => {
    return (window as any).monaco.editor.getModels()[0].getValue();
  });
  console.log("Code after:", codeAfter);

  await browser.close();
})();
