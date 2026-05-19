// قائمة الأعضاء الذكور في اللجنة النسائية الذين لا يجب أن يروا
// بيانات استبيان مواهب بنات العائلة. الوصول مقصور على الإناث + مدير النظام.
export const WOMEN_COMMITTEE_MALE_USER_IDS: string[] = [
  "bd0057d4-5bc7-4c7d-a029-c30b3184f439", // أحمد بن سليم — رئيس اللجنة
  "2a4af8b9-aa26-4a92-bb77-a908d7d22fb0", // مهند مضيف
  "111b2a17-5b6b-40e7-8033-47cc7bdd3bb8", // عبدالرحمن عمر
];

export function isExcludedFromWomenSurvey(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return WOMEN_COMMITTEE_MALE_USER_IDS.includes(userId);
}
