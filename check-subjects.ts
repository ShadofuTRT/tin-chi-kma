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

function checkSpecificSubjects(): void {
  const JSON_PATH = './public/tinchi.json';
  
  if (!fs.existsSync(JSON_PATH)) {
    console.error('JSON file not found:', JSON_PATH);
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    
    console.log('=== Checking PE and English Subjects ===\n');

    // Check A20C8D7 major for these subjects
    const majorData = data.majors['A20C8D7'];
    if (!majorData) {
      console.log('A20C8D7 major not found');
      return;
    }

    // Check PE subjects
    const peSubjects = Object.keys(majorData).filter((subject: string) => 
      subject.includes('Giáo dục thể chất')
    );
    
    console.log('📚 Physical Education (PE) Subjects:');
    peSubjects.forEach((subject: string) => {
      const classes = Object.keys(majorData[subject]);
      console.log(`  ${subject}:`);
      classes.forEach((classCode: string) => {
        const classData: ClassData = majorData[subject][classCode];
        const scheduleCount = classData.schedules ? classData.schedules.length : 0;
        console.log(`    - ${classCode} (${scheduleCount} schedules) - Teacher: ${classData.teacher}`);
      });
      console.log();
    });

    // Check English subjects
    const englishSubjects = Object.keys(majorData).filter((subject: string) => 
      subject.includes('Tiếng Anh')
    );
    
    console.log('🇺🇸 English Subjects:');
    englishSubjects.forEach((subject: string) => {
      const classes = Object.keys(majorData[subject]);
      console.log(`  ${subject}:`);
      classes.forEach((classCode: string) => {
        const classData: ClassData = majorData[subject][classCode];
        const scheduleCount = classData.schedules ? classData.schedules.length : 0;
        console.log(`    - ${classCode} (${scheduleCount} schedules) - Teacher: ${classData.teacher}`);
      });
      console.log();
    });

    // Summary
    const totalPEClasses = peSubjects.reduce((total: number, subject: string) => {
      return total + Object.keys(majorData[subject]).length;
    }, 0);
    
    const totalEnglishClasses = englishSubjects.reduce((total: number, subject: string) => {
      return total + Object.keys(majorData[subject]).length;
    }, 0);

    console.log('📊 Summary:');
    console.log(`  PE Subjects: ${peSubjects.length} subjects, ${totalPEClasses} classes`);
    console.log(`  English Subjects: ${englishSubjects.length} subjects, ${totalEnglishClasses} classes`);
    
  } catch (error) {
    console.error('Error checking subjects:', error);
  }
}

checkSpecificSubjects();
