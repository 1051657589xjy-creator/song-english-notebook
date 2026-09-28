import { parseStudyNotes, type ImportedCard, type ParseResult } from "./bulkImport";

type Section = "other" | "lyrics" | "daily" | "literary" | "vocabulary";

export interface DocumentImportResult extends ParseResult {
  lyricRowsSkipped: number;
  annotatedRows: number;
}

function plain(text: string) {
  return text
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*|(?<!\*)\*(?!\*)|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tableCells(line: string) {
  if (!line.trim().startsWith("|")) return [];
  return line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|").map((cell) => cell.trim());
}

function isSeparator(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function sectionForHeading(line: string): Section | undefined {
  const heading = line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim();
  if (!heading) return undefined;
  if (/逐行中英对照|完整歌词|歌词对照/.test(heading)) return "lyrics";
  if (/日常表达|常用表达/.test(heading)) return "daily";
  if (/偏文学|文学表达|修辞/.test(heading)) return "literary";
  if (/生词|词汇/.test(heading)) return "vocabulary";
  return undefined;
}

function firstSentence(text: string) {
  return text.split(/(?<=。)\s*/)[0]?.replace(/。$/, "").trim() || text;
}

function parseAnnotatedRow(cells: string[], section: Section): ImportedCard[] {
  if (cells.length < 3 || !/^(?:日|文|词)\d+$/.test(cells[0])) return [];
  const bold = [...cells[1].matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1].trim());
  const expression = section === "vocabulary"
    ? bold.join(" / ") || plain(cells[1])
    : bold[0] || plain(cells[1].split("：")[0]);
  const colon = cells[1].indexOf("：");
  const explanation = section === "vocabulary"
    ? plain(cells[2])
    : plain(colon >= 0 ? cells[1].slice(colon + 1) : cells[1]);
  if (!expression || !explanation) return [];

  const exampleCell = section === "vocabulary" ? "" : cells[2];
  const example = exampleCell.match(/\*([^*]+)\*/)?.[1]?.trim() || "";
  const label = section === "daily" ? "日常可用"
    : section === "literary" ? "偏文学化" : "待确认";
  const category = section === "daily" ? "日常表达"
    : section === "literary" ? "文学表达" : "生词与语感";
  const card: ImportedCard = {
    expression: plain(expression),
    meaning: firstSentence(explanation),
    context: `上传文档 · ${category} · ${cells[0]}`,
    scenario: "",
    label,
    example,
    notes: explanation,
    sourceType: "song",
  };
  // Some everyday-use rows teach two independent expressions in one cell.
  if (section === "daily" && card.expression.includes(" / ")) {
    const expressions = card.expression.split(/\s+\/\s+/);
    if (expressions.length === 2) {
      const definitions = explanation.split("；");
      const examples = [...exampleCell.matchAll(/\*([^*]+)\*/g)].map((match) => match[1].trim());
      return expressions.map((item, index) => ({
        ...card,
        expression: item,
        meaning: firstSentence(plain((definitions[index] || explanation)
          .replace(/^前者是/, "")
          .replace(/^前者/, "")
          .replace(/^后者(?:在此)?表示/, "")
          .replace(/^后者/, ""))),
        context: `${card.context} · ${index + 1}`,
        example: examples[index] || examples[0] || "",
      }));
    }
  }
  return [card];
}

/** Extract only annotated study tables; lyric/translation tables are never cards. */
export function parseStudyDocument(text: string): DocumentImportResult {
  const cards: ImportedCard[] = [];
  const unrecognized: string[] = [];
  let section: Section = "other";
  let lyricRowsSkipped = 0;
  let annotatedRows = 0;
  let inLyricTable = false;

  for (const rawLine of text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").split("\n")) {
    const line = rawLine.trim();
    const headingSection = sectionForHeading(line);
    if (headingSection) {
      section = headingSection;
      inLyricTable = headingSection === "lyrics";
      continue;
    }
    const cells = tableCells(line);
    if (!cells.length) continue;
    if (isSeparator(cells)) continue;
    if (cells[0] === "英文歌词" && cells[1] === "中文翻译") {
      inLyricTable = true;
      continue;
    }
    if (cells[0] === "标记") {
      inLyricTable = false;
      continue;
    }
    if (section === "lyrics" || inLyricTable) {
      lyricRowsSkipped++;
      continue;
    }
    if (/^(?:日|文|词)\d+$/.test(cells[0])) {
      annotatedRows++;
      const card = parseAnnotatedRow(cells, section);
      if (card.length) cards.push(...card);
      else unrecognized.push(rawLine.trim());
    }
  }

  if (annotatedRows || lyricRowsSkipped) {
    return { cards, unrecognized, lyricRowsSkipped, annotatedRows };
  }
  const fallback = parseStudyNotes(text);
  return { ...fallback, lyricRowsSkipped: 0, annotatedRows: 0 };
}
