import { getSettings } from "@/lib/settings";
import { attendanceFromSettings, type AttendanceConfig } from "@/lib/attendance";

export async function getAttendanceConfig(): Promise<AttendanceConfig> {
  return attendanceFromSettings(await getSettings());
}
