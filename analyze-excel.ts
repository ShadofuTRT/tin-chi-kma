import { utils, readFile } from 'xlsx';

const EXCEL_PATH = './public/tinchi.xlsx';

// Function to analyze a specific sheet
function analyzeSheet(filePath: string, sheetName: string): void {
  console.log(`\n=== Analyzing Sheet: ${sheetName} ===`);
  
  try {
    const workbook = readFile(filePath);
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      console.log(`Sheet "${sheetName}" not found.`);
      return;
    }

    // Get sheet range
    const range = utils.decode_range(worksheet['!ref'] || 'A1:A1');
    console.log(`Sheet range: ${worksheet['!ref']}`);
    
    // Check rows 5-533 as configured for A20C8D7
    const startRow = 5;
    const endRow = Math.min(533, range.e.r + 1);
    
    console.log(`Checking rows ${startRow} to ${endRow}`);
    
    let validRows = 0;
    let emptyClassRows = 0;
    let emptyDateRows = 0;
    let emptySessionRows = 0;
    let emptyDayOfWeekRows = 0;
    let totalRows = 0;
    
    for (let i = startRow; i <= endRow; i++) {
      totalRows++;
      
      // Get cell values for this row
      const classCell = `E${i}`;
      const dayOfWeekCell = `H${i}`;      const sessionCell = `I${i}`;
      const startDateCell = `K${i}`;
      const endDateCell = `L${i}`;
      
      const classValue = worksheet[classCell]?.v;
      const dayOfWeekValue = worksheet[dayOfWeekCell]?.v;
      const sessionValue = worksheet[sessionCell]?.v;      const startDateValue = worksheet[startDateCell]?.v;
      const endDateValue = worksheet[endDateCell]?.v;
      
      // Check for missing critical data
      if (!classValue || typeof classValue !== 'string') {
        emptyClassRows++;
        continue;
      }
      
      if (!startDateValue || !endDateValue) {
        emptyDateRows++;
        console.log(`Row ${i}: Missing dates - Start: ${startDateValue}, End: ${endDateValue}, Class: ${classValue}`);
        continue;
      }
      
      if (!sessionValue || typeof sessionValue !== 'string') {
        emptySessionRows++;
        console.log(`Row ${i}: Missing session - Session: ${sessionValue}, Class: ${classValue}`);
        continue;
      }
      
      if (!dayOfWeekValue) {
        emptyDayOfWeekRows++;
        console.log(`Row ${i}: Missing day of week - Day: ${dayOfWeekValue}, Class: ${classValue}`);
        continue;
      }
      
      validRows++;
      
      // Log first few valid rows for inspection
      if (validRows <= 5) {
        console.log(`Row ${i} (valid): Class=${classValue}, Session=${sessionValue}, Start=${startDateValue}, End=${endDateValue}, Day=${dayOfWeekValue}`);
      }
    }
    
    console.log(`\nSummary for ${sheetName}:`);
    console.log(`Total rows processed: ${totalRows}`);
    console.log(`Valid rows: ${validRows}`);
    console.log(`Empty class rows: ${emptyClassRows}`);
    console.log(`Empty date rows: ${emptyDateRows}`);
    console.log(`Empty session rows: ${emptySessionRows}`);
    console.log(`Empty day of week rows: ${emptyDayOfWeekRows}`);
    console.log(`Data completion rate: ${((validRows / totalRows) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error(`Error analyzing sheet ${sheetName}:`, error);
  }
}

// Main function
function main() {
  console.log('Analyzing Excel file for data quality issues...');
  
  // Analyze the A20C8D7 sheet specifically
  analyzeSheet(EXCEL_PATH, 'A20C8D7');
  
  // Also check a working sheet for comparison
  analyzeSheet(EXCEL_PATH, 'A20C801'); // This should have good data based on JSON output
}

main();
