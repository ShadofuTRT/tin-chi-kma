import {
  END_AFTERNOON_SESSION,
  END_EVENING_SESSION,
  END_MORNING_SESSION,
  START_AFTERNOON_SESSION,
  START_EVENING_SESSION,
  START_MORNING_SESSION,
} from '../constants/calendar';
import {
  AutoMode,
  CalendarData,
  CalendarGroupByClassDetail,
  CalendarGroupByMajor,
  CalendarGroupBySessionDetail,
  CalendarGroupBySubjectName,
  CalendarTableContent,
  ClassCombination,
} from '../types/calendar';
import {
  calculateOverlapBetween2Classes,
  calculateOverlapWithBitmask2,
} from '../utils/calendar_overlap';

function workerCalculateCalendarTableContent(
  calendarTableContent: CalendarTableContent,
  calendarGroupByMajor: CalendarGroupByMajor,
  dateList: number[], // Danh sách ngày của học kỳ
  sessions: number[]
): {
  updatedCalendarTableContent: CalendarTableContent;
  updatedCalendarGroupByMajor: CalendarGroupByMajor;
  isConflict: boolean;
} {
  const updatedCalendarTableContent = structuredClone(calendarTableContent);
  const updatedCalendarGroupByMajor = structuredClone(calendarGroupByMajor);
  let isConflict = false;

  // Lặp qua từng ngày
  for (const date of dateList) {
    // Lấy ra lịch học trong ngày
    const dateData = updatedCalendarTableContent[date];

    // Lặp qua từng tiết
    for (const session of sessions) {
      // Lấy ra thông tin lịch học của tiết đó
      dateData[session] = workerGetSessionContent(
        updatedCalendarGroupByMajor,
        date,
        session
      );

      // Nếu tiết học đó có trên 2 môn học thì xem như tiết học bị trùng
      if (dateData[session].length > 1) isConflict = true;
    }
  }

  return {
    updatedCalendarTableContent,
    updatedCalendarGroupByMajor,
    isConflict,
  };
}

function workerGetSessionContent(
  calendarGroupByMajor: CalendarGroupByMajor,
  date: number,
  session: number
): CalendarGroupBySessionDetail[] {
  const result: CalendarGroupBySessionDetail[] = [];
  const dow = new Date(date).getDay();

  // Lặp qua từng khóa / ngành
  for (const majorName in calendarGroupByMajor) {
    // Chi tiết lịch học của khóa / ngành
    const majorData = calendarGroupByMajor[majorName];

    // Lặp qua từng môn của khóa / ngành
    for (const subjectName in majorData.subjects) {
      // Chi tiết lịch học của môn
      const subjectData = majorData.subjects[subjectName];

      // Nếu môn đó không được hiển thị trên lịch hoặc không có lớp nào được chọn
      // thì bỏ qua
      if (!subjectData.displayOnCalendar || !subjectData.selectedClass?.length)
        continue;

      // Chi tiết lịch học của lớp được chọn
      const classData = subjectData.classes[subjectData.selectedClass];

      // Lặp qua từng phần lịch của lớp
      for (const classPart of classData.details) {
        // Nếu thời gian của phần lịch học trùng khớp với thời gian hiện tại
        // thì thêm vào kết quả
        if (
          classPart.startDate <= date &&
          classPart.endDate >= date &&
          dow === classPart.dayOfWeek &&
          classPart.startSession <= session &&
          classPart.endSession >= session
        )
          result.push(classPart);
      }
    }
  }

  return result;
}

/**
 * Tìm ra tổ hợp các lớp từ các môn được chọn sao cho độ trùng lặp thời gian học là ít nhất
 *
 * @param selectedCalendar - Đối tượng chứa các môn học đã được chọn
 *
 * @returns Đối tượng CalendarTableContent chứa tổ hợp các lớp học tối ưu
 */
export async function workerAutoCalculateCalendarTableContent(
  calendarTableContent: CalendarTableContent,
  calendarGroupByMajor: CalendarGroupByMajor,
  dateList: number[], // Danh sách ngày của học kỳ
  sessions: number[], // Danh sách tiết học (1 -> 16),
  auto: AutoMode,
  autoTh: number
): Promise<{
  updatedCalendarTableContent: CalendarTableContent;
  updatedCalendarGroupByMajor: CalendarGroupByMajor;
  isConflict: boolean;
}> {
  const selectedSubjects = Object.keys(calendarGroupByMajor).reduce(
    (acc, majorKey) => {
      const subjectData = calendarGroupByMajor[majorKey].subjects;
      const selectedSubjects = Object.keys(subjectData).filter(
        (subjectKey) => subjectData[subjectKey].displayOnCalendar
      );
      for (const subjectKey of selectedSubjects)
        acc[subjectKey] = subjectData[subjectKey];
      return acc;
    },
    <CalendarGroupBySubjectName>{}
  );

  const selectedSubjectsKeys = Object.keys(selectedSubjects);
  const selectedSubjectsLength = selectedSubjectsKeys.length;

  const aDayInMiliseconds = 24 * 60 * 60 * 1000;
  // const getDateIndex = (date: number) =>
  //   (date - dateList[0]) / aDayInMiliseconds;

  // n = số môn
  // m = số lớp của mỗi môn
  // p = số lịch của mỗi lớp
  const classes: CalendarGroupByClassDetail[][] = []; // Danh sách các lớp của các môn: n * m
  const timeGrid: [number, number, number, number][][][] = []; // Lịch học của các lớp của các môn: n * m * p * [startDate, endDate, dayOfWeek, sessionBitmask]
  const totalSessionsInSessionRange: number[][] = []; // Tổng số tiết học trong buổi auto của các lớp của các môn: n * m

  const autoData = [
    ['refer-non-overlap-morning', START_MORNING_SESSION, END_MORNING_SESSION],
    [
      'refer-non-overlap-afternoon',
      START_AFTERNOON_SESSION,
      END_AFTERNOON_SESSION,
    ],
    ['refer-non-overlap-evening', START_EVENING_SESSION, END_EVENING_SESSION],
  ].find((item) => item[0] === auto) as [string, number, number];

  selectedSubjectsKeys.forEach((subjectKey) => {
    const subjectData = selectedSubjects[subjectKey];
    const subjectClasses: CalendarGroupByClassDetail[] = []; // Danh sách các lớp
    const subjectTimeGrid: [number, number, number, number][][] = []; // Lịch học của tất cả các lớp: m * p * [startDate, endDate, dayOfWeek, sessionBitmask]
    const subjectTotalSessionsInSessionRange: number[] = []; // Tổng số tiết học trong buổi auto của tất cả các lớp: m

    Object.keys(subjectData.classes).forEach((classKey) => {
      const classData = subjectData.classes[classKey];

      let totalAutoSessions = 0;

      const classScheduleGrid: [number, number, number, number][] = new Array(
        classData.details.length
      ).fill([0, 0, 0, 0]); // Lịch học của lớp: m * [startDate, endDate, dayOfWeek, sessionBitmask]

      classData.details.forEach((detail, i) => {
        // Lấy ra số tuần giữa ngày bắt đầu và ngày kết thúc
        const totalWeeks =
          (detail.endDate - detail.startDate + aDayInMiliseconds) /
          (aDayInMiliseconds * 7);

        classScheduleGrid[i][0] = detail.startDate;
        classScheduleGrid[i][1] = detail.endDate;
        classScheduleGrid[i][2] = detail.dayOfWeek;
        classScheduleGrid[i][3] =
          ((1 << (detail.endSession - detail.startSession + 1)) - 1) <<
          (sessions.length - detail.endSession); // Tạo lịch bitmask của lớp trong lịch hiện tại

        // Tính số tiết học trong buổi
        if (
          autoData &&
          detail.startSession <= autoData[2] &&
          detail.endSession >= autoData[1]
        )
          totalAutoSessions +=
            (Math.min(autoData[2], detail.endSession) -
              Math.max(autoData[1], detail.startSession) +
              1) *
            totalWeeks;
      });

      subjectTimeGrid.push(classScheduleGrid); // Thêm lịch học của lớp vào lịch môn
      subjectClasses.push(classData); // Thêm lớp vào danh sách các lớp của môn
      subjectTotalSessionsInSessionRange.push(totalAutoSessions); // Thêm tổng số tiết học trong mỗi buổi của lớp trong môn học
    });

    classes.push(subjectClasses); // Thêm danh sách các lớp của môn học vào danh sách các lớp
    timeGrid.push(subjectTimeGrid); // Thêm lịch học của môn học vào lịch
    totalSessionsInSessionRange.push(subjectTotalSessionsInSessionRange); // Thêm tổng số tiết học trong mỗi buổi của các lớp trong môn học
  });

  const combinations: number[][] = []; // Danh sách các tổ hợp: Số lượng tổ hợp * (n + 1)
  const threshold = 12; // số tiết học có thể trùng tối đa trong 1 tổ hợp

  // Hàm tạo tổ hợp
  function generateCombination(
    current: number[],
    index: number,
    overlap: number
  ) {
    // Nếu đã chọn hết tất cả các môn thì thêm tổ hợp này vào danh sách tổ hợp
    if (index === selectedSubjectsLength) {
      combinations.push([overlap, ...current]);
      return;
    }

    const classesData = classes[index]; // Lấy danh sách các lớp của môn học hiện tại
    for (let i = 0; i < classesData.length; i++) {
      const currentClassTimeGrid = timeGrid[index][i]; // Lấy lịch học của lớp hiện tại

      // Tính số tiết học bị trùng trong trường hợp thêm lớp này vào tổ hợp
      let newOverlap = overlap;
      for (let j = 0; j < index; j++) {
        newOverlap += calculateOverlapBetween2Classes(
          timeGrid[j][current[j]],
          currentClassTimeGrid
        );

        // Nếu số tiết học bị trùng vượt quá ngưỡng thì bỏ qua tổ hợp này
        if (newOverlap > threshold) break;
      }

      // Nếu số tiết học bị trùng vượt quá ngưỡng thì bỏ qua tổ hợp này
      if (newOverlap > threshold) continue;

      current[index] = i; // Lưu lớp được chọn
      generateCombination(current, index + 1, newOverlap); // Tìm tổ hợp cho môn tiếp theo
    }
  }

  const start = performance.now();

  generateCombination(new Array(selectedSubjectsLength).fill(0), 0, 0); // Phần tử đầu tiên trong mảng là tổng số tiết học bị trùng

  console.log('Generate combinations time:', performance.now() - start);
  console.log('Total combinations:', combinations.length);

  // Lưu ý: khi truy cập mảng bestCombination đều phải cộng 1 vào index
  //        do phần tử đầu tiên là tổng số tiết học bị trùng

  // Tìm tổ hợp tối ưu nhất dựa trên số tiết học bị trùng
  const combinationsWithOverlapSorted = combinations.sort((a, b) => {
    const diff = a[0] - b[0];
    if (diff !== 0 || !auto) return diff;

    return (
      b
        .slice(1)
        .reduce((acc, cur, i) => acc + totalSessionsInSessionRange[i][cur], 0) -
      a
        .slice(1)
        .reduce((acc, cur, i) => acc + totalSessionsInSessionRange[i][cur], 0)
    );
  });
  const bestCombination = combinationsWithOverlapSorted.length
    ? combinationsWithOverlapSorted[
        autoTh % combinationsWithOverlapSorted.length
      ]
    : undefined;

  const updatedCalendarGroupByMajor = bestCombination
    ? (() => {
        const clonedCalendarGroupByMajor =
          structuredClone(calendarGroupByMajor);
        for (let i = 0; i < selectedSubjectsLength; i++) {
          const classData = classes[i][bestCombination[i + 1]];
          for (const major of classData.majors) {
            const majorData = clonedCalendarGroupByMajor[major];
            const subjectData = majorData.subjects[classData.subjectName];
            subjectData.selectedClass = classData.subjectClassCode;
          }
        }
        return clonedCalendarGroupByMajor;
      })()
    : calendarGroupByMajor;
  const updatedCalendarTableContent = bestCombination
    ? workerCalculateCalendarTableContent(
        calendarTableContent,
        updatedCalendarGroupByMajor,
        dateList,
        sessions
      ).updatedCalendarTableContent
    : calendarTableContent;

  return {
    updatedCalendarTableContent,
    updatedCalendarGroupByMajor,
    isConflict: bestCombination ? bestCombination[0] > 0 : false,
  };
}

self.onmessage = async (message: {
  data: {
    type: string;
    data: any;
  };
}) => {
  switch (message.data.type) {
    case 'calculateCalendarTableContent': {
      const data = message.data.data as {
        calendarTableContent: CalendarTableContent;
        calendar: CalendarData;
        sessions: number[];
        auto: AutoMode;
        autoTh: number;
      };

      switch (data.auto) {
        case 'none': {
          self.postMessage({
            type: message.data.type,
            data: workerCalculateCalendarTableContent(
              data.calendarTableContent,
              data.calendar.calendarGroupByMajor,
              data.calendar.dateList,
              data.sessions
            ),
          });
          break;
        }
        case 'refer-non-overlap':
        case 'refer-non-overlap-morning':
        case 'refer-non-overlap-afternoon':
        case 'refer-non-overlap-evening':
          self.postMessage({
            type: message.data.type,
            data: await workerAutoCalculateCalendarTableContent(
              data.calendarTableContent,
              data.calendar.calendarGroupByMajor,
              data.calendar.dateList,
              data.sessions,
              data.auto,
              data.autoTh
            ),
          });
      }

      break;
    }
  }
};
