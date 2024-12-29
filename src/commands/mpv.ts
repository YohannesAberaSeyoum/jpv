import { Args, Command, Flags } from '@oclif/core'
import { input, select, search, confirm } from '@inquirer/prompts'
import Video from './video.js';
import mpv from 'node-mpv'
import { db } from '../db/setup.js'
import { JpvLink, videoProgress, JpvVideo, JpvChannel, JpvPlaylist, watchContextEnum, jpvChannel, jpvVideo, JpvFilePath, jpvPlaylistDetail, jpvPlaylist, jpvLink, jpvFilePath, JpvPlaylistDetail } from '../db/schema/jpv.js';
// import readline from 'readline';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import Channel from './channel.js';
import path from 'path';
import Playlist from './playlist.js';

interface MpvArgs {
  url?: string
}

export enum WatchContext {
  CHANNEL = "CHANNEL",
  PLAYLIST = "PLAYLIST",
  VIDEO = "VIDEO",
}

export default class Mpv extends Command {
  static override args = {
    url: Args.string({ description: 'It is Unique Url' }),
  }
  mpvPlayer = new (mpv as any)({ "audio_only": true});
  progressInterval: NodeJS.Timeout | null = null;
  positionProgressInterval: NodeJS.Timeout | null = null;
  isAudioOnly = true;
  volume = 75;
  currentVideo: JpvVideo | null = null;
  currentDetail: JpvPlaylistDetail | null = null;
  currentPlaylist: JpvPlaylist | null = null;
  currentChannel: JpvChannel | null = null;
  watch_context: WatchContext | undefined

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
  channel = new Channel(this.argv, this.config);
  playlist = new Playlist(this.argv, this.config);

  async keyboardControlMpv() {
    console.log('Controls:');
    console.log('  Space: Pause/Resume');
    console.log('  +: Volume Up');
    console.log('  -: Volume Down');
    console.log('  Arrow Right: Seek Forward');
    console.log('  Arrow Left: Seek Backward');
    console.log('  A: Toggle Audio-Only Mode');
    console.log('  N: Play Next');
    console.log('  P: Play Prev');
    console.log('  Q: Quit');
  
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
  
    const handleKeypress = async (str: string) => {
      try {
        switch (str) {
          case ' ':
            await this.mpvPlayer.togglePause();
            await this.savePositionProgress();
            break;
          case '\u0003': // Ctrl+C
          case 'q':
            await cleanupAndExit();
            break;
          case '\u001b[C': // Arrow Right
            await this.mpvPlayer.seek(10);
            await this.savePositionProgress();
            await this.displayProgress();
            break;
          case '\u001b[D': // Arrow Left
            await this.mpvPlayer.seek(-10);
            await this.savePositionProgress();
            await this.displayProgress();
            break;
          case '+':
            this.volume = Math.min(100, this.volume + 10);
            await this.mpvPlayer.volume(this.volume);
            break;
          case '-':
            this.volume = Math.max(0, this.volume - 10);
            await this.mpvPlayer.volume(this.volume);
            break;
          case 'a':
          case 'A':
            await this.toggleAudioOnly();
            break;
          case 'n':
          case 'N':
            await this.playNext();
            await this.savePositionProgress();
            break;
          case 'p':
          case 'P':
            await this.playPrev();
            await this.savePositionProgress();
            break;
          default:
            console.log('Unknown command:', str);
        }
      } catch (error) {
        console.error('Error handling keypress:', error);
      }
    };
  
    const cleanupAndExit = async () => {
      try {
        await this.savePositionProgress();
        await this.mpvPlayer.quit();
        this.stopRealTimeProgress();
        process.stdin.removeListener('data', handleKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.exit(0);
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };
  
    process.stdin.on('data', handleKeypress);
  }
  

  async playNext() {
    try {

      if(!this.currentVideo?.createdAt){
        return;
      }
      let equal;
      if (this.watch_context === 'VIDEO') {
        await this.savePositionProgress(true)
        process.exit(0)
      }
      let nextVideo;
      if (this.watch_context === 'CHANNEL') {
        nextVideo = await db.query.jpvVideo.findFirst({
          where: and(eq(jpvVideo.channel, this.currentChannel?.id!), gt(jpvVideo.id, this.currentVideo.id)),
          orderBy: [desc(jpvVideo.createdAt), asc(jpvVideo.id)],
          with: {
            link: true,
            filePath: true
          }
        })
      }
      if(this.watch_context === 'PLAYLIST'){
        const detail = await db.query.jpvPlaylistDetail.findFirst({
          where: and(eq(jpvPlaylistDetail.playlist, this.currentPlaylist?.id!), gt(jpvPlaylistDetail.order, (this.currentDetail as JpvPlaylistDetail).order!)),
          orderBy: [asc(jpvPlaylistDetail.order)],
          with: {
            video: {with: {filePath: true, link: true}},
          }
        })
        if(detail){
          nextVideo = detail?.video
          this.currentDetail = detail;
        }
      }
      if(nextVideo){
        this.currentVideo = nextVideo
        if(this.mpvPlayer.stopped){
          await this.mpvPlayer.start()
        }
        if(nextVideo.link){
          await this.mpvPlayer.load((nextVideo?.link as JpvLink)?.url);
        } else {
          await this.mpvPlayer.load((nextVideo?.filePath as JpvFilePath)?.pathUrl)
        }
        await this.displayAudioInfo()
      } else {
        await this.savePositionProgress()
        process.exit(0)
      }
    } catch (error) {
      
    }

  }

  async playPrev() {
    if(!this.currentVideo?.createdAt){
      return;
    }
    let equal;
    if (this.watch_context === 'VIDEO') {
      await this.savePositionProgress(true)
      return;
    }
    let prevVideo;
    if (this.watch_context === 'CHANNEL') {
      prevVideo = await db.query.jpvVideo.findFirst({
        where: and(eq(jpvVideo.channel, this.currentChannel?.id!), lt(jpvVideo.id, this.currentVideo.id)),
        orderBy: [asc(jpvVideo.createdAt), desc(jpvVideo.id)],
        with: {
          link: true,
          filePath: true
        }
      })
    }
    if(this.watch_context === 'PLAYLIST'){
      const detail = await db.query.jpvPlaylistDetail.findFirst({
        where: and(eq(jpvPlaylistDetail.playlist, this.currentPlaylist?.id!), lt(jpvPlaylistDetail.order, (this.currentDetail as JpvPlaylistDetail).order!)),
        orderBy: [desc(jpvPlaylistDetail.order)],
        with: {
          video: {with: {filePath: true, link: true}},
        }
      })
      if(detail){
        prevVideo = detail?.video
        this.currentDetail = detail;
      }
    }
    if(prevVideo){
      this.currentVideo = prevVideo
        if(this.mpvPlayer.stopped){
          await this.mpvPlayer.start()
        }
        if(prevVideo.link){
          await this.mpvPlayer.load((prevVideo?.link as JpvLink)?.url);
        } else {
          await this.mpvPlayer.load((prevVideo?.filePath as JpvFilePath)?.pathUrl)
        }
      await this.displayAudioInfo()
    }
  }

  startRealTimeProgress() {
    this.progressInterval = setInterval(async () => {
      await this.displayProgress();
    }, 1000);
  }

  stopRealTimeProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  startRealTimePositionProgress() {
    this.positionProgressInterval = setInterval(async () => {
      await this.savePositionProgress();
    }, 10000);
  }

  stopRealTimePositionProgress() {
    if (this.positionProgressInterval) {
      clearInterval(this.positionProgressInterval);
      this.positionProgressInterval = null;
    }
  }

  async toggleAudioOnly() {
    this.isAudioOnly = !this.isAudioOnly;
    await this.setAudioOnly(this.isAudioOnly);
  }

  private async setAudioOnly(audioOnly: boolean) {
    await this.mpvPlayer.setProperty('vid', audioOnly ? 'no' : 'auto');
  }

  async displayProgress() {
    try {
      if(this.mpvPlayer && this.mpvPlayer.isRunning()){
      const currentTime = await this.mpvPlayer.getProperty('time-pos');
      const duration = await this.mpvPlayer.getProperty('duration');
      process.stdout.write(`\rCurrent Time: ${this.formatTime(currentTime)} / ${this.formatTime(duration)}`);}
    } catch (error: any) {
      return;
    }
  }

  async savePositionProgress(stopPosition: boolean = false) {
    try {
      if (!stopPosition && (this.mpvPlayer && !await this.mpvPlayer.getProperty)){
        return;
      }
      let currentTime;
      try {
         currentTime = stopPosition ? 0 : await this.mpvPlayer.getProperty('time-pos');
      } catch (error) {
        return;
      }
      await db.insert(videoProgress).values({ channel: this.currentChannel?.id, playlist: this.currentPlaylist?.id, video: this.currentVideo?.id, watch_context: this.watch_context, last_position: currentTime })
        .onConflictDoUpdate({
          target: [videoProgress.video, videoProgress.watch_context],
          set: {
            last_position: currentTime
          }
        })
    } catch (error) {
      console.log(stopPosition)
      console.log('Error retrieving playback progress1:', error);
    }
  }

  formatTime(seconds: number | null): string {
    if (seconds === null) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    // Pad with leading zeros
    const formattedTime = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0'),
    ].join(':');

    return formattedTime;
  }

  async controlMpv() {
    const controlActions = [
      'Pause/Resume', 'Stop', 'Volume Up', 'Volume Down',
      'Seek Forward', 'Seek Backward', 'Display Audio Info', 'Toggle Audio-Only Mode',
      'Exit'
    ] as const;
    let keepRunning = true;

    while (keepRunning) {
      const action = await select({
        choices: controlActions,
        message: 'Choose an action for MPV player',
      });

      try {
        switch (action) {
          case 'Pause/Resume':
            await this.mpvPlayer.togglePause();
            console.log('Toggled pause/resume.');
            break;
          case 'Stop':
            await this.mpvPlayer.stop();
            console.log('Stopped the video.');
            this.stopRealTimeProgress();
            keepRunning = false;
            break;
          case 'Volume Up':
            await this.mpvPlayer.volumeUp(10);
            console.log('Increased volume by 10%.');
            break;
          case 'Volume Down':
            await this.mpvPlayer.volumeDown(10);
            console.log('Decreased volume by 10%.');
            break;
          case 'Seek Forward':
            await this.mpvPlayer.seek(10);
            console.log('Seeked forward by 10 seconds.');
            break;
          case 'Seek Backward':
            await this.mpvPlayer.seek(-10);
            console.log('Seeked backward by 10 seconds.');
            break;
          case 'Display Audio Info':
            await this.displayAudioInfo();
            break;
          case 'Toggle Audio-Only Mode':
            await this.toggleAudioOnly();
            break;
          case 'Exit':
            this.stopRealTimeProgress();
            keepRunning = false;
            break;
        }
      } catch (error: any) {
        console.log(`Error executing ${action}:`, error.message);
      }
    }
  }

  displayAudioInfo = async () => {
    try {
      const title = await this.mpvPlayer.getProperty('media-title');
      const volume = await this.mpvPlayer.getProperty('volume');
      const duration = await this.mpvPlayer.getProperty('duration');
      const audioCodec = await this.mpvPlayer.getProperty('audio-codec-name');
      console.log()
      console.log('--- Media Information ---');
      console.log(`Title: ${title}`);
      // console.log(`Volume: ${volume}%`);
      console.log(`Duration: ${this.formatTime(duration)}`);
      console.log(`Audio Codec: ${audioCodec}`);
      console.log('-------------------------');
    } catch (error: any) {
      console.log('Error retrieving audio information:', error.message);
    }
  }
  playMpv = async (args?: MpvArgs) => {
    if (args?.url) {
      try {
        await this.mpvPlayer.start()
        await this.mpvPlayer.load(args.url)
        this.startRealTimeProgress();
        // await this.controlMpv()
        await this.keyboardControlMpv()
      }
      catch (error) {
        // handle errors here
        console.log(error);
      }
    } else {
      this.watch_context = await select({
        message: 'Watch Context',
        choices: watchContextEnum.enumValues
      })
      if (this.watch_context == 'VIDEO') {
        this.currentVideo = await search({
          message: 'Video',
          source: async (input) => {
            return this.video.searchVideo(input)
          },
        })
        if (this.currentVideo.link) {
          try {
            if(!await this.mpvPlayer.isRunning()){
              await this.mpvPlayer.start()
            }
            await this.mpvPlayer.load((this.currentVideo.link as JpvLink).url)
            this.startRealTimeProgress();
            const videoProg = await db.query.videoProgress.findFirst({ where: and(eq(videoProgress.video, this.currentVideo.id), eq(videoProgress.watch_context, 'VIDEO')) })
            if (videoProg) {
              await this.mpvPlayer.seek(videoProg.last_position)
            }
            await this.startRealTimePositionProgress()
            // await this.controlMpv()
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
          }
          catch (error) {
            // handle errors here
            console.log(error);
          }
        }if (this.currentVideo.filePath) {
          try {
            if(!await this.mpvPlayer.isRunning()){
              await this.mpvPlayer.start()
            }
            await this.mpvPlayer.load(path.join((this.currentVideo.filePath as JpvFilePath).pathUrl))
            this.startRealTimeProgress();
            const videoProg = await db.query.videoProgress.findFirst({ where: and(eq(videoProgress.video, this.currentVideo.id), eq(videoProgress.watch_context, 'VIDEO')) })
            if (videoProg) {
              await this.mpvPlayer.seek(videoProg.last_position)
            }
            await this.startRealTimePositionProgress()
            // await this.controlMpv()
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
          }
          catch (error) {
            // handle errors here
            console.log(error);
          }
        }
      }
      if (this.watch_context == 'CHANNEL') {
        this.currentChannel = await search({
          message: 'Channel',
          source: async (input) => {
            return this.channel.searchChannel(input)
          },
        })
        if (this.currentChannel) {
          try {
            if(!await this.mpvPlayer.isRunning()){
              await this.mpvPlayer.start()
            }
            const videoProg = await db.query.videoProgress.findFirst({ with: {video: {with: {link: true, filePath: true}}}, where: and(eq(videoProgress.channel, this.currentChannel.id), eq(videoProgress.watch_context, 'CHANNEL')) })

            if (videoProg) {
              this.currentVideo = videoProg.video
              if(videoProg.video?.link){
                await this.mpvPlayer.load(((videoProg.video as JpvVideo).link as JpvLink).url)
              } else {
                await this.mpvPlayer.load(((videoProg.video as JpvVideo).filePath as JpvFilePath).pathUrl)
              }
              await this.mpvPlayer.seek(videoProg.last_position)
            } else {
              const video = await db.query.jpvVideo.findFirst({with: {link: true, filePath: true}, where: eq(jpvVideo.channel, this.currentChannel.id), orderBy: asc(jpvVideo.id)})
              if(video){
                this.currentVideo = video;
                if(this.currentVideo.link){
                  await this.mpvPlayer.load((this.currentVideo.link as JpvLink).url)
                } else {
                  await this.mpvPlayer.load((this.currentVideo.filePath as JpvFilePath).pathUrl)
                
                }
              }
            }
            this.startRealTimeProgress();
            await this.startRealTimePositionProgress()
            // await this.controlMpv()
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
          }
          catch (error) {
            // handle errors here
            console.log(error);
          }
        }
      }if (this.watch_context == 'PLAYLIST') {
        this.currentPlaylist = await search({
          message: 'Playlist',
          source: async (input) => {
            return this.playlist.searchPlaylist(input)
          },
        })
        if (this.currentPlaylist) {
          try {
            if(!await this.mpvPlayer.isRunning()){
              await this.mpvPlayer.start()
            }
            const videoProg = await db.query.videoProgress.findFirst({ with: {video: {with: {link: true, filePath: true}}}, where: and(eq(videoProgress.playlist, this.currentPlaylist.id), eq(videoProgress.watch_context, 'PLAYLIST')) })
            if (videoProg) {
              this.currentVideo = videoProg.video
              const playlistDetail = await db.query.jpvPlaylistDetail.findFirst({where: and(eq(jpvPlaylistDetail.video, this.currentVideo!.id), eq(jpvPlaylistDetail.playlist, this.currentPlaylist.id))})

              if(playlistDetail){
                this.currentDetail = playlistDetail
              }
              const path = videoProg.video?.link ? videoProg.video.link.url : videoProg.video?.filePath?.pathUrl
              await this.mpvPlayer.load(path)
              await this.mpvPlayer.seek(videoProg.last_position)
            } else {
              const video = await db.query.jpvPlaylistDetail.findFirst({with: {video: {with: {link: true, filePath: true}}}, where: and(eq(jpvPlaylistDetail.playlist, this.currentPlaylist.id)), orderBy: asc(jpvPlaylistDetail.order)})

              if(video){
                this.currentVideo = video.video;
                this.currentDetail = video
                const path = video.video?.link ? video.video.link.url : video.video?.filePath?.pathUrl
                await this.mpvPlayer.load(path)
              }
            }
            this.startRealTimeProgress();
            await this.startRealTimePositionProgress()
            // await this.controlMpv()
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
          }
          catch (error) {
            // handle errors here
            console.log(error);
          }
        }
      }
    }
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

    process.on('unhandledRejection', (reason, promise) => {
      process.exit(1);
    });

    this.mpvPlayer.on('stopped', async () => {
      try {
      await this.playNext()
        
      } catch (error) {
      }
    });


    this.mpvPlayer.on('quit', async() => {
      try{
        await this.savePositionProgress()
        this.stopRealTimeProgress()
        process.exit(0)
      } catch (e) {

      }
    });

    if (flags.play) {
      await this.playMpv(args)
    } else if (flags.manage) {
      await this.manageMpv()
    }
  }
}
