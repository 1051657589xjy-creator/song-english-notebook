export type UsageLabel = "日常可用" | "偏文学化" | "待确认";
export type Grade = "forgot" | "fuzzy" | "good";

export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  lyrics: string;
  studyNotes?: string;
  lessonIntro?: string;
  curated?: boolean;
  coverImageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEvent {
  at: string;
  grade: Grade;
  streakAfter: number;
  nextReview: string;
}

export interface Card {
  id: string;
  songId: string;
  expression: string;
  meaning: string;
  context: string;
  scenario: string;
  label: UsageLabel;
  example: string;
  notes: string;
  referenceUrl?: string;
  sourceType?: "title" | "song" | "extension";
  curated?: boolean;
  streak: number;
  nextReview: string;
  history: ReviewEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Practice {
  id: string;
  cardIds: string[];
  expressions: string[];
  sentence: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  songs: Song[];
  cards: Card[];
  practices: Practice[];
  settings: { homeImageId?: string; decorImageId?: string };
}

export const emptyData = (): AppData => ({
  songs: [],
  cards: [],
  practices: [],
  settings: {},
});

export const localDay = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const addDays = (day: string, days: number) => {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + days));
};

export const gradeCard = (card: Card, grade: Grade, now = new Date()): Card => {
  const streak =
    grade === "forgot" ? 0 : grade === "good" ? card.streak + 1 : card.streak;
  const interval =
    grade === "good" ? [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] : 1;
  const nextReview = addDays(localDay(now), interval);
  return {
    ...card,
    streak,
    nextReview,
    updatedAt: now.toISOString(),
    history: [
      ...card.history,
      { at: now.toISOString(), grade, streakAfter: streak, nextReview },
    ],
  };
};
