import fs from 'fs';
import { WorkSheet, utils, readFile } from 'xlsx';
import {
  CellData,
  ClassData,
  Field,
  JSONData,
  JSONResultData,
} from '../types/excel';
import { SHEET_DATA, TITLE } from '../configs/excel';

const EXCEL_PATH = './public/tinchi.xlsx';
const JSON_PATH = './public/tinchi.json';

// Đọc sheet và xử lý các ô gộp
function readSheetAndUnmerge(filePath: string, sheetName: string): WorkSheet {
  // Đọc file Excel
  const workbook = readFile(filePath);

  // Chọn worksheet
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" không tìm thấy.`);
  }

  // Xử lý các ô gộp
  const mergedCells = worksheet['!merges'] || [];
  mergedCells.forEach((merge) => {
    const startCell = utils.encode_cell(merge.s); // Ô bắt đầu
    // const endCell = utils.encode_cell(merge.e); // Ô kết thúc
    const value = worksheet[startCell]?.v || ''; // Lấy giá trị từ ô bắt đầu

    // Điền tất cả các ô trong phạm vi gộp với cùng giá trị
    for (let row = merge.s.r; row <= merge.e.r; row++) {
      for (let col = merge.s.c; col <= merge.e.c; col++) {
        const cellAddress = utils.encode_cell({ r: row, c: col });
        worksheet[cellAddress] = { v: value, t: 's' }; // Điền giá trị
      }
    }
  });

  return worksheet;
}

// Đọc cột Excel và chuyển đổi thành JSON
function readExcelColumnToJson(
  workSheet: WorkSheet,
  column: string,
  startRow: number,
  endRow: number
): string[] {
  // Chọn phạm vi cụ thể
  const rangeData = utils.sheet_to_json<CellData>(workSheet, {
    range: `${column}${startRow}:${column}${endRow}`,
    header: 1,
  });
  
  return rangeData
    .map((row: CellData) => Object.values(row).map(val => String(val || '')))
    .flat()
    .filter(val => val && val.trim() !== ''); // Filter out empty values
}

function main() {
  const jsonData: JSONData = {};

  // Lặp qua các sheet trong SHEET_DATA
  for (const sheetName of Object.keys(SHEET_DATA)) {
    const sheetData = SHEET_DATA[sheetName];
    
    let workSheet;
    try {
      workSheet = readSheetAndUnmerge(EXCEL_PATH, sheetName);
    } catch (error) {
      console.error(`Error loading sheet ${sheetName}:`, error);
      continue; // Skip this sheet if it doesn't exist
    }

    // Khởi tạo dữ liệu JSON cho sheet
    jsonData[sheetName] = {
      fieldData: {
        [Field.Class]: [] as string[],
        [Field.DayOfWeek]: [] as string[],
        [Field.Session]: [] as string[],
        [Field.StartDate]: [] as string[],
        [Field.EndDate]: [] as string[],
        [Field.Teacher]: [] as string[],
      },
    };

    const jsonSheetData = jsonData[sheetName];
    const { startRow, endRow } = sheetData;

    const fields: [
      Field.Class,
      Field.DayOfWeek,
      Field.Session,
      Field.StartDate,
      Field.EndDate,
      Field.Teacher
    ] = [
      Field.Class,
      Field.DayOfWeek,
      Field.Session,
      Field.StartDate,
      Field.EndDate,
      Field.Teacher,
    ];    // Đọc dữ liệu từ các cột và lưu vào JSON
    for (const field of fields) {
      jsonSheetData.fieldData[field] = readExcelColumnToJson(
        workSheet,
        sheetData.fieldColumn[field],
        startRow,
        endRow
      );
    }
  }

  // Khởi tạo dữ liệu kết quả JSON
  const jsonResultData: JSONResultData = {
    title: TITLE,
    minDate: Infinity,
    maxDate: 0,
    majors: {},
  };  // Lặp qua các sheet trong jsonData
  for (const sheetName of Object.keys(jsonData)) {
    const { fieldData } = jsonData[sheetName];

    // Lặp qua các lớp học trong fieldData
    for (let i = 0; i < fieldData[Field.Class].length; i++) {
      // Lấy tên lớp học
      const classTitle = fieldData[Field.Class][i];      // Skip if classTitle is not a valid string
      if (!classTitle || typeof classTitle !== 'string' || classTitle.trim().length === 0) {
        continue;
      }      // Lấy tên môn học và mã lớp học
      let subjectName: string;
      let classCode: string;
      let practiceClassCode = '';

      // Special handling for subjects with complex naming patterns
      if (classTitle.includes('Giáo dục thể chất') || classTitle.includes('Tiếng Anh')) {
        // For subjects like "Giáo dục thể chất 5-1-25 (C8D701)-bóng đá" or "Tiếng Anh 3-1-25 (A20C8D701)_103"
        const match = classTitle.match(/^(.+?)\s*\(([^)]+)\)(.*)$/);
        if (match) {
          subjectName = match[1].trim(); // "Giáo dục thể chất 5-1-25" or "Tiếng Anh 3-1-25"
          classCode = match[2].trim(); // "C8D701" or "A20C8D701"
          const suffix = match[3].trim(); // "-bóng đá" or "_103"
          
          // For PE classes, append the sport type to the class code
          if (classTitle.includes('Giáo dục thể chất') && suffix.startsWith('-')) {
            classCode = `${classCode}${suffix}`; // "C8D701-bóng đá"
          }
          // For English classes, append the room/section code
          else if (classTitle.includes('Tiếng Anh') && suffix.startsWith('_')) {
            classCode = `${classCode}${suffix}`; // "A20C8D701_103"
          }
        } else {
          // Fallback to original logic
          subjectName = classTitle.replace(/\(([^()]+?)\)$/, '').trim();
          const classCodeWithPracticeClassCode = /\(([^()]+?)\)$/.test(classTitle)
            ? classTitle.match(/\(([^()]+?)\)$/)?.[1] || ''
            : '';
          classCode = classCodeWithPracticeClassCode.includes('.')
            ? classCodeWithPracticeClassCode.split('.')[0]
            : classCodeWithPracticeClassCode;
        }
      } else {
        // Original logic for other subjects
        subjectName = classTitle.replace(/\(([^()]+?)\)$/, '').trim();

        // Lấy mã lớp học kèm mã lớp thực hành (nếu có)
        const classCodeWithPracticeClassCode = /\(([^()]+?)\)$/.test(classTitle)
          ? classTitle.match(/\(([^()]+?)\)$/)?.[1] || ''
          : '';

        // Lấy mã lớp học
        classCode = classCodeWithPracticeClassCode.includes('.')
          ? classCodeWithPracticeClassCode.split('.')[0]
          : classCodeWithPracticeClassCode;

        // Lấy mã lớp thực hành
        practiceClassCode = classCodeWithPracticeClassCode.includes('.')
          ? classCodeWithPracticeClassCode.split('.')[1]
          : '';
      }

      // Validate that we have a valid class code
      if (!classCode || classCode.trim().length === 0) {
        console.log(`Skipping row with empty class code: Class=${classTitle}, Subject=${subjectName}`);
        continue;
      }

      // Use the sheet name as the major key instead of extracting from class code
      const majorKey = sheetName;

      // Kiểm tra xem dữ liệu của lớp học đã tồn tại chưa
      const isClassDataExist =
        jsonResultData.majors?.[majorKey]?.[subjectName]?.[classCode];      // Lấy dữ liệu của lớp học hiện tại hoặc tạo mới nếu chưa tồn tại
      const classData = isClassDataExist
        ? jsonResultData.majors[majorKey][subjectName][classCode]
        : ({
            schedules: [],
            [Field.Teacher]: fieldData[Field.Teacher][i] ?? '',
          } as ClassData);

      // Lấy dữ liệu của lớp học hiện tại để thêm thông tin vào
      let schedules = classData.schedules;

      // Lớp học hiện tại là lớp thực hành thì gán schedules là mảng của lớp thực hành
      if (practiceClassCode.length) {
        if (!classData.practiceSchedules) classData.practiceSchedules = {};
        if (!classData.practiceSchedules[practiceClassCode])
          classData.practiceSchedules[practiceClassCode] = [];

        schedules = classData.practiceSchedules[practiceClassCode];
      }      // Lấy ra ngày bắt đầu và kết thúc
      const startDateStr = fieldData[Field.StartDate][i];
      const endDateStr = fieldData[Field.EndDate][i];
        // Skip if dates are missing or invalid
      if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
        console.log(`Skipping row with invalid dates: Class=${classTitle}, Start=${startDateStr}, End=${endDateStr}`);
        continue;
      }
      
      const currentStartDate = Number(
        startDateStr.split('/').reverse().join('')
      );
      const currentEndDate = Number(
        endDateStr.split('/').reverse().join('')
      );

      // Cập nhật ngày nhỏ nhất và lớn nhất
      if (currentStartDate < jsonResultData.minDate)
        jsonResultData.minDate = currentStartDate;
      if (currentEndDate > jsonResultData.maxDate)
        jsonResultData.maxDate = currentEndDate;      const sessionStr = fieldData[Field.Session][i];
        // Skip if session is missing or invalid
      if (!sessionStr || typeof sessionStr !== 'string' || !sessionStr.includes('->')) {
        console.log(`Skipping row with invalid session: Class=${classTitle}, Session=${sessionStr}`);
        continue;
      }
        const session = sessionStr.split('->').map(Number);
      const startSession = session[0]; // tiết bắt đầu của lịch học
      const endSession = session[1]; // tiết kết thúc của lịch học

      // Validate session numbers
      if (isNaN(startSession) || isNaN(endSession) || startSession < 1 || endSession > 16 || startSession > endSession) {
        console.log(`Skipping row with invalid session numbers: Class=${classTitle}, StartSession=${startSession}, EndSession=${endSession}`);
        continue;
      }

      // thứ trong tuần của lịch học
      const dayOfWeekStr = fieldData[Field.DayOfWeek][i];
      if (!dayOfWeekStr) {
        console.log(`Skipping row with missing day of week: Class=${classTitle}`);
        continue;
      }      const dayOfWeek = parseInt(
        dayOfWeekStr === 'CN' ? '8' : dayOfWeekStr
      );
      
      // Validate day of week
      if (isNaN(dayOfWeek) || dayOfWeek < 2 || dayOfWeek > 8) {
        console.log(`Skipping row with invalid day of week: Class=${classTitle}, DayOfWeek=${dayOfWeekStr}`);
        continue;
      }
      
      const dayOfWeekStandard = dayOfWeek - 1 === 7 ? 0 : dayOfWeek - 1; // chuyển đổi thứ trong tuần từ 2-8 sang 0-6 (0: Chủ nhật)

      schedules.push({
        [Field.StartDate]: currentStartDate,
        [Field.EndDate]: currentEndDate,
        [Field.DayOfWeekStandard]: dayOfWeekStandard,
        [Field.StartSession]: startSession,
        [Field.EndSession]: endSession,
      });      // Cập nhật dữ liệu vào lại kho chính
      if (!jsonResultData.majors[majorKey])
        jsonResultData.majors[majorKey] = {};

      if (!jsonResultData.majors[majorKey][subjectName])
        jsonResultData.majors[majorKey][subjectName] = {};

      jsonResultData.majors[majorKey][subjectName][classCode] = classData;
    }
  }

  // Gộp lịch thực hành vào lịch lý thuyết
  for (const majorKey in jsonResultData.majors) {
    const majorData = jsonResultData.majors[majorKey];

    for (const subjectKey in majorData) {
      const subjectData = majorData[subjectKey];

      for (const classKey in subjectData) {
        const classData = subjectData[classKey];

        // Nếu lớp học có lịch thực hành thì gộp lịch lý thuyết + thực hành thành một lớp mới của môn học
        if (
          classData.practiceSchedules &&
          Object.keys(classData.practiceSchedules).length
        ) {
          for (const practiceClassKey in classData.practiceSchedules)
            subjectData[`${classKey}.${practiceClassKey}`] = {
              schedules: [
                ...classData.schedules,
                ...classData.practiceSchedules[practiceClassKey],
              ],
              [Field.Teacher]: classData[Field.Teacher],
            } as ClassData;

          // Xóa lớp học lý thuyết đi
          delete subjectData[classKey];
        }
      }
    }
  }

  // Filter out classes with empty schedules and log statistics
  let totalClasses = 0;
  let emptyScheduleClasses = 0;
  let validClasses = 0;

  for (const majorKey in jsonResultData.majors) {
    const majorData = jsonResultData.majors[majorKey];
    console.log(`\nProcessing major: ${majorKey}`);

    for (const subjectKey in majorData) {
      const subjectData = majorData[subjectKey];
      const classesToRemove: string[] = [];

      for (const classKey in subjectData) {
        totalClasses++;
        const classData = subjectData[classKey];

        // Check if class has empty schedules
        if (!classData.schedules || classData.schedules.length === 0) {
          emptyScheduleClasses++;
          classesToRemove.push(classKey);
          console.log(`  Removing empty class: ${subjectKey} (${classKey}) - no schedules`);
        } else {
          validClasses++;
        }
      }

      // Remove classes with empty schedules
      classesToRemove.forEach(classKey => {
        delete subjectData[classKey];
      });

      // Remove subjects that have no valid classes
      if (Object.keys(subjectData).length === 0) {
        delete majorData[subjectKey];
        console.log(`  Removed empty subject: ${subjectKey}`);
      }
    }

    // Remove majors that have no valid subjects
    if (Object.keys(majorData).length === 0) {
      delete jsonResultData.majors[majorKey];
      console.log(`Removed empty major: ${majorKey}`);
    }
  }

  console.log(`\n=== Processing Summary ===`);
  console.log(`Total classes processed: ${totalClasses}`);
  console.log(`Classes with empty schedules (removed): ${emptyScheduleClasses}`);
  console.log(`Valid classes retained: ${validClasses}`);
  console.log(`Data completion rate: ${((validClasses / totalClasses) * 100).toFixed(2)}%`);

  // Ghi dữ liệu JSON vào file
  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonResultData, null, 2), 'utf8');

  console.log('Ghi file thành công!');
}

main();
