/**
 * Google Apps Script Web App for Logging CodeLab Submissions
 * 
 * Instructions:
 * 1. Create a new Google Sheet named "Submissions".
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire script.
 * 4. Save the file.
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 * 7. Set "Execute as" to "Me".
 * 8. Set "Who has access" to "Anyone".
 * 9. Click Deploy and authorize the script.
 * 10. Copy the "Web app URL" and set it as APPS_SCRIPT_WEBHOOK_URL in your backend environment.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  
  // Wait for up to 10 seconds for other processes to finish.
  try {
    lock.waitLock(10000);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Could not obtain lock after 10 seconds."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Submissions");
      // Add headers if new sheet
      sheet.appendRow([
        "Timestamp", "Name", "Roll Number", "Problem Title", 
        "Language", "Verdict", "Test Case 1", "Test Case 2", "Marks Awarded", "Code"
      ]);
      sheet.getRange("A1:J1").setFontWeight("bold");
    }

    var payload = JSON.parse(e.postData.contents);
    var name = payload.name;
    var rollNumber = payload.rollNumber;
    var problemTitle = payload.problemTitle;
    
    var data = sheet.getDataRange().getValues();
    var updated = false;

    // Start from row 1 (0-indexed is 1 because row 0 is header)
    for (var i = 1; i < data.length; i++) {
      var rowName = data[i][1];
      var rowRollNumber = data[i][2];
      var rowProblemTitle = data[i][3];
      
      // If student and problem match, overwrite the row
      if (rowName === name && rowRollNumber === rollNumber && rowProblemTitle === problemTitle) {
        var rowNum = i + 1; // +1 because array is 0-indexed and sheets are 1-indexed
        sheet.getRange(rowNum, 1, 1, 10).setValues([[
          payload.timestamp,
          payload.name,
          payload.rollNumber,
          payload.problemTitle,
          payload.language,
          payload.verdict,
          payload.testCase1Result,
          payload.testCase2Result,
          payload.marksAwarded,
          payload.code
        ]]);
        updated = true;
        break;
      }
    }
    
    // If not found, append a new row
    if (!updated) {
      sheet.appendRow([
        payload.timestamp,
        payload.name,
        payload.rollNumber,
        payload.problemTitle,
        payload.language,
        payload.verdict,
        payload.testCase1Result,
        payload.testCase2Result,
        payload.marksAwarded,
        payload.code
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Release the lock so other requests can proceed
    lock.releaseLock();
  }
}
