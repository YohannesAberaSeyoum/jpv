import { Args, Command, Flags } from '@oclif/core'
import { JpvPlaylistDetail, jpvPlaylistDetail, playlistDetailTypeEnum, JpvVideo, jpvPlaylist, jpvVideo, JpvPlaylist, JpvPlaylistDetailWithPlaylistDetailVideo } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { and, eq, ilike } from 'drizzle-orm'
import Video, { Transaction } from './video.js'
import { Video as YoutubeVideo } from 'youtube-sr'

interface PlaylistDetailArgs {
  // pathUrl?: string
  playlist_type?: 'video' | 'playlist' | 'channel',
  video?: YoutubeVideo
  playlist_id?: number
  order?: number
}

export default class PlaylistDetail extends Command {
  static override args = {
    // pathUrl: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV PlaylistDetails'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New PlaylistDetail' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing PlaylistDetail' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage PlaylistDetail' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing PlaylistDetail' }),
  }

  video = new Video(this.argv, this.config);
  timeOut: NodeJS.Timeout | undefined = undefined
  searchPlaylistDetail = async (
    input: string = "",
    optional?: boolean,
    playlist_id?: number
  ): Promise<{
    name: string
    value: JpvPlaylistDetailWithPlaylistDetailVideo
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db.select().from(jpvPlaylistDetail).leftJoin(jpvPlaylist, eq(jpvPlaylist.id, jpvPlaylistDetail.detailPlaylist)).leftJoin(jpvVideo, eq(jpvPlaylistDetail.video, jpvVideo.id)).where( playlist_id ? (and(ilike(jpvVideo.name, `%${input}%`), eq(jpvPlaylistDetail.playlist, playlist_id))) : ilike(jpvVideo.name, `%${input}%`))        
          const pathes: {name: string, value: JpvPlaylistDetailWithPlaylistDetailVideo}[] = result.map((res) => ({ name: `${res.video?.name}(${res.playlist?.name})`, value: {...res.playlist_detail, video: res.video, playlist_detail: res.playlist_detail} as JpvPlaylistDetailWithPlaylistDetailVideo}));
          if (optional) {
            const jpvF: JpvPlaylistDetailWithPlaylistDetailVideo = {
              playlistDetailType: 'video'
            } as JpvPlaylistDetailWithPlaylistDetailVideo
            pathes.push({ name: "", value: jpvF })
          }
          resolve(pathes)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deletePlaylistDetail = async (args?: PlaylistDetailArgs) => {
    let deletePlaylistDetail: JpvPlaylistDetail
    // if (args?.pathUrl) {
    //   const jpvPlaylistDetail = await db.select().from(playlistDetail).where(eq(playlistDetail., args.pathUrl))
    //   if (!jpvPlaylistDetail.length) {
    //     this.log(chalk.red('Their is no PlaylistDetail with this pathUrl'))
    //     this.exit(1)
    //   }
    //   deletePlaylistDetail = jpvPlaylistDetail[0]
    // } else {
    deletePlaylistDetail = await search({
      message: 'Search PlaylistDetail',
      source: async (input) => {
        return this.searchPlaylistDetail(input)
      },
    })
    // }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvPlaylistDetail).where(eq(jpvPlaylistDetail.id, deletePlaylistDetail.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deletePlaylistDetail()
    }
  }

  updatePlaylistDetail = async (args?: PlaylistDetailArgs) => {
    let updatePlaylistDetail: JpvPlaylistDetail
    // if (args?.pathUrl) {
    //   const jpvPlaylistDetail = await db.select().from(playlistDetail).where(eq(playlistDetail.pathUrl, args.pathUrl))
    //   if (!jpvPlaylistDetail.length) {
    //     this.log(chalk.red('Their is no PlaylistDetail with this pathUrl'))
    //     this.exit(1)
    //   }
    //   updatePlaylistDetail = jpvPlaylistDetail[0]
    // } else {
    updatePlaylistDetail = await search({
      message: 'Search PlaylistDetail',
      source: async (input) => {
        return this.searchPlaylistDetail(input)
      },
    })
    // }
    const ch = await this.playlistDetailForm(updatePlaylistDetail)
    await db.update(jpvPlaylistDetail).set(ch).where(eq(jpvPlaylistDetail.id, updatePlaylistDetail.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updatePlaylistDetail()
    }
  }


  playlistDetailForm = async (playlistDetail: JpvPlaylistDetail = {} as JpvPlaylistDetail) => {

    let video: JpvVideo | undefined;
    const playlist_detail_type = await select({
      message: 'Playlist Detail Type',
      choices: playlistDetailTypeEnum.enumValues,
    })

    if (playlist_detail_type == playlistDetailTypeEnum.enumValues[0]) {
      video = await search({
        message: 'Link of Video',
        source: async (input) => {
          return this.video.searchVideo(input)
        },
      })
    }

    if (video) {
      playlistDetail.video = video?.id
    }
    return playlistDetail
  }

  addPlaylistDetail = async (args?: PlaylistDetailArgs | JpvPlaylistDetail, tx?: Transaction, handleMultiple: boolean = true) => {
    let jpvPlaylistD: JpvPlaylistDetail = args as JpvPlaylistDetail;
    let form: JpvPlaylistDetail = {} as JpvPlaylistDetail;
    if (args && 'playlist_type' in args) {
      if (args.playlist_type == 'video') {
        const videos = await this.video.addVideo(args.video, tx, handleMultiple)
        form.playlistDetailType = 'video'
        form.playlist = args.playlist_id || -1
        form.order = BigInt(args.order || -1)
        form.video = videos[0].id
      }
    } else {
      form = await this.playlistDetailForm(jpvPlaylistD)
    }
    let details = await db.insert(jpvPlaylistDetail).values({ ...form }).onConflictDoUpdate({target: [jpvPlaylistDetail.playlist, jpvPlaylistDetail.video], 
      set: {order: form.order}
    }).returning()
    if(!details[0]){
      details = await db.query.jpvPlaylistDetail.findMany({where:  and(eq(jpvPlaylistDetail.playlist, form.playlist!), eq(jpvPlaylistDetail.video, form.video!))});
    }
    if (handleMultiple) {
      const continueConfirmation = await confirm({
        message: 'Do you want to add more details',
        default: true,
      })
      if (continueConfirmation) {
        await this.addPlaylistDetail()
      }
    }
    return details;
  }

  public async managePlaylistDetail() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addPlaylistDetail()
        break
      }
      case actions[1]: {
        await this.updatePlaylistDetail()
        break
      }
      case actions[2]: {
        await this.deletePlaylistDetail()
        break
      }
      default:
        this.exit(0)
    }
    await this.managePlaylistDetail()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(PlaylistDetail)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addPlaylistDetail(args)
    } else if (flags.delete) {
      await this.deletePlaylistDetail(args)
    } else if (flags.update) {
      await this.updatePlaylistDetail(args)
    } else if (flags.manage) {
      await this.managePlaylistDetail()
    }
    this.exit(0)
  }
}
