import { serial, text, pgTable, timestamp, pgEnum, boolean, unique, integer, bigint, AnyPgColumn, numeric } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel } from "drizzle-orm"
import { InferResultType } from './type-utils.js';


export const channelTypeEnum = pgEnum('channel_type', ['youtube', 'local']);

export const common = {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date())
}

export const jpvTutorial = pgTable('tutorial', {
    ...common,
    title: text('title').notNull(),
    playlist: integer('playlist_id').references(() => jpvPlaylist.id),
    description: text('description'),
    author: text('author'),
});

export type JpvTutorial = InferResultType<'jpvTutorial'>

export const jpvProject = pgTable('project', {
    ...common,
    title: text('title').notNull(),
    description: text('description'),
    filePath: integer('file_id').references(() => jpvFilePath.id),
});

export type JpvProject = InferResultType<'jpvProject'>

export const jpvTutorialProject = pgTable('tutorial_project', {
    ...common,
    tutorial: integer('tutorial_id').references(() => jpvTutorial.id),
    project: integer('project_id').references(() => jpvProject.id),
});

export type JpvTutorialProject = InferResultType<'jpvTutorialProject'>

export const jpvLink = pgTable('link', {
    ...common,
    name: text('name').notNull(),
    description: text('description'),
    url: text('url').notNull().unique()
});

export const jpvLinkRelations = relations(jpvLink, ({one}) => ({
    video: one(jpvVideo)
}))

export type JpvLink = InferResultType<'jpvLink'>

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

export type JpvChannel = InferResultType<'jpvChannel'>

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

export type JpvFilePath = InferResultType<'jpvFilePath'>

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

export type JpvVideo = InferResultType<'jpvVideo'>
export type JpvVideoWithPathLink = InferResultType<'jpvVideo', {filePath: true, link: true}>

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

export type JpvPlaylist = InferResultType<'jpvPlaylist'>


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
    uniqueVideo: unique().on(t.playlist, t.video),
    uniquePlaylist: unique().on(t.playlist, t.detailPlaylist)
}));

export type JpvPlaylistDetail = InferResultType<'jpvPlaylistDetail'>
export type JpvPlaylistDetailWithPlaylistDetailVideo = InferResultType<'jpvPlaylistDetail', {video: true, detailPlaylist: true, playlist: true}>

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
    uniqVideo: unique().on(t.watch_context, t.video),
    uniqPlaylist: unique().on(t.watch_context, t.playlist),
    uniqChannel: unique().on(t.watch_context, t.channel)
}));

export const videoProgressRelations = relations(videoProgress, ({ one }) => ({
	channel: one(jpvChannel, {fields: [videoProgress.channel], references: [jpvChannel.id]}),
    playlist: one(jpvPlaylist, {fields: [videoProgress.playlist], references: [jpvPlaylist.id]}),
    video: one(jpvVideo, {fields: [videoProgress.video], references: [jpvVideo.id]}),
}));

export type VideoProgress = InferResultType<'videoProgress'>
export type VideoProgressWithVideoPathLink = InferResultType<'videoProgress', {video: {with: {link: true, filePath: true}}}>

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

export type Setting = InferResultType<'setting'>