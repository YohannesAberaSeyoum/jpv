import { Args, Command, Flags } from '@oclif/core'
import { input, select, search, confirm } from '@inquirer/prompts'
import Video from './video.js';
import mpv from 'node-mpv'
import { db } from '../db/setup.js'
import { JpvLink, videoProgress, JpvVideo, JpvChannel, JpvPlaylist, watchContextEnum, jpvChannel, jpvVideo, JpvFilePath, jpvPlaylistDetail, jpvPlaylist, jpvLink, jpvFilePath, JpvPlaylistDetail, JpvVideoWithPathLink } from '../db/schema/jpv.js';
// import readline from 'readline';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import Channel from './channel.js';
import path from 'path';
import Playlist from './playlist.js';
import PlaylistDetail from './playlist_detail.js';
import YouTube from 'youtube-sr';

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
  currentVideo: JpvVideoWithPathLink | null = null;
  currentDetail: JpvPlaylistDetail | null = null;
  currentPlaylist: JpvPlaylist | null = null;
  currentChannel: JpvChannel | null = null;
  currentYoutubeVideo: YouTube.Video | null = null;
  watch_context: WatchContext | undefined
  isSearching: boolean = false;
  mixPlaylist: YouTube.Video[] = [];

  static override description = 'Manage JPV Mpvs'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    play: Flags.boolean({ char: 'p', description: 'To Play Mpv' }),
    delete: Flags.boolean({ char: 'd', description: 'To Delete Existing Mpv' }),
    manage: Flags.boolean({ char: 'm', description: 'To Manage Mpv' }),
    update: Flags.boolean({ char: 'u', description: 'To Update Existing Mpv' }),
    mix: Flags.boolean({char: 'x', description: 'To Play Mix'})
  }

  video = new Video(this.argv, this.config);
  channel = new Channel(this.argv, this.config);
  playlist = new Playlist(this.argv, this.config);
  playlistDetail = new PlaylistDetail(this.argv, this.config);

  showControls(){
    console.log('Controls:');
    console.log('  Space: Pause/Resume');
    console.log('  +: Volume Up');
    console.log('  -: Volume Down');
    console.log('  Arrow Right: Seek Forward');
    console.log('  Arrow Left: Seek Backward');
    console.log('  A: Toggle Audio-Only Mode');
    console.log('  L: List Playlist Detail');
    console.log('  N: Play Next');
    console.log('  P: Play Prev');
    console.log('  Q: Quit');
    console.log('  H: help');
  }

  async keyboardControlMpv() {
    // this.showControls()

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
  
    const handleKeypress = async (str: string) => {
      if (this.isSearching) {
        // Prevent keypress handling while searching for videos
        return;
      }
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
          case 'l':
          case 'L':
            await this.selectVideo();
            await this.savePositionProgress();
            break;
          case 'h':
          case 'H':
            await this.showControls();
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
  
  async selectVideo() {
    this.isSearching = true;
    this.stopRealTimeProgress()
    this.stopRealTimePositionProgress()
    let current;
    if(this.watch_context == 'PLAYLIST'){
      const playlistDetail = await search({
        message: 'Search Video',
        source: async (input) => {
          return this.playlistDetail.searchPlaylistDetail(input, false, this.currentPlaylist?.id)
        },
      })
      this.currentDetail = playlistDetail;
      if(playlistDetail.video){
        current = await db.query.jpvVideo.findFirst({with: {link: true, filePath: true}, where: eq(jpvVideo.id, (playlistDetail.video as any).id)})
        if(current){
          this.currentVideo = current
        } else {}
      }
    } else if(this.watch_context == 'CHANNEL'){
      current = await search({
        message: 'Search Video',
        source: async (input) => {
          return this.video.searchVideo(input, this.currentChannel?.id)
        }
      })
      if(current){
        this.currentVideo = current
      }
    }
    this.isSearching = false;
    this.startRealTimeProgress()
    this.startRealTimePositionProgress()
    if(this.mpvPlayer.stopped){
      this.mpvPlayer = await this.mpvPlayer.start()
    }
    if(current?.link){
      await this.mpvPlayer.load((current?.link as JpvLink)?.url);
    } else {
      await this.mpvPlayer.load((current?.filePath as JpvFilePath)?.pathUrl)
    }
    await this.keyboardControlMpv()
    await this.displayAudioInfo()
  }

  async playNext(isRefreshed: boolean = false) {
    try {
      let nextVideo;
      if (this.watch_context === 'VIDEO') {
        if(this.mixPlaylist.length){
          const i = this.mixPlaylist.findIndex((playlist) => playlist.url == this.currentYoutubeVideo?.url)
          if(this.mixPlaylist.length - 1 == i && this.currentYoutubeVideo){
            const video = await YouTube.YouTube.getVideo(this.currentYoutubeVideo.url)
            if(video.id){
              this.mixPlaylist = (await YouTube.YouTube.getMixVideos(video.id)).videos
              this.currentYoutubeVideo = this.mixPlaylist[0];
            }
          } else {
            this.currentYoutubeVideo = this.mixPlaylist[i + 1]
          }
          if(this.currentYoutubeVideo){
            if(this.mpvPlayer.stopped){
              await this.mpvPlayer.start()
            }
            await this.mpvPlayer.load(this.currentYoutubeVideo.url);
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
            return;
          } else {
            process.exit(0)
          }
        } else {
          const restart_confirm = await confirm({
            message: 'You have finished the channel, Do you want to restart',
          })
          if(!restart_confirm){
            await this.savePositionProgress()
            process.exit(0)
          } else if(this.currentVideo) {
            nextVideo = this.currentVideo
          } else {
            await this.mpvPlayer.load(this.currentYoutubeVideo?.url);
            await this.keyboardControlMpv()
            await this.displayAudioInfo()
          }
        }
      }
      if (this.watch_context === 'CHANNEL') {
        nextVideo = await db.query.jpvVideo.findFirst({
          where: and(eq(jpvVideo.channel, this.currentChannel?.id!), gt(jpvVideo.id, this.currentVideo!.id)),
          orderBy: [desc(jpvVideo.createdAt), asc(jpvVideo.id)],
          with: {
            link: true,
            filePath: true
          }
        })
        if(!nextVideo){
          if(!isRefreshed && this.currentChannel?.channelType == 'youtube'){
            await this.channel.addVideos(this.currentChannel.targetId!)
            await this.playNext(true)
            return
          }
          const restart_confirm = await confirm({
                message: 'You have finished the channel, Do you want to restart',
              })
          if(!restart_confirm){
            await this.savePositionProgress()
            process.exit(0)
          } else {
            nextVideo = await db.query.jpvVideo.findFirst({
              where: eq(jpvVideo.channel, this.currentChannel?.id!),
              orderBy: [desc(jpvVideo.createdAt), asc(jpvVideo.id)],
              with: {
                link: true,
                filePath: true
              }
            })
          }
        }
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
        if(!nextVideo){
          if(!isRefreshed && this.currentPlaylist?.playlistType == 'link'){
            await this.playlist.addVideos(this.currentPlaylist)
            await this.playNext(true)
            return
          }
          const restart_confirm = await confirm({
                message: 'You have finished the playlist, Do you want to restart',
              })
          if(!restart_confirm){
            await this.savePositionProgress()
            process.exit(0)
          } else {
            const detail = await db.query.jpvPlaylistDetail.findFirst({
              where: eq(jpvPlaylistDetail.playlist, this.currentPlaylist?.id!),
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
        await this.keyboardControlMpv()
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
    let prevVideo;
    if (this.watch_context === 'VIDEO') {
      if(this.mixPlaylist.length){
        const i = this.mixPlaylist.findIndex((playlist) => playlist.url == this.currentYoutubeVideo?.url)
        this.currentYoutubeVideo = this.mixPlaylist[i - 1]
        if(this.currentYoutubeVideo){
          if(this.mpvPlayer.stopped){
            await this.mpvPlayer.start()
          }
          await this.mpvPlayer.load(this.currentYoutubeVideo.url);
          await this.keyboardControlMpv()
          await this.displayAudioInfo()
          return;
        } else {
          process.exit(0)
        }
      } else {
        const restart_confirm = await confirm({
          message: 'You have finished the channel, Do you want to restart',
        })
        if(!restart_confirm){
          await this.savePositionProgress()
          process.exit(0)
        } else if(this.currentVideo) {
          prevVideo = this.currentVideo
        } else {
          await this.mpvPlayer.load(this.currentYoutubeVideo?.url);
          await this.keyboardControlMpv()
          await this.displayAudioInfo()
        }
      }
    }
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
      await this.keyboardControlMpv()
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
    if((this.currentYoutubeVideo || this.currentVideo?.videoType == 'link') && !audioOnly){
      await this.reloadPlayback(audioOnly)
    }
  }

  async reloadPlayback(audioOnly: boolean) {
    this.isSearching = true
    const currentTime = await this.mpvPlayer.getProperty('time-pos'); // Get current position
    await this.mpvPlayer.stop(); // Stop the video
    await this.mpvPlayer.setProperty('vid', audioOnly ? 'no' : 'auto'); // Set vid property
    if(this.mpvPlayer.stopped){
      await this.mpvPlayer.start()
    }
    if(this.currentVideo){
      await this.mpvPlayer.load((this.currentVideo?.link as JpvLink).url); // Reload video
    }
    if(this.currentYoutubeVideo){
      await this.mpvPlayer.load(this.currentYoutubeVideo.url); // Reload video
    }
    setTimeout(async () => await this.mpvPlayer.seek(+currentTime))
    // console.log(currentTime)
    this.isSearching = false
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

  async savePositionProgress() {
    try {
      if (this.mpvPlayer && !await this.mpvPlayer.getProperty){
        return;
      }
      let currentTime;
      try {
         currentTime = await this.mpvPlayer.getProperty('time-pos');
      } catch (error) {
        return;
      }
      if(this.currentVideo){
        const target = [videoProgress.watch_context, this.watch_context == 'PLAYLIST' ? videoProgress.playlist : (this.watch_context == 'CHANNEL' ? videoProgress.channel : videoProgress.video)]
        await db.insert(videoProgress).values({channel: this.currentChannel?.id, playlist: this.currentPlaylist?.id, watch_context: this.watch_context, last_position: currentTime })
        .onConflictDoUpdate({
          target: target,
          set: {
            last_position: currentTime,
            video: this.currentVideo.id
          }
        })
      }
    } catch (error) {
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
  playMpv = async (args?: MpvArgs, flags?: {mix: boolean}) => {
    if (args?.url) {
      try {
        this.watch_context = WatchContext.VIDEO;
        const video = await YouTube.YouTube.getVideo(args.url)
        this.currentYoutubeVideo = video;
        if(flags?.mix){
          if(video.id){
            this.mixPlaylist = (await YouTube.YouTube.getMixVideos(video.id)).videos
          }
        }
        await this.mpvPlayer.start()
        await this.mpvPlayer.load(args.url)
        await this.displayAudioInfo()
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
                await this.mpvPlayer.load((videoProg.video.link as JpvLink).url)
              } else if(videoProg.video?.filePath) {
                await this.mpvPlayer.load((videoProg.video.filePath as JpvFilePath).pathUrl)
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
        if(!this.isSearching){
          await this.playNext()
        }        
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
      await this.playMpv(args, flags)
    } else if (flags.manage) {
      await this.manageMpv()
    }
  }
}
