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

/**
 * يحدّد ما إذا كانت أيقونة «المحاضر» ستظهر على الجوال للمستخدم الحالي.
 * في الواجهة، الحاوية تُعرض حين يكون هناك لجنة نشطة، وتحمل الكلاس
 * `lg:hidden` (أي تَظهر على الجوال وتختفي على الشاشات الكبيرة).
 * هذه الدالة تجمع شرطَي العرض في موضعٍ واحد قابل للاختبار التلقائي.
 */
export function isMinutesIconVisibleOnMobile(params: {
  isPrivileged: boolean;
  committeeId: string | null;
  committeeFilter: string;
  /** عرض شاشة الجهاز بالبكسل (افتراضياً 390 = جوال). */
  viewportWidth?: number;
}): boolean {
  const { viewportWidth = 390 } = params;
  // كلاس tailwind `lg:hidden` يُخفي العنصر عند العرض ≥ 1024px.
  const isMobileViewport = viewportWidth < 1024;
  if (!isMobileViewport) return false;
  return resolveActiveCommitteeId(params) !== null;
}