import { chapterNames, questions, type Question } from "./data";
import { topicMap, topicQuestions, questionTopic } from "./learning";
import { lessonQuestions } from "./course";
export type QuestionType = "all" | "single" | "multiple" | "case";
export type SourceType = "all" | "chapter" | "past";
export type PracticeSession =
  | { kind: "lesson"; topic: string }
  | { kind: "chapter"; chapter: number; type: QuestionType }
  | { kind: "paper"; year: number; session: string; type: QuestionType }
  | {
      kind: "topic";
      topic: string;
      source: SourceType;
      type: QuestionType;
      label: string;
    }
  | {
      kind: "unmapped";
      chapter: number;
      source: SourceType;
      type: QuestionType;
    };
export const typeNames = {
  all: "全部题型",
  single: "单选题",
  multiple: "多选题",
  case: "案例题",
};
export const sourceNames = {
  all: "全部来源",
  chapter: "章节习题",
  past: "历年题",
};
export const paperKey = (q: Question) => `${q.year}-${q.session}`;
export const papers = Array.from(
  new Set(questions.filter((q) => q.sourceType === "past").map(paperKey)),
)
  .map((key) => {
    const list = questions.filter(
      (q) => q.sourceType === "past" && paperKey(q) === key,
    );
    return {
      key,
      year: list[0].year!,
      session: list[0].session!,
      questions: list,
    };
  })
  .sort(
    (a, b) => b.year - a.year || a.session.localeCompare(b.session, "zh-CN"),
  );
export function selectQuestions(s: PracticeSession): Question[] {
  if (s.kind === "lesson") return lessonQuestions(s.topic);
  let list: Question[] = [];
  if (s.kind === "chapter")
    list = questions.filter(
      (q) => q.sourceType === "chapter" && q.originalChapter === s.chapter,
    );
  if (s.kind === "paper")
    list = questions.filter(
      (q) =>
        q.sourceType === "past" && q.year === s.year && q.session === s.session,
    );
  if (s.kind === "topic")
    list = (topicQuestions.get(s.topic) ?? []).filter(
      (q) =>
        (s.source === "all" || q.sourceType === s.source) &&
        (!s.label || q.knowledgePoint === s.label),
    );
  if (s.kind === "unmapped")
    list = questions.filter(
      (q) =>
        q.originalChapter === s.chapter &&
        !questionTopic.get(q.id) &&
        (s.source === "all" || q.sourceType === s.source),
    );
  return list.filter((q) => s.type === "all" || q.type === s.type);
}
export const sessionKey = (s: PracticeSession) => `study:${JSON.stringify(s)}`;
export function sessionTitle(s: PracticeSession) {
  if (s.kind === "lesson")
    return `${topicMap.get(s.topic)?.title} · 本轮理解检验`;
  if (s.kind === "paper") return `${s.year} 年 · ${s.session} · 资料标注历年题`;
  if (s.kind === "topic")
    return `${topicMap.get(s.topic)?.title} · ${sourceNames[s.source]}`;
  if (s.kind === "unmapped") return `旧版第 ${s.chapter} 章 · 待细分考点`;
  return `旧版第 ${s.chapter} 章 · ${chapterNames[s.chapter - 1]} · 章节习题`;
}
export function isValidCursor(key: string, id: string) {
  const q = questions.find((q) => q.id === id);
  if (!q) return false;
  // v1 backup compatibility: old chapter sessions mixed both sources.
  if (/^chapter:(?:[1-9]|10|11)$/.test(key))
    return key === `chapter:${q.originalChapter}`;
  if (!key.startsWith("study:")) return false;
  try {
    const s = JSON.parse(key.slice(6));
    if (!s) return false;
    if (s.kind === "lesson")
      return (
        topicMap.has(s.topic) &&
        lessonQuestions(s.topic).some((q) => q.id === id)
      );
    if (!Object.hasOwn(typeNames, s.type)) return false;
    if (
      s.kind === "chapter" &&
      (!Number.isInteger(s.chapter) || s.chapter < 1 || s.chapter > 11)
    )
      return false;
    else if (
      s.kind === "paper" &&
      (!Number.isInteger(s.year) || typeof s.session !== "string")
    )
      return false;
    else if (
      s.kind === "topic" &&
      (!topicMap.has(s.topic) ||
        !Object.hasOwn(sourceNames, s.source) ||
        typeof s.label !== "string")
    )
      return false;
    else if (
      s.kind === "unmapped" &&
      (!Number.isInteger(s.chapter) ||
        s.chapter < 1 ||
        s.chapter > 11 ||
        !Object.hasOwn(sourceNames, s.source))
    )
      return false;
    if (!["chapter", "paper", "topic", "unmapped"].includes(s.kind))
      return false;
    return selectQuestions(s).some((q) => q.id === id);
  } catch {
    return false;
  }
}
