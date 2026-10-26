import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Question } from "../../src/data";
const questions: Question[] = JSON.parse(
  readFileSync(
    new URL("../../questions_import_ready.json", import.meta.url),
    "utf8",
  ),
);
test("安卓练习、错题、持久化、备份恢复与离线冷启动", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  const q = questions[0],
    bad = Object.keys(q.options).find((k) => !q.answer.includes(k))!;
  await page.getByRole("button", { name: new RegExp(`^${bad} `) }).click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByText("这道题再记一遍")).toBeVisible();
  await expect(page.getByText("原资料答案：")).toContainText(
    q.answer.join("、"),
  );
  await page.getByText("原题来源与纠错备注").click();
  await expect(
    page.getByText(`${q.sourceFile} · 第 ${q.sourceLine} 行`, { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("记录疑问（仅保存在本机，不修改答案）")
    .fill("需要核对原文");
  await page.getByRole("button", { name: "保存备注" }).click();
  await page.getByRole("button", { name: "下一题 →" }).click();
  await expect(page.locator(".practice-top")).toContainText(
    `2 / ${questions.filter((q) => q.originalChapter === 1 && q.sourceType === "chapter").length}`,
  );
  await page.reload();
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  await expect(
    page.getByText(
      `2 / ${questions.filter((q) => q.originalChapter === 1 && q.sourceType === "chapter").length}`,
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "错题本", exact: true }).click();
  await page.getByRole("button", { name: "开始复习 · 1 题" }).click();
  for (const key of q.answer)
    await page.getByRole("button", { name: new RegExp(`^${key} `) }).click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByText("✓ 本次答对了")).toBeVisible();
  await page.getByRole("button", { name: "完成本轮" }).click();
  await expect(page.getByText("这里还没有错题")).toBeVisible();
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByText("✓ 离线资源已就绪")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const file = await (await downloadPromise).path();
  expect(file).toBeTruthy();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("status")).toContainText("文件不是有效 JSON");
  await page.locator("input[type=file]").setInputFiles(file!);
  await expect(page.getByText("确认恢复备份？")).toBeVisible();
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.getByRole("status")).toContainText("恢复完成");
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.close();
  const offline = await context.newPage();
  await offline.goto("/");
  await offline.getByRole("button", { name: "题库", exact: true }).click();
  await expect(offline.getByText("温故，也知新。")).toBeVisible();
  await offline.getByRole("button", { name: "知识手册", exact: true }).click();
  await expect(
    offline.getByRole("heading", { name: "知识成体系，练习有方向。" }),
  ).toBeVisible();
  await offline
    .getByText("查阅原始资料（保留用于追溯）", { exact: true })
    .click();
  await expect(
    offline.getByRole("heading", {
      name: "ME 工商管理 · 知识点体系与学习心法（完整版）",
      exact: true,
    }),
  ).toBeVisible();
  await offline
    .getByRole("button", { name: "体系与学习心法原文", exact: true })
    .click();
  await expect(
    offline.getByRole("heading", {
      name: "ME工商管理·知识点体系与学习心法（skill-creator版）",
      exact: true,
    }),
  ).toBeVisible();
  await offline.getByRole("button", { name: "题库", exact: true }).click();
  await offline.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  await expect(
    offline.getByText(
      `2 / ${questions.filter((q) => q.originalChapter === 1 && q.sourceType === "chapter").length}`,
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await offline.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("案例表格、多选判分和安装清单", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await expect(page.getByText("温故，也知新。")).toBeVisible();
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe("standalone");
  async function jump(id: string, ch: number) {
    await page.evaluate(
      async ({ id, ch }) => {
        const r = indexedDB.open("shizhi-study", 1);
        await new Promise<void>((resolve) => {
          r.onsuccess = () => resolve();
        });
        const d = r.result;
        const t = d.transaction("study", "readwrite");
        t.objectStore("study").put(
          { records: {}, cursors: { [`chapter:${ch}`]: id }, notes: {} },
          "state",
        );
        await new Promise<void>((resolve) => {
          t.oncomplete = () => resolve();
        });
        d.close();
      },
      { id, ch },
    );
    await page.reload();
    await page.getByRole("button", { name: "题库", exact: true }).click();
    await page.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  }
  const cq = questions.find((q) => q.type === "case")!;
  await jump(cq.id, cq.originalChapter);
  await expect(page.getByText("案例背景材料", { exact: true })).toBeVisible();
  await expect(page.locator(".case table")).toBeVisible();
  const multi = questions.find(
    (q) => q.type === "multiple" && q.answer.length > 1,
  )!;
  await jump(multi.id, multi.originalChapter);
  await page
    .getByRole("button", { name: new RegExp(`^${multi.answer[0]} `) })
    .click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByText("这道题再记一遍")).toBeVisible();
  await page.getByRole("button", { name: "重新作答" }).click();
  for (const k of [...multi.answer].reverse())
    await page.getByRole("button", { name: new RegExp(`^${k} `) }).click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await expect(page.getByText("✓ 本次答对了")).toBeVisible();
});

test("历年题按年份场次与题型练习，返回保持筛选，刷新可续练", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page
    .getByRole("button", { name: "历年真题 · 564", exact: true })
    .click();
  await expect(page.getByText("原资料条目 14 道 · 非完整原卷")).toBeVisible();
  await page.getByLabel("年份", { exact: true }).selectOption("2025");
  await page.getByLabel("题型", { exact: true }).selectOption("case");
  const list = questions.filter(
    (q) =>
      q.sourceType === "past" &&
      q.year === 2025 &&
      q.session === "下午" &&
      q.type === "case",
  );
  await page
    .getByRole("button", { name: "开始练习 · 2025 下午", exact: true })
    .click();
  await expect(page.locator(".question-origin")).toContainText(
    "2025 年 · 下午 · 资料标注历年题",
  );
  await expect(page.locator(".practice-top")).toContainText(
    `1 / ${list.length}`,
  );
  await expect(
    page.getByRole("heading", { name: list[0].stem, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一题 →" }).click();
  await page.getByRole("button", { name: "← 返回题库", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "历年真题 · 564", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("题型", { exact: true })).toHaveValue("case");
  await page.reload();
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page
    .getByRole("button", { name: "历年真题 · 564", exact: true })
    .click();
  await page.getByLabel("题型", { exact: true }).selectOption("case");
  await page
    .getByRole("button", { name: "继续练习 · 2025 下午", exact: true })
    .click();
  await expect(page.locator(".practice-top")).toContainText(
    `2 / ${list.length}`,
  );
});

test("知识点—题目—错题双向联动，原题考点可细分，阅读后保留作答状态", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByRole("button", { name: "知识手册", exact: true }).click();
  await page
    .getByRole("button", { name: "学习专题：战略目标与层次", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "抓住这几件事" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "易混辨析与边界" }),
  ).toBeVisible();
  await page.getByText("展开自测参考", { exact: true }).click();
  await expect(
    page.getByText("前者是总体战略，后者是业务战略。", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("题目来源", { exact: true }).selectOption("chapter");
  await page
    .getByLabel("细分到原题考点", { exact: true })
    .selectOption("企业战略的特征");
  await page.getByRole("button", { name: /^开始关联练习/ }).click();
  const q = questions[0],
    bad = Object.keys(q.options).find((k) => !q.answer.includes(k))!;
  await expect(
    page.getByRole("heading", { name: q.stem, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${bad} `) }).click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await page
    .getByRole("button", { name: "学习专题 · 战略目标与层次 →", exact: true })
    .click();
  await expect(
    page.locator(".topic-detail .page-heading .topic-stats"),
  ).toContainText("待复习 1");
  await page.getByRole("button", { name: /返回.*上一页/ }).click();
  await expect(page.getByText("这道题再记一遍")).toBeVisible();
  await page.getByRole("button", { name: "错题本", exact: true }).click();
  await page
    .getByRole("button", { name: "战略目标与层次 · 1 道错题 →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "复习本专题错题 · 1 题", exact: true })
    .click();
  for (const k of q.answer)
    await page.getByRole("button", { name: new RegExp(`^${k} `) }).click();
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  await page.getByRole("button", { name: "完成本轮", exact: true }).click();
  await expect(
    page.locator(".topic-detail .page-heading .topic-stats"),
  ).toContainText("待复习 0");
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await expect(page.getByText("✓ 离线资源已就绪")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "知识手册", exact: true }).click();
  await page
    .getByRole("button", { name: "学习专题：战略目标与层次", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "抓住这几件事" }),
  ).toBeVisible();
  await expect(
    page.locator(".topic-detail .page-heading .topic-stats"),
  ).toContainText("最近答对 1");
});

test("按章拆到专题，专题页按来源筛选历年案例题，窄屏无溢出", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByLabel("旧版章节", { exact: true }).selectOption("1");
  await expect(
    page.getByRole("heading", { name: "从知识专题进入 · 第 1 章" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "学习要点 · 环境分析与核心竞争力",
      exact: true,
    })
    .click();
  await page.getByLabel("题目来源", { exact: true }).selectOption("past");
  await page.getByLabel("题型", { exact: true }).selectOption("case");
  await page.getByRole("button", { name: /^开始关联练习/ }).click();
  await expect(page.locator(".question-origin")).toContainText(
    "资料标注历年题",
  );
  await expect(page.getByText("案例背景材料", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("从零学习五步流程：示范、闭卷回忆、续学、当轮检验、复习安排与备份", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "先看懂一家企业。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始引导学习", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "市场细分、目标选择与定位",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "把自己放进这个场景" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "带着这个问题，认识概念 →", exact: true })
    .click();
  await expect(
    page.getByText("没有基础？先看这几个词", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".term-box")).toContainText("需求");
  await page
    .getByRole("button", { name: "看它在例子里如何运用 →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "不只看结论，看每一步为什么" }),
  ).toBeVisible();
  await expect(page.locator(".worked-steps li")).toHaveCount(2);
  await page
    .getByRole("button", { name: "暂时收起讲解，自己说一遍 →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "自测参考", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "保存回忆并对照参考", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("先用自己的话");
  await page
    .getByLabel("用自己的话解释判断依据", { exact: true })
    .fill("一种产品面对多个顾客群是产品专业化。");
  await page
    .getByRole("button", { name: "保存回忆并对照参考", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "自测参考", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "继续引导学习", exact: true }).click();
  await expect(page.getByLabel("用自己的话解释判断依据")).toHaveValue(
    "一种产品面对多个顾客群是产品专业化。",
  );
  await expect(
    page.getByRole("heading", { name: "自测参考", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "保存回忆并对照参考", exact: true })
    .click();
  await page.getByRole("button", { name: "想起一部分", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "完成这一轮并安排复习", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "开始本轮理解检验", exact: true })
    .click();
  let count = 0;
  while (true) {
    const id = await page.locator(".question").getAttribute("data-question-id");
    const q = questions.find((q) => q.id === id)!;
    expect(q).toBeTruthy();
    for (const key of q.answer)
      await page.getByRole("button", { name: new RegExp(`^${key} `) }).click();
    await page.getByRole("button", { name: "提交答案", exact: true }).click();
    await expect(page.getByText("✓ 本次答对了")).toBeVisible();
    count++;
    if (
      await page.getByRole("button", { name: "完成本轮", exact: true }).count()
    ) {
      await page.getByRole("button", { name: "完成本轮", exact: true }).click();
      break;
    }
    await page.getByRole("button", { name: "下一题 →", exact: true }).click();
    await expect(page.locator(".question")).not.toHaveAttribute(
      "data-question-id",
      id!,
    );
  }
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
  await expect(page.locator(".lesson-checks")).toContainText(
    `${count} / ${count}`,
  );
  await page
    .getByRole("button", { name: "完成这一轮并安排复习", exact: true })
    .click();
  await expect(page.getByText("下次建议回忆：")).toBeVisible();
  await page.getByRole("button", { name: "我的", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出 JSON 备份", exact: true })
    .click();
  const file = await (await downloadPromise).path();
  const saved = JSON.parse(readFileSync(file!, "utf8"));
  expect(saved.state.lessons["3-2"]).toMatchObject({
    phase: 5,
    reviews: 1,
    rating: "hard",
  });
  expect(saved.state.lessons["3-2"].nextReviewAt).toBeTruthy();
  await page.reload();
  await expect(page.locator(".learn-hero")).toContainText("已完成首轮 1 / 48");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "先看懂一家企业。" }),
  ).toBeVisible();
  await expect(page.locator(".learn-hero")).toContainText("已完成首轮 1 / 48");
  // Reopening a due lesson starts with retrieval, not with the explanatory pages.
  await page.evaluate(async () => {
    const request = indexedDB.open("shizhi-study", 1);
    await new Promise<void>((resolve) => {
      request.onsuccess = () => resolve();
    });
    const db = request.result;
    const tx = db.transaction("study", "readwrite");
    const store = tx.objectStore("study");
    const get = store.get("state");
    get.onsuccess = () => {
      const state = get.result;
      state.lessons["3-2"].nextReviewAt = new Date(
        Date.now() - 60000,
      ).toISOString();
      store.put(state, "state");
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "到了再回忆的时候", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始到期回忆", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "合上讲解，你会怎样回答？",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".worked-steps")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
