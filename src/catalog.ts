import published from "./publishedCatalog.json";
import { localDay, type AppData, type Card, type Song } from "./types";

export type PublishedCard = Pick<
  Card,
  | "id"
  | "songId"
  | "expression"
  | "meaning"
  | "context"
  | "scenario"
  | "label"
  | "example"
  | "notes"
  | "referenceUrl"
  | "sourceType"
  | "curated"
>;

export interface PublishedCatalog {
  songs: Song[];
  cards: PublishedCard[];
}

export const catalogSongs = published.songs as Song[];
export const catalogCards = published.cards as PublishedCard[];

// Published content is the source of truth. Browser storage holds only each
// learner's review history and private practice, so an editor's changes appear
// on the next site build without erasing learning progress.
export function withCatalog(data: AppData): AppData {
  const currentSongs = new Map(data.songs.map((song) => [song.id, song]));
  const currentCards = new Map(data.cards.map((card) => [card.id, card]));
  const songIds = new Set(catalogSongs.map((song) => song.id));
  const cardIds = new Set(catalogCards.map((card) => card.id));
  return {
    ...data,
    songs: [
      ...catalogSongs.map((song) => ({ ...currentSongs.get(song.id), ...song })),
      ...data.songs.filter((song) => !songIds.has(song.id) && !song.curated),
    ],
    cards: [
      ...catalogCards.map((card) => {
        const current = currentCards.get(card.id);
        const publishedAt = catalogSongs.find((song) => song.id === card.songId)?.updatedAt ?? "2026-09-28T00:00:00.000Z";
        return {
          ...current,
          ...card,
          streak: current?.streak ?? 0,
          nextReview: current?.nextReview ?? localDay(),
          history: current?.history ?? [],
          createdAt: current?.createdAt ?? publishedAt,
          updatedAt: current?.updatedAt ?? publishedAt,
        } satisfies Card;
      }),
      ...data.cards.filter((card) => !cardIds.has(card.id) && !card.curated),
    ],
  };
}
