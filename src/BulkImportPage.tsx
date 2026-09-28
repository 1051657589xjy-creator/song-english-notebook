import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { parseStudyNotes, type ImportedCard } from "./bulkImport";
import type { Card, Song, UsageLabel } from "./types";

interface Draft extends ImportedCard {
  draftId: string;
}

interface Props {
  song?: Song;
  existingCards: Card[];
  onCancel: () => void;
  onSave: (
    song: Pick<Song, "title" | "artist" | "url" | "lyrics" | "studyNotes">,
    cards: ImportedCard[],
  ) => void;
}

const keyFor = (expression: string, meaning: string) =>
  `${expression.trim().toLocaleLowerCase()}\u0000${meaning.trim().toLocaleLowerCase()}`;

const emptyDraft = (): Draft => ({
  draftId: crypto.randomUUID(),
  expression: "",
  meaning: "",
  context: "",
  scenario: "",
  label: "待确认",
  example: "",
  notes: "",
});

export default function BulkImportPage({
  song,
  existingCards,
  onCancel,
  onSave,
}: Props) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "Taylor Swift");
  const [url, setUrl] = useState(song?.url ?? "");
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");
  const [notesText, setNotesText] = useState(song?.studyNotes ?? "");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const existingKeys = new Set(
    existingCards.map((card) => keyFor(card.expression, card.meaning)),
  );
  const duplicateCount = drafts.filter((draft) =>
    existingKeys.has(keyFor(draft.expression, draft.meaning)),
  ).length;

  function inspect(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !artist.trim() || !lyrics.trim()) {
      setError("请先填写歌名、歌手和歌词。");
      return;
    }
    if (url.trim()) {
      try {
        if (!["http:", "https:"].includes(new URL(url.trim()).protocol))
          throw new Error();
      } catch {
        setError("音乐平台链接需要以 http:// 或 https:// 开头。");
        return;
      }
    }
    const result = parseStudyNotes(notesText);
    setDrafts(
      result.cards.map((card) => ({ ...card, draftId: crypto.randomUUID() })),
    );
    setUnrecognized(result.unrecognized);
    setError("");
    setPreview(true);
  }

  function update(draftId: string, field: keyof ImportedCard, value: string) {
    setDrafts((old) =>
      old.map((draft) =>
        draft.draftId === draftId ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function save() {
    if (drafts.some((draft) => !draft.expression.trim() || !draft.meaning.trim())) {
      setError("每张卡片都需要英文表达和中文意思；请补全或删除空卡片。");
      return;
    }
    setError("");
    onSave(
      {
        title: title.trim(),
        artist: artist.trim(),
        url: url.trim(),
        lyrics,
        studyNotes: notesText,
      },
      drafts.map(({ draftId: _draftId, ...card }) => card),
    );
  }

  return (
    <div className="content-page bulk-import-page">
      <div className="page-intro">
        <span className="eyebrow">PASTE & PREVIEW</span>
        <h1>{song ? "批量加入学习笔记" : "批量粘贴歌词和笔记"}</h1>
        <p>
          一次粘贴完整歌词和已有生词笔记。网站会从笔记里识别表达卡，
          保存前由你核对；仅粘贴歌词不会自动生成词义。
        </p>
      </div>

      {!preview ? (
        <form className="panel bulk-panel" onSubmit={inspect}>
          <div className="field-grid">
            <label className="field">
              <span>歌名 *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>歌手 *</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>音乐平台链接（可选）</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>完整歌词 *</span>
            <textarea
              className="lyrics-input"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="在这里粘贴歌词，原有换行会保留"
            />
          </label>
          <label className="field">
            <span>生词与表达学习笔记（可选）</span>
            <textarea
              className="bulk-notes-input"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder={
                "表达 | 中文意思 | 使用场景 | 我的例句\n" +
                "take a breath | 缓一口气 | 紧张时 | I need to take a breath.\n\n" +
                "或写成：\n表达：take a breath\n意思：缓一口气\n例句：I need to take a breath."
              }
            />
          </label>
          <p className="helper">
            支持「表达 | 意思 | 场景 | 例句」、每行「表达：意思」，以及「表达：… / 意思：… / 例句：…」分段写法。
            原样粘贴即可，下一步可以修改识别结果。
          </p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="button primary" type="submit">识别并预览</button>
            <button className="button subtle" type="button" onClick={onCancel}>取消</button>
          </div>
        </form>
      ) : (
        <div className="bulk-preview">
          <div className="panel bulk-summary">
            <div>
              <span className="eyebrow">CHECK BEFORE SAVING</span>
              <h2>检查识别结果</h2>
              <p>
                《{title}》的歌词已准备好；识别出 {drafts.length} 张表达卡。
                {duplicateCount > 0 && ` 与已有卡片重复的 ${duplicateCount} 张会跳过。`}
              </p>
            </div>
            <button className="button subtle small" onClick={() => { setPreview(false); setError(""); }}>
              <ArrowLeft size={16} /> 修改粘贴内容
            </button>
          </div>

          {unrecognized.length > 0 && (
            <details className="panel bulk-unrecognized">
              <summary>有 {unrecognized.length} 行未识别为卡片，点此检查</summary>
              <p>这些文字不会变成卡片，但原始笔记仍会随歌曲保存。你也可以返回修改格式，或在下方手动补卡。</p>
              <pre>{unrecognized.join("\n")}</pre>
            </details>
          )}

          <div className="bulk-card-heading">
            <h2>待保存的表达卡</h2>
            <button className="button subtle small" onClick={() => setDrafts((old) => [...old, emptyDraft()])}>
              <Plus size={16} /> 手动补一张
            </button>
          </div>
          {drafts.length === 0 && (
            <div className="panel bulk-empty">
              没有识别出表达卡。你仍可以先保存歌词，之后再制作卡片。
            </div>
          )}
          {drafts.map((draft, index) => (
            <section className="panel bulk-card" key={draft.draftId}>
              <div className="bulk-card-top">
                <strong>表达 {index + 1}</strong>
                <button
                  className="button text danger small"
                  onClick={() => setDrafts((old) => old.filter((item) => item.draftId !== draft.draftId))}
                >
                  <Trash2 size={15} /> 删除
                </button>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>英文表达 *</span>
                  <input value={draft.expression} onChange={(e) => update(draft.draftId, "expression", e.target.value)} />
                </label>
                <label className="field">
                  <span>中文意思 *</span>
                  <input value={draft.meaning} onChange={(e) => update(draft.draftId, "meaning", e.target.value)} />
                </label>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>使用场景</span>
                  <input value={draft.scenario} onChange={(e) => update(draft.draftId, "scenario", e.target.value)} />
                </label>
                <label className="field">
                  <span>使用标签</span>
                  <select value={draft.label} onChange={(e) => update(draft.draftId, "label", e.target.value as UsageLabel)}>
                    <option>日常可用</option>
                    <option>偏文学化</option>
                    <option>待确认</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>歌词语境或所在行</span>
                <input value={draft.context} onChange={(e) => update(draft.draftId, "context", e.target.value)} />
              </label>
              <label className="field">
                <span>我的英文例句</span>
                <input value={draft.example} onChange={(e) => update(draft.draftId, "example", e.target.value)} />
              </label>
              <label className="field">
                <span>备注</span>
                <textarea className="short-textarea" value={draft.notes} onChange={(e) => update(draft.draftId, "notes", e.target.value)} />
              </label>
            </section>
          ))}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="bulk-save-bar panel">
            <p>确认后保存歌词和卡片；你的原有学习记录会保留。</p>
            <button className="button primary" onClick={save}>
              <Check size={17} /> 保存歌词和表达卡
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
