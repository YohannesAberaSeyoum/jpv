import { serial, text, pgTable, timestamp, pgEnum, boolean, unique, integer, bigint, AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel } from "drizzle-orm"

export const channelTypeEnum = pgEnum('channel_type', ['youtube', 'local']);

export const common = {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date())
}

export const link = pgTable('link', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    url: text('url').notNull().unique()
});

export const linkRelations = relations(link, ({one}) => ({
    video: one(video)
}))

export type Link = InferSelectModel<typeof link>

export const channel = pgTable('channel', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    url: integer("url_id").references(() => link.id),
    channelType: channelTypeEnum("channel_type"),
    verified: boolean("verified"),
    targetId: text('target_id'),
    iconURL: integer("icon_id").references(() => link.id),
    channelname: text('channelname').notNull().unique()
}, (t) => ({
    uniq: unique().on(t.channelType, t.targetId)
}));

export type Channel = InferSelectModel<typeof channel>

export const filePath = pgTable('path', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    pathUrl: text('path_url').notNull().unique(),
    size: bigint('size', {mode: 'bigint'}),
    parent: integer('parent_id').references((): AnyPgColumn => filePath.id)
});

export const filePathRelations = relations(filePath, ({one}) => ({
    video: one(video)
}))

export type FilePath = InferSelectModel<typeof filePath>

export const videoTypeEnum = pgEnum('video_type', ['link', 'local']);

export const video = pgTable('video', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    videoType: videoTypeEnum("video_type"),
    link: integer('link_id').references(() => link.id),
    filePath: integer('file_id').references(() => filePath.id),
    duration: bigint('duration', {'mode': 'bigint'})
}, (t) => ({
    uniq: unique().on(t.filePath, t.link)
}));

export const videoRelations = relations(video, ({ one }) => ({
	filePath: one(filePath, {fields: [video.id], references: [filePath.id]}),
    link: one(link, {fields: [video.id], references: [link.id]}),
}));

export type Video = InferSelectModel<typeof video> & {filePath: number | FilePath | null} & {link: number | Link | null}

export const playlist = pgTable('playlist', {
    ...common,
    name: text('name').notNull(),
    description: text('description')
});

export type Playlist = InferSelectModel<typeof playlist>

export const playlistDetailTypeEnum = pgEnum('playlist_detail_type', ['video']);
export const playlistDetail = pgTable('playlist_detail', {
    ...common,
    playlist: integer('playlist_id').references(() => playlist.id),
    playlistDetailType: playlistDetailTypeEnum("playlist_detail_type"),
    video: integer('video_id').references(() => video.id)
});

export type PlaylistDetail = InferSelectModel<typeof playlistDetail>