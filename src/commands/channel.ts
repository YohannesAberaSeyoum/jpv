import {Args, Command, Flags} from '@oclif/core'
import {input, select, search, confirm} from '@inquirer/prompts'
import {searchYoutube} from '../utils/youtube.js'
import {db} from '../db/setup.js'
import chalk from 'chalk'
import {channel} from '../db/schema/jpv.js'
import {eq, ilike} from 'drizzle-orm'
import {Channel as JPVChannel} from '../db/schema/jpv.js'
import YouTube from 'youtube-sr'

interface ChannelArgs {
  channelname?: string
}

export default class Channel extends Command {
  static override args = {
    channelname: Args.string({description: 'It is Unique Channel channelname'}),
  }

  static override description = 'Manage JPV Channels'

  static override examples = ['<%= config.bin %> <%= command.id %>']

  static override flags = {
    add: Flags.boolean({char: 'a', description: 'To Add New Channel'}),
    delete: Flags.boolean({char: 'd', description: 'To Delete Existing Channel'}),
    manage: Flags.boolean({char: 'm', description: 'To Manage Channel'}),
    update: Flags.boolean({char: 'u', description: 'To Update Existing Channel'}),
  }

  timeOut: NodeJS.Timeout | undefined = undefined
  searchChannel = (
    input: string,
  ): Promise<
    {
      name: string
      value: JPVChannel
    }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(channel)
            .where(ilike(channel.name, `%${input}%`))
          resolve(result.map((res) => ({name: res.name, value: res})))
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
        if (!input) return []
        return this.searchChannel(input)
      },
    })
    await db.delete(channel).where(eq(channel.id, youtubeChannel.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteChannel()
    }
  }

  updateChannel = async (args?: ChannelArgs) => {
    let youtubeChannel: JPVChannel
    if (args?.channelname) {
      const jpvChannel = await db.select().from(channel).where(eq(channel.channelname, args.channelname))
      if (!jpvChannel.length) {
        this.log(chalk.red('Their is no Channel with this channelname'))
        this.exit(1)
      }
      youtubeChannel = jpvChannel[0]
    } else {
      youtubeChannel = await search({
        message: 'Search Channel',
        source: async (input) => {
          if (!input) return []
          return this.searchChannel(input)
        },
      })
    }
    const ch = await this.channelForm(youtubeChannel)
    await db.update(channel).set(ch).where(eq(channel.id, youtubeChannel.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateChannel()
    }
  }

  channelForm = async (channel: JPVChannel = {} as JPVChannel) => {
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

  addChannel = async (args?: ChannelArgs) => {
    let youtubeChannel
    if (args?.channelname) {
      youtubeChannel = await YouTube.YouTube.getChannel(args.channelname)
    } else {
      const channel_type = await select({
        message: 'Select Channel Type',
        choices: ['Youtube', 'Local'] as const,
      })
      if (channel_type == 'Youtube') {
        youtubeChannel = await search({
          message: 'Search Youtube',
          source: async (input) => {
            if (!input) return []
            return searchYoutube(input, 'channel')
          },
        })
      }
    }
    if (youtubeChannel?.type == 'channel') {
      youtubeChannel.id
      const jpvChannel: JPVChannel = youtubeChannel.toJSON() as unknown as JPVChannel
      const ch = await this.channelForm(jpvChannel)
      if (youtubeChannel.id) {
        ch.targetId = youtubeChannel.id
      }
      await db.insert(channel).values({...ch, id: undefined})
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to add more',
      default: true,
    })
    if (continueConfirmation) {
      await this.addChannel()
    }
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
    const {args, flags} = await this.parse(Channel)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', {exit: 1})
    }

    if (flags.add) {
      await this.addChannel(args)
    } else if (flags.delete) {
      await this.deleteChannel()
    } else if (flags.update) {
      await this.updateChannel(args)
    } else if (flags.manage) {
      await this.manageChannel()
    }
    this.exit(0)
  }
}
