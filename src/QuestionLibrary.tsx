import { chapterNames, questions } from "./data";
import {
  chapterGuides,
  topics,
  topicQuestions,
  unmappedQuestions,
} from "./learning";
import {
  papers,
  selectQuestions,
  sessionKey,
  type QuestionType,
} from "./practice";
import { TypeFilter, type StartPractice } from "./LearningViews";
import type { StudyState } from "./storage";
export interface LibraryFilters {
  source: "chapter" | "past";
  type: QuestionType;
  chapter: number;
  year: number;
}
export default function QuestionLibrary({
  state,
  busy,
  onPractice,
  onTopic,
  filters,
  onFilters,
}: {
  state: StudyState;
  busy: boolean;
  onPractice: StartPractice;
  onTopic: (id: string) => void;
  filters: LibraryFilters;
  onFilters: (f: LibraryFilters) => void;
}) {
  const { source, type, chapter, year } = filters;
  const setSource = (source: LibraryFilters["source"]) =>
    onFilters({ ...filters, source });
  const setType = (type: QuestionType) => onFilters({ ...filters, type });
  const setChapter = (chapter: number) => onFilters({ ...filters, chapter });
  const setYear = (year: number) => onFilters({ ...filters, year });
  const chapterCount = questions.filter(
    (q) => q.sourceType === "chapter",
  ).length;
  return (
    <>
      <div className="section-heading">
        <h2>找到你要练的题</h2>
        <span>来源、考点与题型</span>
      </div>
      <div className="segmented library-tabs">
        <button
          aria-pressed={source === "chapter"}
          onClick={() => setSource("chapter")}
        >
          章节习题 · {chapterCount}
        </button>
        <button
          aria-pressed={source === "past"}
          onClick={() => setSource("past")}
        >
          历年真题 · {questions.length - chapterCount}
        </button>
      </div>
      <div className="filter-bar">
        <TypeFilter value={type} onChange={setType} />
        {source === "chapter" ? (
          <label>
            旧版章节
            <select
              aria-label="旧版章节"
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
            >
              <option value={0}>全部章节</option>
              {chapterNames.map((name, i) => (
                <option key={name} value={i + 1}>
                  第 {i + 1} 章 · {name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            年份
            <select
              aria-label="年份"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              <option value={0}>全部年份</option>
              {Array.from(new Set(papers.map((p) => p.year))).map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {source === "past" ? (
        <>
          <p className="chapter-warning">
            “真题”为资料来源标注，非官方核验。按资料中的年份、场次分组；题数不齐，仅作练习，不作为完整原卷或模拟考试。
          </p>
          <div className="paper-grid">
            {papers
              .filter((p) => !year || p.year === year)
              .map((p) => {
                const session = {
                  kind: "paper" as const,
                  year: p.year,
                  session: p.session,
                  type,
                };
                const list = selectQuestions(session),
                  done = list.filter((q) => state.records[q.id]).length;
                return (
                  <section className="card paper-card" key={p.key}>
                    <div className="eyebrow">
                      <span>
                        {p.year} 年 ·{" "}
                        {p.session === "未注明" ? "场次未注明" : p.session}
                      </span>
                      <span className="badge">待核验</span>
                    </div>
                    <h3>资料标注历年题</h3>
                    <p>原资料条目 {p.questions.length} 道 · 非完整原卷</p>
                    <p className="muted">
                      单选{" "}
                      {p.questions.filter((q) => q.type === "single").length} ·
                      多选{" "}
                      {p.questions.filter((q) => q.type === "multiple").length}{" "}
                      · 案例小题{" "}
                      {p.questions.filter((q) => q.type === "case").length}
                    </p>
                    <p>
                      当前筛选 {list.length} 题 · 已练 {done} 题
                    </p>
                    <button
                      className="primary"
                      disabled={busy || !list.length}
                      onClick={() => onPractice(session)}
                    >
                      {state.cursors[sessionKey(session)]
                        ? "继续练习"
                        : "开始练习"}{" "}
                      · {p.year} {p.session}
                    </button>
                  </section>
                );
              })}
          </div>
        </>
      ) : (
        <>
          <p className="chapter-warning">
            章节习题独立于历年题；以下是旧版章节，尚未适配 2026
            考纲。选择单章后，可进一步按知识专题与原题考点练习。
          </p>
          <div className="chapters">
            {chapterNames.map((name, i) => {
              if (chapter && chapter !== i + 1) return null;
              const session = {
                kind: "chapter" as const,
                chapter: i + 1,
                type,
              };
              const list = selectQuestions(session),
                done = list.filter((q) => state.records[q.id]).length;
              return (
                <section className="card chapter-group" key={name}>
                  <button
                    className="chapter"
                    disabled={busy || !list.length}
                    onClick={() => onPractice(session)}
                  >
                    <span className="chapter-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="chapter-content">
                      <strong>{name}</strong>
                      <span>
                        {done} / {list.length} 题 ·{" "}
                        {state.cursors[sessionKey(session)]
                          ? "继续练习"
                          : "开始练习"}
                      </span>
                      <span className="mini-track">
                        <i
                          style={{
                            width: `${list.length ? (done / list.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="arrow">↗</span>
                  </button>
                  <button
                    className="chapter-topics-link text-button"
                    onClick={() => setChapter(i + 1)}
                  >
                    按本章知识专题拆练 →
                  </button>
                </section>
              );
            })}
          </div>
          {chapter > 0 && (
            <section className="chapter-topic-list">
              <h2>从知识专题进入 · 第 {chapter} 章</h2>
              <p className="muted">{chapterGuides[chapter - 1].path}</p>
              {topics
                .filter((t) => t.chapter === chapter)
                .map((t) => {
                  const list = (topicQuestions.get(t.id) ?? []).filter(
                    (q) =>
                      q.sourceType === "chapter" &&
                      (type === "all" || q.type === type),
                  );
                  return (
                    <section className="card topic-row" key={t.id}>
                      <h3>{t.title}</h3>
                      <p>{t.gist}</p>
                      <div className="practice-actions">
                        <button onClick={() => onTopic(t.id)}>
                          学习要点 · {t.title}
                        </button>
                        <button
                          className="primary"
                          disabled={busy || !list.length}
                          onClick={() =>
                            onPractice({
                              kind: "topic",
                              topic: t.id,
                              source: "chapter",
                              type,
                              label: "",
                            })
                          }
                        >
                          练本专题习题 · {list.length} 题
                        </button>
                      </div>
                    </section>
                  );
                })}
              {unmappedQuestions.some(
                (q) =>
                  q.originalChapter === chapter && q.sourceType === "chapter",
              ) && (
                <section className="card topic-row">
                  <h3>标签待细分</h3>
                  <p>尚未明确对应专题的原题，不强行放入不相关知识点。</p>
                  <button
                    disabled={
                      busy ||
                      !selectQuestions({
                        kind: "unmapped",
                        chapter,
                        source: "chapter",
                        type,
                      }).length
                    }
                    onClick={() =>
                      onPractice({
                        kind: "unmapped",
                        chapter,
                        source: "chapter",
                        type,
                      })
                    }
                  >
                    练待细分习题
                  </button>
                </section>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
