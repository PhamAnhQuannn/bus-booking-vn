export function vnLocalDate(instant: Date | number | string): string {
  const date =
    instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
