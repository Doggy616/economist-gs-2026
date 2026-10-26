import { useState } from "react";
import {
  learningPath,
  corePath,
  coreTopicIds,
  stages,
  newLesson,
  needsReview,
  lessonQuestions,
  completeLesson,
  type LessonRecord,
  type RecallRating,
} from "./course";
import { chapterNames } from "./data";
import { topicStats, topicSources, type Topic } from "./learning";
import examples from "./lesson-examples.json";
import type { StudyState } from "./storage";
import Markdown from "./Markdown";
const stepNames = ["看问题", "懂概念", "看推演", "主动回忆", "检验与复习"];
const phaseLabel = (r: LessonRecord | undefined) =>
  !r
    ? "尚未开始"
    : r.phase === 5
      ? "已完成学习轮次"
      : `进行中 · ${stepNames[Math.min(r.phase, 4)]}`;
export function LearnHome({
  state,
  onOpen,
}: {
  state: StudyState;
  onOpen: (id: string, review?: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const lessons = state.lessons ?? {};
  const coreDone = corePath.filter(
    (t) => (lessons[t.id]?.reviews ?? 0) > 0,
  ).length;
  const path =
    showAll || coreDone === corePath.length ? learningPath : corePath;
  const due = learningPath.filter((t) => needsReview(lessons[t.id]));
  const unfinished = learningPath.find(
    (t) => lessons[t.id] && lessons[t.id].phase < 5,
  );
  const next =
    unfinished ??
    due[0] ??
    path.find((t) => !lessons[t.id]?.reviews) ??
    path[0];
  const done = learningPath.filter(
    (t) => (lessons[t.id]?.reviews ?? 0) > 0,
  ).length;
  return (
    <>
      <section className="hero learn-hero">
        <div className="eyebrow">
          从零开始 · 先理解，再练习<span>LEARN WITH A STRUCTURE</span>
        </div>
        <h1>先看懂一家企业。</h1>
        <p>不必先背完整本书。每次只解决一个问题，再把它放回整张知识地图。</p>
        <div className="hero-bottom">
          <span>
            已完成首轮 <strong>{done}</strong> / {learningPath.length} 个专题
          </span>
          <span>待复习 {due.length}</span>
        </div>
        <div className="progress-track">
          <i style={{ width: `${(done / learningPath.length) * 100}%` }} />
        </div>
        <p className="core-progress">
          入门核心：{coreDone} / {corePath.length} · 先搭主干，再补细节
        </p>
      </section>
      <section className="card next-lesson">
        <span className="eyebrow">
          {unfinished
            ? "接着上次的小步走"
            : due.length
              ? "今天先唤回旧知识"
              : "今天只学一个小专题"}
        </span>
        <h2>{next.title}</h2>
        <p>{next.gist}</p>
        <button
          className="primary"
          onClick={() =>
            onOpen(next.id, !unfinished && needsReview(lessons[next.id]))
          }
        >
          {unfinished
            ? "继续引导学习"
            : due.length
              ? "开始到期回忆"
              : "开始引导学习"}
        </button>
        <p className="muted">
          建议先用 10—15
          分钟完成一轮，速度由你决定。读过和答对少量题，都不等于已经长期掌握。
        </p>
      </section>
      <section className="card business-orientation">
        <span className="eyebrow">先有整体，再放细节</span>
        <h2>企业在做一件什么事？</h2>
        <div className="business-chain">
          <span>发现需求</span>
          <b>→</b>
          <span>组织资源</span>
          <b>→</b>
          <span>交付价值</span>
          <b>→</b>
          <span>获得回报</span>
        </div>
        <p>
          比如开一家面包店：谁会买，是营销；为什么选这门生意，是战略；怎么做出来并送到顾客手里，是生产、物流与渠道；人和钱怎么安排，又需要组织与财务。
        </p>
        <small>
          先把知识放进这条经营链，再逐渐细分。下面是学习顺序，不是 2026
          考纲章节顺序。
        </small>
      </section>
      <details className="card learning-method">
        <summary>为什么这样安排？</summary>
        <ol>
          <li>先给经营场景和少量术语，减轻新手一次处理过多信息的负担。</li>
          <li>先看例子的推理过程，再逐渐自己回答，而不是一上来就猜选项。</li>
          <li>回忆时暂时隐藏讲解，写出自己的解释，再对照反馈。</li>
          <li>少量同专题题检验理解，后续再用跨专题与历年题辨认情境。</li>
          <li>
            隔一段时间重新回忆，依据表现调整提醒；本机提醒不等于记忆能力诊断。
          </li>
        </ol>
      </details>
      {due.length > 0 && (
        <section className="review-due">
          <h2>到了再回忆的时候</h2>
          {due.map((t) => (
            <button
              className="card"
              key={t.id}
              onClick={() => onOpen(t.id, true)}
            >
              <strong>{t.title}</strong>
              <span>从主动回忆开始，不先重读讲解 →</span>
            </button>
          ))}
        </section>
      )}
      <div className="section-heading">
        <h2>你的核心知识路径</h2>
        <span>6 个经营问题</span>
      </div>
      <p className="muted">
        可以按建议顺序前进，也可以自行选择。专题和原题关联仍待核验。
      </p>
      <div className="segmented">
        <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>
          20 个入门核心
        </button>
        <button aria-pressed={showAll} onClick={() => setShowAll(true)}>
          48 个完整专题
        </button>
      </div>
      <p className="muted">
        核心优先级按概念依赖与可迁移性编排，不是考纲核验或考试命中预测；完成核心后会继续推荐进阶内容。
      </p>
      <div className="learning-stages">
        {stages.map((s, i) => (
          <details className="card" key={s.title} open={i === 0}>
            <summary>
              <span className="stage-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{s.title}</strong>
                <small>{s.question}</small>
              </span>
            </summary>
            <div className="stage-topics">
              {learningPath
                .filter(
                  (t) =>
                    s.chapters.includes(t.chapter) &&
                    (showAll || coreTopicIds.has(t.id)),
                )
                .map((t) => (
                  <button key={t.id} onClick={() => onOpen(t.id)}>
                    <span>
                      <strong>{t.title}</strong>
                      <small>
                        {coreTopicIds.has(t.id) ? "入门核心" : "系统进阶"} ·
                        旧版第 {t.chapter} 章 · {phaseLabel(lessons[t.id])}
                      </small>
                    </span>
                    <span>→</span>
                  </button>
                ))}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
export function GuidedLesson({
  topic,
  state,
  busy,
  onSave,
  onPractice,
  onExit,
  onNext,
}: {
  topic: Topic;
  state: StudyState;
  busy: boolean;
  onSave: (r: LessonRecord) => Promise<boolean>;
  onPractice: (id: string) => void;
  onExit: () => void;
  onNext: (id: string) => void;
}) {
  const record = state.lessons?.[topic.id] ?? newLesson();
  const phase = record.phase;
  const [text, setText] = useState(record.recallText),
    [showAnswer, setShowAnswer] = useState(false),
    [error, setError] = useState("");
  const material = examples.find((e) => e.topic === topic.id)!;
  const example = material.example;
  const list = lessonQuestions(topic.id);
  const checked = list.filter(
    (q) =>
      state.records[q.id] &&
      record.recalledAt &&
      Date.parse(state.records[q.id].updatedAt) >=
        Date.parse(record.recalledAt),
  );
  const wrong = checked.filter((q) => !state.records[q.id].correct);
  const nextPath = coreTopicIds.has(topic.id) ? corePath : learningPath;
  const next = nextPath[nextPath.findIndex((t) => t.id === topic.id) + 1];
  async function step(to: number) {
    if (await onSave({ ...record, phase: to })) {
      setError("");
      window.scrollTo(0, 0);
    }
  }
  async function compare() {
    if (text.trim().length < 4) {
      setError(
        "请先用自己的话写出至少 4 个字，再对照参考。不会也可以写出哪里不明白。",
      );
      return;
    }
    if (await onSave({ ...record, recallText: text.trim() })) {
      setShowAnswer(true);
      setError("");
    }
  }
  async function rate(rating: RecallRating) {
    const saved = await onSave({
      ...record,
      recallText: text.trim(),
      rating,
      recalledAt: new Date().toISOString(),
      phase: 4,
    });
    if (!saved) return;
    setShowAnswer(false);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <div className="practice-top">
        <button className="text-button" disabled={busy} onClick={onExit}>
          ← 返回学习入口
        </button>
        <span>旧版第 {topic.chapter} 章 · 待核验</span>
      </div>
      <div className="lesson-title">
        <small>{chapterNames[topic.chapter - 1]} · 引导学习</small>
        <h1>{topic.title}</h1>
      </div>
      {phase < 5 && (
        <ol className="lesson-steps" aria-label="学习步骤">
          {stepNames.map((name, i) => (
            <li key={name} aria-current={phase === i ? "step" : undefined}>
              <span>{i + 1}</span>
              <small>{name}</small>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {phase === 0 && (
        <section className="card lesson-panel">
          <span className="eyebrow">01 · 先知道为什么要学</span>
          <h2>把自己放进这个场景</h2>
          <p className="scenario">{example.scenario}</p>
          <p>
            这个专题要解决的是：<strong>{topic.gist}</strong>
          </p>
          <div className="lesson-objective">
            <h3>这一小步的目标</h3>
            <p>
              能用自己的话区分本专题概念，说明例子为什么这样判断，再尝试{" "}
              {list.length} 道关联题。不要求一次记住所有细节。
            </p>
          </div>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => void step(1)}
          >
            带着这个问题，认识概念 →
          </button>
        </section>
      )}
      {phase === 1 && (
        <section className="card lesson-panel">
          <span className="eyebrow">02 · 一次只放进少量概念</span>
          <h2>先理解，再记关键词</h2>
          <details className="term-box" open>
            <summary>没有基础？先看这几个词</summary>
            <dl>
              {material.terms.map((g) => (
                <div key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
          <ol className="key-points">
            {topic.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <div className="contrast">
            <h3>最容易混在一起的地方</h3>
            <p>{topic.trap}</p>
          </div>
          <details className="lesson-sources">
            <summary>查看提炼依据</summary>
            {topicSources(topic).map((s) => (
              <details key={`${s.file}:${s.line}`}>
                <summary>
                  {s.file} 第 {s.line} 行 · {s.heading}
                </summary>
                <Markdown text={s.text} />
              </details>
            ))}
          </details>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => void step(2)}
          >
            看它在例子里如何运用 →
          </button>
        </section>
      )}
      {phase === 2 && (
        <section className="card lesson-panel">
          <span className="eyebrow">03 · 先看一个完整推演</span>
          <h2>不只看结论，看每一步为什么</h2>
          <p className="scenario">{example.scenario}</p>
          <ol className="worked-steps">
            {example.steps.map((p, i) => (
              <li key={p}>
                <span>{i + 1}</span>
                <p>{p}</p>
              </li>
            ))}
          </ol>
          <div className="lesson-conclusion">
            <strong>合起来看</strong>
            <p>{example.conclusion}</p>
          </div>
          <p className="muted">
            这是依据专题要点编写的教学示例，不是新增的官方试题，仍待核验。
          </p>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => void step(3)}
          >
            暂时收起讲解，自己说一遍 →
          </button>
        </section>
      )}
      {phase === 3 && (
        <section className="card lesson-panel">
          <span className="eyebrow">04 · 主动回忆，不靠眼熟</span>
          <h2>合上讲解，你会怎样回答？</h2>
          <p className="scenario">{topic.selfTest.prompt}</p>
          <label className="recall-label" htmlFor="recall">
            用自己的话解释判断依据
          </label>
          <textarea
            id="recall"
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setShowAnswer(false);
            }}
            placeholder="不需要写标准答案；试着说出关键区别。不会时，写出卡住的地方。"
          />
          <button
            className="primary"
            disabled={busy}
            onClick={() => void compare()}
          >
            保存回忆并对照参考
          </button>
          <p className="muted">
            回忆内容确认后保存在本机并随备份导出。应用不会自动判断这段文字是否正确。
          </p>
          {showAnswer && (
            <div className="recall-feedback">
              <h3>自测参考</h3>
              <p>{topic.selfTest.answer}</p>
              <p>对照关键概念，诚实判断刚才的回忆：</p>
              <div className="recall-ratings">
                <button disabled={busy} onClick={() => void rate("again")}>
                  还没想起来
                </button>
                <button disabled={busy} onClick={() => void rate("hard")}>
                  想起一部分
                </button>
                <button disabled={busy} onClick={() => void rate("good")}>
                  能解释依据
                </button>
              </div>
            </div>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void step(1)}
          >
            卡住了，回看概念（保留已保存的回忆）
          </button>
        </section>
      )}
      {phase === 4 && (
        <section className="card lesson-panel">
          <span className="eyebrow">05 · 检验理解，再安排复习</span>
          <h2>换回原题，看能否辨认</h2>
          <p>
            本轮选取 {list.length}{" "}
            道关联原题，尽可能覆盖不同原题考点并包含历年题。标签关联待核验；少量题的表现不能证明已经掌握整个专题。
          </p>
          <div className="lesson-checks">
            <span>
              本轮已作答{" "}
              <strong>
                {checked.length} / {list.length}
              </strong>
            </span>
            <span>
              最近答错 <strong>{wrong.length}</strong>
            </span>
          </div>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => onPractice(topic.id)}
          >
            {checked.length ? "继续检验或重做" : "开始本轮理解检验"}
          </button>
          <p className="muted">
            只计算本次回忆之后提交的答案，旧答题记录不会自动算作本轮完成。
          </p>
          <h3>把知识放回结构</h3>
          <p>{topic.gist}</p>
          <p className="muted">
            {wrong.length
              ? "有错题时建议先对照解析和专题要点，下一轮优先复习。"
              : "完成全部检验题后，将根据自评与答题表现安排下一次回忆。"}
          </p>
          <button
            disabled={busy || checked.length < list.length}
            onClick={async () => {
              try {
                await onSave(completeLesson(topic.id, record, state.records));
                window.scrollTo(0, 0);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            完成这一轮并安排复习
          </button>
        </section>
      )}
      {phase === 5 && (
        <section className="card lesson-panel lesson-done">
          <span className="eyebrow">一轮结束，下次再唤回</span>
          <h2>把这一步放进长期积累。</h2>
          <p>
            本专题已完成 {record.reviews}{" "}
            轮引导学习。这表示完成了回忆与检验，不是对知识掌握的认证。
          </p>
          <p>
            下次建议回忆：
            <strong>
              {new Intl.DateTimeFormat("zh-CN", {
                timeZone: "Asia/Shanghai",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(record.nextReviewAt!))}
            </strong>
          </p>
          <p className="muted">
            提醒只在打开应用时显示。间隔是启发式安排：未想起约 10
            分钟后，部分想起或检验有错次日；能解释且检验全对，随连续表现逐步延长到
            1、3、7、14、30 天，并非个人记忆模型。
          </p>
          {next ? (
            <button
              className="primary wide"
              disabled={busy}
              onClick={() => onNext(next.id)}
            >
              下一专题 · {next.title} →
            </button>
          ) : (
            <button className="primary wide" onClick={onExit}>
              返回知识路径
            </button>
          )}
          <button className="text-button" onClick={onExit}>
            今天先到这里，回到学习入口
          </button>
        </section>
      )}
      {phase > 0 && phase < 3 && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void step(phase - 1)}
        >
          ← 上一步
        </button>
      )}
      <p className="footnote">
        固定结构：场景 → 概念 → 示范 → 主动回忆 → 检验与间隔复习
      </p>
    </>
  );
}
