import { Args, Command, Flags } from '@oclif/core'
import { VideoProgress as JPVVideoProgress, videoProgress, watchContextEnum, JpvVideo } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import Video from './video.js'

interface VideoProgressArgs {
  // pathUrl?: string
}

export default class VideoProgress extends Command {
  static override args = {
    // pathUrl: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV VideoProgresss'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New VideoProgress' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing VideoProgress' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage VideoProgress' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing VideoProgress' }),
  }

  video = new Video(this.argv, this.config);
  timeOut: NodeJS.Timeout | undefined = undefined
  searchVideoProgress = async (
    input: string = "",
    optional?: boolean,
  ): Promise<{
    name: string
    value: JPVVideoProgress
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(videoProgress)
            .where(ilike(videoProgress.video, `%${input}%`))
          const pathes = result.map((res) => ({ name: `${res.video}(${res.video})`, value: res }))
          if (optional) {
            const jpvF: JPVVideoProgress = {
              createdAt: null,
              updatedAt: null,
              id: -1,
              video: -1,
              playlist: -1,
              watch_context: 'CHANNEL',
              channel: -1,
              last_position: '0',
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

  deleteVideoProgress = async (args?: VideoProgressArgs) => {
    let deleteVideoProgress: JPVVideoProgress
    // if (args?.pathUrl) {
    //   const jpvVideoProgress = await db.select().from(videoProgress).where(eq(videoProgress., args.pathUrl))
    //   if (!jpvVideoProgress.length) {
    //     this.log(chalk.red('Their is no VideoProgress with this pathUrl'))
    //     this.exit(1)
    //   }
    //   deleteVideoProgress = jpvVideoProgress[0]
    // } else {
    deleteVideoProgress = await search({
      message: 'Search VideoProgress',
      source: async (input) => {
        return this.searchVideoProgress(input)
      },
    })
    // }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(videoProgress).where(eq(videoProgress.id, deleteVideoProgress.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteVideoProgress()
    }
  }

  updateVideoProgress = async (args?: VideoProgressArgs) => {
    let updateVideoProgress: JPVVideoProgress
    // if (args?.pathUrl) {
    //   const jpvVideoProgress = await db.select().from(videoProgress).where(eq(videoProgress.pathUrl, args.pathUrl))
    //   if (!jpvVideoProgress.length) {
    //     this.log(chalk.red('Their is no VideoProgress with this pathUrl'))
    //     this.exit(1)
    //   }
    //   updateVideoProgress = jpvVideoProgress[0]
    // } else {
    updateVideoProgress = await search({
      message: 'Search VideoProgress',
      source: async (input) => {
        return this.searchVideoProgress(input)
      },
    })
    // }
    const ch = await this.videoProgressForm(updateVideoProgress)
    await db.update(videoProgress).set(ch).where(eq(videoProgress.id, updateVideoProgress.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateVideoProgress()
    }
  }


  videoProgressForm = async (videoProgress: JPVVideoProgress = {} as JPVVideoProgress) => {

    let video: JpvVideo | undefined;
    const playlist_detail_type = await select({
      message: 'Playlist Detail Type',
      choices: watchContextEnum.enumValues,
    })

    if (playlist_detail_type == watchContextEnum.enumValues[0]) {
      video = await search({
        message: 'Link of Video',
        source: async (input) => {
          return this.video.searchVideo(input)
        },
      })
    }

    if (video) {
      videoProgress.video = video?.id
    }
    return videoProgress
  }

  addVideoProgress = async (args?: VideoProgressArgs) => {
    let jpvVideoProgress: JPVVideoProgress = {} as JPVVideoProgress;
    const form = await this.videoProgressForm(jpvVideoProgress)
    await db.insert(videoProgress).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more progress',
      default: true,
    })
    if (continueConfirmation) {
      await this.addVideoProgress()
    }
  }

  public async manageVideoProgress() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addVideoProgress()
        break
      }
      case actions[1]: {
        await this.updateVideoProgress()
        break
      }
      case actions[2]: {
        await this.deleteVideoProgress()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageVideoProgress()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(VideoProgress)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addVideoProgress(args)
    } else if (flags.delete) {
      await this.deleteVideoProgress(args)
    } else if (flags.update) {
      await this.updateVideoProgress(args)
    } else if (flags.manage) {
      await this.manageVideoProgress()
    }
    this.exit(0)
  }
}
