import assert from "node:assert/strict";
import test from "node:test";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const SESSION = "card-demo-e2e";
const SHOT_DIR = process.env.SHOT_DIR || ".tmp-agent-browser/e2e";
const APP_URL = process.env.APP_URL || "http://127.0.0.1:5173";

function run(cmd: string): string {
  try {
    return execSync(`agent-browser --session ${SESSION} ${cmd}`, {
      encoding: "utf-8",
      timeout: 30000,
    }).trim();
  } catch {
    return "";
  }
}

function screenshot(label: string) {
  run(`screenshot ${SHOT_DIR}/game-loop-${label}.png`);
}

function openBrowser() {
  run("close --all");
  run(
    `open ${APP_URL} --args "--no-sandbox,--disable-gpu-sandbox,--use-gl=swiftshader,--ignore-gpu-blocklist,--enable-unsafe-swiftshader"`,
  );
  run("set viewport 1280 720");
  run("wait --load networkidle");
  run("console --clear");
  run("errors --clear");
}

function joinGame(name: string) {
  run(`fill 'input[placeholder="Enter your name"]' ${name}`);
  run("click .primary-btn");
  run('wait --fn "document.querySelector(\\".game-shell\\") !== null"');
  run("wait 1000");
}

function playOneTurn(): "played" | "drawn" | "waiting" | "wild-picked" | "game-over" {
  const hasWinner = run(
    'wait --fn "document.querySelector(\\".winner-podium-overlay\\") !== null" --timeout 2000',
  );
  if (hasWinner.includes("true")) return "game-over";

  const hasPlayable = run(
    'wait --fn "document.querySelector(\\".hand-card-wrapper.playable\\") !== null || document.querySelector(\\".draw-pile.guidance-pulse\\") !== null" --timeout 10000',
  );
  if (!hasPlayable.includes("true")) return "waiting";

  const played = run(
    `wait --fn "(function() {
      const wildCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$=\\"Wild\\"]');
      if (wildCard) { wildCard.click(); return 'wild'; }
      const wildDraw4 = document.querySelector('.hand-card-wrapper.playable button[aria-label$=\\"Wild +4\\"]');
      if (wildDraw4) { wildDraw4.click(); return 'wild'; }
      const reverseCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$=\\"Reverse\\"]');
      if (reverseCard) { reverseCard.click(); return 'reverse'; }
      const skipCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$=\\"Skip\\"]');
      if (skipCard) { skipCard.click(); return 'skip'; }
      const playableCard = document.querySelector('.hand-card-wrapper.playable button');
      if (playableCard) { playableCard.click(); return 'played'; }
      const drawDeck = document.querySelector('.draw-pile.guidance-pulse');
      if (drawDeck) { drawDeck.click(); return 'drawn'; }
      return false;
    })()"`,
  );

  if (played.includes("'wild'")) {
    run("wait 800");
    run(
      `wait --fn "(function() {
        const modal = document.querySelector('.color-modal');
        if (!modal) return true;
        const red = document.querySelector('[data-testid=\\"wild-color-red\\"]');
        if (red) red.click();
        return true;
      })()"`,
    );
    return "wild-picked";
  }

  if (played.includes("'drawn'")) return "drawn";
  return "played";
}

function getWinnerName(): string | null {
  const result = run(
    'wait --fn "(function() { const h1 = document.querySelector(\\".winner-podium-box h1\\"); return h1 ? h1.textContent : null; })()" --timeout 5000',
  );
  const match = result.match(/(\w[\w\s]*?)\s*Wins!/);
  return match ? match[1].trim() : null;
}

test("full game loop - lobby to winner", () => {
  mkdirSync(SHOT_DIR, { recursive: true });

  openBrowser();
  screenshot("00-lobby");
  joinGame("E2EPlayer");

  run('wait --fn "document.querySelector(\\".table-board .card-sprite\\") !== null" --timeout 30000');
  screenshot("01-game-started");

  let turns = 0;
  const MAX_TURNS = 200;

  while (turns < MAX_TURNS) {
    const result = playOneTurn();

    if (result === "game-over") {
      screenshot(`02-game-over-turn-${turns}`);
      const winner = getWinnerName();
      assert.ok(winner, "Winner should be displayed");
      assert.ok(winner.length > 0, "Winner name should not be empty");
      console.log(`Game completed in ${turns} turns. Winner: ${winner}`);
      run("close --all");
      return;
    }

    if (result === "waiting") {
      execSync("sleep 1");
      continue;
    }

    turns++;
    execSync("sleep 0.5");
  }

  run("close --all");
  assert.fail(`Game did not finish within ${MAX_TURNS} turns`);
});

test("multiple games complete successfully", () => {
  mkdirSync(SHOT_DIR, { recursive: true });
  const gamesToPlay = 2;
  const results: string[] = [];

  for (let g = 0; g < gamesToPlay; g++) {
    openBrowser();
    screenshot(`game-${g}-00-lobby`);
    joinGame(`E2E-G${g}`);

    run('wait --fn "document.querySelector(\\".table-board .card-sprite\\") !== null" --timeout 30000');

    let turns = 0;
    let winnerFound = false;

    while (turns < 200 && !winnerFound) {
      const result = playOneTurn();
      if (result === "game-over") {
        winnerFound = true;
        const winner = getWinnerName();
        results.push(winner || "unknown");
        screenshot(`game-${g}-01-winner`);
      } else if (result === "waiting") {
        execSync("sleep 1");
      } else {
        turns++;
        execSync("sleep 0.3");
      }
    }

    assert.ok(winnerFound, `Game ${g} should have a winner`);
    run("close --all");
    execSync("sleep 1");
  }

  console.log(`All ${gamesToPlay} games completed. Winners: ${results.join(", ")}`);
  assert.equal(results.length, gamesToPlay, "All games should have completed");
});
