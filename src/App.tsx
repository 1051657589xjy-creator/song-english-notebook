import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Edit3,
  ExternalLink,
  Headphones,
  ImagePlus,
  Library,
  Menu,
  Music2,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createBackup,
  getImage,
  parseBackup,
  readData,
  removeImage,
  restoreBackup,
  saveImage,
  writeData,
  type Backup,
} from "./storage";
import {
  emptyData,
  gradeCard,
  localDay,
  type AppData,
  type Card,
  type Grade,
  type Practice,
  type Song,
  type UsageLabel,
} from "./types";
import BulkImportPage from "./BulkImportPage";
import { withCatalog } from "./catalog";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const routeNow = () => decodeURI(location.hash.slice(1) || "/");
const go = (route: string) => {
  location.hash = route;
  window.scrollTo({ top: 0, behavior: "smooth" });
};
const dateText = (value: string) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "今天";
const isWebUrl = (url: string) => {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

function useImageUrl(imageId?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(undefined);
    getImage(imageId)
      .then((blob) => {
        if (active && blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);
  return url;
}

function ImageArea({
  imageId,
  className = "",
  children,
}: {
  imageId?: string;
  className?: string;
  children?: ReactNode;
}) {
  const url = useImageUrl(imageId);
  return (
    <div
      className={`image-area ${className}`}
      style={
        url
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(18,21,43,.14), rgba(18,21,43,.77)), url("${url}")`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function ImagePicker({
  label,
  imageId,
  onSet,
  onRemove,
}: {
  label: string;
  imageId?: string;
  onSet: (id: string) => void;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const url = useImageUrl(imageId);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const newId = await saveImage(file);
      onSet(newId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片保存失败");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="image-picker">
      <div
        className="image-picker-preview"
        style={url ? { backgroundImage: `url("${url}")` } : undefined}
      >
        {!url && <ImagePlus size={30} strokeWidth={1.5} />}
      </div>
      <div className="image-picker-actions">
        <strong>{label}</strong>
        <p>图片只保存在此浏览器，单张不超过 8 MB。</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          onChange={(e) => void choose(e.target.files?.[0])}
          hidden
        />
        <div className="inline-actions">
          <button
            className="button subtle small"
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "正在保存…" : imageId ? "更换图片" : "选择图片"}
          </button>
          {imageId && (
            <button
              className="button text danger small"
              type="button"
              onClick={onRemove}
            >
              删除
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function SongCover({
  song,
  className = "",
}: {
  song: Song;
  className?: string;
}) {
  const url = useImageUrl(song.coverImageId);
  return (
    <div
      className={`song-cover ${className}`}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
    >
      {!url && <Music2 size={28} strokeWidth={1.5} />}
    </div>
  );
}

function Home({ data }: { data: AppData }) {
  const due = data.cards.filter((card) => card.nextReview <= localDay());
  const latest = [...data.songs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  return (
    <div className="home-page">
      <ImageArea imageId={data.settings.homeImageId} className="hero public-hero">
        <div className="hero-inner">
          <div className="hero-kicker">
            <Headphones size={16} /> SONGS INTO ENGLISH
          </div>
          <h1>
            从喜欢的歌，
            <br />
            <em>学会自己的表达。</em>
          </h1>
          <p>从 Taylor Swift 的歌曲出发，听歌、学表达，再用自己的话说出来。</p>
          <div className="hero-actions">
            <button className="button gold" onClick={() => go("/songs")}>
              <BookOpen size={18} /> 开始学习
            </button>
            <button
              className="button ghost-light"
              onClick={() => go("/review")}
            >
              <RotateCcw size={17} /> 开始复习
            </button>
          </div>
        </div>
        <div className="hero-decoration" aria-hidden="true">
          ♪
        </div>
      </ImageArea>
      <div className="stat-grid">
        <button className="stat" onClick={() => go("/review")}>
          <span>今天可练习</span>
          <strong>
            {due.length}
            <small> 张</small>
          </strong>
          <span className="stat-bottom">
            {due.length ? "现在开始回忆" : "今天已经安排好了"}{" "}
            <ChevronRight size={16} />
          </span>
        </button>
        <button className="stat" onClick={() => go("/cards")}>
          <span>课程表达</span>
          <strong>
            {data.cards.length}
            <small> 张</small>
          </strong>
          <span className="stat-bottom">
            查看表达卡 <ChevronRight size={16} />
          </span>
        </button>
        <button className="stat" onClick={() => go("/songs")}>
          <span>歌曲课程</span>
          <strong>
            {data.songs.length}
            <small> 首</small>
          </strong>
          <span className="stat-bottom">
            打开歌单 <ChevronRight size={16} />
          </span>
        </button>
      </div>
      <div className="home-columns">
        <section className="panel paper-panel">
          <SectionHeading
            eyebrow="ON THE DESK"
            title="精选歌曲"
            action={
              <button className="link-button" onClick={() => go("/songs")}>
                全部歌曲 <ArrowRight size={16} />
              </button>
            }
          />
          {latest.length ? (
            <div className="song-list compact">
              {latest.map((song) => (
                <button
                  className="song-row"
                  key={song.id}
                  onClick={() => go(`/songs/${song.id}`)}
                >
                  <SongCover song={song} />
                  <span className="song-row-copy">
                    <strong>{song.title}</strong>
                    <small>{song.artist}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Music2 />}
              title="从第一首歌开始"
              text="添加歌名，粘贴你手边的歌词，就可以开始摘录表达。"
              action={
                <button
                  className="button primary small"
                  onClick={() => go("/songs/new")}
                >
                  添加歌曲
                </button>
              }
            />
          )}
        </section>
        <ImageArea
          imageId={data.settings.decorImageId}
          className="panel note-panel"
        >
          <span className="eyebrow">A SMALL ROUTINE</span>
          <h2>今天想记住哪一句？</h2>
          <p>先听歌，再学已经整理好的表达。最后写一句自己的英文。</p>
          <div className="note-lines">
            <span>01&nbsp; 听一首歌</span>
            <span>02&nbsp; 学几个表达</span>
            <span>03&nbsp; 写下自己的句子</span>
          </div>
          <button
            className="link-button"
            onClick={() => go(data.songs.length ? "/songs" : "/songs/new")}
          >
            去看课程 <ArrowRight size={16} />
          </button>
        </ImageArea>
      </div>
    </div>
  );
}

function SongForm({
  song,
  onSave,
  onCancel,
}: {
  song?: Song;
  onSave: (
    fields: Pick<Song, "title" | "artist" | "url" | "lyrics" | "coverImageId">,
  ) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "Taylor Swift");
  const [url, setUrl] = useState(song?.url ?? "");
  const [lyrics, setLyrics] = useState(song?.lyrics ?? "");
  const [coverImageId, setCoverImageId] = useState(song?.coverImageId);
  const [error, setError] = useState("");
  function changeCover(next?: string) {
    if (coverImageId && coverImageId !== song?.coverImageId)
      void removeImage(coverImageId);
    setCoverImageId(next);
  }
  function cancel() {
    if (coverImageId && coverImageId !== song?.coverImageId)
      void removeImage(coverImageId);
    onCancel();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !lyrics.trim()) {
      setError("请填写歌名、歌手和歌词");
      return;
    }
    if (url.trim() && !isWebUrl(url.trim())) {
      setError("音乐平台链接需要以 http:// 或 https:// 开头");
      return;
    }
    onSave({
      title: title.trim(),
      artist: artist.trim(),
      url: url.trim(),
      lyrics,
      coverImageId,
    });
    if (song?.coverImageId && song.coverImageId !== coverImageId)
      void removeImage(song.coverImageId);
  }
  return (
    <form className="editor-layout" onSubmit={submit}>
      <div className="panel form-panel">
        <div className="field-grid">
          <label className="field">
            <span>
              歌名 <b>*</b>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="写下歌名"
            />
          </label>
          <label className="field">
            <span>
              歌手 <b>*</b>
            </span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="歌手姓名"
            />
          </label>
        </div>
        <label className="field">
          <span>音乐平台链接</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          <small>点击链接会在新标签页打开你的音乐 App 或平台。</small>
        </label>
        <label className="field">
          <span>
            歌词 <b>*</b>
          </span>
          <textarea
            className="lyrics-input"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={"在这里粘贴歌词\n\n原有换行和段落会保留"}
          />
          <small>歌词仅保存在你的浏览器中。请粘贴你有权使用的内容。</small>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="button primary" type="submit">
            <Save size={17} /> 保存歌曲
          </button>
          <button className="button subtle" type="button" onClick={cancel}>
            取消
          </button>
        </div>
      </div>
      <aside className="panel side-panel">
        <span className="eyebrow">THE COVER</span>
        <h3>为这首歌配张图</h3>
        <ImagePicker
          label="歌曲封面"
          imageId={coverImageId}
          onSet={changeCover}
          onRemove={() => changeCover(undefined)}
        />
        <p className="side-hint">
          可以选择你设备上的照片或专辑封面，不会上传。
        </p>
      </aside>
    </form>
  );
}

function songContext(lyrics: string, expression: string) {
  const phrase = expression.trim().replace(/\s+/g, " ").toLowerCase();
  return (
    lyrics
      .split("\n")
      .find((line) => phrase && line.replace(/\s+/g, " ").toLowerCase().includes(phrase))
      ?.trim() ?? ""
  );
}

function HighlightedLyrics({
  lyrics,
  cards,
  onCard,
}: {
  lyrics: string;
  cards: Card[];
  onCard: (id: string) => void;
}) {
  const matches: { start: number; end: number; card: Card }[] = [];
  for (const card of cards) {
    const expression = card.expression.trim();
    if (!expression) continue;
    const pattern = expression
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    try {
      const regex = new RegExp(pattern, "gi");
      for (const match of lyrics.matchAll(regex))
        if (match.index !== undefined)
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            card,
          });
    } catch {
      /* A card remains visible in the card list if its text cannot be matched. */
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const parts: ReactNode[] = [];
  let position = 0;
  for (const match of matches) {
    if (match.start < position) continue;
    if (match.start > position) parts.push(lyrics.slice(position, match.start));
    parts.push(
      <mark
        key={`${match.card.id}-${match.start}`}
        role="button"
        tabIndex={0}
        title={`查看表达卡：${match.card.expression}`}
        onClick={() => onCard(match.card.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCard(match.card.id);
          }
        }}
      >
        {lyrics.slice(match.start, match.end)}
      </mark>,
    );
    position = match.end;
  }
  parts.push(lyrics.slice(position));
  return <div className="lyrics-text">{parts}</div>;
}

function SongDetail({
  song,
  cards,
  onDelete,
}: {
  song: Song;
  cards: Card[];
  onDelete: () => void;
}) {
  const [selection, setSelection] = useState("");
  const lyricsRef = useRef<HTMLDivElement>(null);
  function captureSelection() {
    setTimeout(() => {
      const selectionObject = window.getSelection();
      const anchor = selectionObject?.anchorNode;
      const focus = selectionObject?.focusNode;
      if (
        !anchor ||
        !focus ||
        !lyricsRef.current?.contains(anchor) ||
        !lyricsRef.current.contains(focus)
      )
        return;
      setSelection(
        selectionObject?.toString().replace(/\s+/g, " ").trim().slice(0, 180) ??
          "",
      );
    }, 0);
  }
  function makeCard() {
    sessionStorage.setItem(
      "card-draft",
      JSON.stringify({
        songId: song.id,
        expression: selection,
        context: songContext(song.lyrics, selection),
      }),
    );
    window.getSelection()?.removeAllRanges();
    go(`/songs/${song.id}/cards/new`);
  }
  return (
    <div className="detail-layout">
      <div className="detail-main">
        <ImageArea imageId={song.coverImageId} className="song-banner">
          <div className="song-banner-copy">
            <span className="eyebrow">MY SONGBOOK</span>
            <h1>{song.title}</h1>
            <p>{song.artist}</p>
          </div>
        </ImageArea>
        <div className="song-toolbar">
          <div className="inline-actions">
            {song.url && (
              <a
                className="button subtle small"
                href={song.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} /> 打开官方歌曲页面
              </a>
            )}
            {!song.curated && (
              <>
                <button
                  className="button subtle small"
                  onClick={() => go(`/songs/${song.id}/bulk`)}
                >
                  <Upload size={16} /> 批量加入笔记
                </button>
                <button
                  className="button subtle small"
                  onClick={() => go(`/songs/${song.id}/edit`)}
                >
                  <Edit3 size={16} /> 编辑
                </button>
              </>
            )}
          </div>
          {!song.curated && (
            <button className="button text danger small" onClick={onDelete}>
              <Trash2 size={16} /> 删除歌曲
            </button>
          )}
        </div>
        {song.curated && (
          <section className="panel lesson-panel">
            <SectionHeading eyebrow="LISTEN & LEARN" title="这节课怎么学" />
            <p>{song.lessonIntro}</p>
            <ol>
              <li>打开官方歌曲页面，先听一遍。</li>
              <li>回到这里，学习歌名表达和标明的主题延伸表达。</li>
              <li>用「造句练习」写下自己的句子，再定期复习。</li>
            </ol>
            <p className="helper">
              课程例句由本站原创编写；完整歌词请在歌曲官方页面查看。
            </p>
          </section>
        )}
        {song.lyrics && (
          <section className="panel lyrics-panel">
            <SectionHeading eyebrow="LYRICS / 歌词" title="边读边收藏" />
            {!song.curated && (
              <p className="helper">
                选中一小段英文后点「制作表达卡」，或用右侧的手动输入。彩色高亮可以打开已有卡片。
              </p>
            )}
            <div
              ref={lyricsRef}
              onMouseUp={song.curated ? undefined : captureSelection}
              onKeyUp={song.curated ? undefined : captureSelection}
              onTouchEnd={song.curated ? undefined : captureSelection}
            >
              <HighlightedLyrics
                lyrics={song.lyrics}
                cards={cards}
                onCard={(cardId) => go(`/cards/${cardId}`)}
              />
            </div>
            {!song.curated && selection && (
              <div className="selection-bar">
                <span>
                  已选中：<strong>{selection}</strong>
                </span>
                <button className="button primary small" onClick={makeCard}>
                  <Plus size={16} /> 制作表达卡
                </button>
                <button
                  className="icon-button"
                  aria-label="清除选择"
                  onClick={() => {
                    setSelection("");
                    window.getSelection()?.removeAllRanges();
                  }}
                >
                  <X size={17} />
                </button>
              </div>
            )}
          </section>
        )}
        {song.studyNotes && (
          <details className="panel original-notes">
            <summary>查看粘贴时的原始学习笔记</summary>
            <pre>{song.studyNotes}</pre>
          </details>
        )}
      </div>
      <aside className="detail-aside">
        <div className="panel sticky-panel">
          <span className="eyebrow">{song.curated ? "IN THIS LESSON" : "YOUR EXPRESSION"}</span>
          <h2>{song.curated ? "本课表达" : "收下一句"}</h2>
          {!song.curated && (
            <>
              <p>手机上选词不方便？直接输入表达也可以。</p>
              <button
                className="button primary full"
                onClick={() => {
                  sessionStorage.removeItem("card-draft");
                  go(`/songs/${song.id}/cards/new`);
                }}
              >
                <PenLine size={17} /> 手动输入表达
              </button>
            </>
          )}
          <div className="divider" />
          <strong className="aside-count">{song.curated ? "本课内容" : "这首歌的表达"} · {cards.length}</strong>
          {cards.length ? (
            <div className="mini-cards">
              {cards.map((card) => (
                <button key={card.id} onClick={() => go(`/cards/${card.id}`)}>
                  <span>
                    {card.expression}
                    {card.sourceType && (
                      <small> · {card.sourceType === "title" ? "歌名表达" : "主题延伸"}</small>
                    )}
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">还没有表达卡。</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function CardForm({
  song,
  card,
  draft,
  onSave,
  onCancel,
}: {
  song: Song;
  card?: Card;
  draft?: { expression?: string; context?: string };
  onSave: (
    fields: Pick<
      Card,
      | "expression"
      | "meaning"
      | "context"
      | "scenario"
      | "label"
      | "example"
      | "notes"
    >,
  ) => void;
  onCancel: () => void;
}) {
  const [expression, setExpression] = useState(
    card?.expression ?? draft?.expression ?? "",
  );
  const [meaning, setMeaning] = useState(card?.meaning ?? "");
  const [context, setContext] = useState(card?.context ?? draft?.context ?? "");
  const [scenario, setScenario] = useState(card?.scenario ?? "");
  const [label, setLabel] = useState<UsageLabel>(card?.label ?? "待确认");
  const [example, setExample] = useState(card?.example ?? "");
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!expression.trim() || !meaning.trim()) {
      setError("请填写英文表达和中文意思");
      return;
    }
    onSave({
      expression: expression.trim(),
      meaning: meaning.trim(),
      context: context.trim(),
      scenario: scenario.trim(),
      label,
      example: example.trim(),
      notes: notes.trim(),
    });
  }
  return (
    <form className="card-editor panel" onSubmit={submit}>
      <div className="form-intro">
        <span className="eyebrow">FROM {song.title.toUpperCase()}</span>
        <h2>{card ? "编辑表达卡" : "把这句留在手账里"}</h2>
        <p>释义、场景和例句都由你填写；不确定的用法可以先标为「待确认」。</p>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>
            英文表达 <b>*</b>
          </span>
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="例如：写下你想记住的一小段"
          />
        </label>
        <label className="field">
          <span>
            中文意思 <b>*</b>
          </span>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="你自己的理解"
          />
        </label>
      </div>
      <label className="field">
        <span>歌词语境或所在行</span>
        <textarea
          className="short-textarea"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="这句在歌里的上下文"
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>使用场景</span>
          <input
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="什么情况下你会用？"
          />
        </label>
        <label className="field">
          <span>使用标签</span>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value as UsageLabel)}
          >
            <option>日常可用</option>
            <option>偏文学化</option>
            <option>待确认</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>我的英文例句</span>
        <textarea
          className="short-textarea"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="用自己的经历写一句英文"
        />
      </label>
      <label className="field">
        <span>我的备注</span>
        <textarea
          className="short-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="发音、联想、疑问……都可以记在这里"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="button primary" type="submit">
          <Save size={17} /> 保存表达卡
        </button>
        <button className="button subtle" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

function CardDetail({
  card,
  song,
  onDelete,
}: {
  card: Card;
  song?: Song;
  onDelete: () => void;
}) {
  return (
    <div className="card-detail panel">
      <div className="card-detail-top">
        <span className={`tag ${card.label === "待确认" ? "tag-warn" : ""}`}>
          {card.label}
        </span>
        {card.sourceType && (
          <span className="tag">
            {card.sourceType === "title" ? "歌名表达" : "主题延伸（非歌词引用）"}
          </span>
        )}
        <span className="eyebrow">EXPRESSION CARD</span>
      </div>
      <h1>{card.expression}</h1>
      <p className="card-meaning">{card.meaning}</p>
      <div className="card-facts">
        <div>
          <span>{card.curated ? "学习来源" : "歌词语境 / 所在行"}</span>
          <p>{card.context || "尚未填写"}</p>
        </div>
        <div>
          <span>使用场景</span>
          <p>{card.scenario || "尚未填写"}</p>
        </div>
        <div>
          <span>{card.curated ? "原创示例句" : "我的英文例句"}</span>
          <p>{card.example || "尚未填写"}</p>
        </div>
        <div>
          <span>{card.curated ? "用法提醒" : "我的备注"}</span>
          <p>{card.notes || "尚未填写"}</p>
        </div>
        {card.referenceUrl && (
          <div>
            <span>词典参考</span>
            <p>
              <a className="inline-link" href={card.referenceUrl} target="_blank" rel="noopener noreferrer">
                查看英文词典 <ExternalLink size={14} />
              </a>
            </p>
          </div>
        )}
        <div>
          <span>来源歌曲</span>
          <p>
            {song ? (
              <button
                className="inline-link"
                onClick={() => go(`/songs/${song.id}`)}
              >
                {song.title} · {song.artist}
              </button>
            ) : (
              "来源歌曲已删除"
            )}
          </p>
        </div>
        <div>
          <span>下次复习</span>
          <p>
            {dateText(card.nextReview)} · 已连续答「会了」{card.streak} 次
          </p>
        </div>
      </div>
      {!card.curated && (
        <div className="card-detail-actions">
          <button
            className="button primary"
            onClick={() => go(`/cards/${card.id}/edit`)}
          >
            <Edit3 size={17} /> 编辑卡片
          </button>
          <button className="button text danger" onClick={onDelete}>
            <Trash2 size={17} /> 删除卡片
          </button>
        </div>
      )}
      {card.history.length > 0 && (
        <div className="history">
          <h3>复习历史</h3>
          {[...card.history].reverse().map((item, index) => (
            <div key={index}>
              <span>{new Date(item.at).toLocaleString("zh-CN")}</span>
              <strong>
                {item.grade === "good"
                  ? "会了"
                  : item.grade === "fuzzy"
                    ? "模糊"
                    : "忘了"}
              </strong>
              <span>下次 {dateText(item.nextReview)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Review({
  data,
  onGrade,
}: {
  data: AppData;
  onGrade: (id: string, grade: Grade) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const due = data.cards
    .filter((card) => card.nextReview <= localDay())
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  const current = due[0];
  const todayEvents = data.cards.flatMap((card) =>
    card.history.filter((event) => localDay(new Date(event.at)) === localDay()),
  );
  function grade(value: Grade) {
    if (!current) return;
    onGrade(current.id, value);
    setRevealed(false);
  }
  return (
    <div className="review-page">
      <div className="page-intro">
        <span className="eyebrow">SPACED REVIEW</span>
        <h1>今天的复习</h1>
        <p>先看中文意思和使用场景，试着在心里说出英文。</p>
      </div>
      {current ? (
        <>
          <div className="review-progress">
            <span>还有 {due.length} 张待复习</span>
            <span>今天已完成 {todayEvents.length} 张</span>
          </div>
          <div className="review-card panel">
            <div className="review-card-top">
              <span>回忆这句英文</span>
              <span className="review-number">
                01 / {String(due.length).padStart(2, "0")}
              </span>
            </div>
            <div className="review-prompt">
              <span>中文意思</span>
              <h2>{current.meaning}</h2>
              <span>使用场景</span>
              <p>{current.scenario || "这张卡还没有填写使用场景"}</p>
            </div>
            {revealed ? (
              <div className="review-answer">
                <span className="eyebrow">ANSWER / 答案</span>
                <h2>{current.expression}</h2>
                {current.context && <p>{current.curated ? "学习来源" : "歌词语境"}：{current.context}</p>}
                {current.example && <p>{current.curated ? "原创示例句" : "我的例句"}：{current.example}</p>}
              </div>
            ) : (
              <button
                className="button primary reveal"
                onClick={() => setRevealed(true)}
              >
                显示英文答案 <ArrowRight size={18} />
              </button>
            )}
          </div>
          {revealed && (
            <div className="grade-actions">
              <button className="grade forgot" onClick={() => grade("forgot")}>
                忘了<small>明天再看 · 重置进度</small>
              </button>
              <button className="grade fuzzy" onClick={() => grade("fuzzy")}>
                模糊<small>明天再看 · 保持进度</small>
              </button>
              <button className="grade good" onClick={() => grade("good")}>
                会了<small>继续延长间隔</small>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="panel review-complete">
          <div className="complete-icon">
            <Check size={30} />
          </div>
          <span className="eyebrow">ALL DONE FOR TODAY</span>
          <h2>今天的复习完成了</h2>
          {todayEvents.length ? (
            <p>
              今天复习了 {todayEvents.length} 张：会了{" "}
              {todayEvents.filter((e) => e.grade === "good").length} 张，模糊{" "}
              {todayEvents.filter((e) => e.grade === "fuzzy").length} 张，忘了{" "}
              {todayEvents.filter((e) => e.grade === "forgot").length} 张。
            </p>
          ) : (
            <p>今天没有到期的表达卡。新建的卡片会从今天开始复习。</p>
          )}
          <button className="button subtle" onClick={() => go("/cards")}>
            看看我的表达卡
          </button>
        </div>
      )}
    </div>
  );
}

function PracticePage({
  data,
  onSave,
  onDelete,
}: {
  data: AppData;
  onSave: (practice: Practice) => void;
  onDelete: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [sentence, setSentence] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState("");
  const oldPractice = data.practices.find((item) => item.id === editingId);
  const cards = picked
    .map((cardId) => data.cards.find((card) => card.id === cardId))
    .filter((card): card is Card => Boolean(card));
  function draw(amount = count) {
    const pool = [...data.cards];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicked(
      pool.slice(0, Math.min(amount, pool.length)).map((card) => card.id),
    );
    setEditingId(undefined);
    setSentence("");
    setError("");
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!sentence.trim()) {
      setError("请先写一句英文");
      return;
    }
    if (!picked.length && !oldPractice) {
      setError("请先抽取表达");
      return;
    }
    onSave({
      id: oldPractice?.id ?? id(),
      cardIds: picked.length ? picked : (oldPractice?.cardIds ?? []),
      expressions: cards.length
        ? cards.map((card) => card.expression)
        : (oldPractice?.expressions ?? []),
      sentence: sentence.trim(),
      createdAt: oldPractice?.createdAt ?? now(),
      updatedAt: now(),
    });
    setSentence("");
    setEditingId(undefined);
    setPicked([]);
    setError("");
  }
  function edit(item: Practice) {
    setEditingId(item.id);
    setPicked(
      item.cardIds.filter((cardId) =>
        data.cards.some((card) => card.id === cardId),
      ),
    );
    setSentence(item.sentence);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="practice-page">
      <div className="page-intro">
        <span className="eyebrow">MAKE IT YOURS</span>
        <h1>造句练习</h1>
        <p>从课程表达里抽几句，用自己的经历写出新的英文句子。</p>
      </div>
      <div className="practice-layout">
        <form className="panel practice-workspace" onSubmit={save}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE PROMPT</span>
              <h2>{editingId ? "修改我的句子" : "开始写一句"}</h2>
            </div>
            <PenLine size={24} />
          </div>
          {data.cards.length || editingId ? (
            <>
              {data.cards.length > 0 && (
                <div className="draw-controls">
                  <label>
                    抽取数量{" "}
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    >
                      {[1, 2, 3]
                        .filter((n) => n <= data.cards.length)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n} 个
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="button subtle small"
                    type="button"
                    onClick={() => draw()}
                  >
                    <RotateCcw size={16} />{" "}
                    {picked.length ? "换一组表达" : "抽取表达"}
                  </button>
                </div>
              )}
              <div className="picked-cards">
                {cards.length ? (
                  cards.map((card) => (
                    <span key={card.id}>{card.expression}</span>
                  ))
                ) : oldPractice?.expressions?.length ? (
                  oldPractice.expressions.map((expression, index) => (
                    <span key={index}>{expression}</span>
                  ))
                ) : (
                  <p>点「抽取表达」，从你自己的卡片中获得灵感。</p>
                )}
              </div>
              <label className="field">
                <span>我的英文句子</span>
                <textarea
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  placeholder="想想最近发生的一件小事，用这些表达写一句英文……"
                />
              </label>
              {error && <p className="error">{error}</p>}
              <div className="form-actions">
                <button className="button primary" type="submit">
                  <Save size={17} /> {editingId ? "保存修改" : "保存句子"}
                </button>
                {editingId && (
                  <button
                    className="button subtle"
                    type="button"
                    onClick={() => {
                      setEditingId(undefined);
                      setSentence("");
                      setPicked([]);
                    }}
                  >
                    取消修改
                  </button>
                )}
              </div>
            </>
          ) : (
            <Empty
              icon={<BookOpen />}
              title="先收藏一张表达卡"
              text="造句练习会从你已学的表达中抽取。"
              action={
                <button
                  className="button primary small"
                  type="button"
                  onClick={() => go("/songs")}
                >
                  去看歌曲
                </button>
              }
            />
          )}
        </form>
        <section className="panel practice-history">
          <SectionHeading eyebrow="YOUR WRITING" title="写过的句子" />
          <div className="practice-list">
            {data.practices.length ? (
              [...data.practices]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((item) => (
                  <article key={item.id} className="practice-item">
                    <div className="practice-tags">
                      {(item.expressions ?? []).map((expression, index) => (
                        <span key={index}>{expression}</span>
                      ))}
                    </div>
                    <p>{item.sentence}</p>
                    <div className="practice-item-bottom">
                      <small>
                        {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                      </small>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="编辑句子"
                          onClick={() => edit(item)}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label="删除句子"
                          onClick={() => {
                            if (window.confirm("确定删除这条造句吗？"))
                              onDelete(item.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
            ) : (
              <p className="muted">
                写下的句子会保存在这里，之后可以回来修改。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsPage({
  data,
  onImageChange,
  onImport,
}: {
  data: AppData;
  onImageChange: (key: "homeImageId" | "decorImageId", value?: string) => void;
  onImport: (backup: Backup) => Promise<void>;
}) {
  const [backup, setBackup] = useState<Backup>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function exportData() {
    setBusy(true);
    setError("");
    try {
      const result = await createBackup(data);
      const blob = new Blob([JSON.stringify(result)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `歌词里的英文-备份-${localDay()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }
  async function selectBackup(file?: File) {
    if (!file) return;
    setError("");
    setBackup(undefined);
    try {
      setBackup(parseBackup(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取备份");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function updateImage(key: "homeImageId" | "decorImageId", value?: string) {
    const previous = data.settings[key];
    onImageChange(key, value);
    if (previous && previous !== value) void removeImage(previous);
  }
  return (
    <div className="settings-page">
      <div className="page-intro">
        <span className="eyebrow">YOUR SPACE</span>
        <h1>外观与备份</h1>
        <p>课程内容由本站提供；你的复习记录、造句和个人图片保存在当前浏览器。换设备或清理数据前，请先导出备份。</p>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <SectionHeading eyebrow="PERSONALIZE" title="我的图片" />
          <ImagePicker
            label="首页背景"
            imageId={data.settings.homeImageId}
            onSet={(value) => updateImage("homeImageId", value)}
            onRemove={() => updateImage("homeImageId")}
          />
          <ImagePicker
            label="页面装饰"
            imageId={data.settings.decorImageId}
            onSet={(value) => updateImage("decorImageId", value)}
            onRemove={() => updateImage("decorImageId")}
          />
          <p className="helper">
            歌曲封面可在添加或编辑歌曲时设置。没有图片时会显示默认背景。
          </p>
        </section>
        <section className="panel settings-panel">
          <SectionHeading eyebrow="BACKUP" title="带走这本手账" />
          <p>备份包含歌曲、歌词、表达卡、复习记录、造句和选过的图片。</p>
          <button
            className="button primary full"
            onClick={() => void exportData()}
            disabled={busy}
          >
            <Download size={17} /> {busy ? "正在准备备份…" : "导出完整备份"}
          </button>
          <div className="divider" />
          <p>导入备份会替换这个浏览器里当前的全部学习数据与图片。</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void selectBackup(e.target.files?.[0])}
          />
          <button
            className="button subtle full"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={17} /> 选择备份文件
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      </div>
      {backup && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <button
              className="icon-button modal-close"
              aria-label="关闭"
              onClick={() => setBackup(undefined)}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">IMPORT PREVIEW</span>
            <h2 id="import-title">确认导入这份备份？</h2>
            <p>
              备份时间：{new Date(backup.exportedAt).toLocaleString("zh-CN")}
            </p>
            <div className="import-summary">
              <span>
                歌曲 <strong>{backup.data.songs.length}</strong>
              </span>
              <span>
                表达卡 <strong>{backup.data.cards.length}</strong>
              </span>
              <span>
                造句 <strong>{backup.data.practices.length}</strong>
              </span>
              <span>
                图片 <strong>{backup.images.length}</strong>
              </span>
            </div>
            <p className="warning">
              确认后会覆盖当前全部数据。建议先导出当前备份。
            </p>
            <div className="form-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onImport(backup);
                    setBackup(undefined);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "导入失败");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "正在导入…" : "确认覆盖并导入"}
              </button>
              <button
                className="button subtle"
                onClick={() => setBackup(undefined)}
              >
                取消
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData>(emptyData());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [route, setRoute] = useState(routeNow);
  const [storageError, setStorageError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  }>();
  useEffect(() => {
    readData()
      .then((loaded) => {
        dataRef.current = loaded;
        setData(loaded);
      })
      .catch((e) =>
        setStorageError(e instanceof Error ? e.message : "无法读取浏览器存储"),
      );
  }, []);
  useEffect(() => {
    const handler = () => {
      setRoute(routeNow());
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  function commit(next: AppData) {
    dataRef.current = next;
    setData(next);
    saveQueue.current = saveQueue.current
      .then(() => writeData(next))
      .catch((e) => {
        setStorageError(
          e instanceof Error ? e.message : "保存失败，请检查浏览器存储空间",
        );
      });
  }
  function change(fn: (old: AppData) => AppData) {
    commit(fn(dataRef.current));
  }
  async function importData(backup: Backup) {
    await saveQueue.current;
    await restoreBackup(backup);
    const restored = withCatalog(backup.data);
    dataRef.current = restored;
    setData(restored);
    go("/");
    setStorageError("");
  }
  if (storageError && !data)
    return (
      <div className="fatal-error">
        <h1>暂时无法打开手账</h1>
        <p>{storageError}</p>
        <p>请确认浏览器允许此页面使用 IndexedDB，并在普通窗口重新打开。</p>
      </div>
    );
  if (!data) return <div className="loading">正在打开手账…</div>;

  const nav = [
    { path: "/", label: "首页", icon: <Music2 size={19} /> },
    { path: "/songs", label: "歌曲课程", icon: <Library size={19} /> },
    { path: "/cards", label: "表达卡", icon: <BookOpen size={19} /> },
    { path: "/review", label: "定期复习", icon: <RotateCcw size={19} /> },
    { path: "/practice", label: "造句练习", icon: <PenLine size={19} /> },
    { path: "/settings", label: "外观与备份", icon: <Settings2 size={19} /> },
  ];
  const segments = route.split("/").filter(Boolean);
  const song =
    segments[0] === "songs"
      ? data.songs.find((item) => item.id === segments[1])
      : undefined;
  const card =
    segments[0] === "cards"
      ? data.cards.find((item) => item.id === segments[1])
      : undefined;
  let page: ReactNode;
  let back: { label: string; path: string } | undefined;
  if (route === "/") page = <Home data={data} />;
  else if (route === "/songs")
    page = (
      <div className="content-page">
        <div className="page-intro with-action">
          <div>
            <span className="eyebrow">MY SONGBOOK</span>
            <h1>歌曲课程</h1>
            <p>选一首歌开始听，课程表达已经为你准备好。</p>
          </div>
        </div>
        {data.songs.length ? (
          <div className="song-grid">
            {[...data.songs]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((item) => (
                <button
                  className="song-tile"
                  key={item.id}
                  onClick={() => go(`/songs/${item.id}`)}
                >
                  <SongCover song={item} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.artist} ·{" "}
                      {data.cards.filter((c) => c.songId === item.id).length}{" "}
                      张表达卡
                    </small>
                  </span>
                  <ArrowRight size={19} />
                </button>
              ))}
          </div>
        ) : (
          <Empty
            icon={<Music2 />}
            title="还没有添加歌曲"
            text="粘贴你想学习的歌词，保留每一行原来的样子。"
            action={
              <button
                className="button primary"
                onClick={() => go("/songs/new")}
              >
                添加第一首歌
              </button>
            }
          />
        )}
      </div>
    );
  else if (route === "/songs/bulk" || (song && !song.curated && segments[2] === "bulk")) {
    back = {
      label: song ? "歌曲详情" : "歌曲课程",
      path: song ? `/songs/${song.id}` : "/songs",
    };
    page = (
      <BulkImportPage
        key={song?.id ?? "new-bulk"}
        song={song}
        existingCards={data.cards.filter((card) => card.songId === song?.id)}
        onCancel={() => go(back!.path)}
        onSave={(fields, importedCards) => {
          const songId = song?.id ?? id();
          const timestamp = now();
          change((old) => {
            const existing = new Set(
              old.cards
                .filter((card) => card.songId === songId)
                .map((card) =>
                  `${card.expression.trim().toLocaleLowerCase()}\u0000${card.meaning.trim().toLocaleLowerCase()}`,
                ),
            );
            const newCards: Card[] = importedCards
              .filter((card) => {
                const key = `${card.expression.trim().toLocaleLowerCase()}\u0000${card.meaning.trim().toLocaleLowerCase()}`;
                if (existing.has(key)) return false;
                existing.add(key);
                return true;
              })
              .map((card) => ({
                ...card,
                context: card.context || songContext(fields.lyrics, card.expression),
                id: id(),
                songId,
                streak: 0,
                nextReview: localDay(),
                history: [],
                createdAt: timestamp,
                updatedAt: timestamp,
              }));
            const updatedSong: Song = song
              ? { ...song, ...fields, updatedAt: timestamp }
              : {
                  id: songId,
                  ...fields,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                };
            return {
              ...old,
              songs: song
                ? old.songs.map((item) => item.id === song.id ? updatedSong : item)
                : [updatedSong, ...old.songs],
              cards: [...newCards, ...old.cards],
            };
          });
          go(`/songs/${songId}`);
        }}
      />
    );
  } else if (route === "/songs/new" || (song && !song.curated && segments[2] === "edit")) {
    back = {
      label: song ? "歌曲详情" : "歌曲课程",
      path: song ? `/songs/${song.id}` : "/songs",
    };
    page = (
      <div className="content-page">
        <div className="page-intro">
          <span className="eyebrow">WRITE A NEW PAGE</span>
          <h1>{song ? "编辑歌曲" : "添加歌曲"}</h1>
          <p>填写歌曲信息，把歌词贴进你的私人手账。</p>
        </div>
        <SongForm
          key={song?.id ?? "new"}
          song={song}
          onCancel={() => go(back!.path)}
          onSave={(fields) => {
            if (song) {
              change((old) => ({
                ...old,
                songs: old.songs.map((s) =>
                  s.id === song.id ? { ...s, ...fields, updatedAt: now() } : s,
                ),
              }));
              go(`/songs/${song.id}`);
            } else {
              const newSong: Song = {
                id: id(),
                ...fields,
                createdAt: now(),
                updatedAt: now(),
              };
              change((old) => ({ ...old, songs: [newSong, ...old.songs] }));
              go(`/songs/${newSong.id}`);
            }
          }}
        />
      </div>
    );
  } else if (song && segments.length === 2) {
    back = { label: "歌曲课程", path: "/songs" };
    const songCards = data.cards.filter((c) => c.songId === song.id);
    page = (
      <SongDetail
        key={song.id}
        song={song}
        cards={songCards}
        onDelete={() =>
          setConfirmDelete({
            title: `删除《${song.title}》？`,
            description: `这首歌和它关联的 ${songCards.length} 张表达卡及复习历史都会删除。已保存的造句会保留。`,
            onConfirm: () => {
              change((old) => ({
                ...old,
                songs: old.songs.filter((s) => s.id !== song.id),
                cards: old.cards.filter((c) => c.songId !== song.id),
              }));
              void removeImage(song.coverImageId);
              go("/songs");
            },
          })
        }
      />
    );
  } else if (song && !song.curated && segments[2] === "cards" && segments[3] === "new") {
    back = { label: "返回歌词", path: `/songs/${song.id}` };
    let draft: { expression?: string; context?: string } | undefined;
    try {
      const saved = sessionStorage.getItem("card-draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.songId === song.id) draft = parsed;
      }
    } catch {
      /* Ignore an invalid temporary selection. */
    }
    page = (
      <div className="narrow-page">
        <CardForm
          key={`${song.id}-${draft?.expression ?? ""}`}
          song={song}
          draft={draft}
          onCancel={() => go(`/songs/${song.id}`)}
          onSave={(fields) => {
            const newCard: Card = {
              id: id(),
              songId: song.id,
              ...fields,
              streak: 0,
              nextReview: localDay(),
              history: [],
              createdAt: now(),
              updatedAt: now(),
            };
            change((old) => ({ ...old, cards: [newCard, ...old.cards] }));
            sessionStorage.removeItem("card-draft");
            go(`/cards/${newCard.id}`);
          }}
        />
      </div>
    );
  } else if (route === "/cards")
    page = (
      <div className="content-page">
        <div className="page-intro">
          <span className="eyebrow">MY EXPRESSIONS</span>
          <h1>表达卡</h1>
          <p>从歌曲出发，学会能放进生活里的英文表达。</p>
        </div>
        {data.cards.length ? (
          <div className="cards-grid">
            {[...data.cards]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((item) => (
                <button
                  className="expression-tile"
                  key={item.id}
                  onClick={() => go(`/cards/${item.id}`)}
                >
                  <span className="tag">{item.label}</span>
                  <strong>{item.expression}</strong>
                  <span>{item.meaning}</span>
                  <small>
                    {data.songs.find((s) => s.id === item.songId)?.title ??
                      "已删除的歌曲"}{" "}
                    · 下次复习 {dateText(item.nextReview)}
                  </small>
                  <ArrowRight className="tile-arrow" size={18} />
                </button>
              ))}
          </div>
        ) : (
          <Empty
            icon={<BookOpen />}
            title="还没有表达卡"
            text="打开一首歌，选中歌词或手动输入英文表达。"
            action={
              <button className="button primary" onClick={() => go("/songs")}>
                去看歌曲
              </button>
            }
          />
        )}
      </div>
    );
  else if (card && !card.curated && segments[2] === "edit") {
    const source = data.songs.find((s) => s.id === card.songId);
    back = { label: "表达卡", path: `/cards/${card.id}` };
    page = source ? (
      <div className="narrow-page">
        <CardForm
          card={card}
          song={source}
          onCancel={() => go(`/cards/${card.id}`)}
          onSave={(fields) => {
            change((old) => ({
              ...old,
              cards: old.cards.map((c) =>
                c.id === card.id ? { ...c, ...fields, updatedAt: now() } : c,
              ),
            }));
            go(`/cards/${card.id}`);
          }}
        />
      </div>
    ) : null;
  } else if (card) {
    back = { label: "全部表达", path: "/cards" };
    page = (
      <div className="narrow-page">
        <CardDetail
          card={card}
          song={data.songs.find((s) => s.id === card.songId)}
          onDelete={() =>
            setConfirmDelete({
              title: "删除这张表达卡？",
              description: "这张卡及其复习历史会一起删除。",
              onConfirm: () => {
                change((old) => ({
                  ...old,
                  cards: old.cards.filter((c) => c.id !== card.id),
                }));
                go("/cards");
              },
            })
          }
        />
      </div>
    );
  } else if (route === "/review")
    page = (
      <Review
        data={data}
        onGrade={(cardId, grade) =>
          change((old) => ({
            ...old,
            cards: old.cards.map((c) =>
              c.id === cardId ? gradeCard(c, grade) : c,
            ),
          }))
        }
      />
    );
  else if (route === "/practice")
    page = (
      <PracticePage
        data={data}
        onSave={(practice) =>
          change((old) => ({
            ...old,
            practices: old.practices.some((p) => p.id === practice.id)
              ? old.practices.map((p) => (p.id === practice.id ? practice : p))
              : [practice, ...old.practices],
          }))
        }
        onDelete={(practiceId) =>
          change((old) => ({
            ...old,
            practices: old.practices.filter((p) => p.id !== practiceId),
          }))
        }
      />
    );
  else if (route === "/settings")
    page = (
      <SettingsPage
        data={data}
        onImageChange={(key, value) =>
          change((old) => ({
            ...old,
            settings: { ...old.settings, [key]: value },
          }))
        }
        onImport={importData}
      />
    );
  else
    page = (
      <Empty
        icon={<CircleHelp />}
        title="没有找到这一页"
        text="这条链接可能已经失效。"
        action={
          <button className="button primary" onClick={() => go("/")}>
            回到首页
          </button>
        }
      />
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button className="brand" onClick={() => go("/")}>
          <span className="brand-icon">
            <Music2 size={24} />
          </span>
          <span>
            <strong>歌词里的英文</strong>
            <small>我的音乐学习手账</small>
          </span>
        </button>
        <div className="sidebar-rule" />
        <nav aria-label="主导航">
          {nav.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${route === item.path || (item.path !== "/" && route.startsWith(item.path + "/")) ? "active" : ""}`}
              onClick={() => go(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
              {route === item.path && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-sticker">
            <Sparkles size={18} />
            <p>
              从喜欢的歌曲里，
              <br />
              找到会用的英文。
            </p>
          </div>
          <small>独立音乐英语学习站 · 非官方网站</small>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="打开菜单"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={22} />
          </button>
          {back ? (
            <button className="back-link" onClick={() => go(back.path)}>
              <ArrowLeft size={17} /> {back.label}
            </button>
          ) : (
            <span className="topbar-label">听歌 · 收藏 · 练习</span>
          )}
          <span className="topbar-right">
            SONG ENGLISH CLUB <span className="topbar-star">✦</span>
          </span>
        </header>
        {storageError && (
          <div className="storage-alert" role="alert">
            {storageError}
          </div>
        )}
        <main>{page}</main>
        <footer>
          <span>歌词里的英文</span>
          <span>课程由本站提供 · 你的练习进度保存在当前浏览器 · 非官方网站</span>
          <span>
            照片：<a href="https://commons.wikimedia.org/wiki/File:Taylor_Swift_The_Eras_Tour_The_Folklore_Set_Era_(53109914795).jpg" target="_blank" rel="noopener noreferrer">Paolo V</a>
            {" · "}<a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener noreferrer">CC BY 2.0</a>
            {" · 页面裁切"}
          </span>
        </footer>
      </div>
      {menuOpen && (
        <button
          className="menu-scrim"
          aria-label="关闭菜单"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div
            className="modal panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <span className="eyebrow">PLEASE CHECK</span>
            <h2 id="delete-title">{confirmDelete.title}</h2>
            <p>{confirmDelete.description}</p>
            <div className="form-actions">
              <button
                className="button danger-solid"
                onClick={() => {
                  confirmDelete.onConfirm();
                  setConfirmDelete(undefined);
                }}
              >
                确认删除
              </button>
              <button
                className="button subtle"
                onClick={() => setConfirmDelete(undefined)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
