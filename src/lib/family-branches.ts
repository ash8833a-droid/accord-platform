// قائمة الفروع العائلية المعتمدة (تستخدم في القوائم المنسدلة)
export const FAMILY_BRANCHES = [
  "آل محمد",
  "العرجان",
  "الشرايرة",
  "آل بريك",
  "القدحان",
  "القفزان",
  "أبناء سعد سليم",
  "آل رداد",
  "عتيق وأبناؤه",
  "آل سالم",
  "آل عبدالرحمن",
  "عبدالرازق وأبناؤه",
] as const;

export type FamilyBranch = (typeof FAMILY_BRANCHES)[number];

// خيارات المبالغ من 100 إلى 1000 بفواصل 50
export const AMOUNT_OPTIONS = Array.from({ length: 19 }, (_, i) => 100 + i * 50);

// السنوات الهجرية المعتمدة (السنة الحالية للأمام)
export const CURRENT_HIJRI_YEAR = 1447;
export const HIJRI_YEARS = [1447, 1446, 1445, 1444, 1443, 1442];
