import { Args, Command, Flags } from '@oclif/core'
import { Playlist as JPVPlaylist, playlist } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'

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
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Playlist' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined

  searchPlaylist = async (
    input: string,
    optional?: boolean,
  ): Promise<{
    name: string
    value: JPVPlaylist
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(playlist)
            .where(ilike(playlist.name, `%${input}%`))
          const playlists = result.map((res) => ({ name: `${res.name}(${res.name})`, value: res }))
          if(optional){
            const jpvL: JPVPlaylist = {
              name: `Create -> ${input}`,
              description: '',
              createdAt: null,
              updatedAt: null,
              id: -1,
            } 
            playlists.push({name: jpvL.name, value: jpvL})
          }
          resolve(playlists)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deletePlaylist = async (args?: PlaylistArgs) => {
    let deletePlaylist: JPVPlaylist
    if (args?.name) {
      const jpvPlaylist = await db.select().from(playlist).where(eq(playlist.name, args.name))
      if (!jpvPlaylist.length) {
        this.log(chalk.red('Their is no Playlist with this name'))
        this.exit(1)
      }
      deletePlaylist = jpvPlaylist[0]
    } else {
      deletePlaylist = await search({
        message: 'Search Playlist',
        source: async (input) => {
          if (!input) return []
          return this.searchPlaylist(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(playlist).where(eq(playlist.id, deletePlaylist.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deletePlaylist()
    }
  }

  updatePlaylist = async (args?: PlaylistArgs) => {
    let updatePlaylist: JPVPlaylist
    if (args?.name) {
      const jpvPlaylist = await db.select().from(playlist).where(eq(playlist.name, args.name))
      if (!jpvPlaylist.length) {
        this.log(chalk.red('Their is no Playlist with this url'))
        this.exit(1)
      }
      updatePlaylist = jpvPlaylist[0]
    } else {
      updatePlaylist = await search({
        message: 'Search Playlist',
        source: async (input) => {
          if (!input) return []
          return this.searchPlaylist(input)
        },
      })
    }
    const ch = await this.playlistForm(updatePlaylist)
    await db.update(playlist).set(ch).where(eq(playlist.id, updatePlaylist.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updatePlaylist()
    }
  }

  playlistForm = async (playlist: JPVPlaylist = {} as JPVPlaylist) => {

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

  addPlaylist = async (args?: PlaylistArgs) => {
    let jpvPlaylist: JPVPlaylist = { name: args?.name || "" } as JPVPlaylist;
    const form = await this.playlistForm(jpvPlaylist)
    await db.insert(playlist).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more',
      default: true,
    })
    if (continueConfirmation) {
      await this.addPlaylist()
    }
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
      await this.addPlaylist(args)
    } else if (flags.delete) {
      await this.deletePlaylist(args)
    } else if (flags.update) {
      await this.updatePlaylist(args)
    } else if (flags.manage) {
      await this.managePlaylist()
    }
    this.exit(0)
  }
}
