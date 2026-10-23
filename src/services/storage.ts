import { MAX_SUBJECTS, normalizeSubject } from "../domain/rules.mjs";

export function loadSubjects(): string[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem("sihyeomji-subjects") || "[]",
    );
    if (!Array.isArray(data)) return [];
    return [
      ...new Set(
        data
          .filter((s): s is string => typeof s === "string")
          .map(normalizeSubject)
          .filter(Boolean),
      ),
    ].slice(0, MAX_SUBJECTS);
  } catch {
    return [];
  }
}
export function saveSubjects(subjects: readonly string[]) {
  try {
    localStorage.setItem("sihyeomji-subjects", JSON.stringify(subjects));
  } catch {
    /* Saving is optional. */
  }
}
export function loadMuted() {
  try {
    return localStorage.getItem("sihyeomji-muted") === "true";
  } catch {
    return false;
  }
}
export function saveMuted(muted: boolean) {
  try {
    localStorage.setItem("sihyeomji-muted", String(muted));
  } catch {
    /* Saving is optional. */
  }
}
