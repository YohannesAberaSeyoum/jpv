import { Args, Command, Flags } from '@oclif/core'
import { FilePath as JPVFilePath, filePath } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'
import path from 'path'

interface FilePathArgs {
  pathUrl?: string
}

export default class FilePath extends Command {
  static override args = {
    pathUrl: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV FilePaths'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New FilePath' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing FilePath' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage FilePath' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing FilePath' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined
  searchFilePath = async (
    input: string,
    optional?: boolean,
  ): Promise<{
    name: string
    value: JPVFilePath
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(filePath)
            .where(ilike(filePath.name, `%${input}%`))
          const pathes = result.map((res) => ({ name: `${res.name}(${res.pathUrl})`, value: res }))
          if(optional){
            const jpvF: JPVFilePath = {
              name: `Create -> ${input}`,
              description: '',
              createdAt: null,
              updatedAt: null,
              pathUrl: input,
              id: -1,
              size: null,
              parent: null
            } 
            pathes.push({name: jpvF.name, value: jpvF})
          }
          resolve(pathes)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteFilePath = async (args?: FilePathArgs) => {
    let deleteFilePath: JPVFilePath
    if (args?.pathUrl) {
      const jpvFilePath = await db.select().from(filePath).where(eq(filePath.pathUrl, args.pathUrl))
      if (!jpvFilePath.length) {
        this.log(chalk.red('Their is no FilePath with this pathUrl'))
        this.exit(1)
      }
      deleteFilePath = jpvFilePath[0]
    } else {
      deleteFilePath = await search({
        message: 'Search FilePath',
        source: async (input) => {
          if (!input) return []
          return this.searchFilePath(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(filePath).where(eq(filePath.id, deleteFilePath.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteFilePath()
    }
  }

  updateFilePath = async (args?: FilePathArgs) => {
    let updateFilePath: JPVFilePath
    if (args?.pathUrl) {
      const jpvFilePath = await db.select().from(filePath).where(eq(filePath.pathUrl, args.pathUrl))
      if (!jpvFilePath.length) {
        this.log(chalk.red('Their is no FilePath with this pathUrl'))
        this.exit(1)
      }
      updateFilePath = jpvFilePath[0]
    } else {
      updateFilePath = await search({
        message: 'Search FilePath',
        source: async (input) => {
          if (!input) return []
          return this.searchFilePath(input)
        },
      })
    }
    const ch = await this.filePathForm(updateFilePath)
    await db.update(filePath).set(ch).where(eq(filePath.id, updateFilePath.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateFilePath()
    }
  }

  filePathForm = async (filePath: JPVFilePath = {} as JPVFilePath) => {

    const pathUrl = await input({
      message: 'File Path',
      default: filePath.pathUrl || '',
    })

    const fileName = path.basename(pathUrl);

    const name = await input({
      message: 'Title of FilePath',
      default: filePath.name || fileName,
    })

    const description = await input({
      message: 'Description of FilePath',
      default: filePath.description || '',
    })

    filePath.name = name
    filePath.description = description
    filePath.pathUrl = pathUrl
    return filePath
  }

  addFilePath = async (args?: FilePathArgs) => {
    let jpvFilePath: JPVFilePath = { pathUrl: args?.pathUrl || "" } as JPVFilePath;
    const form = await this.filePathForm(jpvFilePath)
    await db.insert(filePath).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more',
      default: true,
    })
    if (continueConfirmation) {
      await this.addFilePath()
    }
  }

  public async manageFilePath() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addFilePath()
        break
      }
      case actions[1]: {
        await this.updateFilePath()
        break
      }
      case actions[2]: {
        await this.deleteFilePath()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageFilePath()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(FilePath)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addFilePath(args)
    } else if (flags.delete) {
      await this.deleteFilePath(args)
    } else if (flags.update) {
      await this.updateFilePath(args)
    } else if (flags.manage) {
      await this.manageFilePath()
    }
    this.exit(0)
  }
}
