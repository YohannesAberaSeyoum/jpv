import { serial, text, pgTable, timestamp, pgEnum, boolean, unique, integer, bigint, AnyPgColumn, numeric } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel } from "drizzle-orm"

export const channelTypeEnum = pgEnum('channel_type', ['youtube', 'local']);

export const common = {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date())
}

export const jpvLink = pgTable('link', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    url: text('url').notNull().unique()
});

export const jpvLinkRelations = relations(jpvLink, ({one}) => ({
    video: one(jpvVideo)
}))

export type JpvLink = InferSelectModel<typeof jpvLink>

export const jpvChannel = pgTable('channel', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    url: integer("url_id").references(() => jpvLink.id),
    channelType: channelTypeEnum("channel_type"),
    verified: boolean("verified"),
    targetId: text('target_id'),
    iconURL: integer("icon_id").references(() => jpvLink.id),
    channelname: text('channelname').notNull().unique()
}, (t) => ({
    uniq: unique().on(t.channelType, t.targetId)
}));

export type JpvChannel = InferSelectModel<typeof jpvChannel>

export const jpvFilePath = pgTable('path', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    pathUrl: text('path_url').notNull().unique(),
    size: bigint('size', {mode: 'bigint'}),
    parent: integer('parent_id').references((): AnyPgColumn => jpvFilePath.id)
});

export const jpvFilePathRelations = relations(jpvFilePath, ({one}) => ({
    video: one(jpvVideo)
}))

export type JpvFilePath = InferSelectModel<typeof jpvFilePath>

export const videoTypeEnum = pgEnum('video_type', ['link', 'local']);

export const jpvVideo = pgTable('video', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    videoType: videoTypeEnum("video_type"),
    link: integer('link_id').references(() => jpvLink.id),
    filePath: integer('file_id').references(() => jpvFilePath.id),
    duration: numeric('duration'),
    channel: integer("channel_id").references(() => jpvChannel.id),
    date: timestamp('date'),
}, (t) => ({
    uniqFile: unique().on(t.filePath),
    uniqLink: unique().on(t.link)
}));

export const jpvVideoRelations = relations(jpvVideo, ({ one }) => ({
	filePath: one(jpvFilePath, {fields: [jpvVideo.filePath], references: [jpvFilePath.id]}),
    link: one(jpvLink, {fields: [jpvVideo.link], references: [jpvLink.id]}),
}));

export type JpvVideo = InferSelectModel<typeof jpvVideo> & {filePath: number | JpvFilePath | null} & {link: number | JpvLink | null}

export const playlistTypeEnum = pgEnum('playlist_type', ['link', 'local']);

export const jpvPlaylist = pgTable('playlist', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    playlistType: playlistTypeEnum("playlist_type"),
    link: integer('link_id').references(() => jpvLink.id),
    filePath: integer('file_id').references(() => jpvFilePath.id),
    channel: integer("channel_id").references(() => jpvChannel.id),
}, (t) => ({
    uniqFile: unique().on(t.filePath),
    uniqLink: unique().on(t.link)
}));


export const jpvPlaylistRelations = relations(jpvPlaylist, ({ one }) => ({
	playlistLink: one(jpvLink, {fields: [jpvPlaylist.link], references: [jpvLink.id]}),
    playlistFilePath: one(jpvFilePath, {fields: [jpvPlaylist.filePath], references: [jpvFilePath.id]}),
    playlistChannel: one(jpvChannel, {fields: [jpvPlaylist.channel], references: [jpvChannel.id]})
}));

export type JpvPlaylist = InferSelectModel<typeof jpvPlaylist>


export const playlistDetailTypeEnum = pgEnum('playlist_detail_type', ['video', 'playlist', 'channel']);
export const jpvPlaylistDetail = pgTable('playlist_detail', {
    ...common,
    playlist: integer('playlist_id').references(() => jpvPlaylist.id),
    playlistDetailType: playlistDetailTypeEnum("playlist_detail_type"),
    video: integer('video_id').references(() => jpvVideo.id),
    detailPlaylist: integer('detail_playlist_id').references(() => jpvPlaylist.id),
    channel: integer('channel_id').references(() => jpvChannel.id),
    order: bigint('order', {mode: 'bigint'}),
}, (t) => ({
    uniqOrder: unique().on(t.playlist, t.order)
}));

export type JpvPlaylistDetail = InferSelectModel<typeof jpvPlaylistDetail>

export const jpvPlaylistDetailRelations = relations(jpvPlaylistDetail, ({ one }) => ({
    playlist: one(jpvPlaylist, {fields: [jpvPlaylistDetail.playlist], references: [jpvPlaylist.id]}),
    detailPlaylist: one(jpvPlaylist, {fields: [jpvPlaylistDetail.playlist], references: [jpvPlaylist.id]}),
    video: one(jpvVideo, {fields: [jpvPlaylistDetail.video], references: [jpvVideo.id]}),
	channel: one(jpvChannel, {fields: [jpvPlaylistDetail.channel], references: [jpvChannel.id]}),

}));


export const watchContextEnum = pgEnum('watch_context', ['CHANNEL', 'PLAYLIST', 'VIDEO']);
export const videoProgress = pgTable('videoProgress', {
    ...common,
    playlist: integer('playlist_id').references(() => jpvPlaylist.id),
    video: integer('video_id').references(() => jpvVideo.id),
    channel: integer('channel_id').references(() => jpvChannel.id),
    last_position: numeric('last_position'),
    watch_context: watchContextEnum('watch_context')
}, (t) => ({
    uniq: unique().on(t.watch_context, t.video)
}));

export const videoProgressRelations = relations(videoProgress, ({ one }) => ({
	channel: one(jpvChannel, {fields: [videoProgress.channel], references: [jpvChannel.id]}),
    playlist: one(jpvPlaylist, {fields: [videoProgress.playlist], references: [jpvPlaylist.id]}),
    video: one(jpvVideo, {fields: [videoProgress.video], references: [jpvVideo.id]}),
}));

export type VideoProgress = InferSelectModel<typeof videoProgress>

export const settingEnum = pgEnum('setting', ['CHANNEL', 'PLAYLIST', 'VIDEO']);
export const setting = pgTable('videoProgress', {
    ...common,
    playlist: integer('playlist_id').references(() => jpvPlaylist.id),
    video: integer('video_id').references(() => jpvVideo.id),
    channel: integer('channel_id').references(() => jpvChannel.id),
    setting_value: text('setting_value'),
    settingType: settingEnum('setting_type')
}, (t) => ({
    uniqPlaylist: unique().on(t.playlist, t.settingType, t. setting_value),
    uniqChannel: unique().on(t.channel, t.settingType, t. setting_value),
    uniqVideo: unique().on(t.video, t.settingType, t. setting_value)
}));

export const settingRelations = relations(setting, ({ one }) => ({
	channel: one(jpvChannel, {fields: [setting.channel], references: [jpvChannel.id]}),
    playlist: one(jpvPlaylist, {fields: [setting.playlist], references: [jpvPlaylist.id]}),
    video: one(jpvVideo, {fields: [setting.video], references: [jpvVideo.id]}),
}));

export type Setting = InferSelectModel<typeof setting>