import { Args, Command, Flags } from '@oclif/core'
import { filePath, Video as JPVVideo, link, video, videoTypeEnum } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ExtractTablesWithRelations } from 'drizzle-orm'
import chalk from 'chalk'
import * as fs from 'fs';
import Link from './link.js'
import FilePath from './file_path.js'
import { Link as JPVLink } from '../db/schema/jpv.js'
import { FilePath as JPVFilePath } from '../db/schema/jpv.js'
import { PgTransaction } from 'drizzle-orm/pg-core'
import { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'


interface VideoArgs {
  path?: string
}

export type Transaction = PgTransaction<NodePgQueryResultHKT, typeof import("../db/schema/jpv.js"), ExtractTablesWithRelations<typeof import("../db/schema/jpv.js")>>

const youtubeChannelRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(channel\/|@)([a-zA-Z0-9_-]+)/;

export default class Video extends Command {


  static override args = {
    path: Args.string({ description: 'It is Unique Path' }),
  }

  static override description = 'Manage JPV Videos'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Video' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Video' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Video' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Video' }),
  }

  link = new Link(this.argv, this.config);
  filePath = new FilePath(this.argv, this.config);

  timeOut: NodeJS.Timeout | undefined = undefined
  searchVideo = async (
    input: string = "",
  ): Promise<{
    name: string
    value: JPVVideo
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db.query.video.findMany(
            {
              with: {
            filePath: true,
            link: true
          }
          , where: (video, {ilike}) => ilike(video.name, `%${input}%`)
        }
        )
          resolve(result.map((res) => ({ name: `${res.name}`, value: res })))
        } catch (error) {
          console.log(error)
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  isFilePath = (path: string) => {
    if (fs.existsSync(path)) {
      return true
    } else {
      return false
    }
  }

  getVideoFromPath = async (path: string) => {
    let jpvVideo;
    if (this.isFilePath(path)) {
      jpvVideo = await db.query.video.findFirst({where: (video, {eq}) => eq(filePath.pathUrl, path)})
      if (!jpvVideo) {
        this.log(chalk.red('Their is no Video with this url'))
        this.exit(1)
      }
    } else {
      jpvVideo = await db.query.video.findFirst({where: (video, {eq}) => eq(link.url, path)})
      if (!jpvVideo) {
        this.log(chalk.red('Their is no Video with this url'))
        this.exit(1)
      }
    }
    return jpvVideo
  }

  deleteVideo = async (args?: VideoArgs) => {
    let deleteVideo: JPVVideo
    if (args?.path) {
      deleteVideo = await this.getVideoFromPath(args.path)
    } else {
      deleteVideo = await search({
        message: 'Search Video',
        source: async (input) => {
          if (!input) return []
          return this.searchVideo(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(video).where(eq(video.id, deleteVideo.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteVideo()
    }
  }

  updateVideo = async (args?: VideoArgs) => {
    let updateVideo: JPVVideo
    if (args?.path) {
      updateVideo = await this.getVideoFromPath(args.path)
    } else {
      updateVideo = await search({
        message: 'Search Video',
        source: async (input) => {
          return this.searchVideo(input)
        },
      })
    }
    await db.transaction(async (tx) => {
      const ch = await this.videoForm(tx, updateVideo)
      await db.update(video).set(ch).where(eq(video.id, updateVideo.id))
    })
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateVideo()
    }
  }

  videoForm = async (tx: Transaction, video: JPVVideo = {} as JPVVideo) => {
    let videoLink: JPVLink | undefined, videoPath: JPVFilePath | undefined;

    const video_type = await select({
      message: 'Video Type',
      choices: videoTypeEnum.enumValues,
    })

    if (video_type == videoTypeEnum.enumValues[0]) {
      videoLink = await search({
        message: 'Link of Video',
        source: async (input) => {
          if (!input) return []
          return this.link.searchLink(input, true)
        },
      })
    } else {
      videoPath = await search({
        message: 'Path of Video',
        source: async (input) => {
          if (!input) return []
          return this.filePath.searchFilePath(input, true)
        },
      })
    }

    const name = await input({
      message: 'Title of Video',
      default: video.name,
    })

    const description = await input({
      message: 'Description of Video',
      default: video.description || '',
    })

    if (video_type == videoTypeEnum.enumValues[0]) {
      if (videoLink?.id == -1) {
        const createdLink = await tx.insert(link).values({ name: name, description: description, url: videoLink.url }).returning()
        videoLink = createdLink[0]
      }
    } else {
      if (videoPath?.id == -1) {
        const createdpath = await tx.insert(filePath).values({ name: name, description: description, pathUrl: videoPath.pathUrl }).returning()
        videoPath = createdpath[0]
      }
    }

    video.videoType = video_type as any
    video.name = name
    video.description = description
    video.link = videoLink?.id || null
    video.filePath = videoPath?.id || null
    return video
  }

  addVideo = async (args?: VideoArgs) => {
    let jpvVideo: JPVVideo = {} as JPVVideo;
    await db.transaction(async (tx) => {
      const form = await this.videoForm(tx, jpvVideo)
      await tx.insert(video).values({ ...form })
    })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more',
      default: true,
    })

    if (continueConfirmation) {
      await this.addVideo()
    }
  }

  public async manageVideo() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addVideo()
        break
      }
      case actions[1]: {
        await this.updateVideo()
        break
      }
      case actions[2]: {
        await this.deleteVideo()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageVideo()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Video)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addVideo(args)
    } else if (flags.delete) {
      await this.deleteVideo(args)
    } else if (flags.update) {
      await this.updateVideo(args)
    } else if (flags.manage) {
      await this.manageVideo()
    }
    this.exit(0)
  }
}
