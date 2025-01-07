import { Args, Command, Flags } from '@oclif/core'
import { input, select, search, confirm } from '@inquirer/prompts'
import { searchYoutube } from '../utils/youtube.js'
import { db } from '../db/setup.js'
import chalk from 'chalk'
import { JpvChannel, jpvLink, JpvLink, jpvVideo, jpvChannel, channelTypeEnum } from '../db/schema/jpv.js'
import { eq, ilike } from 'drizzle-orm'
import YouTube from 'youtube-sr'
import Video, { Transaction } from './video.js'
import { Channel as YoutubeChannel } from 'youtube-sr'

interface ChannelArgs {
  channelname?: string
}

export default class Channel extends Command {
  static override args = {
    channelname: Args.string({ description: 'It is Unique Channel channelname' }),
  }

  static override description = 'Manage JPV Channels'

  static override examples = ['<%= config.bin %> <%= command.id %>']

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Channel' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Channel' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Channel' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Channel' }),
    videos: Flags.boolean({ char: 'v', description: 'To Add Videos' }),
  }

  video = new Video(this.argv, this.config);

  timeOut: NodeJS.Timeout | undefined = undefined
  searchChannel = (
    input: string = "",
    create_new: boolean = false
  ):
    Promise<{
      name: string
      value: JpvChannel
    }[]> => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvChannel)
            .where(ilike(jpvChannel.name, `%${input}%`))
          const channels = result.map((res) => ({ name: res.name, value: res }))
          if (create_new) {
            const jpvL: JpvChannel = {
              name: `Create -> ${input}`,
            } as JpvChannel
            channels.push({ name: jpvL.name, value: jpvL })
          }
          resolve(channels)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteChannel = async () => {
    const youtubeChannel = await search({
      message: 'Search Channel',
      source: async (input) => {
        return this.searchChannel(input)
      },
    })
    await db.delete(jpvChannel).where(eq(jpvChannel.id, youtubeChannel.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteChannel()
    }
  }

  delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  addVideos=async (channel_id?: string) => {
    let channel = undefined;
    if (!channel_id) {
      const youtube = await search({
        message: 'Search Channel',
        source: async (input) => {
          return this.searchChannel(input)
        },
      })
      channel = youtube.id;
      channel_id = youtube.targetId!
    } else {
      const ch = await YouTube.YouTube.getChannel(channel_id)
      const existingChannel = await db.query.jpvChannel.findFirst({where: eq(jpvChannel.channelname, ch.channelname!)})
      if(!existingChannel){
        const returnChannel = await this.addChannel(ch)
        channel = returnChannel[0].id
      } else {
        channel = existingChannel.id
      }
    }
    const videos = await YouTube.YouTube.getChannelVideos(channel_id)
    await db.transaction(async (tx) => {
      await Promise.all(videos.reverse().map(async (vid) => {
        let createdLink = await tx.query.jpvLink.findMany({ where: eq(jpvLink.url, vid.url) })
        if (!createdLink.length) {
          createdLink = await tx.insert(jpvLink).values({ name: vid.title!, description: vid.description, url: vid.url }).onConflictDoNothing().returning()
        }
        await tx.insert(jpvVideo).values({ name: vid.title!, channel: channel, description: vid.description, link: createdLink[0].id, duration: `${vid.lengthSeconds}`, videoType: 'link' }).onConflictDoNothing()
      }));
    })
  }

  updateChannel = async (args?: ChannelArgs) => {
    let youtubeChannel: JpvChannel
    if (args?.channelname) {
      const jpvC = await db.select().from(jpvChannel).where(eq(jpvChannel.channelname, args.channelname))
      if (!jpvC.length) {
        this.log(chalk.red('Their is no Channel with this channelname'))
        this.exit(1)
      }
      youtubeChannel = jpvC[0]
    } else {
      youtubeChannel = await search({
        message: 'Search Channel',
        source: async (input) => {
          return this.searchChannel(input)
        },
      })
    }
    const ch = await this.channelForm(youtubeChannel)
    await db.update(jpvChannel).set(ch).where(eq(jpvChannel.id, youtubeChannel.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateChannel()
    }
  }

  getOrInsertChannel = async (tx?: Transaction) => {
    let channel = await search({
      message: 'Channel of Playlist',
      source: async (input) => {
        return this.searchChannel(input, true)
      },
    })

    if (!channel.id) {
      const channels = await this.addChannel(channel, tx)
      channel = channels[0]
    }
    return channel;
  }

  channelForm = async (channel: JpvChannel = {} as JpvChannel, tx?: Transaction) => {
    if (!channel.channelname) {
      const channel_type = await select({
        message: 'Select Channel Type',
        choices: channelTypeEnum.enumValues,
      })
      channel.channelType = channel_type as any;
      if (channel_type == 'youtube') {
        const youtubeChannel = await search({
          message: 'Search Youtube',
          source: async (input) => {
            return searchYoutube(input, 'channel')
          },
        }) as YoutubeChannel

        channel.name = youtubeChannel.name || ""
        channel.description = youtubeChannel.description || ""
        channel.verified = youtubeChannel.verified
        channel.targetId = youtubeChannel.id || ""
        if (tx) {
          let link = await tx.insert(jpvLink).values({ name: channel.name, url: youtubeChannel.url } as JpvLink).onConflictDoNothing().returning()
          if(!link[0]){
            link = await tx.query.jpvLink.findMany({where: eq(jpvLink.url, youtubeChannel.url!)});
          }
          channel.url = link[0].id
          let iconLink = await tx.insert(jpvLink).values({ name: channel.name, url: youtubeChannel.icon.url } as JpvLink).onConflictDoNothing().returning()
          if(!iconLink[0]){
            iconLink = await tx.query.jpvLink.findMany({where: eq(jpvLink.url, youtubeChannel.icon.url!)});
          }
          channel.iconURL = iconLink[0].id
        }
      }

      if (channel_type == "local") {
        const channel_name = await input({
          message: 'Channel Name'
        })
        channel.channelname = channel_name
      }
    }

    const name = await input({
      message: 'Title of Channel',
      default: channel.name,
    })

    const description = await input({
      message: 'Description of Channel',
      default: channel.description || '',
    })
    channel.name = name
    channel.description = description
    return channel
  }

  addChannel = async (args?: ChannelArgs, tx?: Transaction, handleMultiple: boolean = true) => {
    let dx = tx || db
    let channel: JpvChannel = {} as JpvChannel
    if (args?.channelname) {
      const youtubeChannel = await YouTube.YouTube.getChannel(args.channelname);
      channel.name = youtubeChannel.name || ""
      channel.description = youtubeChannel.description || ""
      channel.verified = youtubeChannel.verified
      channel.targetId = youtubeChannel.id || ""
      if (tx) {
        let link = await tx.insert(jpvLink).values({ name: channel.name, url: youtubeChannel.url } as JpvLink).onConflictDoNothing().returning()
        if(!link[0]){
          link = await tx.query.jpvLink.findMany({where: eq(jpvLink.url, youtubeChannel.url!)});
        }
        channel.url = link[0].id
        let iconLink = await tx.insert(jpvLink).values({ name: channel.name, url: youtubeChannel.icon.url } as JpvLink).onConflictDoNothing().returning()
        if(!iconLink[0]){
          iconLink = await tx.query.jpvLink.findMany({where: eq(jpvLink.url, youtubeChannel.icon.url!)});
        }
        channel.iconURL = iconLink[0].id
      }
    }
    const ch = await this.channelForm(channel, tx)
    let channels = await dx.insert(jpvChannel).values({ ...ch }).onConflictDoNothing().returning()
    if(!channels[0]){
      channels = await dx.query.jpvChannel.findMany({where: eq(jpvChannel.channelname, ch.channelname!)});
    }
    if (handleMultiple) {
      const continueConfirmation = await confirm({
        message: 'Do you want to add more channel',
        default: true,
      })
      if (continueConfirmation) {
        await this.addChannel()
      }
    }
    return channels;
  }

  public async manageChannel() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addChannel()
        break
      }
      case actions[1]: {
        await this.updateChannel()
        break
      }
      case actions[2]: {
        await this.deleteChannel()
        break
      }
      default:
        this.exit(0)
    }
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Channel)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addChannel(args)
    } else if (flags.delete) {
      await this.deleteChannel()
    } else if (flags.update) {
      await this.updateChannel(args)
    } else if (flags.manage) {
      await this.manageChannel()
    } else if (flags.videos) {
      await this.addVideos()
    }
    this.exit(0)
  }
}
