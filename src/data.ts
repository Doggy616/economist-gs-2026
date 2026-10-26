import raw from "../questions_import_ready.json";
export interface Question {
  id: string;
  sourceType: string;
  sourceFile: string;
  sourceLine: number;
  year: number | null;
  session: string | null;
  originalChapter: number;
  knowledgePoint: string | null;
  type: string;
  stem: string;
  options: Record<string, string>;
  answer: string[];
  explanation: string;
  caseContext: string | null;
  caseGroupId: string | null;
  syllabus2026Status: string;
  verificationStatus: string;
}
export const questions = raw as Question[];
export const questionMap = new Map(questions.map((q) => [q.id, q]));
export const chapterNames = [
  "企业战略与经营决策",
  "公司法人治理结构",
  "市场营销与品牌管理",
  "分销渠道管理",
  "生产管理",
  "物流管理",
  "技术创新管理",
  "人力资源规划与薪酬管理",
  "企业投融资决策及并购重组",
  "电子商务",
  "国际商务运营",
];
export function sameAnswer(a: string[], b: string[]) {
  return (
    a.length === b.length &&
    new Set(a).size === a.length &&
    [...a].sort().join("|") === [...b].sort().join("|")
  );
}
// Literal newlines occur in extracted case materials. Only normalize presentation.
export const displayText = (text: string) => text.replace(/\\n/g, "\n");
