import { topics, topicMap, topicQuestions } from "./learning";
import type { AnswerRecord } from "./storage";
export type RecallRating = "again" | "hard" | "good";
export interface LessonRecord {
  phase: number;
  recallText: string;
  rating?: RecallRating;
  recalledAt?: string;
  reviews: number;
  streak: number;
  completedAt?: string;
  nextReviewAt?: string;
}
export const newLesson = (): LessonRecord => ({
  phase: 0,
  recallText: "",
  reviews: 0,
  streak: 0,
});
export const stages = [
  { title: "先看懂一门生意", question: "顾客为什么愿意买？", chapters: [3] },
  {
    title: "再理解方向与选择",
    question: "资源有限，企业该做什么？",
    chapters: [1],
  },
  {
    title: "把价值真正交付出去",
    question: "产品如何生产、流转、到达顾客？",
    chapters: [4, 5, 6],
  },
  {
    title: "让一群人协作起来",
    question: "人、权利和回报如何组织？",
    chapters: [8, 2],
  },
  {
    title: "为未来作出投入",
    question: "资金与创新怎样创造长期价值？",
    chapters: [9, 7],
  },
  {
    title: "扩展经营的边界",
    question: "数字化和跨境经营改变了什么？",
    chapters: [10, 11],
  },
];
export const learningPath = stages.flatMap((s) =>
  s.chapters.flatMap((ch) => {
    const list = topics.filter((t) => t.chapter === ch);
    // Start with a concrete customer problem rather than an abstract environment taxonomy.
    return ch === 3 ? [...list.slice(1), list[0]] : list;
  }),
);
// Editorial beginner priority: conceptual dependencies and transfer, not exam-frequency prediction.
export const coreTopicIds = new Set([
  "3-2",
  "3-3",
  "3-4",
  "1-1",
  "1-3",
  "1-4",
  "4-1",
  "5-1",
  "5-3",
  "6-3",
  "8-1",
  "8-2",
  "2-1",
  "2-2",
  "9-1",
  "9-2",
  "9-4",
  "7-1",
  "10-1",
  "11-1",
]);
export const corePath = learningPath.filter((t) => coreTopicIds.has(t.id));
export function lessonQuestions(id: string) {
  const all = topicQuestions.get(id) ?? [];
  const selected = [] as typeof all;
  const add = (q: (typeof all)[number] | undefined) => {
    if (q && !selected.includes(q)) selected.push(q);
  };
  add(all.find((q) => q.sourceType === "chapter"));
  add(
    all.find(
      (q) =>
        q.sourceType === "chapter" &&
        q.knowledgePoint !== selected[0]?.knowledgePoint,
    ),
  );
  add(all.find((q) => q.sourceType === "past"));
  for (const q of all) {
    if (selected.length >= 3) break;
    add(q);
  }
  return selected;
}
export function needsReview(
  record: LessonRecord | undefined,
  now = Date.now(),
) {
  return (
    !!record &&
    record.phase === 5 &&
    !!record.nextReviewAt &&
    Date.parse(record.nextReviewAt) <= now
  );
}
export function resetLesson(
  record: LessonRecord | undefined,
  review = false,
): LessonRecord {
  return {
    ...newLesson(),
    reviews: record?.reviews ?? 0,
    streak: record?.streak ?? 0,
    phase: review ? 3 : 0,
  };
}
export function completeLesson(
  id: string,
  record: LessonRecord,
  records: Record<string, AnswerRecord>,
  now = Date.now(),
): LessonRecord {
  const list = lessonQuestions(id);
  if (
    !topicMap.has(id) ||
    record.phase !== 4 ||
    !record.rating ||
    !record.recalledAt ||
    record.recallText.trim().length < 4 ||
    !list.length ||
    !list.every(
      (q) =>
        records[q.id] &&
        Date.parse(records[q.id].updatedAt) >= Date.parse(record.recalledAt!),
    )
  )
    throw new Error("请先完成闭卷回忆与本轮检验题，再安排复习。");
  const allCorrect = list.every((q) => records[q.id].correct);
  const streak = allCorrect && record.rating === "good" ? record.streak + 1 : 0;
  const days = streak ? [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] : 1;
  const delay = record.rating === "again" ? 10 * 60 * 1000 : days * 86400000;
  return {
    ...record,
    phase: 5,
    reviews: record.reviews + 1,
    streak,
    completedAt: new Date(now).toISOString(),
    nextReviewAt: new Date(now + delay).toISOString(),
  };
}
export function validateLessonRecords(
  value: unknown,
): Record<string, LessonRecord> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("学习路径记录必须是对象");
  const result: Record<string, LessonRecord> = {};
  for (const [id, raw] of Object.entries(value)) {
    const r = raw as LessonRecord;
    const validDate = (v: unknown) =>
      typeof v === "string" && Number.isFinite(Date.parse(v));
    if (
      !topicMap.has(id) ||
      !r ||
      !Number.isInteger(r.phase) ||
      r.phase < 0 ||
      r.phase > 5 ||
      typeof r.recallText !== "string" ||
      r.recallText.length > 2000 ||
      !Number.isSafeInteger(r.reviews) ||
      r.reviews < 0 ||
      !Number.isSafeInteger(r.streak) ||
      r.streak < 0 ||
      r.streak > r.reviews ||
      (r.rating !== undefined &&
        !["again", "hard", "good"].includes(r.rating)) ||
      (r.recalledAt !== undefined && !validDate(r.recalledAt)) ||
      (r.completedAt !== undefined && !validDate(r.completedAt)) ||
      (r.nextReviewAt !== undefined && !validDate(r.nextReviewAt)) ||
      (r.phase >= 4 &&
        (!r.rating || !r.recalledAt || r.recallText.trim().length < 4)) ||
      (r.phase === 5 && (!r.completedAt || !r.nextReviewAt || r.reviews < 1))
    )
      throw new Error(`学习专题 ${id}：步骤、回忆、次数或复习日期无效`);
    result[id] = {
      phase: r.phase,
      recallText: r.recallText,
      reviews: r.reviews,
      streak: r.streak,
      ...(r.rating ? { rating: r.rating } : {}),
      ...(r.recalledAt ? { recalledAt: r.recalledAt } : {}),
      ...(r.completedAt ? { completedAt: r.completedAt } : {}),
      ...(r.nextReviewAt ? { nextReviewAt: r.nextReviewAt } : {}),
    };
  }
  return result;
}
