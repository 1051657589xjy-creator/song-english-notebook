import type { UsageLabel } from "./types";

export interface ImportedCard {
  expression: string;
  meaning: string;
  context: string;
  scenario: string;
  label: UsageLabel;
  example: string;
  notes: string;
  sourceType?: "title" | "song" | "extension";
}

export interface ParseResult {
  cards: ImportedCard[];
  unrecognized: string[];
}

const blankCard = (): ImportedCard => ({
  expression: "",
  meaning: "",
  context: "",
  scenario: "",
  label: "待确认",
  example: "",
  notes: "",
});

const cleanLine = (line: string) =>
  line
    .trim()
    .replace(/^(?:[-*•]\s+|\d+[.)、]\s*)/, "")
    .replace(/\*\*|`/g, "")
    .trim();

function fieldFor(label: string): keyof ImportedCard | undefined {
  const key = label.trim().toLowerCase().replace(/[\s_]/g, "");
  if (/^(?:英文表达|表达|短语|生词|词汇|单词|word|phrase|expression)$/.test(key))
    return "expression";
  if (/^(?:中文意思|中文释义|意思|释义|含义|翻译|meaning|definition)$/.test(key))
    return "meaning";
  if (/^(?:歌词语境|语境|原文|所在行|context)$/.test(key))
    return "context";
  if (/^(?:使用场景|场景|用法|scenario|usage)$/.test(key))
    return "scenario";
  if (/^(?:使用标签|标签|label)$/.test(key)) return "label";
  if (/^(?:来源类型|来源|sourcetype)$/.test(key)) return "sourceType";
  if (/^(?:英文例句|我的例句|例句|example|sentence)$/.test(key))
    return "example";
  if (/^(?:备注|笔记|notes?|note)$/.test(key)) return "notes";
  return undefined;
}

function parseLabel(text: string): UsageLabel {
  if (text.includes("日常")) return "日常可用";
  if (text.includes("文学") || text.includes("诗")) return "偏文学化";
  return "待确认";
}

function isHeader(parts: string[]) {
  return (
    fieldFor(parts[0]) === "expression" &&
    fieldFor(parts[1]) === "meaning"
  );
}

export function parseStudyNotes(text: string): ParseResult {
  const cards: ImportedCard[] = [];
  const unrecognized: string[] = [];
  let current: ImportedCard | undefined;

  function finish() {
    if (!current) return;
    if (current.expression && current.meaning) cards.push(current);
    else if (current.expression || current.meaning)
      unrecognized.push(
        [current.expression, current.meaning].filter(Boolean).join(" — "),
      );
    current = undefined;
  }

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = cleanLine(rawLine);
    if (!line) {
      finish();
      continue;
    }

    const tableParts = line.includes("|")
      ? line.split("|").map((part) => part.trim()).filter(Boolean)
      : line.includes("\t")
        ? line.split("\t").map((part) => part.trim())
        : [];
    if (tableParts.length >= 2) {
      finish();
      if (isHeader(tableParts) || /^[-: ]+$/.test(tableParts[0])) continue;
      const card = blankCard();
      [card.expression, card.meaning, card.scenario, card.example, card.notes] =
        tableParts.slice(0, 5).concat(Array(5).fill("")).slice(0, 5);
      if (card.expression && card.meaning) cards.push(card);
      else unrecognized.push(rawLine.trim());
      continue;
    }

    const labeled = line.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
    if (labeled) {
      const field = fieldFor(labeled[1]);
      if (field) {
        if (field === "expression") {
          finish();
          current = blankCard();
          current.expression = labeled[2].trim();
        } else {
          current ??= blankCard();
          if (field === "label") current.label = parseLabel(labeled[2]);
          else if (field === "sourceType") current.sourceType = labeled[2].includes("歌名")
            ? "title" : labeled[2].includes("歌曲") ? "song" : "extension";
          else current[field] = labeled[2].trim();
        }
        continue;
      }
    }

    const pair = line.match(/^(.{1,100}?)\s*(?:\s+[—–-]\s+|[:：]\s*)\s*(.{1,250})$/);
    if (pair) {
      finish();
      current = { ...blankCard(), expression: pair[1].trim(), meaning: pair[2].trim() };
      continue;
    }

    const parenthesized = line.match(/^([A-Za-z][A-Za-z\s'’.,-]{0,99})\s*[（(]([^()（）]{1,250})[）)]$/);
    if (parenthesized) {
      finish();
      current = {
        ...blankCard(),
        expression: parenthesized[1].trim(),
        meaning: parenthesized[2].trim(),
      };
      continue;
    }

    if (current?.expression && current.meaning) {
      current.notes = [current.notes, line].filter(Boolean).join("\n");
    } else {
      unrecognized.push(rawLine.trim());
    }
  }
  finish();
  return { cards, unrecognized };
}
