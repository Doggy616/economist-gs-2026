import { describe, it, expect } from "vitest";
import { questions } from "../src/data";
import {
  topics,
  classifyQuestion,
  topicQuestions,
  unmappedQuestions,
  topicSources,
  topicStats,
} from "../src/learning";
import {
  papers,
  selectQuestions,
  sessionKey,
  isValidCursor,
  type PracticeSession,
} from "../src/practice";
import {
  emptyState,
  recordAnswer,
  exportBackup,
  parseBackup,
} from "../src/storage";
describe("知识提炼与追溯", () => {
  it("11 章均有提炼专题、要点、易混辨析、自测和两份资料中的可追溯依据", () => {
    expect(topics).toHaveLength(48);
    expect(new Set(topics.map((t) => t.id)).size).toBe(48);
    for (let ch = 1; ch <= 11; ch++)
      expect(
        topics.filter((t) => t.chapter === ch).length,
      ).toBeGreaterThanOrEqual(3);
    for (const t of topics) {
      expect(t.points.length).toBeGreaterThanOrEqual(3);
      expect(t.trap.length).toBeGreaterThan(20);
      expect(t.selfTest.prompt).toBeTruthy();
      expect(t.selfTest.answer).toBeTruthy();
      const sources = topicSources(t);
      expect(new Set(sources.map((s) => s.file)).size).toBe(2);
      for (const s of sources) {
        expect(s.line).toBeGreaterThan(1);
        expect(s.heading).toMatch(/^\d+\.\d+/);
        expect(s.text).toBeTruthy();
      }
      expect(topicQuestions.get(t.id)!.length).toBeGreaterThan(0);
    }
  });
  it("关联只使用同章原题标签，已匹配与待细分共同覆盖全部题目，不强制错章标签入类", () => {
    const matched = [...topicQuestions.values()].flat();
    expect(new Set(matched.map((q) => q.id)).size).toBe(matched.length);
    expect(matched.length + unmappedQuestions.length).toBe(questions.length);
    for (const t of topics)
      for (const q of topicQuestions.get(t.id)!) {
        expect(q.originalChapter).toBe(t.chapter);
        expect(
          t.keywords.some((k) =>
            q.knowledgePoint?.toLowerCase().includes(k.toLowerCase()),
          ),
        ).toBe(true);
      }
    const wrongChapter = questions.find(
      (q) =>
        q.originalChapter === 1 &&
        q.knowledgePoint === "技术创新战略——切入型战略",
    )!;
    expect(classifyQuestion(wrongChapter)).toBeUndefined();
    const leverage = questions.find(
      (q) => q.knowledgePoint === "筹资决策——财务杠杆系数计算",
    )!;
    expect(classifyQuestion(leverage)?.id).toBe("9-3");
    const shareholder = questions.find(
      (q) => q.knowledgePoint === "股东会的职权",
    )!;
    expect(classifyQuestion(shareholder)?.id).toBe("2-2");
  });
  it("同一条作答记录同时反映到专题已练和错题统计，不虚报掌握", () => {
    const q = topicQuestions.get("1-1")![0];
    const bad = Object.keys(q.options).find((k) => !q.answer.includes(k))!;
    let s = recordAnswer(emptyState(), q.id, [bad]);
    expect(topicStats("1-1", s.records)).toMatchObject({
      attempted: 1,
      wrong: 1,
      correct: 0,
    });
    s = recordAnswer(s, q.id, q.answer);
    expect(topicStats("1-1", s.records)).toMatchObject({
      attempted: 1,
      wrong: 0,
      correct: 1,
    });
  });
});
describe("题库来源、考点和进度", () => {
  it("章节习题与 7 组年份场次分开，历年题不遗漏、不串组、不补造完整卷", () => {
    const chapterQuestions = Array.from({ length: 11 }, (_, i) =>
      selectQuestions({ kind: "chapter", chapter: i + 1, type: "all" }),
    ).flat();
    expect(chapterQuestions).toHaveLength(860);
    expect(chapterQuestions.every((q) => q.sourceType === "chapter")).toBe(
      true,
    );
    expect(papers).toHaveLength(7);
    const past = papers.flatMap((p) =>
      selectQuestions({
        kind: "paper",
        year: p.year,
        session: p.session,
        type: "all",
      }),
    );
    expect(past).toHaveLength(564);
    expect(new Set(past.map((q) => q.id)).size).toBe(564);
    for (const p of papers)
      expect(
        p.questions.every(
          (q) =>
            q.sourceType === "past" &&
            q.year === p.year &&
            q.session === p.session,
        ),
      ).toBe(true);
    expect(papers.find((p) => p.year === 2021)?.questions).toHaveLength(14);
  });
  it("专题练习支持来源、题型和原题考点联合过滤", () => {
    const t = topics.find((t) =>
      topicQuestions
        .get(t.id)!
        .some((q) => q.sourceType === "past" && q.type === "case"),
    )!;
    const q = topicQuestions
      .get(t.id)!
      .find((q) => q.sourceType === "past" && q.type === "case")!;
    const session: PracticeSession = {
      kind: "topic",
      topic: t.id,
      source: "past",
      type: "case",
      label: q.knowledgePoint!,
    };
    const list = selectQuestions(session);
    expect(list.length).toBeGreaterThan(0);
    expect(
      list.every(
        (x) =>
          x.sourceType === "past" &&
          x.type === "case" &&
          x.knowledgePoint === q.knowledgePoint,
      ),
    ).toBe(true);
  });
  it("新版练习与真题位置可备份恢复，兼容旧备份，并拒绝跨来源和跨专题的游标", () => {
    const s = emptyState();
    const chapter: PracticeSession = {
      kind: "chapter",
      chapter: 1,
      type: "all",
    };
    const paper: PracticeSession = {
      kind: "paper",
      year: 2025,
      session: "下午",
      type: "all",
    };
    const a = selectQuestions(chapter)[1],
      b = selectQuestions(paper)[2];
    s.cursors[sessionKey(chapter)] = a.id;
    s.cursors[sessionKey(paper)] = b.id;
    s.cursors["chapter:1"] = a.id;
    expect(parseBackup(exportBackup(s))).toEqual(s);
    expect(isValidCursor(sessionKey(chapter), b.id)).toBe(false);
    const wrongTopic: PracticeSession = {
      kind: "topic",
      topic: "2-1",
      source: "all",
      type: "all",
      label: "",
    };
    expect(isValidCursor(sessionKey(wrongTopic), a.id)).toBe(false);
  });
});
