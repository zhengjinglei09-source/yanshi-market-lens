import { Report } from "./types";
let current: Report | null = null;
export function saveReport(report: Report) {
  current = report;
  try {
    sessionStorage.setItem(
      "yanshi-request",
      JSON.stringify({ question: report.question, scenario: report.scenario }),
    );
  } catch {
    /* Reload falls back to new research when browser storage is unavailable. */
  }
}
export function getReport() {
  return current;
}
