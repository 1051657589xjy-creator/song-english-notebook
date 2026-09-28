import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { parseStudyNotes } from "./bulkImport";
import type { PublishedCard, PublishedCatalog } from "./catalog";
import { connectRepository, publishCatalog, type GitHubRepository } from "./githubPublisher";
import type { Song, UsageLabel } from "./types";

const repoKey = "songbook-admin-repository";
const tokenKey = "songbook-admin-token";
const draftKey = (repo: GitHubRepository) =>
  `songbook-admin-draft:${repo.owner.toLowerCase()}/${repo.name.toLowerCase()}`;
const timestamp = () => new Date().toISOString();
const repositoryHint = import.meta.env.VITE_GITHUB_REPOSITORY
  ? `https://github.com/${import.meta.env.VITE_GITHUB_REPOSITORY}`
  : "";

const blankSong = (): Song => ({
  id: crypto.randomUUID(),
  title: "",
  artist: "Taylor Swift",
  url: "",
  lyrics: "",
  lessonIntro: "",
  curated: true,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

const blankCard = (songId: string): PublishedCard => ({
  id: crypto.randomUUID(),
  songId,
  expression: "",
  meaning: "",
  context: "",
  scenario: "",
  label: "日常可用",
  example: "",
  notes: "",
  referenceUrl: "",
  sourceType: "extension",
  curated: true,
});

function validUrl(value: string) {
  if (!value.trim()) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function validateCatalog(catalog: PublishedCatalog, rightsConfirmed: boolean) {
  if (catalog.songs.some((song) => !song.title.trim() || !song.artist.trim()))
    return "每首歌都需要歌名和歌手。";
  if (catalog.songs.some((song) => !validUrl(song.url)))
    return "歌曲链接需要以 https:// 或 http:// 开头。";
  if (catalog.songs.some((song) => song.lyrics.trim()) && !rightsConfirmed)
    return "课程包含完整歌词；请先确认你拥有公开使用授权。";
  const songIds = new Set(catalog.songs.map((song) => song.id));
  if (catalog.cards.some((card) => !songIds.has(card.songId) || !card.expression.trim() || !card.meaning.trim()))
    return "表达卡需要关联歌曲、英文表达和中文意思。";
  if (catalog.cards.some((card) => card.referenceUrl && !validUrl(card.referenceUrl)))
    return "词典参考链接需要以 https:// 或 http:// 开头。";
  return "";
}

export default function AdminPage({ onPublic }: { onPublic: () => void }) {
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem(repoKey) || repositoryHint);
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || "");
  const [repo, setRepo] = useState<GitHubRepository>();
  const [sha, setSha] = useState("");
  const [catalog, setCatalog] = useState<PublishedCatalog>();
  const [selectedId, setSelectedId] = useState("");
  const [notesText, setNotesText] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function connect(url = repoUrl, accessToken = token) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const connected = await connectRepository(url, accessToken);
      let workingCatalog = connected.catalog;
      let restoredNotes = "";
      let hasDraft = false;
      const savedDraft = localStorage.getItem(draftKey(connected.repo));
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as {
            sha?: string;
            catalog?: PublishedCatalog;
            notesText?: string;
          };
          if (parsed.sha === connected.sha &&
              Array.isArray(parsed.catalog?.songs) &&
              Array.isArray(parsed.catalog?.cards)) {
            workingCatalog = parsed.catalog;
            restoredNotes = parsed.notesText ?? "";
            hasDraft = true;
            setMessage("已恢复这个浏览器里未发布的课程草稿。");
          } else {
            setMessage("GitHub 仓库已有新版本，本机旧草稿未自动覆盖最新课程。");
          }
        } catch {
          setMessage("本机课程草稿无法读取，已载入 GitHub 上的最新课程。");
        }
      }
      setRepo(connected.repo);
      setCatalog(workingCatalog);
      setSha(connected.sha);
      setSelectedId(workingCatalog.songs[0]?.id ?? "");
      setNotesText(restoredNotes);
      setDirty(hasDraft);
      sessionStorage.setItem(tokenKey, accessToken.trim());
      localStorage.setItem(repoKey, `https://github.com/${connected.repo.owner}/${connected.repo.name}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接 GitHub 失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const savedToken = sessionStorage.getItem(tokenKey);
    const savedRepo = localStorage.getItem(repoKey) || repositoryHint;
    if (savedToken && savedRepo) void connect(savedRepo, savedToken);
    // Restore only once on entering the admin page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!repo || !catalog || !sha || (!dirty && !notesText.trim())) return;
    try {
      localStorage.setItem(draftKey(repo), JSON.stringify({ sha, catalog, notesText }));
    } catch {
      setError("浏览器无法保存草稿。请先发布课程，或检查浏览器存储空间。");
    }
  }, [repo, catalog, sha, dirty, notesText]);

  function disconnect() {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setRepo(undefined);
    setCatalog(undefined);
    setSha("");
    setDirty(false);
  }

  function updateSong(changes: Partial<Song>) {
    if (!catalog || !selectedId) return;
    setCatalog({
      ...catalog,
      songs: catalog.songs.map((song) => song.id === selectedId
        ? { ...song, ...changes, updatedAt: timestamp(), curated: true }
        : song),
    });
    setDirty(true);
  }

  function updateCard(cardId: string, changes: Partial<PublishedCard>) {
    if (!catalog) return;
    setCatalog({
      ...catalog,
      cards: catalog.cards.map((card) => card.id === cardId ? { ...card, ...changes } : card),
    });
    setDirty(true);
  }

  function addSong() {
    if (!catalog) return;
    const song = blankSong();
    setCatalog({ ...catalog, songs: [...catalog.songs, song] });
    setSelectedId(song.id);
    setDirty(true);
  }

  function removeSong() {
    if (!catalog || !selectedId) return;
    const song = catalog.songs.find((item) => item.id === selectedId);
    if (!window.confirm(`确定删除《${song?.title || "未命名歌曲"}》及其所有表达卡？发布后，所有用户都将看不到这节课。`)) return;
    const songs = catalog.songs.filter((item) => item.id !== selectedId);
    setCatalog({
      songs,
      cards: catalog.cards.filter((card) => card.songId !== selectedId),
    });
    setSelectedId(songs[0]?.id ?? "");
    setDirty(true);
  }

  function addCard() {
    if (!catalog || !selectedId) return;
    setCatalog({ ...catalog, cards: [...catalog.cards, blankCard(selectedId)] });
    setDirty(true);
  }

  function removeCard(cardId: string) {
    if (!catalog || !window.confirm("确定删除这张表达卡？")) return;
    setCatalog({ ...catalog, cards: catalog.cards.filter((card) => card.id !== cardId) });
    setDirty(true);
  }

  function importNotes() {
    if (!catalog || !selectedId) return;
    const result = parseStudyNotes(notesText);
    if (!result.cards.length) {
      setError("没有识别出表达。试试“英文表达 — 中文意思”，每行一条。");
      return;
    }
    const existing = new Set(catalog.cards.filter((card) => card.songId === selectedId)
      .map((card) => `${card.expression.toLowerCase()}\u0000${card.meaning.toLowerCase()}`));
    const newCards = result.cards.filter((card) => {
      const key = `${card.expression.toLowerCase()}\u0000${card.meaning.toLowerCase()}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    }).map((card) => ({
      ...blankCard(selectedId),
      ...card,
      context: card.context || "主题延伸表达；不作为歌词引用",
    }));
    setCatalog({ ...catalog, cards: [...catalog.cards, ...newCards] });
    setNotesText("");
    setDirty(true);
    setError("");
    setMessage(`已加入 ${newCards.length} 张表达卡；${result.unrecognized.length} 行未识别。请检查内容后再发布。`);
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!repo || !catalog || !sha) return;
    const problem = validateCatalog(catalog, rightsConfirmed);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const nextSha = await publishCatalog(repo, token, catalog, sha);
      localStorage.removeItem(draftKey(repo));
      setSha(nextSha);
      setDirty(false);
      setNotesText("");
      setMessage("课程已提交到 GitHub。Pages 会自动构建；完成后，刷新公开网站即可看到更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败");
    } finally {
      setBusy(false);
    }
  }

  const selected = catalog?.songs.find((song) => song.id === selectedId);
  const cards = catalog?.cards.filter((card) => card.songId === selectedId) ?? [];
  return (
    <div className="content-page admin-page">
      <div className="page-intro with-action">
        <div>
          <span className="eyebrow">EDITOR STUDIO</span>
          <h1>课程管理后台</h1>
          <p>在这里整理歌曲和表达，再发布给所有学习者。未发布的课程草稿会自动保存在这个浏览器里。</p>
        </div>
        <button className="button subtle" onClick={onPublic}><ArrowLeft size={16} /> 查看学习界面</button>
      </div>
      {!repo || !catalog ? (
        <form className="panel form-panel admin-connect" onSubmit={(event) => { event.preventDefault(); void connect(); }}>
          <h2>连接你的 GitHub 仓库</h2>
          <p>管理权限由 GitHub 仓库的写入权限决定。令牌仅保存在此标签页，不会写进网站或仓库。</p>
          <label className="field"><span>具体仓库地址</span>
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/用户名/仓库名" />
          </label>
          <label className="field"><span>GitHub 访问令牌</span>
            <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="需要该仓库的 Contents 写入权限" />
          </label>
          <p className="helper">
            <a className="inline-link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">创建细粒度令牌 <ExternalLink size={14} /></a>
            {" · "}只选这个仓库，授予 Contents 读写权限。令牌请直接填在这里，不要发给任何人。
          </p>
          <button className="button primary" disabled={busy} type="submit">{busy ? "正在验证…" : "进入管理后台"}</button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      ) : (
        <>
          <div className="panel admin-status">
            <span>已连接：{repo.user} · {repo.owner}/{repo.name}</span>
            <span>{notesText.trim() ? "有尚未识别的笔记" : dirty ? "有未发布改动" : "课程与仓库同步"}</span>
            <button className="button text small" onClick={disconnect}>退出管理</button>
          </div>
          {catalog.songs.length === 0 && (
            <div className="panel admin-start-guide">
              <h2>从第一首正式课程开始</h2>
              <p>点「新建歌曲课程」，填写歌名、官方歌曲链接和本课导语；再添加表达卡，或一次粘贴已有的学习笔记。检查内容后点页面底部的「发布课程」，学习者才会看到。</p>
            </div>
          )}
          <div className="admin-layout">
            <aside className="panel admin-song-list">
              <div className="section-heading"><div><span className="eyebrow">SONG LIBRARY</span><h2>歌曲课程</h2></div></div>
              {catalog.songs.map((song) => (
                <button key={song.id} className={`admin-song-item ${selectedId === song.id ? "selected" : ""}`}
                  onClick={() => { setSelectedId(song.id); setNotesText(""); setError(""); }}>
                  <strong>{song.title || "未命名歌曲"}</strong>
                  <small>{catalog.cards.filter((card) => card.songId === song.id).length} 张表达卡</small>
                </button>
              ))}
              <button className="button subtle small" onClick={addSong}><Plus size={16} /> 新建歌曲课程</button>
            </aside>
            <div className="admin-editor">
              {selected ? (
                <>
                  <section className="panel form-panel">
                    <div className="section-heading">
                      <div><span className="eyebrow">COURSE DETAILS</span><h2>歌曲信息</h2></div>
                      <button className="button text danger small" onClick={removeSong}><Trash2 size={16} /> 删除课程</button>
                    </div>
                    <div className="field-grid">
                      <label className="field"><span>歌名 *</span><input value={selected.title} onChange={(event) => updateSong({ title: event.target.value })} /></label>
                      <label className="field"><span>歌手 *</span><input value={selected.artist} onChange={(event) => updateSong({ artist: event.target.value })} /></label>
                    </div>
                    <label className="field"><span>官方歌曲链接</span><input value={selected.url} onChange={(event) => updateSong({ url: event.target.value })} placeholder="https://…" /></label>
                    <label className="field"><span>本课导语</span><textarea className="short-textarea" value={selected.lessonIntro ?? ""} onChange={(event) => updateSong({ lessonIntro: event.target.value })} placeholder="告诉学习者这首歌可以学什么" /></label>
                    <label className="field"><span>获授权公开展示的歌词（可留空）</span><textarea className="short-textarea" value={selected.lyrics} onChange={(event) => updateSong({ lyrics: event.target.value })} placeholder="没有公开使用授权时请留空，学习者可以通过官方链接查看歌词" /></label>
                  </section>
                  <section className="panel form-panel">
                    <div className="section-heading"><div><span className="eyebrow">EXPRESSIONS</span><h2>表达卡 · {cards.length}</h2></div>
                      <button className="button subtle small" onClick={addCard}><Plus size={16} /> 添加表达</button>
                    </div>
                    {cards.map((card) => (
                      <div className="admin-card" key={card.id}>
                        <div className="section-heading"><div><strong>{card.expression || "新表达卡"}</strong></div>
                          <button className="button text danger small" onClick={() => removeCard(card.id)}><Trash2 size={15} /> 删除</button>
                        </div>
                        <div className="field-grid">
                          <label className="field"><span>英文表达 *</span><input value={card.expression} onChange={(event) => updateCard(card.id, { expression: event.target.value })} /></label>
                          <label className="field"><span>中文意思 *</span><input value={card.meaning} onChange={(event) => updateCard(card.id, { meaning: event.target.value })} /></label>
                        </div>
                        <div className="field-grid">
                          <label className="field"><span>来源类型</span><select value={card.sourceType ?? "extension"} onChange={(event) => updateCard(card.id, { sourceType: event.target.value as "title" | "extension" })}>
                            <option value="title">歌名表达</option><option value="extension">主题延伸（非歌词引用）</option>
                          </select></label>
                          <label className="field"><span>使用标签</span><select value={card.label} onChange={(event) => updateCard(card.id, { label: event.target.value as UsageLabel })}>
                            <option>日常可用</option><option>偏文学化</option><option>待确认</option>
                          </select></label>
                        </div>
                        <label className="field"><span>学习来源 / 语境</span><input value={card.context} onChange={(event) => updateCard(card.id, { context: event.target.value })} /></label>
                        <label className="field"><span>使用场景</span><input value={card.scenario} onChange={(event) => updateCard(card.id, { scenario: event.target.value })} /></label>
                        <label className="field"><span>原创英文例句</span><input value={card.example} onChange={(event) => updateCard(card.id, { example: event.target.value })} /></label>
                        <label className="field"><span>用法提醒</span><input value={card.notes} onChange={(event) => updateCard(card.id, { notes: event.target.value })} /></label>
                        <label className="field"><span>词典参考链接</span><input value={card.referenceUrl ?? ""} onChange={(event) => updateCard(card.id, { referenceUrl: event.target.value })} placeholder="https://…" /></label>
                      </div>
                    ))}
                  </section>
                  <section className="panel form-panel">
                    <div className="section-heading"><div><span className="eyebrow">BULK PASTE</span><h2>批量导入表达</h2></div></div>
                    <p className="helper">可以一次粘贴多条已有笔记。系统会识别表达、释义、场景、例句和备注；导入后请逐张检查，再发布课程。</p>
                    <details className="admin-import-help">
                      <summary>查看粘贴格式示例</summary>
                      <pre>{"英文表达：shake it off\n中文意思：摆脱烦心事\n使用场景：工作不顺时鼓励自己\n英文例句：I'll shake it off and try again.\n备注：例句请用自己的话编写\n\n英文表达：bounce back\n中文意思：恢复状态"}</pre>
                    </details>
                    <label className="field"><span>表达学习笔记</span><textarea value={notesText} onChange={(event) => setNotesText(event.target.value)} placeholder={"英文表达：…\n中文意思：…\n使用场景：…\n英文例句：…\n备注：…"} /></label>
                    <button className="button subtle" onClick={importNotes} disabled={!notesText.trim()}>识别并加入表达卡</button>
                  </section>
                </>
              ) : (
                <div className="panel form-panel"><h2>先添加一首歌曲</h2><button className="button primary" onClick={addSong}><Plus size={16} /> 新建歌曲课程</button></div>
              )}
            </div>
          </div>
          <form className="panel admin-publish" onSubmit={(event) => void publish(event)}>
            <div>
              <h2>发布给学习者</h2>
              <p>发布会提交课程数据到 GitHub，并触发 Pages 自动更新。学习者的复习记录仍保存在各自浏览器。</p>
              {catalog.songs.some((song) => song.lyrics.trim()) && (
                <label className="admin-rights"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
                  我确认对所填写的完整歌词拥有公开使用授权
                </label>
              )}
            </div>
            <button className="button primary" type="submit" disabled={busy || !dirty}><Save size={17} /> {busy ? "正在发布…" : "发布课程"}</button>
          </form>
          {error && <p className="error admin-feedback" role="alert">{error}</p>}
          {message && <p className="admin-feedback" role="status">{message}</p>}
          <a className="inline-link" href={`https://github.com/${repo.owner}/${repo.name}/actions`} target="_blank" rel="noopener noreferrer">查看 GitHub 构建进度 <ExternalLink size={14} /></a>
        </>
      )}
    </div>
  );
}
