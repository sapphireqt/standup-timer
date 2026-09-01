import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist/client/", import.meta.url);
const pagesBasePath = "/standup-timer";

function getArtifactUrl(pathname) {
  const relativePath = pathname.startsWith(`${pagesBasePath}/`)
    ? pathname.slice(pagesBasePath.length + 1)
    : pathname.replace(/^\//, "");

  return new URL(relativePath, outputRoot);
}

test("exports the standup and settings routes", async () => {
  const [homeHtml, settingsHtml] = await Promise.all([
    readFile(new URL("index.html", outputRoot), "utf8"),
    readFile(new URL("settings/index.html", outputRoot), "utf8"),
  ]);

  assert.match(homeHtml, /<title>Daily standup<\/title>/i);
  assert.match(homeHtml, /Daily standup/);
  assert.match(homeHtml, /Preparing the standup/);
  assert.match(homeHtml, new RegExp(`href="${pagesBasePath}/settings/"`));
  assert.doesNotMatch(
    homeHtml,
    /codex-preview|SkeletonPreview|react-loading-skeleton/i,
  );

  assert.match(settingsHtml, /<h1>Settings<\/h1>/);
  assert.match(settingsHtml, /<textarea[^>]+id="users"/);
  assert.match(settingsHtml, /id="timer-duration"/);
  assert.match(settingsHtml, /Save settings/);
});

test("exports GitHub Pages assets", async () => {
  const homeHtml = await readFile(new URL("index.html", outputRoot), "utf8");
  const cssHref = homeHtml.match(/href="([^"]+\.css)"/)?.[1];
  const jsSrc = homeHtml.match(/src="([^"]+\.js)"/)?.[1];

  assert.ok(cssHref, "The exported page must link to a stylesheet");
  assert.ok(jsSrc, "The exported page must link to a script");

  await Promise.all([
    access(new URL(".nojekyll", outputRoot)),
    access(new URL("favicon.svg", outputRoot)),
    access(new URL("og.png", outputRoot)),
    access(getArtifactUrl(cssHref)),
    access(getArtifactUrl(jsSrc)),
  ]);
});

test("keeps settings local and includes tournament behavior", async () => {
  const [settingsSource, standupSource, packageJson] = await Promise.all([
    readFile(new URL("../lib/standup-settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/standup-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(settingsSource, /window\.localStorage/);
  assert.match(settingsSource, /URLSearchParams/);
  assert.match(settingsSource, /version:\s*1/);
  assert.match(standupSource, /hasStarted/);
  assert.match(standupSource, /Speed ranking/);
  assert.match(standupSource, /Confetti/);
  assert.match(standupSource, /timer-digits/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
