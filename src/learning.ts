import content from "./curriculum.json";
import guides from "./chapter-guides.json";
import yao from "../knowledge_yao.md?raw";
import creator from "../knowledge_skill_creator.md?raw";
import { questions, type Question } from "./data";
import type { AnswerRecord } from "./storage";
export interface Topic {
  id: string;
  chapter: number;
  title: string;
  gist: string;
  points: string[];
  trap: string;
  selfTest: { prompt: string; answer: string };
  sections: string[];
  keywords: string[];
}
export const topics: Topic[] = content;
export const chapterGuides = guides;
export const topicMap = new Map(topics.map((t) => [t.id, t]));
// Associate only by the original knowledge-point label within its original chapter.
// Prefer the most specific keyword (e.g. 股东会 over 股东); never infer from the answer.
export function classifyQuestion(q: Question): Topic | undefined {
  let best: Topic | undefined;
  let score = 0;
  for (const t of topics) {
    if (t.chapter !== q.originalChapter) continue;
    const hits = t.keywords.filter((k) =>
      q.knowledgePoint?.toLowerCase().includes(k.toLowerCase()),
    );
    const next = Math.max(0, ...hits.map((k) => k.length));
    if (next > score) {
      best = t;
      score = next;
    }
  }
  return best;
}
export const questionTopic = new Map(
  questions.map((q) => [q.id, classifyQuestion(q)]),
);
export const topicQuestions = new Map(
  topics.map((t) => [
    t.id,
    questions.filter((q) => questionTopic.get(q.id)?.id === t.id),
  ]),
);
export const unmappedQuestions = questions.filter(
  (q) => !questionTopic.get(q.id),
);
export function topicStats(id: string, records: Record<string, AnswerRecord>) {
  const list = topicQuestions.get(id) ?? [];
  const attempted = list.filter((q) => records[q.id]);
  return {
    total: list.length,
    attempted: attempted.length,
    wrong: attempted.filter((q) => !records[q.id].correct).length,
    correct: attempted.filter((q) => records[q.id].correct).length,
  };
}
const creatorSection = (s: string) =>
  ({
    "3.1": "3.1",
    "3.2": "3.1",
    "3.3": "3.2",
    "3.4": "3.3",
    "3.5": "3.4",
    "3.6": "3.5",
    "3.7": "3.6",
    "3.8": "3.7",
    "4.3": "4.3",
    "4.4": "4.3",
    "4.5": "4.4",
    "4.6": "4.4",
  })[s] ?? s;
export interface SourceExcerpt {
  file: string;
  line: number;
  heading: string;
  text: string;
}
export function topicSources(t: Topic): SourceExcerpt[] {
  const result: SourceExcerpt[] = [];
  for (const [file, raw, refs] of [
    ["knowledge_yao.md", yao, t.sections],
    ["knowledge_skill_creator.md", creator, t.sections.map(creatorSection)],
  ] as const) {
    const lines = raw.split("\n");
    for (const ref of new Set(refs)) {
      // Creator's overview repeats 1.1–1.4; use the later actual chapter section.
      const candidates = lines
        .map((line, i) => (line.startsWith(`### ${ref} `) ? i : -1))
        .filter((i) => i >= 0);
      const start = candidates.at(-1);
      if (start === undefined) continue;
      let end = start + 1;
      while (end < lines.length && !/^#{1,3} /.test(lines[end])) end++;
      result.push({
        file,
        line: start + 1,
        heading: lines[start].replace(/^### /, ""),
        text: lines
          .slice(start + 1, end)
          .join("\n")
          .trim(),
      });
    }
  }
  return result;
}
export const originalDocuments = { yao, creator };
