import { Args, Command, Flags } from '@oclif/core'
import { jpvFilePath, JpvProject, jpvProject } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'
import fileSelector from 'inquirer-file-selector'
import { Transaction } from './video.js'
import path from 'path'
import { projectInit } from '../utils/project_init.js'

interface ProjectArgs {
  url?: string
}

export default class Project extends Command {
  static override args = {
    url: Args.string({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV Projects'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New Project' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Project' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Project' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Project' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined

  searchProject = async (
    input: string = "",
    optional?: boolean,
  ): Promise<{
    title: string
    value: JpvProject
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvProject)
            .where(ilike(jpvProject.title, `%${input}%`))
          const projects = result.map((res) => ({ title: `${res.title}(${res.filePath})`, value: res }))
          if(optional){
            const jpvL: JpvProject = {
              title: `Create -> ${input}`,
              description: '',
              createdAt: null,
              updatedAt: null,
              filePath: null,
              id: -1,
            } 
            projects.push({title: jpvL.title, value: jpvL})
          }
          resolve(projects)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteProject = async (args?: ProjectArgs) => {
    let deleteProject: JpvProject
    if (args?.url) {
      const jpvL = await db.select().from(jpvProject).where(eq(jpvProject.title, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Project with this url'))
        this.exit(1)
      }
      deleteProject = jpvL[0]
    } else {
      deleteProject = await search({
        message: 'Search Project',
        source: async (input) => {
          return this.searchProject(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvProject).where(eq(jpvProject.id, deleteProject.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteProject()
    }
  }

  updateProject = async (args?: ProjectArgs) => {
    let updateProject: JpvProject
    if (args?.url) {
      const jpvL = await db.select().from(jpvProject).where(eq(jpvProject.title, args.url))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no Project with this url'))
        this.exit(1)
      }
      updateProject = jpvL[0]
    } else {
      updateProject = await search({
        message: 'Search Project',
        source: async (input) => {
          return this.searchProject(input)
        },
      })
    }
    const ch = await this.projectForm(updateProject)
    await db.update(jpvProject).set(ch).where(eq(jpvProject.id, updateProject.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateProject()
    }
  }

  projectForm = async (project: JpvProject = {} as JpvProject, tx?: Transaction) => {

    const name = await input({
      message: 'Title of Project',
      default: project.title,
    })

    const description = await input({
      message: 'Description of Project',
      default: project.description || '',
    })


    const filePath  = await fileSelector({
      message: "Enter the path to initialize Git:",
      type: 'directory'
    })

    project.title = name
    project.description = description
    const directory = path.parse(filePath)
    if (tx) {
      let file = await tx.insert(jpvFilePath).values({ name: directory.base, pathUrl: filePath }).onConflictDoNothing().returning()
      if(!file[0]){
        file = await tx.query.jpvFilePath.findMany({where: eq(jpvFilePath.pathUrl, filePath)});
      }
      project.filePath = file[0].id
    }
    return project
  }

  addProject = async (args?: ProjectArgs, tx?: Transaction, handleMultiple: boolean = true) => {
    let jpvL: JpvProject = { title: args?.url || "" } as JpvProject;
    const form = await this.projectForm(jpvL, tx)
    await db.insert(jpvProject).values({ ...form })
    if(form.filePath){
      const jpvFile = await db.query.jpvFilePath.findFirst({where: eq(jpvFilePath.id, form.filePath)})
      await projectInit(jpvFile)
    }
    if (handleMultiple) {
      const continueConfirmation = await confirm({
        message: 'Do you want to add more projects',
        default: true,
      })
      if (continueConfirmation) {
        await this.addProject()
      }
    }
  }

  addTransactionProject = async(args?: ProjectArgs) => {
      await db.transaction(async(tx) => {
        await this.addProject(args, tx)
      })
    }

  public async manageProject() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addProject()
        break
      }
      case actions[1]: {
        await this.updateProject()
        break
      }
      case actions[2]: {
        await this.deleteProject()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageProject()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Project)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addTransactionProject(args)
    } else if (flags.delete) {
      await this.deleteProject(args)
    } else if (flags.update) {
      await this.updateProject(args)
    } else if (flags.manage) {
      await this.manageProject()
    }
    this.exit(0)
  }
}
