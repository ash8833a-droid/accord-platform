/**
 * يحدّد اللجنة النشِطة لعرض أيقونة «المحاضر» في مركز المهام.
 * - المستخدم العادي → لجنته الخاصة دائماً.
 * - المستخدم ذو الصلاحيات (admin/quality) → اللجنة المُفلترة، أو لجنته إن وُجدت.
 * يضمن ظهور الأيقونة لكل المستخدمين حسب لجنتهم.
 */
export function resolveActiveCommitteeId(params: {
  isPrivileged: boolean;
  committeeId: string | null;
  committeeFilter: string; // "all" أو معرّف لجنة
}): string | null {
  const { isPrivileged, committeeId, committeeFilter } = params;
  if (!isPrivileged) return committeeId ?? null;
  if (committeeFilter !== "all") return committeeFilter;
  return committeeId ?? null;
}