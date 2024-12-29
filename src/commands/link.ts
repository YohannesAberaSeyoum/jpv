import { Args, Command, Flags } from '@oclif/core'
import { JpvLink, jpvLink } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'

interface LinkArgs {
  url?: string
}

export default class Link extends Command {
  static override args = {
    url: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV Links'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Link' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Link' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Link' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Link' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined

  searchLink = async (
    input: string = "",
    optional?: boolean,
  ): Promise<{
    name: string
    value: JpvLink
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvLink)
            .where(ilike(jpvLink.name, `%${input}%`))
          const links = result.map((res) => ({ name: `${res.name}(${res.url})`, value: res }))
          if(optional){
            const jpvL: JpvLink = {
              name: `Create -> ${input}`,
              description: '',
              createdAt: null,
              updatedAt: null,
              url: input,
              id: -1,
            } 
            links.push({name: jpvL.name, value: jpvL})
          }
          resolve(links)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteLink = async (args?: LinkArgs) => {
    let deleteLink: JpvLink
    if (args?.url) {
      const jpvL = await db.select().from(jpvLink).where(eq(jpvLink.url, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Link with this url'))
        this.exit(1)
      }
      deleteLink = jpvL[0]
    } else {
      deleteLink = await search({
        message: 'Search Link',
        source: async (input) => {
          return this.searchLink(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvLink).where(eq(jpvLink.id, deleteLink.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteLink()
    }
  }

  updateLink = async (args?: LinkArgs) => {
    let updateLink: JpvLink
    if (args?.url) {
      const jpvL = await db.select().from(jpvLink).where(eq(jpvLink.url, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Link with this url'))
        this.exit(1)
      }
      updateLink = jpvL[0]
    } else {
      updateLink = await search({
        message: 'Search Link',
        source: async (input) => {
          return this.searchLink(input)
        },
      })
    }
    const ch = await this.linkForm(updateLink)
    await db.update(jpvLink).set(ch).where(eq(jpvLink.id, updateLink.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateLink()
    }
  }

  linkForm = async (link: JpvLink = {} as JpvLink) => {

    const url = await input({
      message: 'URL',
      default: link.url || '',
    })

    const name = await input({
      message: 'Title of Link',
      default: link.name,
    })

    const description = await input({
      message: 'Description of Link',
      default: link.description || '',
    })
    link.name = name
    link.description = description
    link.url = url
    return link
  }

  addLink = async (args?: LinkArgs) => {
    let jpvL: JpvLink = { url: args?.url || "" } as JpvLink;
    const form = await this.linkForm(jpvL)
    await db.insert(jpvLink).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more links',
      default: true,
    })
    if (continueConfirmation) {
      await this.addLink()
    }
  }

  public async manageLink() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addLink()
        break
      }
      case actions[1]: {
        await this.updateLink()
        break
      }
      case actions[2]: {
        await this.deleteLink()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageLink()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Link)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addLink(args)
    } else if (flags.delete) {
      await this.deleteLink(args)
    } else if (flags.update) {
      await this.updateLink(args)
    } else if (flags.manage) {
      await this.manageLink()
    }
    this.exit(0)
  }
}
