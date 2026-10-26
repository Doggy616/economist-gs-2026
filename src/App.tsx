import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { chapterNames, questionMap, questions } from "./data";
import Markdown from "./Markdown";
import { LearnHome, GuidedLesson } from "./GuidedLearning";
import {
  newLesson,
  resetLesson,
  lessonQuestions,
  type LessonRecord,
} from "./course";
import QuestionLibrary, { type LibraryFilters } from "./QuestionLibrary";
import {
  KnowledgeHub,
  TopicDetail,
  questionOrigin,
  type KnowledgeFilters,
} from "./LearningViews";
import { topics, topicMap, questionTopic, topicStats } from "./learning";
import {
  selectQuestions,
  sessionKey,
  sessionTitle,
  type PracticeSession,
} from "./practice";
import {
  emptyState,
  exportBackup,
  loadState,
  parseBackup,
  recordAnswer,
  saveState,
  type StudyState,
} from "./storage";
type Tab = "learn" | "home" | "wrong" | "knowledge" | "settings";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const [state, setState] = useState<StudyState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [fatal, setFatal] = useState("");
  const [tab, setTab] = useState<Tab>("learn");
  const [queue, setQueue] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [mode, setMode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [lessonTopic, setLessonTopic] = useState<string | null>(null);
  const [courseOrigin, setCourseOrigin] = useState<string | null>(null);
  const [focusedTopic, setFocusedTopic] = useState<string | null>(null);
  const [originTopic, setOriginTopic] = useState<string | null>(null);
  const [practiceTitle, setPracticeTitle] = useState("");
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({
    source: "chapter",
    type: "all",
    chapter: 0,
    year: 0,
  });
  const [knowledgeFilters, setKnowledgeFilters] = useState<KnowledgeFilters>({
    chapter: 1,
    search: "",
    weak: false,
  });
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState<StudyState | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sw = useRegisterSW({
    onRegisterError() {
      setMessage("离线资源准备失败，请联网刷新后重试。");
    },
  });
  const [offlineReady, setOfflineReady] = sw.offlineReady;
  const [needRefresh] = sw.needRefresh;
  async function init() {
    setFatal("");
    try {
      setState(await loadState());
      setLoaded(true);
    } catch {
      setFatal(
        "无法打开本地数据库。请允许浏览器存储并重试；暂不开始练习，以免进度丢失。",
      );
    }
  }
  useEffect(() => {
    void init();
    const capture = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const connection = () => setOnline(navigator.onLine);
    const installed = () => {
      setInstall(null);
      setMessage("已安装，可以从手机桌面打开拾知。");
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const q = questionMap.get(queue[position]);
  useEffect(() => {
    setSelected([]);
    setRevealed(false);
    setNote(q ? (state.notes[q.id] ?? "") : "");
    window.scrollTo(0, 0);
  }, [q?.id]);
  async function persist(next: StudyState) {
    setBusy(true);
    try {
      await saveState(next);
      setState(next);
      return true;
    } catch {
      setMessage(
        "保存失败，可能是存储空间不足。请先导出备份并检查浏览器存储权限。",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function openGuided(id: string, review = false) {
    const saved = state.lessons?.[id];
    const record =
      saved?.phase === 5 || review
        ? resetLesson(saved, true)
        : (saved ?? newLesson());
    if (
      !topicMap.has(id) ||
      !(await persist({
        ...state,
        lessons: { ...state.lessons, [id]: record },
      }))
    )
      return;
    setLessonTopic(id);
    setFocusedTopic(null);
    window.scrollTo(0, 0);
  }
  async function saveLesson(id: string, record: LessonRecord) {
    return persist({ ...state, lessons: { ...state.lessons, [id]: record } });
  }
  async function openPractice(
    session: PracticeSession,
    startId?: string,
    wrongOnly = false,
  ) {
    const list = selectQuestions(session).filter(
      (q) => !wrongOnly || state.records[q.id]?.correct === false,
    );
    const ids = list.map((q) => q.id);
    if (!ids.length) {
      setMessage("当前范围没有可练题目，请调整筛选。");
      return;
    }
    const key = sessionKey(session);
    const legacy =
      session.kind === "chapter"
        ? state.cursors[`chapter:${session.chapter}`]
        : undefined;
    const saved = startId ?? state.cursors[key] ?? legacy;
    const pos = Math.max(0, ids.indexOf(saved ?? ""));
    if (
      !wrongOnly &&
      !(await persist({
        ...state,
        cursors: { ...state.cursors, [key]: ids[pos] },
      }))
    )
      return;
    setQueue(ids);
    setPosition(pos);
    setMode(wrongOnly ? "wrong-topic" : key);
    setPracticeTitle(
      `${wrongOnly ? "错题回练 · " : ""}${sessionTitle(session)}`,
    );
    setOriginTopic(session.kind === "topic" ? session.topic : null);
    setCourseOrigin(session.kind === "lesson" ? session.topic : null);
    setLessonTopic(null);
    setFocusedTopic(null);
    setSelected([]);
    setRevealed(false);
    setMessage("");
  }
  function finishPractice() {
    setQueue([]);
    setLessonTopic(courseOrigin);
    setCourseOrigin(null);
    setFocusedTopic(originTopic);
    setOriginTopic(null);
  }
  function openWrong(id?: string) {
    const ids = questions
      .filter((q) => state.records[q.id]?.correct === false)
      .map((q) => q.id);
    setQueue(ids);
    setPosition(Math.max(0, ids.indexOf(id ?? "")));
    setMode("wrong");
    setLessonTopic(null);
    setCourseOrigin(null);
    setPracticeTitle("错题回练");
    setOriginTopic(null);
    setFocusedTopic(null);
    setSelected([]);
    setRevealed(false);
  }
  async function move(delta: number) {
    const pos = position + delta;
    if (pos < 0 || pos >= queue.length) return;
    if (
      (mode.startsWith("study:") || mode.startsWith("chapter:")) &&
      !(await persist({
        ...state,
        cursors: { ...state.cursors, [mode]: queue[pos] },
      }))
    )
      return;
    setPosition(pos);
  }
  async function submit() {
    if (!q || !selected.length || busy) return;
    if (await persist(recordAnswer(state, q.id, selected))) setRevealed(true);
  }
  const records = Object.values(state.records);
  const correct = records.filter((r) => r.correct).length;
  const wrong = questions.filter((q) => state.records[q.id]?.correct === false);
  const percent = Math.round((records.length / questions.length) * 100);
  function navigate(next: Tab) {
    setQueue([]);
    setLessonTopic(null);
    setCourseOrigin(null);
    setFocusedTopic(null);
    setOriginTopic(null);
    setTab(next);
    setMessage("");
    window.scrollTo(0, 0);
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportBackup(state)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `拾知学习备份-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("已生成 JSON 备份，请在浏览器下载记录中确认保存。");
  }
  async function readBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("备份超过 10MB，请选择拾知导出的学习备份。");
      setPending(parseBackup(await file.text()));
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  if (!loaded)
    return (
      <main className="loading">
        <div className="brand-icon">拾</div>
        <h1>拾知</h1>
        <p>{fatal || "正在读取本机学习记录…"}</p>
        {fatal && <button onClick={() => void init()}>重试</button>}
      </main>
    );
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">拾</span>
          <div>
            <strong>拾知</strong>
            <small>工商管理 · 每天积累一点</small>
          </div>
        </div>
        <span className={"connection " + (online ? "" : "offline")}>
          {online ? "● 本机学习" : "● 当前离线"}
        </span>
      </header>
      <main>
        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {needRefresh && (
          <div className="notice">
            发现新版本，当前进度已保存。
            <button onClick={() => void sw.updateServiceWorker(true)}>
              更新应用
            </button>
          </div>
        )}
        {lessonTopic && topicMap.has(lessonTopic) ? (
          <GuidedLesson
            key={lessonTopic}
            topic={topicMap.get(lessonTopic)!}
            state={state}
            busy={busy}
            onSave={(record) => saveLesson(lessonTopic, record)}
            onExit={() => navigate("learn")}
            onNext={(id) => void openGuided(id)}
            onPractice={(id) => {
              const r = state.lessons?.[id];
              const first = lessonQuestions(id).find(
                (q) =>
                  !state.records[q.id] ||
                  !r?.recalledAt ||
                  Date.parse(state.records[q.id].updatedAt) <
                    Date.parse(r.recalledAt),
              );
              void openPractice({ kind: "lesson", topic: id }, first?.id);
            }}
          />
        ) : focusedTopic && topicMap.has(focusedTopic) ? (
          <TopicDetail
            key={focusedTopic}
            topic={topicMap.get(focusedTopic)!}
            state={state}
            busy={busy}
            onGuided={() => void openGuided(focusedTopic)}
            onBack={() => setFocusedTopic(null)}
            onPractice={(...args) => void openPractice(...args)}
          />
        ) : q ? (
          <>
            <div className="practice-top">
              <button
                className="text-button"
                disabled={busy}
                onClick={finishPractice}
              >
                ← 返回
                {courseOrigin
                  ? "引导学习"
                  : originTopic
                    ? "知识专题"
                    : mode === "wrong"
                      ? "错题本"
                      : "题库"}
              </button>
              <span>
                {position + 1} / {queue.length}
              </span>
            </div>
            <p className="muted practice-title">{practiceTitle}</p>
            <p className="question-origin">
              {questionOrigin(q)} · {q.sourceFile} 第 {q.sourceLine} 行
            </p>
            <div className="progress-track">
              <i
                style={{ width: `${((position + 1) / queue.length) * 100}%` }}
              />
            </div>
            <section
              className="question card"
              key={q.id}
              data-question-id={q.id}
            >
              <div className="eyebrow">
                <span>
                  旧版第 {q.originalChapter} 章 ·{" "}
                  {q.type === "case"
                    ? "案例题"
                    : q.type === "multiple"
                      ? "多选题"
                      : "单选题"}
                </span>
                <span className="badge">待核验</span>
              </div>
              <p className="muted">
                {q.knowledgePoint || chapterNames[q.originalChapter - 1]}
              </p>
              {q.caseContext && (
                <details className="case" open>
                  <summary>案例背景材料</summary>
                  <Markdown text={q.caseContext} />
                  {q.caseGroupId && <small>案例组：{q.caseGroupId}</small>}
                </details>
              )}
              <h1 className="stem">{q.stem}</h1>
              <p className="muted">
                {q.type === "single"
                  ? "请选择一个选项"
                  : "可选择一个或多个选项，完全匹配原答案才记为答对。"}
              </p>
              <div className="options" role="group" aria-label="答题选项">
                {Object.entries(q.options).map(([key, value]) => (
                  <button
                    key={key}
                    disabled={revealed || busy}
                    aria-pressed={selected.includes(key)}
                    className={
                      "option " +
                      (selected.includes(key) ? "selected " : "") +
                      (revealed && q.answer.includes(key) ? "right " : "") +
                      (revealed &&
                      selected.includes(key) &&
                      !q.answer.includes(key)
                        ? "incorrect"
                        : "")
                    }
                    onClick={() =>
                      setSelected(
                        q.type === "single"
                          ? [key]
                          : selected.includes(key)
                            ? selected.filter((k) => k !== key)
                            : [...selected, key],
                      )
                    }
                  >
                    <span className="letter">{key}</span>
                    <span>{value}</span>
                    {selected.includes(key) && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
              {!revealed ? (
                <button
                  className="primary wide"
                  disabled={!selected.length || busy}
                  onClick={() => void submit()}
                >
                  {busy ? "保存中…" : "提交答案"}
                </button>
              ) : (
                <section className="explanation" aria-live="polite">
                  <h2>
                    {state.records[q.id]?.correct
                      ? "✓ 本次答对了"
                      : "这道题再记一遍"}
                  </h2>
                  <p>
                    原资料答案：<strong>{q.answer.join("、")}</strong>
                    　你的选择：{selected.join("、")}
                  </p>
                  <p className="muted">
                    答案与解析待人工核验；判分仅按原题答案完全匹配，不代表正式考试计分。
                  </p>
                  <Markdown text={q.explanation || "原资料未提供解析。"} />
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected([]);
                      setRevealed(false);
                    }}
                  >
                    重新作答
                  </button>
                </section>
              )}
              {state.records[q.id] && !revealed && (
                <p className="muted">
                  已练 {state.records[q.id].attempts} 次 · 上次
                  {state.records[q.id].correct ? "答对" : "答错"}，可再次练习
                </p>
              )}
              <section className="knowledge-bridge">
                <h2>
                  {revealed && !state.records[q.id]?.correct
                    ? "先补知识，再练同类题"
                    : "这道题对应的知识"}
                </h2>
                {questionTopic.get(q.id) ? (
                  <>
                    <p>原题考点：{q.knowledgePoint}</p>
                    <button
                      onClick={() =>
                        setFocusedTopic(questionTopic.get(q.id)!.id)
                      }
                    >
                      学习专题 · {questionTopic.get(q.id)!.title} →
                    </button>
                    <p className="muted">
                      按原题标签关联，待核验。返回后保留本题作答状态。
                    </p>
                  </>
                ) : (
                  <p>
                    原题考点：{q.knowledgePoint || "未标注"}
                    。目前没有可靠的专题匹配，暂列待细分；原题仍可正常练习。
                  </p>
                )}
              </section>
              <details className="source">
                <summary>原题来源与纠错备注</summary>
                <p>
                  {q.sourceFile} · 第 {q.sourceLine} 行
                </p>
                <p>题目 ID：{q.id}</p>
                <p>
                  {q.year ? `${q.year} 年 ${q.session ?? ""}` : "章节习题"} ·
                  原章节号：{q.originalChapter}
                </p>
                <p>
                  核验状态：{q.verificationStatus}
                  <br />
                  2026 考纲：{q.syllabus2026Status}，未建立新版章节映射。
                </p>
                <label htmlFor="note">
                  记录疑问（仅保存在本机，不修改答案）
                </label>
                <textarea
                  id="note"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：答案疑问、待核对资料页码…"
                />
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await persist({
                        ...state,
                        notes: { ...state.notes, [q.id]: note },
                      })
                    )
                      setMessage("纠错备注已保存，将随 JSON 备份导出。");
                  }}
                >
                  保存备注
                </button>
              </details>
            </section>
            <div className="question-nav">
              <button
                disabled={position === 0 || busy}
                onClick={() => void move(-1)}
              >
                ← 上一题
              </button>
              {position < queue.length - 1 ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void move(1)}
                >
                  下一题 →
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={finishPractice}
                >
                  完成本轮
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {tab === "learn" && (
              <LearnHome
                state={state}
                onOpen={(id, review) => void openGuided(id, review)}
              />
            )}
            {tab === "home" && (
              <>
                <section className="hero">
                  <div className="eyebrow">
                    你的随身学习手册 <span>OFFLINE STUDY</span>
                  </div>
                  <h1>温故，也知新。</h1>
                  <p>从一个章节开始，把知识变成自己的。</p>
                  <div className="hero-bottom">
                    <span>
                      已练 <strong>{records.length}</strong> /{" "}
                      {questions.length} 题
                    </span>
                    <span>{percent}%</span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </section>
                <div className="stats">
                  <div>
                    <strong>{records.length}</strong>
                    <span>已练题目</span>
                  </div>
                  <div>
                    <strong>
                      {records.length
                        ? Math.round((correct / records.length) * 100)
                        : 0}
                      <small>%</small>
                    </strong>
                    <span>最近作答正确率</span>
                  </div>
                  <button onClick={() => navigate("wrong")}>
                    <strong>{wrong.length}</strong>
                    <span>待复习错题 ↗</span>
                  </button>
                </div>
                <QuestionLibrary
                  filters={libraryFilters}
                  onFilters={setLibraryFilters}
                  state={state}
                  busy={busy}
                  onPractice={(...args) => void openPractice(...args)}
                  onTopic={setFocusedTopic}
                />
                <p className="footnote">
                  一点一滴，学有所获。进度自动保存在当前设备。
                </p>
              </>
            )}
            {tab === "wrong" && (
              <>
                <div className="page-heading">
                  <span className="eyebrow">REVIEW & REMEMBER</span>
                  <h1>把错题，变成收获。</h1>
                  <p>按最近一次作答收录；重新答对后自动移出，练习次数保留。</p>
                </div>
                {wrong.length > 0 && (
                  <section className="card weakness-panel">
                    <h2>先找到薄弱专题</h2>
                    <p className="muted">
                      按最近一次作答统计，不代表完整掌握情况；先回看知识，再练同类题。
                    </p>
                    <div className="weakness-links">
                      {topics
                        .filter(
                          (t) => topicStats(t.id, state.records).wrong > 0,
                        )
                        .sort(
                          (a, b) =>
                            topicStats(b.id, state.records).wrong -
                            topicStats(a.id, state.records).wrong,
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setFocusedTopic(t.id)}
                          >
                            {t.title} · {topicStats(t.id, state.records).wrong}{" "}
                            道错题 →
                          </button>
                        ))}
                    </div>
                  </section>
                )}
                {wrong.length ? (
                  <>
                    <button className="primary" onClick={() => openWrong()}>
                      开始复习 · {wrong.length} 题
                    </button>
                    <div className="wrong-list">
                      {wrong.map((q) => (
                        <button
                          className="card wrong-item"
                          key={q.id}
                          onClick={() => openWrong(q.id)}
                        >
                          <small>旧版第 {q.originalChapter} 章 · 待核验</small>
                          <strong>{q.stem}</strong>
                          <span>
                            已练 {state.records[q.id].attempts} 次 · 查看并练习
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <section className="empty card">
                    <span>✧</span>
                    <h2>这里还没有错题</h2>
                    <p>答错的题会自动收录，复习后答对即可移出。</p>
                    <button onClick={() => navigate("home")}>去章节练习</button>
                  </section>
                )}
              </>
            )}
            {tab === "knowledge" && (
              <KnowledgeHub
                filters={knowledgeFilters}
                onFilters={setKnowledgeFilters}
                state={state}
                onOpen={setFocusedTopic}
              />
            )}
            {tab === "settings" && (
              <>
                <div className="page-heading">
                  <span className="eyebrow">KEEP YOUR PROGRESS</span>
                  <h1>学习记录，安心收好。</h1>
                  <p>无需登录。学习记录保存在此浏览器，建议定期备份。</p>
                </div>
                <section className="card settings">
                  <h2>备份与恢复</h2>
                  <p>
                    导出包含答题记录、练习位置、引导学习步骤、回忆文本、复习安排和纠错备注，不包含题库原文。清除浏览器数据或更换网址、设备后，需要手动恢复备份。
                  </p>
                  <button className="primary" onClick={download}>
                    导出 JSON 备份
                  </button>
                  <button onClick={() => input.current?.click()}>
                    选择备份恢复
                  </button>
                  <input
                    ref={input}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => void readBackup(e.target.files?.[0])}
                  />
                  {pending && (
                    <div className="restore-confirm" role="alert">
                      <h3>确认恢复备份？</h3>
                      <p>
                        此备份有 {Object.keys(pending.records).length}{" "}
                        道已练题、{Object.keys(pending.notes).length}{" "}
                        条备注。恢复会替换本机全部学习记录，建议先导出当前备份。
                      </p>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={async () => {
                          if (await persist(pending)) {
                            setPending(null);
                            setMessage("恢复完成，学习记录已保存到本机。");
                          }
                        }}
                      >
                        确认替换并恢复
                      </button>
                      <button onClick={() => setPending(null)}>取消</button>
                    </div>
                  )}
                </section>
                <section className="card settings">
                  <h2>安装与离线</h2>
                  <p className="offline-status">
                    {offlineReady
                      ? "✓ 离线资源已就绪"
                      : "正在准备离线资源，请保持联网…"}
                  </p>
                  <p>
                    首次联网打开后，等待上方显示“离线资源已就绪”。安卓 Chrome
                    点击右上角 ⋮
                    →“添加到主屏幕”或“安装应用”，之后可从桌面离线打开。
                  </p>
                  {install && (
                    <button
                      className="primary"
                      onClick={async () => {
                        try {
                          await install.prompt();
                          await install.userChoice;
                          setInstall(null);
                        } catch {
                          setMessage("请通过 Chrome 右上角菜单安装应用。");
                        }
                      }}
                    >
                      安装到手机
                    </button>
                  )}
                  <p className="muted">
                    安装需要
                    HTTPS；浏览器未提供安装按钮时，可使用菜单。应用无需外部字体或在线接口。题库、解析和两份知识资料均支持离线阅读。
                  </p>
                </section>
                <section className="card settings">
                  <h2>资料说明</h2>
                  <p>
                    1424 道结构校验通过的候选题，含 166
                    道案例小题。未完成逐题人工核对，也未完成 2026
                    年考纲适配。旧版第十章为电子商务，请勿视为新版章节。
                  </p>
                  <p>
                    答案、解析和原题来源保持原样，解析可能含原资料残留文字。请结合原始资料核对；可在题目下方记录纠错备注。
                  </p>
                  <p>
                    静态部署后题库通常可被网址访问者获取，公开部署前请确认资料使用权限。当前无账号、云同步或分析服务。
                  </p>
                  <p className="muted">拾知 v1.1 · 知识与试题联动</p>
                </section>
              </>
            )}
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {(
          [
            ["learn", "⌂", "学习"],
            ["home", "▦", "题库"],
            ["wrong", "↺", "错题本"],
            ["knowledge", "▤", "知识手册"],
            ["settings", "⚙", "我的"],
          ] as const
        ).map(([key, icon, title]) => (
          <button
            disabled={busy}
            key={key}
            aria-label={title}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            <span>{icon}</span>
            {title}
          </button>
        ))}
      </nav>
    </>
  );
}
