import { Args, Command, Flags } from '@oclif/core'
import { input, select, search, confirm } from '@inquirer/prompts'
import Video from './video.js';
import mpv from 'node-mpv'
import { FilePath, Link } from '../db/schema/jpv.js';

interface MpvArgs {
  url?: string
}

export default class Mpv extends Command {
  static override args = {
    url: Args.string({ description: 'It is Unique Url' }),
  }
  mpvPlayer = new (mpv as any)({"audio_only": true});

  static override description = 'Manage JPV Mpvs'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    play: Flags.boolean({ char: 'p', description: 'To Play Mpv' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Mpv' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Mpv' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Mpv' }),
  }

  video = new Video(this.argv, this.config);

  playMpv = async (args?: MpvArgs) => {
    if(args?.url){
      try {
        await this.mpvPlayer.start()
        await this.mpvPlayer.load(args.url)
      }
      catch (error) {
        // handle errors here
        console.log(error);
      }
    } else {
    const video = await search({
      message: 'Video',
      source: async (input) => {
        return this.video.searchVideo(input)
      },
    })
    if (video.link) {
      try {
        await this.mpvPlayer.start()
        await this.mpvPlayer.load((video.link as Link).url)
      }
      catch (error) {
        // handle errors here
        console.log(error);
      }
    }}
  }

  public async manageMpv() {
    const actions = ['Play', 'Update', 'Delete', 'Exit'] as const
    const action = await select({
      choices: actions,
      message: 'Action You want to Perform',
    })
    switch (action) {
      case actions[0]: {
        await this.playMpv()
        break
      }
      default:
        this.exit(0)
    }
    await this.manageMpv()
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Mpv)
    if ([flags.play, flags.delete, flags.update, flags.manage].filter(Boolean).length > 1) {
      this.error('You can only use one of --play, --delete, or --update at a time.', { exit: 1 })
    }

    if (flags.play) {
      await this.playMpv(args)
    } else if (flags.manage) {
      await this.manageMpv()
    }
    this.exit(0)
  }
}
