import { openDB } from "idb";
import { questionMap, sameAnswer } from "./data";
export interface AnswerRecord {
  selected: string[];
  correct: boolean;
  attempts: number;
  updatedAt: string;
}
export interface StudyState {
  records: Record<string, AnswerRecord>;
  cursors: Record<string, string>;
  notes: Record<string, string>;
}
export const emptyState = (): StudyState => ({
  records: {},
  cursors: {},
  notes: {},
});
const db = () =>
  openDB("shizhi-study", 1, {
    upgrade(db) {
      db.createObjectStore("study");
    },
  });
export async function loadState(): Promise<StudyState> {
  const d = await db();
  try {
    return (await d.get("study", "state")) ?? emptyState();
  } finally {
    d.close();
  }
}
export async function saveState(state: StudyState) {
  const d = await db();
  try {
    await d.put("study", state, "state");
  } finally {
    d.close();
  }
}
export function recordAnswer(
  state: StudyState,
  id: string,
  selected: string[],
): StudyState {
  const q = questionMap.get(id);
  if (
    !q ||
    !selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some((k) => !(k in q.options)) ||
    (q.type === "single" && selected.length !== 1)
  )
    throw new Error("请选择有效答案");
  return {
    ...state,
    records: {
      ...state.records,
      [id]: {
        selected: [...selected],
        correct: sameAnswer(selected, q.answer),
        attempts: (state.records[id]?.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
export function exportBackup(state: StudyState) {
  return JSON.stringify(
    {
      app: "shizhi-economist",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}
export function parseBackup(text: string): StudyState {
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效 JSON，未修改学习记录。");
  }
  if (value?.app !== "shizhi-economist" || value.version !== 1)
    throw new Error("不支持的备份格式或版本，需要拾知 v1 学习备份。");
  const s = value.state;
  const object = (v: any) => v && typeof v === "object" && !Array.isArray(v);
  if (
    !object(s) ||
    !object(s.records) ||
    !object(s.cursors) ||
    !object(s.notes)
  )
    throw new Error("备份缺少 records、cursors 或 notes 对象。");
  const result = emptyState();
  const errors: string[] = [];
  for (const [id, r] of Object.entries(s.records) as [string, any][]) {
    const q = questionMap.get(id);
    if (
      !q ||
      !object(r) ||
      !Array.isArray(r.selected) ||
      !r.selected.length ||
      r.selected.some((k: any) => typeof k !== "string" || !(k in q.options)) ||
      new Set(r.selected).size !== r.selected.length ||
      (q.type === "single" && r.selected.length !== 1) ||
      !Number.isSafeInteger(r.attempts) ||
      r.attempts < 1 ||
      typeof r.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(r.updatedAt)) ||
      r.correct !== sameAnswer(r.selected, q.answer)
    ) {
      errors.push(`题目 ${id}：未知 ID、答案、次数、时间或判分字段无效`);
    } else
      result.records[id] = {
        selected: [...r.selected],
        correct: r.correct,
        attempts: r.attempts,
        updatedAt: r.updatedAt,
      };
  }
  for (const [key, id] of Object.entries(s.cursors)) {
    const q = typeof id === "string" ? questionMap.get(id) : undefined;
    if (
      !q ||
      !/^chapter:(?:[1-9]|10|11)$/.test(key) ||
      key !== `chapter:${q.originalChapter}`
    )
      errors.push(`进度 ${key}：章节或题目 ID 无效`);
    else result.cursors[key] = id as string;
  }
  for (const [id, note] of Object.entries(s.notes)) {
    if (!questionMap.has(id) || typeof note !== "string" || note.length > 2000)
      errors.push(`纠错记录 ${id}：未知题目或文本超过 2000 字`);
    else result.notes[id] = note;
  }
  if (errors.length)
    throw new Error(
      `备份校验失败（${errors.length} 项），未导入：\n${errors.slice(0, 10).join("\n")}`,
    );
  return result;
}
