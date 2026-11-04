const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const splitIntoBlocks = (startTime, endTime, durationMinutes) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const blocks = [];
  for (let current = start; current + durationMinutes <= end; current += durationMinutes) {
    blocks.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + durationMinutes),
    });
  }
  return blocks;
};

const getTodayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

const formatDisplayDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const getDayName = (date) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(`${date}T00:00:00`).getDay()
  ];

const isBlockBooked = (block, date, bookedSlots) =>
  bookedSlots.some((booked) => {
    if (booked.date !== date) return false;
    const bookedStart = timeToMinutes(booked.startTime);
    const bookedEnd = timeToMinutes(booked.endTime);
    return (
      timeToMinutes(block.startTime) < bookedEnd &&
      timeToMinutes(block.endTime) > bookedStart
    );
  });

const getValidBlocks = (
  timeRange,
  date,
  durationMinutes,
  isToday,
  currentTimeInMinutes,
  bookedSlots,
) =>
  splitIntoBlocks(timeRange.startTime, timeRange.endTime, durationMinutes)
    .filter((block) => {
      if (isToday && timeToMinutes(block.startTime) <= currentTimeInMinutes) return false;
      return !isBlockBooked(block, date, bookedSlots);
    })
    .map((block) => ({ ...block, isBooked: false }));

const buildDateEntry = (date, slots) => ({
  date,
  displayDate: formatDisplayDate(date),
  day: getDayName(date),
  slots,
});

const generateSlotsFromSpecificDates = (specificDates, durationMinutes, bookedSlots) => {
  const today = getTodayLocal();
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  return specificDates
    .filter(({ date, slots }) => date >= today && slots?.length)
    .map(({ date, slots }) => ({
      date,
      slots: slots.flatMap((range) =>
        getValidBlocks(range, date, durationMinutes, date === today, currentTime, bookedSlots),
      ),
    }))
    .filter(({ slots }) => slots.length > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(({ date, slots }) => buildDateEntry(date, slots));
};

const generateSlotsFromWeeklyHours = (
  weeklyHours,
  durationMinutes,
  bookedSlots,
  daysAhead = 28,
) => {
  const now = new Date();
  const today = getTodayLocal();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const weeklyMap = Object.fromEntries(weeklyHours.map((entry) => [entry.day, entry]));
  const result = [];

  for (let index = 0; index < daysAhead; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
    const dayConfig = weeklyMap[getDayName(dateString)];
    if (!dayConfig?.isAvailable || !dayConfig.slots?.length) continue;

    const slots = dayConfig.slots.flatMap((range) =>
      getValidBlocks(range, dateString, durationMinutes, dateString === today, currentTime, bookedSlots),
    );
    if (slots.length) result.push(buildDateEntry(dateString, slots));
  }

  return result;
};

const generateAvailableSlots = (
  durationMinutes,
  specificDates = [],
  weeklyHours = [],
  bookedSlots = [],
  daysAhead = 28,
) => {
  const specificDateKeys = new Set(specificDates.map(({ date }) => date));
  const specific = generateSlotsFromSpecificDates(specificDates, durationMinutes, bookedSlots);
  const weekly = weeklyHours.some((entry) => entry.isAvailable && entry.slots?.length)
    ? generateSlotsFromWeeklyHours(weeklyHours, durationMinutes, bookedSlots, daysAhead).filter(
        (entry) => !specificDateKeys.has(entry.date),
      )
    : [];
  return [...specific, ...weekly].sort((a, b) => new Date(a.date) - new Date(b.date));
};

module.exports = { generateAvailableSlots };
