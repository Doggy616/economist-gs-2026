import { describe, it, expect } from "vitest";
import examples from "../src/lesson-examples.json";
import {
  learningPath,
  corePath,
  coreTopicIds,
  stages,
  newLesson,
  completeLesson,
  resetLesson,
  needsReview,
  lessonQuestions,
  validateLessonRecords,
} from "../src/course";
import { topics } from "../src/learning";
import {
  emptyState,
  recordAnswer,
  parseBackup,
  exportBackup,
} from "../src/storage";
import { selectQuestions, sessionKey, isValidCursor } from "../src/practice";
describe("新手引导与复习安排", () => {
  it("48 个专题全部进入六阶段路径，有独立示例和检验题，不重复计入", () => {
    expect(corePath).toHaveLength(20);
    expect(coreTopicIds.size).toBe(20);
    expect(corePath.every((t) => learningPath.includes(t))).toBe(true);
    expect(stages).toHaveLength(6);
    expect(learningPath).toHaveLength(topics.length);
    expect(new Set(learningPath.map((t) => t.id)).size).toBe(topics.length);
    expect(learningPath[0].id).toBe("3-2");
    for (const t of topics) {
      const example = examples.find((e) => e.topic === t.id)!;
      expect(example.example.steps).toHaveLength(2);
      expect(example.terms.length).toBeGreaterThanOrEqual(3);
      expect(example.terms.length).toBeLessThanOrEqual(4);
      expect(example.example.scenario).not.toBe(t.selfTest.prompt);
      const list = lessonQuestions(t.id);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(new Set(list.map((q) => q.id)).size).toBe(list.length);
      expect(selectQuestions({ kind: "lesson", topic: t.id })).toEqual(list);
      expect(
        isValidCursor(sessionKey({ kind: "lesson", topic: t.id }), list[0].id),
      ).toBe(true);
    }
  });
  it("不能用阅读点击、旧作答或未检验全部题目替代本轮回忆和检验", () => {
    const id = "3-2",
      list = lessonQuestions(id);
    let s = emptyState();
    const now = Date.now();
    for (const q of list) s = recordAnswer(s, q.id, q.answer);
    expect(() => completeLesson(id, newLesson(), s.records, now)).toThrow();
    const record = {
      ...newLesson(),
      phase: 4,
      recallText: "按需求分群，再选择目标顾客。",
      rating: "good" as const,
      recalledAt: new Date(now + 10000).toISOString(),
    };
    expect(() => completeLesson(id, record, s.records, now + 20000)).toThrow();
  });
  it("只在回忆与本轮检验完成后安排复习，错误不因自评良好而延长间隔", () => {
    const id = "3-2",
      now = Date.now(),
      r = {
        ...newLesson(),
        phase: 4,
        recallText: "细分与定位的依据不同。",
        rating: "good" as const,
        recalledAt: new Date(now - 1000).toISOString(),
      };
    let s = emptyState();
    for (const q of lessonQuestions(id)) s = recordAnswer(s, q.id, q.answer);
    const first = completeLesson(id, r, s.records, now);
    expect(first.phase).toBe(5);
    expect(Date.parse(first.nextReviewAt!) - now).toBe(86400000);
    expect(needsReview(first, now)).toBe(false);
    expect(needsReview(first, now + 86400000)).toBe(true);
    const second = completeLesson(id, { ...first, phase: 4 }, s.records, now);
    expect(Date.parse(second.nextReviewAt!) - now).toBe(3 * 86400000);
    const q = lessonQuestions(id)[0],
      bad = Object.keys(q.options).find((k) => !q.answer.includes(k))!;
    s = recordAnswer(s, q.id, [bad]);
    const mistake = completeLesson(id, { ...first, phase: 4 }, s.records, now);
    expect(mistake.streak).toBe(0);
    expect(Date.parse(mistake.nextReviewAt!) - now).toBe(86400000);
    const again = completeLesson(id, { ...r, rating: "again" }, s.records, now);
    expect(Date.parse(again.nextReviewAt!) - now).toBe(600000);
    expect(resetLesson(first, true)).toMatchObject({
      phase: 3,
      recallText: "",
      reviews: 1,
      streak: 1,
    });
  });
  it("新旧备份兼容，回忆文本和学习步骤保留，损坏专题/步骤不可导入", () => {
    const old = emptyState();
    expect(parseBackup(exportBackup(old))).toEqual(old);
    const state = {
      ...old,
      lessons: {
        "3-2": { ...newLesson(), phase: 3, recallText: "先按需求区分顾客。" },
      },
    };
    expect(parseBackup(exportBackup(state))).toEqual(state);
    expect(() => validateLessonRecords({ bogus: newLesson() })).toThrow();
    expect(() =>
      validateLessonRecords({ "3-2": { ...newLesson(), phase: 9 } }),
    ).toThrow();
    expect(() =>
      parseBackup(
        exportBackup({
          ...old,
          lessons: { "3-2": { ...newLesson(), phase: 5 } },
        }),
      ),
    ).toThrow("学习专题");
  });
});
