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
  await page.reload();
  await page.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  await expect(page.getByText("2 / 147", { exact: true })).toBeVisible();
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
  await page
    .locator("input[type=file]")
    .setInputFiles({
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
  await expect(offline.getByText("温故，也知新。")).toBeVisible();
  await offline.getByRole("button", { name: "知识手册", exact: true }).click();
  await expect(
    offline.getByRole("heading", {
      name: "ME 工商管理 · 知识点体系与学习心法（完整版）",
      exact: true,
    }),
  ).toBeVisible();
  await offline
    .getByRole("button", { name: "体系与学习心法", exact: true })
    .click();
  await expect(
    offline.getByRole("heading", {
      name: "ME工商管理·知识点体系与学习心法（skill-creator版）",
      exact: true,
    }),
  ).toBeVisible();
  await offline.getByRole("button", { name: "章节", exact: true }).click();
  await offline.getByRole("button", { name: /01 企业战略与经营决策/ }).click();
  await expect(offline.getByText("2 / 147", { exact: true })).toBeVisible();
  expect(
    await offline.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("案例表格、多选判分和安装清单", async ({ page }) => {
  await page.goto("/");
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
