import type { PublishedCatalog } from "./catalog";

export interface GitHubRepository {
  owner: string;
  name: string;
  branch: string;
  user: string;
}

const catalogPath = "src/publishedCatalog.json";

export function parseRepository(value: string): { owner: string; name: string } {
  const match = value.trim().match(/^(?:https:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (!match || match[1] === "repos") {
    throw new Error("请填写具体仓库地址，例如 https://github.com/用户名/仓库名");
  }
  return { owner: match[1], name: match[2] };
}

async function github<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const githubMessage = await response.json()
      .then((body: unknown) => body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message : "")
      .catch(() => "");
    const publishing = init?.method?.toUpperCase() === "PUT";
    const rateLimited = response.status === 403 && (
      response.headers.get("x-ratelimit-remaining") === "0" ||
      /rate limit/i.test(githubMessage)
    );
    const detail = response.status === 401 ? "令牌无效或已过期"
      : rateLimited ? "GitHub 暂时限制了请求，请稍后再试"
      : response.status === 403 && publishing
        ? "发布被拒绝。请检查令牌是否选中了这个仓库，且 Repository permissions → Contents 为 Read and write"
      : response.status === 403 ? "没有访问该仓库的权限"
      : response.status === 404 ? "找不到该仓库或课程文件"
      : response.status === 409 ? "仓库内容已变化，请重新连接后再发布"
      : "请检查 GitHub 仓库和网络连接";
    throw new Error(`GitHub 返回 ${response.status}：${detail}${githubMessage ? `。GitHub 提示：${githubMessage}` : ""}`);
  }
  return response.json() as Promise<T>;
}

function decodeContent(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replace(/\s/g, "")), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeContent(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function connectRepository(repoUrl: string, token: string): Promise<{
  repo: GitHubRepository;
  catalog: PublishedCatalog;
  sha: string;
}> {
  const { owner, name } = parseRepository(repoUrl);
  if (!token.trim()) throw new Error("请输入 GitHub 访问令牌");
  const repoPath = `/repos/${owner}/${name}`;
  const [repository, profile] = await Promise.all([
    github<{ default_branch: string; permissions?: { push?: boolean } }>(repoPath, token),
    github<{ login: string }>("/user", token),
  ]);
  if (repository.permissions?.push === false) {
    throw new Error("这个 GitHub 账号没有该仓库的写入权限");
  }
  const file = await github<{ content: string; sha: string }>(
    `${repoPath}/contents/${catalogPath}?ref=${encodeURIComponent(repository.default_branch)}`,
    token,
  );
  let catalog: PublishedCatalog;
  try {
    catalog = JSON.parse(decodeContent(file.content)) as PublishedCatalog;
    if (!Array.isArray(catalog.songs) || !Array.isArray(catalog.cards)) throw new Error();
  } catch {
    throw new Error("仓库中的课程文件格式不正确");
  }
  return {
    repo: { owner, name, branch: repository.default_branch, user: profile.login },
    catalog,
    sha: file.sha,
  };
}

export async function publishCatalog(
  repo: GitHubRepository,
  token: string,
  catalog: PublishedCatalog,
  sha: string,
): Promise<string> {
  const file = await github<{ content: { sha: string } }>(
    `/repos/${repo.owner}/${repo.name}/contents/${catalogPath}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        message: "Update published song lessons",
        content: encodeContent(`${JSON.stringify(catalog, null, 2)}\n`),
        sha,
        branch: repo.branch,
      }),
    },
  );
  return file.content.sha;
}
