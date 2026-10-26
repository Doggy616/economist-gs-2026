import { useState } from "react";
import { chapterNames, type Question } from "./data";
import {
  chapterGuides,
  topics,
  topicQuestions,
  topicStats,
  topicSources,
  originalDocuments,
  unmappedQuestions,
  type Topic,
} from "./learning";
import {
  sourceNames,
  typeNames,
  type SourceType,
  type QuestionType,
  type PracticeSession,
} from "./practice";
import type { StudyState } from "./storage";
import Markdown from "./Markdown";
export type StartPractice = (
  session: PracticeSession,
  startId?: string,
  wrongOnly?: boolean,
) => void;
function Stats({ topic, state }: { topic: Topic; state: StudyState }) {
  const s = topicStats(topic.id, state.records);
  return (
    <p className="topic-stats">
      关联 {s.total} 题 · 已练 {s.attempted} · 最近答对 {s.correct} · 待复习{" "}
      {s.wrong}
    </p>
  );
}
export function TopicCard({
  topic,
  state,
  onOpen,
}: {
  topic: Topic;
  state: StudyState;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      className="card topic-card"
      aria-label={`学习专题：${topic.title}`}
      onClick={() => onOpen(topic.id)}
    >
      <small>
        旧版第 {topic.chapter} 章 · 专题 {topic.id} · 待核验
      </small>
      <h3>{topic.title}</h3>
      <p>{topic.gist}</p>
      <Stats topic={topic} state={state} />
      <span className="topic-link">学习要点与关联试题 →</span>
    </button>
  );
}
export interface KnowledgeFilters {
  chapter: number;
  search: string;
  weak: boolean;
}
export function KnowledgeHub({
  state,
  onOpen,
  filters,
  onFilters,
}: {
  state: StudyState;
  onOpen: (id: string) => void;
  filters: KnowledgeFilters;
  onFilters: (f: KnowledgeFilters) => void;
}) {
  const { chapter, search, weak } = filters;
  const setChapter = (chapter: number) => onFilters({ ...filters, chapter });
  const setSearch = (search: string) => onFilters({ ...filters, search });
  const setWeak = (weak: boolean) => onFilters({ ...filters, weak });
  const [doc, setDoc] = useState<"yao" | "creator">("yao");
  const list = topics.filter(
    (t) =>
      (search.trim()
        ? `${t.title}${t.gist}${t.points.join("")}${t.keywords.join("")}`.includes(
            search.trim(),
          )
        : t.chapter === chapter) &&
      (!weak || topicStats(t.id, state.records).wrong > 0),
  );
  const guide = chapterGuides[chapter - 1];
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">LEARN → PRACTICE → REVIEW</span>
        <h1>知识成体系，练习有方向。</h1>
        <p>
          48
          个学习专题：先理解主线，再辨易混点，最后用原题检验。内容由两份资料重新整理，仍待核验。
        </p>
      </div>
      <div className="filter-bar">
        <label>
          旧版章节
          <select
            aria-label="旧版章节"
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value))}
          >
            {chapterNames.map((name, i) => (
              <option key={name} value={i + 1}>
                第 {i + 1} 章 · {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          搜索知识专题
          <input
            aria-label="搜索知识专题"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="例如：年金、定价、库存…"
          />
        </label>
      </div>
      <button
        className="weak-toggle"
        aria-pressed={weak}
        onClick={() => setWeak(!weak)}
      >
        {weak ? "显示全部专题" : "只看有错题的专题"}
      </button>
      {!search && (
        <section className="learning-map card">
          <span className="eyebrow">本章要回答的问题</span>
          <h2>{guide.question}</h2>
          <p>{guide.path}</p>
          <small>
            先学习专题 → 闭卷自测 → 练章节习题 → 检验历年题 →
            回看错题。最近答题结果仅作复习参考，不代表已经掌握。
          </small>
        </section>
      )}
      <div className="topic-grid">
        {list.map((t) => (
          <TopicCard key={t.id} topic={t} state={state} onOpen={onOpen} />
        ))}
      </div>
      {!list.length && (
        <p className="empty card">
          {weak
            ? "当前范围没有待复习专题。未练题目不等于已经掌握。"
            : "没有找到专题，请换个关键词。"}
        </p>
      )}
      <p className="chapter-warning">
        关联依据：原题 knowledgePoint
        标签与旧版章节，按已列出的关键词归类，关联关系待核验。
        {unmappedQuestions.length}{" "}
        题标签暂未匹配，仍可在题库按章或年份练习，不强行归类。
      </p>
      <details className="card original-docs">
        <summary>查阅原始资料（保留用于追溯）</summary>
        <p className="muted">
          原始文档不等于整理后的知识专题；文档中的旧统计、公式及法律适用均需核对。
        </p>
        <div className="segmented">
          <button aria-pressed={doc === "yao"} onClick={() => setDoc("yao")}>
            完整知识骨架原文
          </button>
          <button
            aria-pressed={doc === "creator"}
            onClick={() => setDoc("creator")}
          >
            体系与学习心法原文
          </button>
        </div>
        <Markdown text={originalDocuments[doc]} />
      </details>
    </>
  );
}
export function TopicDetail({
  topic,
  state,
  onBack,
  onPractice,
  onGuided,
  busy,
}: {
  topic: Topic;
  state: StudyState;
  onBack: () => void;
  onPractice: StartPractice;
  onGuided: () => void;
  busy: boolean;
}) {
  const [source, setSource] = useState<SourceType>("all"),
    [type, setType] = useState<QuestionType>("all"),
    [label, setLabel] = useState("");
  const all = topicQuestions.get(topic.id) ?? [];
  const filtered = all.filter(
    (q) =>
      (source === "all" || q.sourceType === source) &&
      (type === "all" || q.type === type) &&
      (!label || q.knowledgePoint === label),
  );
  const wrong = filtered.filter((q) => state.records[q.id]?.correct === false);
  const session: PracticeSession = {
    kind: "topic",
    topic: topic.id,
    source,
    type,
    label,
  };
  const sources = topicSources(topic);
  return (
    <>
      <button className="text-button" disabled={busy} onClick={onBack}>
        ← 返回 {/* Keep question state when coming from practice. */}上一页
      </button>
      <article className="topic-detail">
        <div className="page-heading">
          <span className="badge">
            旧版第 {topic.chapter} 章 · 提炼内容待核验
          </span>
          <h1>{topic.title}</h1>
          <p>{topic.gist}</p>
          <Stats topic={topic} state={state} />
        </div>
        <section className="card guided-invite">
          <h2>第一次接触这个知识？</h2>
          <p>跟着固定的五步结构，先认识概念和例子，再主动回忆与检验。</p>
          <button className="primary" disabled={busy} onClick={onGuided}>
            从零引导学习这个专题
          </button>
        </section>
        <section className="card knowledge">
          <h2>抓住这几件事</h2>
          <ol className="key-points">
            {topic.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <div className="contrast">
            <h3>易混辨析与边界</h3>
            <p>{topic.trap}</p>
          </div>
        </section>
        <section className="card settings retrieval">
          <h2>先不看答案，想一想</h2>
          <p>{topic.selfTest.prompt}</p>
          <details>
            <summary>展开自测参考</summary>
            <p>{topic.selfTest.answer}</p>
            <small>
              这是整理后的自测示例，不修改题库答案，也不计入答题正确率。
            </small>
          </details>
        </section>
        <section className="card settings">
          <h2>从知识到试题</h2>
          <p>
            按原题考点标签关联，尚未逐题核验。全部关联题共 {all.length}{" "}
            道：章节习题 {all.filter((q) => q.sourceType === "chapter").length}
            ，历年题 {all.filter((q) => q.sourceType === "past").length}。
          </p>
          <div className="filter-bar">
            <label>
              题目来源
              <select
                aria-label="题目来源"
                value={source}
                onChange={(e) => setSource(e.target.value as SourceType)}
              >
                {Object.entries(sourceNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <TypeFilter value={type} onChange={setType} />
          </div>
          <label className="tag-filter">
            细分到原题考点
            <select
              aria-label="细分到原题考点"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            >
              <option value="">本专题全部考点</option>
              {Array.from(new Set(all.map((q) => q.knowledgePoint)))
                .sort()
                .map((k) => (
                  <option key={k} value={k ?? ""}>
                    {k}
                  </option>
                ))}
            </select>
          </label>
          <div className="practice-actions">
            <button
              className="primary"
              disabled={busy || !filtered.length}
              onClick={() => onPractice(session)}
            >
              开始关联练习 · {filtered.length} 题
            </button>
            <button
              disabled={busy || !wrong.length}
              onClick={() => onPractice(session, undefined, true)}
            >
              复习本专题错题 · {wrong.length} 题
            </button>
          </div>
          {!filtered.length && <p>当前筛选下没有题目，可以切换来源或题型。</p>}
          <details>
            <summary>查看关联题目与来源（{filtered.length}）</summary>
            <div className="related-list">
              {filtered.map((q) => (
                <button
                  key={q.id}
                  disabled={busy}
                  onClick={() => onPractice(session, q.id)}
                >
                  <small>
                    {questionOrigin(q)} · {q.knowledgePoint} ·{" "}
                    {state.records[q.id]
                      ? state.records[q.id].correct
                        ? "最近答对"
                        : "待复习"
                      : "未练"}
                  </small>
                  <span>{q.stem}</span>
                </button>
              ))}
            </div>
          </details>
        </section>
        <details className="card original-docs">
          <summary>提炼依据与关联规则</summary>
          <p>
            本专题仅按原题考点标签匹配以下关键词，不按答案猜测归属；同章多个关键词命中时取最长的匹配词。标签可能有误，关联仍待人工核验。
          </p>
          <p className="muted">{topic.keywords.join("、")}</p>
          {sources.map((s) => (
            <details key={`${s.file}:${s.line}`}>
              <summary>
                {s.file} · 第 {s.line} 行 · {s.heading}
              </summary>
              <Markdown text={s.text} />
            </details>
          ))}
        </details>
      </article>
    </>
  );
}
export function TypeFilter({
  value,
  onChange,
}: {
  value: QuestionType;
  onChange: (t: QuestionType) => void;
}) {
  return (
    <label>
      题型
      <select
        aria-label="题型"
        value={value}
        onChange={(e) => onChange(e.target.value as QuestionType)}
      >
        {Object.entries(typeNames).map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function questionOrigin(q: Question) {
  return q.sourceType === "past"
    ? `${q.year} 年 · ${q.session} · 资料标注历年题`
    : "章节习题";
}
