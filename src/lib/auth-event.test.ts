import { test, expect, describe } from "bun:test";
import { decideAuthAction } from "./auth-event";

/**
 * يضمن هذا الاختبار أن تبديل تبويبات المتصفح لا يُسبب تسجيل خروج مفاجئ.
 * Supabase يُطلق TOKEN_REFRESHED عند إعادة التركيز على التبويب،
 * ويُطلق INITIAL_SESSION عند كل تركيب للمكوّن. يجب ألا يُسقط أيٌّ منهما
 * صلاحيات المستخدم الحالية.
 */
describe("decideAuthAction — استقرار الجلسة عند تبديل التبويبات", () => {
  const uid = "user-123";

  test("TOKEN_REFRESHED على نفس المستخدم لا يُعيد ضبط الوصول (لا Logout مفاجئ)", () => {
    expect(decideAuthAction(uid, "TOKEN_REFRESHED", uid)).toBe("ignore");
  });

  test("USER_UPDATED لا يُعيد ضبط الوصول", () => {
    expect(decideAuthAction(uid, "USER_UPDATED", uid)).toBe("ignore");
  });

  test("INITIAL_SESSION المتكرر لنفس المستخدم يُتجاهل (لا وميض /pending)", () => {
    expect(decideAuthAction(uid, "INITIAL_SESSION", uid)).toBe("ignore");
  });

  test("SIGNED_IN المتكرر لنفس المستخدم (تبديل تبويب) يُتجاهل", () => {
    expect(decideAuthAction(uid, "SIGNED_IN", uid)).toBe("ignore");
  });

  test("تسجيل دخول مستخدم جديد يُشغّل تحميل الصلاحيات", () => {
    expect(decideAuthAction(null, "SIGNED_IN", uid)).toBe("load-access");
  });

  test("تبديل الهوية إلى مستخدم آخر يُعيد تحميل الصلاحيات", () => {
    expect(decideAuthAction(uid, "SIGNED_IN", "user-999")).toBe("load-access");
  });

  test("تسجيل خروج حقيقي يمسح الصلاحيات", () => {
    expect(decideAuthAction(uid, "SIGNED_OUT", null)).toBe("clear-access");
  });

  test("SIGNED_OUT بينما لا يوجد مستخدم أصلاً لا يفعل شيئاً", () => {
    expect(decideAuthAction(null, "SIGNED_OUT", null)).toBe("ignore");
  });

  test("محاكاة سيناريو تبديل التبويبات: عدة أحداث متتالية لا تُغيّر الحالة", () => {
    const events: Array<Parameters<typeof decideAuthAction>[1]> = [
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
    ];
    for (const ev of events) {
      expect(decideAuthAction(uid, ev, uid)).toBe("ignore");
    }
  });
});