import { Args, Command, Flags } from '@oclif/core'
import { JpvChannel, jpvFilePath, JpvLink, jpvLink, JpvPlaylist, jpvPlaylist, playlistTypeEnum } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { and, eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'
import Channel from './channel.js'
import Video, { Transaction } from './video.js'
import { Playlist as YoutubePlaylist, YouTube} from 'youtube-sr'
import { searchYoutube } from '../utils/youtube.js'
import fileSelector from 'inquirer-file-selector'
import * as path from 'path';
import PlaylistDetail from './playlist_detail.js'
import { extension, sortedWalkDirWithMergedArray } from '../utils/file.js'

interface PlaylistArgs {
  name?: string
}

export default class Playlist extends Command {
  static override args = {
    name: Args.string({ description: 'It is Unique name' }),
  }

  static override description = 'Manage JPV Playlists'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Playlist' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Playlist' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Playlist' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Playlist' })
  }

  channel = new Channel(this.argv, this.config);
  videoT = new Video(this.argv, this.config);
  playlistDetail = new PlaylistDetail(this.argv, this.config);
  timeOut: NodeJS.Timeout | undefined = undefined

  searchPlaylist = async (
    input: string = "",
    create_new?: boolean,
  ): Promise<{
    name: string
    value: JpvPlaylist
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvPlaylist)
            .where(ilike(jpvPlaylist.name, `%${input}%`))
          const playlists = result.map((res) => ({ name: `${res.name}(${res.name})`, value: res }))
          if (create_new) {
            const jpvL: JpvPlaylist = {
              name: `Create -> ${input}`,
            } as JpvPlaylist
            playlists.push({ name: jpvL.name, value: jpvL })
          }
          resolve(playlists)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deletePlaylist = async (args?: PlaylistArgs) => {
    let deletePlaylist: JpvPlaylist
    if (args?.name) {
      const jpvP = await db.select().from(jpvPlaylist).where(eq(jpvPlaylist.name, args.name))
      if (!jpvP.length) {
        this.log(chalk.red('Their is no Playlist with this name'))
        this.exit(1)
      }
      deletePlaylist = jpvP[0]
    } else {
      deletePlaylist = await search({
        message: 'Search Playlist',
        source: async (input) => {
          return this.searchPlaylist(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvPlaylist).where(eq(jpvPlaylist.id, deletePlaylist.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deletePlaylist()
    }
  }

  updatePlaylist = async (args?: PlaylistArgs, tx?: Transaction) => {
    const dx = tx || db
    let updatePlaylist: JpvPlaylist
    if (args?.name) {
      const jpvP = await dx.select().from(jpvPlaylist).where(eq(jpvPlaylist.name, args.name))
      if (!jpvP.length) {
        this.log(chalk.red('Their is no Playlist with this url'))
        this.exit(1)
      }
      updatePlaylist = jpvP[0]
    } else {
      updatePlaylist = await search({
        message: 'Search Playlist',
        source: async (input) => {
          return this.searchPlaylist(input)
        },
      })
    }
    const pl = await this.playlistForm(updatePlaylist)
    const playlists = await dx.update(jpvPlaylist).set(pl).where(eq(jpvPlaylist.id, updatePlaylist.id)).returning()
    const playlist = playlists[0]
    await this.addVideos(playlist, tx)
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updatePlaylist()
    }
  }

  playlistForm = async (playlist: JpvPlaylist = {} as JpvPlaylist, tx?: Transaction) => {
    if(!playlist?.id){
      const playlistType = await select({
        message: 'Select Playlist Type',
        choices: playlistTypeEnum.enumValues,
      })
      playlist.playlistType = playlistType as any
      
      if (playlistType == 'link') {
        const youtubePlaylist = await search({
          message: 'Search Youtube',
          source: async (input) => {
            return searchYoutube(input, 'playlist')
          },
        }) as YoutubePlaylist
  
        playlist.name = youtubePlaylist.title || ""
        playlist.description = ""
        if (tx) {
          let link = await tx.insert(jpvLink).values({ name: playlist.name, url: youtubePlaylist.url } as JpvLink).onConflictDoNothing().returning()
          if(!link[0]){
            link = await db.query.jpvLink.findMany({where: eq(jpvLink.url, youtubePlaylist.url!)});
          }
          playlist.link = link[0].id
          const channel: JpvChannel = { ...youtubePlaylist.channel, channelType: 'youtube' } as unknown as JpvChannel
          const channels = await this.channel.addChannel(channel, tx, false);
          playlist.channel = channels[0].id
        }
      } else {
        const filePath = await fileSelector({
          message: "Select Playlist Path",
          type: 'directory'
        })
        const directory = path.parse(filePath)
        if (tx) {
          let file = await tx.insert(jpvFilePath).values({ name: directory.base, pathUrl: filePath }).onConflictDoNothing().returning()
          if(!file[0]){
            file = await tx.query.jpvFilePath.findMany({where: eq(jpvFilePath.pathUrl, filePath)});
          }
          playlist.filePath = file[0].id
        }
        const channel = await this.channel.getOrInsertChannel(tx);
        playlist.channel = channel.id
      }
    }

    const name = await input({
      message: 'Title of Playlist',
      default: playlist.name,
    })

    const description = await input({
      message: 'Description of Playlist',
      default: playlist.description || '',
    })
    playlist.name = name
    playlist.description = description
    return playlist
  }

  addVideos = async (playlist: JpvPlaylist, tx?: Transaction) => {
    if(playlist.playlistType == 'link'){
      const link = await tx?.query.jpvLink.findFirst({where: eq(jpvLink.id, playlist.link!)})
      const playlistDetail = await YouTube.getPlaylist(link?.url!)
      playlistDetail.videos.map(async(video, idx) => {
        await this.playlistDetail.addPlaylistDetail({playlist_type: 'video', video, playlist_id: playlist.id, order: playlistDetail.videoCount - idx})
      })
    }else if(playlist.playlistType == 'local'){
      const filePath = await tx?.query.jpvFilePath.findFirst({where: eq(jpvLink.id, playlist.filePath!)})
      const playlistDetail = await sortedWalkDirWithMergedArray(filePath?.pathUrl!, extension)
      const videoPromises = playlistDetail.map(async(video, idx) => {
        const directory = path.parse(video)
        await this.playlistDetail.addPlaylistDetail({playlist_type: 'video', video: {title: directory.base, description: '', file_path: video, duration: await this.videoT.getVideoDuration(video)} as any, playlist_id: playlist.id, order: idx, channel: playlist.channel}, tx, false)
      })
      await Promise.all(videoPromises)
    }
  }

  addPlaylist = async (args?: PlaylistArgs, tx?: Transaction, handleMultiple: boolean = true) => {
    const dx = tx || db
    let jpvP: JpvPlaylist = { name: args?.name || "" } as JpvPlaylist;
    const form = await this.playlistForm(jpvP, tx)
    let playlists = await dx.insert(jpvPlaylist).values({ ...form }).onConflictDoNothing().returning()
    if(!playlists.length){
      if(form.playlistType == 'local'){
        playlists = await dx.query.jpvPlaylist.findMany({where: eq(jpvPlaylist.filePath, form.filePath!)});
      } else {
        playlists = await dx.query.jpvPlaylist.findMany({where: eq(jpvPlaylist.link, form.link!)});
      }
    }
    const playlist = playlists[0]
    await this.addVideos(playlist, tx)
    if (handleMultiple) {
      const continueConfirmation = await confirm({
        message: 'Do you want to add more playlists',
        default: true,
      })
      if (continueConfirmation) {
        await this.addPlaylist()
      }
    }
    return playlists;
  }

  addTransactionPlaylist = async(args?: PlaylistArgs) => {
    await db.transaction(async(tx) => {
      await this.addPlaylist(args, tx)
    })
  }

  updateTransactionPlaylist = async(args?: PlaylistArgs) => {
    await db.transaction(async(tx) => {
      await this.updatePlaylist(args, tx)
    })
  }

  public async managePlaylist() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addPlaylist()
        break
      }
      case actions[1]: {
        await this.updatePlaylist()
        break
      }
      case actions[2]: {
        await this.deletePlaylist()
        break
      }
      default:
        this.exit(0)
    }
    await this.managePlaylist()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Playlist)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }
    if (flags.add) {
      await this.addTransactionPlaylist(args)
    } else if (flags.delete) {
      await this.deletePlaylist(args)
    } else if (flags.update) {
      await this.updateTransactionPlaylist(args)
    } else if (flags.manage) {
      await this.managePlaylist()
    }
    this.exit(0)
  }
}
