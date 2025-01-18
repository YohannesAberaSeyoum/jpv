import { Args, Command, Flags } from '@oclif/core'
import { JpvTutorialProject, jpvTutorialProject } from '../db/schema/jpv.js'
import { input, select, search, confirm } from '@inquirer/prompts'
import { db } from '../db/setup.js'
import { eq, ilike } from 'drizzle-orm'
import chalk from 'chalk'

interface TutorialProjectArgs {
  project?: number
}

export default class TutorialProject extends Command {
  static override args = {
    project: Args.integer({ description: 'It is Unique Url' }),
  }

  static override description = 'Manage JPV TutorialProjects'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    add: Flags.boolean({ char: 'a', description: 'To Add New TutorialProject' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing TutorialProject' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage TutorialProject' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing TutorialProject' }),
  }

  timeOut: NodeJS.Timeout | undefined = undefined

  searchTutorialProject = async (
    input: string = "",
    optional?: boolean,
  ): Promise<{
    title: string
    value: JpvTutorialProject
  }[]
  > => {
    return new Promise((resolve, reject) => {
      clearTimeout(this.timeOut)

      this.timeOut = setTimeout(async () => {
        try {
          const result = await db
            .select()
            .from(jpvTutorialProject)
            .where(ilike(jpvTutorialProject.project, `%${input}%`))
          const tutorialprojects = result.map((res) => ({ title: `${res.project}(${res.tutorial})`, value: res }))
          if(optional){
            const jpvL: JpvTutorialProject = {
              tutorial: null,
              project: null,
              createdAt: null,
              updatedAt: null,
              id: -1,
            } 
            tutorialprojects.push({title:`${jpvL.project}`, value: jpvL})
          }
          resolve(tutorialprojects)
        } catch (error) {
          resolve([])
        }
      }, 1000) // Simulate delay of 1 second
    })
  }

  deleteTutorialProject = async (args?: TutorialProjectArgs) => {
    let deleteTutorialProject: JpvTutorialProject
    if (args?.project) {
      const jpvL = await db.select().from(jpvTutorialProject).where(eq(jpvTutorialProject.project, args.project!))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no TutorialProject with this url'))
        this.exit(1)
      }
      deleteTutorialProject = jpvL[0]
    } else {
      deleteTutorialProject = await search({
        message: 'Search TutorialProject',
        source: async (input) => {
          return this.searchTutorialProject(input)
        },
      })
    }
    const deleteConfirmation = await confirm({
      message: 'Are you sure to delete this',
      default: false,
    })
    if (deleteConfirmation) {
      await db.delete(jpvTutorialProject).where(eq(jpvTutorialProject.id, deleteTutorialProject.id))
    }
    const continueConfirmation = await confirm({
      message: 'Do you want to delete more',
      default: true,
    })
    if (continueConfirmation) {
      await this.deleteTutorialProject()
    }
  }

  updateTutorialProject = async (args?: TutorialProjectArgs) => {
    let updateTutorialProject: JpvTutorialProject
    if (args?.project) {
      const jpvL = await db.select().from(jpvTutorialProject).where(eq(jpvTutorialProject.project, args.project))
      if (!jpvL.length) {
        this.log(chalk.red('Their is no TutorialProject with this url'))
        this.exit(1)
      }
      updateTutorialProject = jpvL[0]
    } else {
      updateTutorialProject = await search({
        message: 'Search TutorialProject',
        source: async (input) => {
          return this.searchTutorialProject(input)
        },
      })
    }
    const ch = await this.tutorialprojectForm(updateTutorialProject)
    await db.update(jpvTutorialProject).set(ch).where(eq(jpvTutorialProject.id, updateTutorialProject.id))
    const continueConfirmation = await confirm({
      message: 'Do you want to update more',
      default: true,
    })
    if (continueConfirmation) {
      await this.updateTutorialProject()
    }
  }

  tutorialprojectForm = async (tutorialproject: JpvTutorialProject = {} as JpvTutorialProject) => {

    // const name = await input({
    //   message: 'Title of TutorialProject',
    //   default: tutorialproject.pro,
    // })

    // const description = await input({
    //   message: 'Description of TutorialProject',
    //   default: tutorialproject.description || '',
    // })


    // const author = await input({
    //   message: 'Author',
    //   default: tutorialproject.author || '',
    // })

    // tutorialproject.title = name
    // tutorialproject.description = description
    // tutorialproject.author = author
    return tutorialproject
  }

  addTutorialProject = async (args?: TutorialProjectArgs) => {
    let jpvL: JpvTutorialProject = { project: args?.project || 0 } as JpvTutorialProject;
    const form = await this.tutorialprojectForm(jpvL)
    await db.insert(jpvTutorialProject).values({ ...form })
    const continueConfirmation = await confirm({
      message: 'Do you want to add more tutorialprojects',
      default: true,
    })
    if (continueConfirmation) {
      await this.addTutorialProject()
    }
  }

  public async manageTutorialProject() {
    const actions = ['Add', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.addTutorialProject()
        break
      }
      case actions[1]: {
        await this.updateTutorialProject()
        break
      }
      case actions[2]: {
        await this.deleteTutorialProject()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageTutorialProject()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TutorialProject)
    if ([flags.add, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --add, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.add) {
      await this.addTutorialProject(args)
    } else if (flags.delete) {
      await this.deleteTutorialProject(args)
    } else if (flags.update) {
      await this.updateTutorialProject(args)
    } else if (flags.manage) {
      await this.manageTutorialProject()
    }
    this.exit(0)
  }
}
