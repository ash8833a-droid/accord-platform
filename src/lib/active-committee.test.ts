import { test, expect, describe } from "bun:test";
import { resolveActiveCommitteeId } from "./active-committee";

/**
 * يضمن هذا الاختبار ظهور أيقونة «المحاضر» لكل المستخدمين حسب لجنتهم.
 * إن أعادت الدالة معرّف لجنة (غير null) فالأيقونة ستظهر في الواجهة.
 */
describe("resolveActiveCommitteeId — أيقونة المحاضر تظهر حسب لجنة المستخدم", () => {
  test("عضو لجنة عادي يرى أيقونة محاضر لجنته", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: false,
        committeeId: "cmt-finance",
        committeeFilter: "all",
      }),
    ).toBe("cmt-finance");
  });

  test("رئيس لجنة (غير privileged) يرى أيقونة لجنته", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: false,
        committeeId: "cmt-programs",
        committeeFilter: "all",
      }),
    ).toBe("cmt-programs");
  });

  test("مندوب بدون لجنة لا يرى الأيقونة", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: false,
        committeeId: null,
        committeeFilter: "all",
      }),
    ).toBeNull();
  });

  test("المسؤول (admin) يرى الأيقونة عند تحديد لجنة في الفلتر", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: true,
        committeeId: null,
        committeeFilter: "cmt-media",
      }),
    ).toBe("cmt-media");
  });

  test("المسؤول بدون فلتر يستخدم لجنته الخاصة إن وُجدت", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: true,
        committeeId: "cmt-quality",
        committeeFilter: "all",
      }),
    ).toBe("cmt-quality");
  });

  test("الفلتر يقدَّم على لجنة المسؤول الشخصية", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: true,
        committeeId: "cmt-quality",
        committeeFilter: "cmt-finance",
      }),
    ).toBe("cmt-finance");
  });

  test("مسؤول بدون لجنة وبدون فلتر — لا أيقونة (متوقَّع)", () => {
    expect(
      resolveActiveCommitteeId({
        isPrivileged: true,
        committeeId: null,
        committeeFilter: "all",
      }),
    ).toBeNull();
  });

  test("ضمان عدم الاعتماد فقط على الفلتر للمستخدم العادي", () => {
    // حتى لو غُيّر الفلتر بطريقة ما، المستخدم العادي يرى لجنته دائماً
    expect(
      resolveActiveCommitteeId({
        isPrivileged: false,
        committeeId: "cmt-mine",
        committeeFilter: "cmt-other",
      }),
    ).toBe("cmt-mine");
  });
});