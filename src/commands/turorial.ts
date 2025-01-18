import { Args, Command, Flags } from '@oclif/core'
import { JpvTutorial, jpvTutorial } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'
import Playlist from './playlist.js'

interface TutorialArgs {
  url?: string
}

export default class Tutorial extends Command {
  static override args = {
    url: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV Tutorials'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Tutorial' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Tutorial' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Tutorial' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Tutorial' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined
  jpvPlaylist: Playlist = new Playlist(this.argv, this.config)

  searchTutorial = async (
    input: string = "",
    optional?: boolean,
  ): Promise<{
    title: string
    value: JpvTutorial
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvTutorial)
            .where(ilike(jpvTutorial.title, `%${input}%`))
          const tutorials = result.map((res) => ({ title: `${res.title}(${res.author})`, value: res }))
          if(optional){
            const jpvL: JpvTutorial = {
              title: `Create -> ${input}`,
              description: '',
              createdAt: null,
              updatedAt: null,
              author: input,
              playlist: null,
              id: -1,
            } 
            tutorials.push({title: jpvL.title, value: jpvL})
          }
          resolve(tutorials)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteTutorial = async (args?: TutorialArgs) => {
    let deleteTutorial: JpvTutorial
    if (args?.url) {
      const jpvL = await db.select().from(jpvTutorial).where(eq(jpvTutorial.title, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Tutorial with this url'))
        this.exit(1)
      }
      deleteTutorial = jpvL[0]
    } else {
      deleteTutorial = await search({
        message: 'Search Tutorial',
        source: async (input) => {
          return this.searchTutorial(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvTutorial).where(eq(jpvTutorial.id, deleteTutorial.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteTutorial()
    }
  }

  updateTutorial = async (args?: TutorialArgs) => {
    let updateTutorial: JpvTutorial
    if (args?.url) {
      const jpvL = await db.select().from(jpvTutorial).where(eq(jpvTutorial.title, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Tutorial with this url'))
        this.exit(1)
      }
      updateTutorial = jpvL[0]
    } else {
      updateTutorial = await search({
        message: 'Search Tutorial',
        source: async (input) => {
          return this.searchTutorial(input)
        },
      })
    }
    const ch = await this.tutorialForm(updateTutorial)
    await db.update(jpvTutorial).set(ch).where(eq(jpvTutorial.id, updateTutorial.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateTutorial()
    }
  }

  tutorialForm = async (tutorial: JpvTutorial = {} as JpvTutorial) => {

    const name = await input({
      message: 'Title of Tutorial',
      default: tutorial.title,
    })

    const description = await input({
      message: 'Description of Tutorial',
      default: tutorial.description || '',
    })


    const author = await input({
      message: 'Author',
      default: tutorial.author || '',
    })

    const playlist = await search({
      message: 'Playlist',
      source: async (input) => {
        return this.jpvPlaylist.searchPlaylist(input)
      },
    })

    tutorial.title = name
    tutorial.description = description
    tutorial.author = author
    return tutorial
  }

  addTutorial = async (args?: TutorialArgs) => {
    let jpvL: JpvTutorial = { title: args?.url || "" } as JpvTutorial;
    const form = await this.tutorialForm(jpvL)
    await db.insert(jpvTutorial).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more tutorials',
      default: true,
    })
    if (continueConfirmation) {
      await this.addTutorial()
    }
  }

  public async manageTutorial() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addTutorial()
        break
      }
      case actions[1]: {
        await this.updateTutorial()
        break
      }
      case actions[2]: {
        await this.deleteTutorial()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageTutorial()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Tutorial)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addTutorial(args)
    } else if (flags.delete) {
      await this.deleteTutorial(args)
    } else if (flags.update) {
      await this.updateTutorial(args)
    } else if (flags.manage) {
      await this.manageTutorial()
    }
    this.exit(0)
  }
}
