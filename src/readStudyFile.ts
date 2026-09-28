import { parseStudyDocument, type DocumentImportResult } from "./studyDocument";

const maxBytes = 10 * 1024 * 1024;

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as Element;
  if (element.tagName === "BR") return "<br>";
  const content = Array.from(element.childNodes).map(inlineText).join("");
  if (["STRONG", "B"].includes(element.tagName)) return `**${content}**`;
  if (["EM", "I"].includes(element.tagName)) return `*${content}*`;
  return content;
}

function wordHtmlToStudyText(html: string) {
  // Never insert converted HTML into the page: Word files are untrusted input.
  const document = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  function visit(element: Element) {
    const tag = element.tagName;
    if (/^H[1-6]$/.test(tag)) {
      lines.push(`## ${element.textContent?.trim() || ""}`);
    } else if (tag === "TABLE") {
      for (const row of Array.from(element.querySelectorAll("tr"))) {
        const cells = Array.from(row.children)
          .filter((cell) => cell.tagName === "TH" || cell.tagName === "TD")
          .map((cell) => inlineText(cell).replace(/\s+/g, " ").trim());
        if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
      }
    } else if (tag === "P" || tag === "LI") {
      const text = inlineText(element).trim();
      if (text) {
        lines.push(/^(?:逐行中英对照|日常表达|常用表达|偏文学|文学表达|生词与语感|词汇)/.test(text)
          ? `## ${text}` : text);
      }
    } else {
      for (const child of Array.from(element.children)) visit(child);
    }
  }
  for (const child of Array.from(document.body.children)) visit(child);
  return lines.join("\n");
}

export async function readStudyFile(file: File): Promise<DocumentImportResult> {
  if (file.size > maxBytes) throw new Error("文档超过 10 MB，请先删除图片或拆分文档。");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text: string;
  if (extension === "txt" || extension === "md") {
    text = await file.text();
  } else if (extension === "docx") {
    const mammoth = (await import("mammoth/mammoth.browser")).default;
    const converted = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    text = wordHtmlToStudyText(converted.value);
  } else {
    throw new Error("目前支持 .txt、.md 和 .docx 文档；Word 的 .doc 请先另存为 .docx。");
  }
  return parseStudyDocument(text);
}
