import fs from 'fs';

interface Schedule {
  startDate: number;
  endDate: number;
  dayOfWeekStandard: number;
  startSession: number;
  endSession: number;
}

interface ClassData {
  schedules: Schedule[];
  teacher: string;
}

type SubjectData = Record<string, ClassData>;
type MajorData = Record<string, SubjectData>;

interface JSONResultData {
  title: string;
  minDate: number;
  maxDate: number;
  majors: Record<string, MajorData>;
}

/**
 * Validates the JSON calendar data for quality issues
 */
function validateCalendarData(): void {
  const JSON_PATH = './public/tinchi.json';
  
  if (!fs.existsSync(JSON_PATH)) {
    console.error('JSON file not found:', JSON_PATH);
    return;
  }

  try {
    const data: JSONResultData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    
    console.log('=== Calendar Data Validation Report ===');
    console.log(`Title: ${data.title}`);
    console.log(`Date range: ${data.minDate} - ${data.maxDate}`);
    console.log();

    let totalMajors = 0;
    let totalSubjects = 0;
    let totalClasses = 0;
    let emptyScheduleClasses = 0;
    let validClasses = 0;

    for (const [majorKey, majorData] of Object.entries(data.majors)) {
      totalMajors++;
      let majorSubjects = 0;
      let majorClasses = 0;
      let majorEmptyClasses = 0;
      
      for (const [subjectName, subjectData] of Object.entries(majorData)) {
        totalSubjects++;
        majorSubjects++;
        
        for (const [classCode, classData] of Object.entries(subjectData)) {
          totalClasses++;
          majorClasses++;
          
          if (!classData.schedules || classData.schedules.length === 0) {
            emptyScheduleClasses++;
            majorEmptyClasses++;
            console.warn(`Empty schedules: ${majorKey} > ${subjectName} > ${classCode}`);
          } else {
            validClasses++;
            
            // Validate schedule data quality
            for (const [scheduleIndex, schedule] of classData.schedules.entries()) {
              // Check for invalid dates
              if (!schedule.startDate || !schedule.endDate || schedule.startDate > schedule.endDate) {
                console.warn(`Invalid dates in ${majorKey} > ${subjectName} > ${classCode} [${scheduleIndex}]: ${schedule.startDate} - ${schedule.endDate}`);
              }
              
              // Check for invalid sessions
              if (!schedule.startSession || !schedule.endSession || 
                  schedule.startSession < 1 || schedule.endSession > 16 || 
                  schedule.startSession > schedule.endSession) {
                console.warn(`Invalid sessions in ${majorKey} > ${subjectName} > ${classCode} [${scheduleIndex}]: ${schedule.startSession} - ${schedule.endSession}`);
              }
              
              // Check for invalid day of week
              if (schedule.dayOfWeekStandard < 0 || schedule.dayOfWeekStandard > 6) {
                console.warn(`Invalid day of week in ${majorKey} > ${subjectName} > ${classCode} [${scheduleIndex}]: ${schedule.dayOfWeekStandard}`);
              }
            }
          }
        }
      }
      
      console.log(`${majorKey}: ${majorSubjects} subjects, ${majorClasses} classes (${majorEmptyClasses} empty)`);
    }

    console.log();
    console.log('=== Summary ===');
    console.log(`Total majors: ${totalMajors}`);
    console.log(`Total subjects: ${totalSubjects}`);
    console.log(`Total classes: ${totalClasses}`);
    console.log(`Classes with valid schedules: ${validClasses}`);
    console.log(`Classes with empty schedules: ${emptyScheduleClasses}`);
    console.log(`Data quality: ${((validClasses / totalClasses) * 100).toFixed(2)}%`);
    
    if (emptyScheduleClasses === 0) {
      console.log('All classes have valid schedule data!');
    } else {
      console.log(`${emptyScheduleClasses} classes have empty schedules and should be reviewed.`);
    }
    
  } catch (error) {
    console.error('Error validating calendar data:', error);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateCalendarData();
}

export { validateCalendarData };
