import { readFile, utils } from 'xlsx';

const EXCEL_PATH = './public/tinchi.xlsx';

function exploreExcel() {
  const workbook = readFile(EXCEL_PATH);
  
  console.log('Available sheets:', Object.keys(workbook.Sheets));
  
  // Check the first sheet to see its structure
  const firstSheetName = Object.keys(workbook.Sheets)[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  console.log(`\nExploring sheet: ${firstSheetName}`);
  
  // Convert to JSON to see the structure
  const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log('First 10 rows:');
  jsonData.slice(0, 10).forEach((row, index) => {
    console.log(`Row ${index + 1}:`, row);
  });
  
  // Check columns A through M for row 5 (which is where our data starts)
  console.log('\nRow 5 data by columns:');
  const row5 = jsonData[4] as any[]; // Row 5 (0-indexed as 4)
  if (row5) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach((col, index) => {
      console.log(`Column ${col} (${index}): ${row5[index]}`);
    });
  }
}

exploreExcel();
