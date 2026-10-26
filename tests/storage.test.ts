import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { questions, sameAnswer, displayText } from "../src/data";
import {
  emptyState,
  recordAnswer,
  exportBackup,
  parseBackup,
  saveState,
  loadState,
} from "../src/storage";
describe("原题与判分", () => {
  it("保留全部题目、来源、待核验状态和案例材料", () => {
    expect(questions).toHaveLength(1424);
    expect(new Set(questions.map((q) => q.id)).size).toBe(1424);
    for (const q of questions) {
      expect(q.sourceFile).toBeTruthy();
      expect(q.sourceLine).toBeGreaterThan(0);
      expect(q.verificationStatus).toBe("待人工核验");
      expect(q.syllabus2026Status).toBe("待人工核验");
      expect(q.answer.every((k) => k in q.options)).toBe(true);
    }
    const cases = questions.filter((q) => q.type === "case");
    expect(cases).toHaveLength(166);
    expect(cases.every((q) => q.caseContext)).toBe(true);
    expect(displayText(cases[0].caseContext!)).toContain("\n|");
  });
  it("多选顺序不影响判分，漏选、重复及错选不判对", () => {
    expect(sameAnswer(["B", "A"], ["A", "B"])).toBe(true);
    expect(sameAnswer(["A"], ["A", "B"])).toBe(false);
    expect(sameAnswer(["A", "A"], ["A", "B"])).toBe(false);
    expect(sameAnswer(["C", "A"], ["A", "B"])).toBe(false);
  });
});
describe("持久化与备份", () => {
  it("答错收录，答对移出，次数累加；数据库往返保持全部记录", async () => {
    const q = questions[0];
    const wrong = Object.keys(q.options).find((k) => !q.answer.includes(k))!;
    let s = recordAnswer(emptyState(), q.id, [wrong]);
    expect(s.records[q.id].correct).toBe(false);
    s = recordAnswer(s, q.id, q.answer);
    expect(s.records[q.id].correct).toBe(true);
    expect(s.records[q.id].attempts).toBe(2);
    s.cursors["chapter:1"] = q.id;
    s.notes[q.id] = "待核对";
    await saveState(s);
    expect(await loadState()).toEqual(s);
    expect(parseBackup(exportBackup(s))).toEqual(s);
  });
  it("拒绝损坏、未来版本、未知题目、伪造判分及错章节备份", () => {
    const q = questions[0],
      s = recordAnswer(emptyState(), q.id, q.answer);
    expect(() => parseBackup("{")).toThrow("有效 JSON");
    expect(() => parseBackup('{"version":2}')).toThrow("不支持");
    const v = JSON.parse(exportBackup(s));
    v.state.records["missing"] = v.state.records[q.id];
    expect(() => parseBackup(JSON.stringify(v))).toThrow("missing");
    delete v.state.records.missing;
    v.state.records[q.id].correct = false;
    expect(() => parseBackup(JSON.stringify(v))).toThrow("判分");
    v.state.records[q.id].correct = true;
    v.state.cursors["chapter:2"] = q.id;
    expect(() => parseBackup(JSON.stringify(v))).toThrow("章节");
  });
  it("拒绝非法选项，不修改原题答案", () => {
    const q = questions[0],
      before = JSON.stringify(q);
    expect(() => recordAnswer(emptyState(), q.id, ["Z"])).toThrow();
    recordAnswer(emptyState(), q.id, q.answer);
    expect(JSON.stringify(q)).toBe(before);
  });
});
