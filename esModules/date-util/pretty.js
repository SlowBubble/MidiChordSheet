
export function getPrettyDateStr(dateMs) {
  const date = new Date(dateMs);
  const currDateMs = Date.now();
  const isSameWeek = currDateMs >= dateMs && currDateMs - dateMs < 1000 * 3600 * 6;
  const moreThanOneWeekOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  const sameWeekOptions = {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  };
  const options = isSameWeek ? sameWeekOptions : moreThanOneWeekOptions;
  const formatter = new Intl.DateTimeFormat('en-US', options);
  return formatter.format(date);
}
