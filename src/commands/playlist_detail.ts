import { Args, Command, Flags } from '@oclif/core'
import { PlaylistDetail as JPVPlaylistDetail, playlistDetail, playlistDetailTypeEnum, Video as JPVVideo } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import Video from './video.js'

interface PlaylistDetailArgs {
  // pathUrl?: string
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
    input: string,
    optional?: boolean,
  ): Promise<{
    name: string
    value: JPVPlaylistDetail
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(playlistDetail)
            .where(ilike(playlistDetail.video, `%${input}%`))
          const pathes = result.map((res) => ({ name: `${res.video}(${res.video})`, value: res }))
          if (optional) {
            const jpvF: JPVPlaylistDetail = {
              createdAt: null,
              updatedAt: null,
              id: -1,
              video: -1,
              playlist: -1,
              playlistDetailType: 'video'
            }
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
    let deletePlaylistDetail: JPVPlaylistDetail
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
        if (!input) return []
        return this.searchPlaylistDetail(input)
      },
    })
    // }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(playlistDetail).where(eq(playlistDetail.id, deletePlaylistDetail.id))
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
    let updatePlaylistDetail: JPVPlaylistDetail
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
        if (!input) return []
        return this.searchPlaylistDetail(input)
      },
    })
    // }
    const ch = await this.playlistDetailForm(updatePlaylistDetail)
    await db.update(playlistDetail).set(ch).where(eq(playlistDetail.id, updatePlaylistDetail.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updatePlaylistDetail()
    }
  }


  playlistDetailForm = async (playlistDetail: JPVPlaylistDetail = {} as JPVPlaylistDetail) => {

    let video: JPVVideo | undefined;
    const playlist_detail_type = await select({
      message: 'Playlist Detail Type',
      choices: playlistDetailTypeEnum.enumValues,
    })

    if (playlist_detail_type == playlistDetailTypeEnum.enumValues[0]) {
      video = await search({
        message: 'Link of Video',
        source: async (input) => {
          if (!input) return []
          return this.video.searchVideo(input)
        },
      })
    }

    if (video) {
      playlistDetail.video = video?.id
    }
    return playlistDetail
  }

  addPlaylistDetail = async (args?: PlaylistDetailArgs) => {
    let jpvPlaylistDetail: JPVPlaylistDetail = {} as JPVPlaylistDetail;
    const form = await this.playlistDetailForm(jpvPlaylistDetail)
    await db.insert(playlistDetail).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more',
      default: true,
    })
    if (continueConfirmation) {
      await this.addPlaylistDetail()
    }
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
