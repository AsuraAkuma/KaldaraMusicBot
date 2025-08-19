// Main music handler for the bot. Manages music playback, queues, and integration with YouTube, Spotify, and SoundCloud.
import { EmbedBuilder } from "@discordjs/builders";
import { AudioPlayer, VoiceConnection, StreamType } from "@discordjs/voice";
import { Channel, Colors, Guild, TextChannel, VoiceBasedChannel } from "discord.js";
import { botName, botImage, clientId } from "./config.json";
import { InfoData, SoundCloudPlaylist, SoundCloudTrack, SpotifyAlbum, SpotifyPlaylist, SpotifyTrack, YouTubePlayList, YouTubeVideo } from "play-dl";
import { AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } from '@discordjs/voice';
import songSchema from "./schemas/song-schema";
import queueSchema from "./schemas/queue-schema";
import logDebug from "./logDebug";
import client from "./index";
import ffmpeg from 'fluent-ffmpeg';
import youtubedl, { Payload } from 'youtube-dl-exec';
import play from 'play-dl';
// import prism from 'prism-media';
import { client_id, client_secret, refresh_token } from './data/spotify.json';
import { WritableStreamBuffer } from 'stream-buffers';
import { EventEmitter, PassThrough, Readable, Writable } from 'stream';
import fs, { existsSync, rmSync } from 'fs';
import logError from "./logError";
import settingsSchema from "./schemas/settings-schema";
import path from "path";
import playlistSchema from "./schemas/playlist-schema";
// import { cookies } from './data/cookies.json';
play.setToken({
    spotify: { client_id, client_secret, refresh_token, market: 'US' }
})
const embedFooter = {
    text: botName,
    iconURL: botImage
}

export class MusicHandler {
    player: AudioPlayer;
    queue: Queue;
    isPlaying: Boolean;
    connection: VoiceConnection | null;
    smartPlay: Boolean;
    volume: number;
    alwaysConnected: Boolean;
    guild: Guild;
    isPaused: Boolean;
    isSeeking: Boolean;
    nowPlaying: Song | null;
    isRepeatSingle: Boolean;
    isRepeatAll: Boolean;
    isAutoplay: Boolean;
    downloading: any;
    songDownloading: any;
    seekTarget: number | null;
    constructor(guild: Guild) {
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        this.queue = new Queue(this);
        this.isPlaying = false;
        this.connection = null;
        // Settings
        this.smartPlay = false;
        this.volume = 70;
        settingsSchema.findOne({ _id: guild.id }).then((result) => {
            if (result) {
                this.volume = result.volume;
            }
        })
        this.alwaysConnected = false;
        this.guild = guild;
        this.isPaused = false;
        this.isSeeking = false;
        this.nowPlaying = null;
        this.isRepeatSingle = false;
        this.isRepeatAll = false;
        this.isAutoplay = false;
        this.seekTarget = null;
        this.startListeners();
    }

    async connect(targetChannel: VoiceBasedChannel) {
        this.connection = joinVoiceChannel({
            channelId: targetChannel.id, // Ensure you save the old channel ID
            guildId: this.guild.id,
            adapterCreator: this.guild.voiceAdapterCreator
        });
    }

    async play(targetChannel: VoiceBasedChannel) {
        // Check if queue is empty
        if (this.queue.songs.length === 0) {
            throw "Queue is empty.";
        }
        const clientMember = this.guild.members.cache.get(clientId);
        if (!clientMember) {
            throw "No client member detected.";
        }
        if (!clientMember.voice) {
            throw "The bot does not have a voice.";
        }
        if (!clientMember.voice.channel) {
            // throw "The bot is not in a voice channel2.";
            await this.connect(targetChannel);
        }
        if (this.connection === null) {
            await this.connect(targetChannel);
        }
        if (this.connection === null) {
            this.play(targetChannel);
            return;
        }
        if (this.queue.songs[0].url === "Unknown") {
            if (await cr(0, this.queue) === true) {
                const resource: any = await this.queue.songs[0].getBufferedResource();
                this.player.play(resource);
                this.connection.subscribe(this.player);
                this.isPlaying = true;
                this.nowPlaying = this.queue.songs[0];
            } else {
                throw 'Was not able to prepare any songs';
            }
        } else {
            const resource: any = await this.queue.songs[0].getBufferedResource();
            this.player.play(resource);
            this.connection.subscribe(this.player);
            this.isPlaying = true;
            this.nowPlaying = this.queue.songs[0];
        }
    }
    async pause() {
        if (this.isPlaying === false) {
            throw `There is nothing currently playing.`;
        }
        this.isPaused = true;
        this.player.pause(true);
    }
    async unpause() {
        if (this.isPaused === false && this.queue.songs.length === 0) {
            throw `There is nothing currently paused.`;
        }
        if (this.isPaused === true) {
            this.player.unpause();
            this.isPaused = false;
        } else {
            if (!this.connection) {
                throw "There is no connection.";
            }
            const resource: any = await this.queue.songs[0].getBufferedResource().catch((err) => {
                throw err;
            });
            this.player.play(resource);
            this.connection.subscribe(this.player);
            this.isPlaying = true;
            this.nowPlaying = this.queue.songs[0];
        }
    }
    async stop() {
        if (this.isPlaying === false) {
            throw `There is nothing currently playing.`;
        }
        await this.stopDownload();

        // Gracefully end the stream instead of destroying it
        if (this.nowPlaying?.audioStream) {
            if (this.nowPlaying.audioStream.end) {
                this.nowPlaying.audioStream.end();
            } else if (this.nowPlaying.audioStream.destroy) {
                this.nowPlaying.audioStream.destroy();
            }
        }

        await this.queue.clear();
        this.player.stop(true);
        this.isAutoplay = false;
        this.isRepeatAll = false;
        this.isRepeatSingle = false;
        this.nowPlaying = null;
        this.isPlaying = false;
        this.isPaused = false;

    }
    async seek(seconds: number) {
        // Check if song is currently playing
        if (this.isPlaying === false) {
            throw `There is nothing currently playing.`;
        }
        if (!this.nowPlaying) {
            throw `There is nothing currently playing.`;
        }
        if (this.nowPlaying.duration <= seconds) {
            throw `You can not seek to that time.`;
        }
        if (!this.nowPlaying.isSeekable) {
            throw `You can not use seek on this song since it is still buffering.`;
        }
        this.isSeeking = true;
        this.seekTarget = seconds;
        this.player.stop(true);
    }

    async skip() {
        // Check if song is currently playing
        if (this.isPlaying === false) {
            throw `There is nothing currently playing.`;
        }
        if (!this.nowPlaying) {
            throw `There is nothing currently playing.`;
        }

        await this.stopDownload();

        // Gracefully end the stream instead of destroying it
        if (this.nowPlaying.audioStream) {
            if (this.nowPlaying.audioStream.end) {
                this.nowPlaying.audioStream.end();
            } else if (this.nowPlaying.audioStream.destroy) {
                this.nowPlaying.audioStream.destroy();
            }
        }

        this.player.stop(true);
    }
    async stopDownload() {
        if (this.songDownloading === this.nowPlaying?.id) {
            await this.downloading.kill("SIGINT");
            this.downloading = null;
            this.songDownloading = null;
        }
    }
    async setVolume(percent: number) {
        if (!(percent >= 0 && percent <= 100)) {
            throw new Error("The percent must be from 0 to 100");
        }
        this.volume = percent;
    }

    async setRepeatSingle(value: Boolean) {
        // Check if repeats are on
        if (this.isRepeatSingle === true && value === true) {
            throw "Repeat single is already on.";
        }
        if (this.isRepeatAll === true && value === true) {
            throw "Repeat all is already on."
        }
        this.isRepeatSingle = value;
    }
    async setRepeatAll(value: Boolean) {
        // Check if repeats are on
        if (this.isRepeatSingle === true && value === true) {
            throw "Repeat single is already on.";
        }
        if (this.isRepeatAll === true && value === true) {
            throw "Repeat all is already on."
        }
        this.isRepeatAll = value;
    }
    async setAutoplay(value: Boolean) {
        if (this.isAutoplay === value) {
            throw `Autoplay is already set to ${value}.`;
        }
        this.isAutoplay = value;
    }
    // Start listeners
    async startListeners() {
        const clientMember = this.guild.members.cache.get(clientId);
        if (!clientMember) {
            throw "No client member detected.";
        }
        // Buffering
        this.player.on(AudioPlayerStatus.Buffering, () => {
            logDebug('Audio is now buffering!');
        });
        // Playing
        this.player.on(AudioPlayerStatus.Playing, async () => {
            // Check for commands channel
            const result = await settingsSchema.findOne({ _id: this.guild.id });

            // Check for channel
            const targetChannel: TextChannel = this.guild.channels.cache.get(result?.channelId as string) as TextChannel;
            if (this.isSeeking === true) {
                return;
            }
            this.isPlaying = true;
            logDebug('Audio is now playing!');
            if (this.isPaused === true) {
                if (targetChannel) {
                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`Music Unpaused`)
                        .setDescription(`The music has been unpaused.`)
                        .setColor(Colors.Blue)
                        .setFooter(embedFooter)
                    targetChannel.send({
                        embeds: [replyEmbed]
                    });
                }
                this.isPaused = false;
            }
            if (result?.channelId !== null) {
                if (this.nowPlaying) {
                    if (targetChannel) {
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Now Playing:** ${this.nowPlaying?.name}`)
                            .addFields(
                                {
                                    name: `**Duration**`,
                                    value: `[${this.nowPlaying.durationRaw}]`,
                                    inline: true

                                },
                                {
                                    name: '**Channel**',
                                    value: `${this.nowPlaying.channel}`,
                                    inline: true
                                }
                            )
                            .setThumbnail((this.nowPlaying) ? this.nowPlaying.thumbnail : "")
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        targetChannel.send({
                            embeds: [replyEmbed]
                        });
                    }
                }

            }
            if (this.queue.songs.length > 1) {
                cr(1, this.queue);
            }

        });
        // Paused
        this.player.on(AudioPlayerStatus.Paused, async () => {
            // Check for commands channel
            const result = await settingsSchema.findOne({ _id: this.guild.id });

            // Check for channel
            const targetChannel: TextChannel = this.guild.channels.cache.get(result?.channelId as string) as TextChannel;
            logDebug('Audio is now paused!');
            if (targetChannel) {
                if (result?.channelId !== null) {
                    if (this.nowPlaying) {
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`Music Paused`)
                            .setDescription(`The music has been paused.`)
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        targetChannel.send({
                            embeds: [replyEmbed]
                        });
                    }

                }
            }
        });
        // Idle
        this.player.on(AudioPlayerStatus.Idle, async () => {
            // Check for commands channel
            const result = await settingsSchema.findOne({ _id: this.guild.id });

            // Check for channel
            const targetChannel: TextChannel = this.guild.channels.cache.get(result?.channelId as string) as TextChannel;
            try {
                if (this.isSeeking === true) {
                    if (this.nowPlaying) {
                        const resource: any = await this.nowPlaying.getBufferedResource(this.seekTarget ?? 0);
                        this.player.play(resource);
                        this.isSeeking = false;
                    }
                    return;
                }
                if (this.isRepeatSingle === true) {
                    if (!this.nowPlaying) {
                        this.isRepeatSingle = false;
                        throw "Nothing currently playing.";
                    }
                    const resource: any = await this.nowPlaying.getBufferedResource();
                    this.player.play(resource);
                } else if (this.isRepeatAll === true) {
                    if (this.queue.songs.length <= 1) {
                        if (!this.nowPlaying) {
                            this.isRepeatAll = false;
                            throw "Nothing currently playing.";
                        }
                        const resource: any = await this.nowPlaying.getBufferedResource();
                        this.player.play(resource);
                    } else {
                        if (!this.nowPlaying) {
                            this.isRepeatAll = false;
                            throw "Nothing currently playing.";
                        }
                        this.queue.songs.push(this.nowPlaying);
                        this.queue.songs.shift();
                        this.nowPlaying = this.queue.songs[0];
                        const resource: any = await this.queue.songs[0].getBufferedResource();
                        this.player.play(resource);
                    }
                } else {
                    if (this.queue.songs.length <= 1) {
                        if (this.queue.songs[0]) {
                            await this.queue.removeSong(this.queue.songs[0].id);
                        }
                        if (this.isAutoplay === true && this.nowPlaying) {
                            const songData = await play.video_info(this.nowPlaying.url);
                            const relatedSong = songData.related_videos[0];
                            await this.queue.addSong(relatedSong);
                            this.nowPlaying = this.queue.songs[0];
                            const resource: any = await this.queue.songs[0].getBufferedResource();
                            this.player.play(resource);
                        } else {
                            if (result?.channelId !== null) {
                                logDebug('Audio has finished playing.');
                                if (targetChannel) {
                                    const replyEmbed = new EmbedBuilder()
                                        .setTitle('**Finished Playing**')
                                        .setDescription(`Audio has finished playing, add more songs using \`/play\``)
                                        .setColor(Colors.Blue)
                                        .setFooter(embedFooter)
                                    targetChannel.send({
                                        embeds: [replyEmbed]
                                    });
                                }
                            }
                            if (this.connection && this.connection.state.status !== "destroyed") {
                                this.connection.destroy();
                            }
                            this.isPlaying = false;
                        }
                    } else {
                        // Remove old buffer file
                        if (this.nowPlaying) {
                            const tmpFile = `./temp/${this.nowPlaying.id}-temp_audio.mp3`;
                            if (existsSync(tmpFile)) {
                                fs.rm(tmpFile, () => logDebug(`Removed temp audio file (${tmpFile})`));
                            }
                        }
                        await this.queue.removeSong(this.queue.songs[0].id);
                        // Set now playing to next song
                        this.nowPlaying = this.queue.songs[0];
                        if (this.nowPlaying.type !== "YouTubeVideo") {
                            if (await cr(0, this.queue) === true) {
                                const resource: any = await this.nowPlaying.getBufferedResource();
                                this.player.play(resource);
                            }
                        } else {
                            const resource: any = await this.nowPlaying.getBufferedResource();
                            this.player.play(resource);
                        }
                        // this.queue.removeSong(this.nowPlaying.id);

                    }
                }
            } catch (error: any) {
                logError(error, __filename);
            }
        });
        // Error
        this.player.on('error', async (error) => {
            // Check for commands channel
            const result = await settingsSchema.findOne({ _id: this.guild.id });

            // Check for channel
            const targetChannel: TextChannel = this.guild.channels.cache.get(result?.channelId as string) as TextChannel;
            logError(error, __filename);
            // if (targetChannel) {
            //     if (result?.channelId !== null) {
            //         const replyEmbed = new EmbedBuilder()
            //             .setTitle('**Music Status**')
            //             .setDescription(`Audio has stopped playing due to an error.`)
            //             .setColor(Colors.Red)
            //             .setFooter(embedFooter)
            //         targetChannel.send({
            //             embeds: [replyEmbed]
            //         });
            //     }
            // }
            if (this.connection && this.connection.state.status !== "destroyed") {
                try {
                    this.connection.destroy();
                } catch (error: any) {
                    logError(error, __filename);
                }
            }
            this.isPlaying = false;
        });
        // Voice state update
        // client.on('voiceStateUpdate', (oldState, newState) => {
        //     if (newState) {
        //         if (newState.channel) {
        //             if (newState.member) {
        //                 if (newState.member.id === clientId) {
        //                     this.connection = joinVoiceChannel({
        //                         channelId: newState.channel.id, // Ensure you save the old channel ID
        //                         guildId: this.guild.id,
        //                         adapterCreator: this.guild.voiceAdapterCreator
        //                     });
        //                 }
        //             }
        //         }
        //     }
        // });
    }
}
type dbSong = {
    _id: string,
    songURL: string,
    name: string,
    channel: string,
    thumbnailURL: string,
    durationRaw: string,
    durationInSec: number
}
export class Song {
    handler: MusicHandler;
    name: string;
    url: string;
    duration: number;//seconds
    durationRaw: string;
    id: string;
    thumbnail: string | null;//url
    channel: string | null;
    type: string;
    audioStream: Writable | PassThrough | null;
    isSeekable: Boolean;
    constructor(info: YouTubeVideo | dbSong | SpotifyTrack | SoundCloudTrack, musicHandler: MusicHandler) {
        if (info instanceof YouTubeVideo) {
            if (!info) {
                logDebug("No video details found.")
                throw "No video details found.";
            }
            if (!info.title) {
                logDebug("No video details found.")
                throw "No video title found.";
            }
            if (!info.id) {
                logDebug("No video id found.")
                throw "No video id found.";
            }
            if (!info.channel) {
                logDebug("No channel found.")
                throw "No channel found.";
            }
            this.channel = (info.channel.name) ? info.channel.name : null;
            this.name = info.title;
            this.url = info.url;
            this.duration = info.durationInSec;
            this.durationRaw = `${Math.floor(info.durationInSec / 60)}:${(info.durationInSec % 60).toString().padStart(2, '0')}`;
            this.id = info.id;
            this.thumbnail = (info.thumbnails[0]) ? info.thumbnails[0].url : null;
            this.handler = musicHandler;
            this.type = "YouTubeVideo";

        } else if (info instanceof SpotifyTrack) {
            if (!info) {
                logDebug("No video details found.")
                throw "No video details found.";
            }
            if (!info.name) {
                logDebug("No video title found.")
                throw "No video title found.";
            }
            this.channel = info.artists.map((v, i) => v.name).join(" ");
            this.name = info.name;
            this.url = "Unknown";
            this.duration = info.durationInSec;
            this.durationRaw = `${Math.floor(info.durationInSec / 60)}:${(info.durationInSec % 60).toString().padStart(2, '0')}`;
            this.id = `SP-${info.id}`;
            this.thumbnail = "Unknown";
            this.handler = musicHandler;
            this.type = "SpotifyTrack";
        } else if (info instanceof SoundCloudTrack) {
            if (!info) {
                logDebug("No video details found.")
                throw "No video details found.";
            }
            if (!info.name) {
                logDebug("No video title found.")
                throw "No video title found.";
            }
            this.channel = info.user.name;
            this.name = info.name;
            this.url = "Unknown";
            this.duration = info.durationInSec;
            this.durationRaw = `${Math.floor(info.durationInSec / 60)}:${(info.durationInSec % 60).toString().padStart(2, '0')}`;
            this.id = `SC-${info.id}`;
            this.thumbnail = "Unknown";
            this.handler = musicHandler;
            this.type = "SoundCloudTrack";
        } else {
            const info2: dbSong = info;
            if (!info2) {
                logDebug("No video details found.")
                throw "No video details found.";
            }
            if (!info2.name) {
                logDebug("No video title found.")
                throw "No video title found.";
            }
            this.channel = info2.channel;
            this.name = info2.name;
            this.url = info2.songURL;
            this.duration = info2.durationInSec;
            this.durationRaw = info2.durationRaw;
            this.id = info2._id;
            this.thumbnail = info2.thumbnailURL;
            this.handler = musicHandler;
            this.type = "dbSong";
        }
        this.audioStream = null;
        this.isSeekable = true;
    }

    // Deprecated
    // async getResourceFromURL(seekInSeconds?: number): Promise<AudioResource> {
    //     const output = await youtubedl(this.url, {
    //         format: 'bestaudio', // Get the best audio or change to "best" for video+audio
    //         dumpSingleJson: true, // Return metadata in JSON format
    //     });
    //     const clientMember = this.handler.guild.members.cache.get(clientId);
    //     if (!clientMember) {
    //         throw "No client member detected.";
    //     }
    //     const targetChannel = clientMember.voice.channel;
    //     const stream: any = ffmpeg(output.url)
    //         .seekInput((seekInSeconds) ? seekInSeconds : 0)
    //         .audioCodec('pcm_s16le') // Specify audio codec
    //         .format('s16le') // Match VolumeTransformer type
    //         .audioBitrate((targetChannel) ? `${targetChannel.bitrate}k` : '64k')
    //         .pipe(new prism.VolumeTransformer({
    //             type: 's16le',
    //             volume: parseFloat((this.handler.volume / 1000).toPrecision(2))
    //         }));
    //     return createAudioResource(stream);
    // }

    async getBufferedResource(seekInSeconds?: number) {
        // Stream the audio data into the buffer
        const archFile = path.resolve(path.join(__dirname, '../archive', `${this.id}-temp_audio.mp3`));
        let ffmpegPromise: Promise<any>;
        const volumeFactor = parseFloat((this.handler.volume / 1000).toPrecision(2));
        if (!existsSync(archFile)) {
            await this.createBufferedResource();
            ffmpegPromise = new Promise((resolve, reject) => {
                this.audioStream = ffmpeg(`./temp/${this.id}-temp_audio.mp3`)
                    .inputFormat('mp3')
                    .seekInput((seekInSeconds) ? seekInSeconds : 0)
                    .audioFilters(`volume=${volumeFactor}`) // Apply volume adjustment
                    .audioFrequency(48000) // Explicitly set sample rate
                    .addOption('-bufsize', '500M')
                    .format('s16le')
                    .on('start', () => { resolve(true) })
                    .on('error', reject)
                    .pipe();
            });
        } else {
            ffmpegPromise = new Promise((resolve, reject) => {
                this.audioStream = ffmpeg(`../archive/${this.id}-temp_audio.mp3`)
                    .inputFormat('mp3')
                    .seekInput((seekInSeconds) ? seekInSeconds : 0)
                    .audioFilters(`volume=${volumeFactor}`) // Apply volume adjustment
                    .audioFrequency(48000) // Explicitly set sample rate
                    .addOption('-bufsize', '500M')
                    .format('s16le')
                    .on('start', () => { resolve(true) })
                    .on('error', (err) => { reject(err) })
                    .pipe();
            });
        }

        if (await ffmpegPromise) {
            logDebug(`Created audio stream for song (${this.id}).`);
            return createAudioResource(this.audioStream as any, { inputType: StreamType.Raw });
        } else {
            // Read the file into a stream
            const fileStream = fs.createReadStream(archFile);
            return createAudioResource(fileStream, { inputType: StreamType.Raw });
        }
    }

    async createBufferedResource(): Promise<boolean> {
        if (this.url === "Unknown") {
            const search = await play.search(`${this.name} ${this.channel}`, {
                limit: 1
            });
            const infoData: InfoData = await play.video_info(search[0].url);
            if (!infoData.video_details) {
                return false;
                throw "No video details found.";
            }
            const info = infoData.video_details;
            if (!info) {
                logDebug("No video details found.")
                return false;
                throw "No video details found.";
            }
            if (!info.title) {
                logDebug("No video details found.")
                return false;
                throw "No video title found.";
            }
            if (!info.id) {
                logDebug("No video id found.")
                return false;
                throw "No video id found.";
            }
            if (!info.channel) {
                logDebug("No channel found.")
                return false;
                throw "No channel found.";
            }
            const songData = await songSchema.findOne({ _id: this.id });
            const songData2 = await songSchema.findOne({ _id: info.id });
            const playlistData = await playlistSchema.find({ "songs.songId": this.id });
            if (!songData2) {
                await songSchema.create({
                    _id: info.id,
                    songURL: info.url,
                    name: info.title,
                    channel: info.channel,
                    thumbnailURL: info.thumbnails[0].url,
                    durationInSec: info.durationInSec,
                    durationRaw: info.durationRaw
                })
                logDebug(`Added song (${info.id}).`);
            }
            if (songData) {
                await songSchema.findOneAndDelete({ _id: this.id });
                logDebug(`Removed song (${this.id}).`);
            }
            if (playlistData.length > 0) {
                playlistData.forEach(async (playlist) => {
                    const targetSong = playlist.songs.find((v, i) => v.songId === this.id);
                    playlist['songs'].push({ songId: info.id, index: targetSong?.index });
                    playlist['songs'] = playlist.songs.filter((v, i) => v.songId !== this.id) as any;
                    await playlistSchema.findOneAndUpdate(
                        {
                            _id: playlist._id
                        },
                        {
                            songs: playlist.songs
                        }
                    )
                })
            }
            this.channel = (info.channel.name) ? info.channel.name : null;
            this.name = info.title;
            this.url = info.url;
            this.duration = info.durationInSec;
            this.durationRaw = info.durationRaw;
            this.id = info.id;
            this.thumbnail = (info.thumbnails[0]) ? info.thumbnails[0].url : null;
            this.handler = this.handler;
            this.type = "YouTubeVideo";
            await queueSchema.findOneAndUpdate(
                {
                    _id: clientId
                },
                {
                    songs: this.handler.queue.songs.map((v, i) => v.id)
                },
                {
                    upsert: true
                }
            )
        }
        const archFile = path.join(__dirname, '../archive', `${this.id}-temp_audio.mp3`);
        const tmpFile = `./temp/${this.id}-temp_audio.mp3`;
        if (!existsSync(path.resolve(archFile))) {
            const output: any = await youtubedl(this.url, {
                format: 'bestaudio', // Get the best audio or change to "best" for video+audio
                dumpSingleJson: true, // Return metadata in JSON format
            }).catch((err) => {
                logError(err, __filename);
                throw err;
            });
            // const volumeFactor = parseFloat((this.handler.volume / 1000).toPrecision(2));
            this.isSeekable = false;
            const ffmpegPromise = new Promise((resolve, reject) => {
                logDebug(`Creating buffer file for song (${this.id}).`);
                this.handler.downloading = ffmpeg(output.url)
                    .audioCodec('libmp3lame')
                    .audioFrequency(48000) // Add this line
                    .format('mp3')
                    .output(`./temp/${this.id}-temp_audio.mp3`)
                    .addOption('-bufsize', '500M')
                    .on('progress', (progress) => {
                        if (progress.percent !== undefined && (progress.percent / 100 * this.duration) >= 30) {
                            resolve(true);
                        }
                    })
                    // .on('progress', (progress) => { logDebug(`Create Buffer Processing: ${progress.percent}%`) })
                    .on('end', () => {
                        logDebug(`Created buffer file (${tmpFile}) for song (${this.id}).`);
                        this.isSeekable = true;
                        fs.copyFile(tmpFile, `../archive/${this.id}-temp_audio.mp3`, (err) => {
                            if (err) {
                                logError(err, __filename);
                            } else {
                                logDebug(`Copied buffer file (${tmpFile}) to archive folder.`);
                            }
                        });
                    })
                    .on('error', async (err) => {
                        await this.handler.queue.removeSong(this.id).catch((err) => {
                            logError(err, __filename);
                        });
                        reject(err);
                    })
                    .run();
                this.handler.songDownloading = this.id;
            });
            await ffmpegPromise.catch(async (err) => {
                logError(err, __filename);
                // Check for commands channel
                const result = await settingsSchema.findOne({ _id: this.handler.guild.id });

                // Check for channel
                const targetChannel: TextChannel = this.handler.guild.channels.cache.get(result?.channelId as string) as TextChannel;
                if (targetChannel) {
                    if (result?.channelId !== null) {
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`Error`)
                            .setDescription(`I was unable to play the song **${this.name}**`)
                            .setColor(Colors.Red)
                            .setFooter(embedFooter)
                        targetChannel.send({
                            embeds: [replyEmbed]
                        });

                    }
                }
            });
        }
        return true;
    }
}

export class Queue {
    songs: Array<Song>;
    handler: MusicHandler;
    guild: Guild;
    constructor(musicHandler: MusicHandler) {
        this.songs = new Array();
        this.handler = musicHandler;
        this.guild = musicHandler.guild;
        // Check for queue entry
        queueSchema.findOne({ _id: clientId }).then((result1) => {
            if (result1) {
                if (result1.songs.length > 0) {
                    // Get song data from db
                    songSchema.find({ _id: { $in: result1.songs } }).then((result2) => {
                        result1.songs.forEach((song) => {
                            try {
                                const songObj = new Song(result2.find((s) => s._id === song) as dbSong, this.handler);
                                this.songs.push(songObj);
                            } catch (error) {
                                logError(error as Error, __filename)
                            }
                        })
                    })
                }
            } else {
                queueSchema.create({
                    _id: clientId,
                    songs: []
                }).catch((err) => logError(err, __filename))
                logDebug(`Created new queue for bot (${clientId}).`);
            }
        }).catch((err) => logError(err, __filename))
        // Create/Update entry in db
    }

    async addSong(url: string): Promise<Boolean> {
        let newSong: Song | null = null;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const info: InfoData = await play.video_info(url).catch((err) => { throw err; });
            if (!info.video_details) {
                throw "No video details found.";
            }
            newSong = new Song(info.video_details, this.handler);
        } else if (url.includes('spotify.com')) {
            if (play.is_expired()) {
                await play.refreshToken()
            }
            const sp_data: SpotifyTrack | SpotifyAlbum | SpotifyPlaylist = await play.spotify(url).catch((err) => { throw err; })
            if (sp_data.type === 'track') {
                const data = sp_data as SpotifyTrack;
                const search = await play.search(`${data.name} ${data.artists.map((v, i) => v.name).join(" ")}`, {
                    limit: 1
                }).catch((err) => { throw err; });
                const info: InfoData = await play.video_info(search[0].url).catch((err) => { throw err; });
                if (!info.video_details) {
                    throw "No video details found.";
                }
                newSong = new Song(info.video_details, this.handler);
            } else {
                throw `This url is not a single song.`;
            }
        } else if (url.includes('soundcloud.com')) {
            const sc_data: SoundCloudTrack | SoundCloudPlaylist = await play.soundcloud(url).catch((err) => { throw err; })
            if (sc_data.type !== 'track') {
                throw "The url was not for a single song.";
            }
            const data: SoundCloudTrack = sc_data as SoundCloudTrack;
            const search = await play.search(`${data.name} by ${data.user.name}`, {
                limit: 1
            }).catch((err) => { throw err; });
            const info: InfoData = await play.video_info(search[0].url).catch((err) => { throw err; });
            if (!info.video_details) {
                throw "No video details found.";
            }
            newSong = new Song(info.video_details, this.handler);
        } else {
            throw "This url is not from YouTube, Spotify, or SoundCloud.";
        }
        if (newSong === null) {
            throw new Error("The song is was never created.");
        }
        // Check if song is in db
        const songData = await songSchema.findOne({ _id: newSong.id });
        if (!songData) {
            await songSchema.create({
                _id: newSong.id,
                songURL: newSong.url,
                name: newSong.name,
                channel: newSong.channel,
                thumbnailURL: newSong.thumbnail,
                durationInSec: newSong.duration,
                durationRaw: newSong.durationRaw
            })
            logDebug(`Added song (${newSong.id}).`);
        }
        // Check if song is already in queue
        if (!this.songs.find((s: Song) => s.id === newSong.id)) {
            if (this.songs.length === 1) {
                await newSong.createBufferedResource();
            }
            this.songs.push(newSong);
        } else {
            throw `This song is already in the queue.`;
        }
        // Update queue in db
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            },
            {
                upsert: true
            }
        )
        return true;
    }
    async addDbSong(song: dbSong): Promise<Boolean> {
        let newSong: Song | null = new Song(song, this.handler);
        if (newSong === null) {
            throw new Error("The song is was never created.");
        }
        // Check if song is already in queue
        if (!this.songs.find((s: Song) => s.id === newSong.id)) {
            if (this.songs.length === 1) {
                await newSong.createBufferedResource();
            }
            this.songs.push(newSong);
        } else {
            throw `This song is already in the queue.`;
        }
        // Update queue in db
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            },
            {
                upsert: true
            }
        )
        return true;
    }

    async addPlaylist(url: string): Promise<any> {
        // type arrayWaiter = {
        //     newSongs: Song[],
        //     addElement(element: Song): void,
        //     waitForFill(): Promise<unknown>
        // }
        let newSongs: Song[] = [];
        if (url.includes('youtube.com')) {
            const info: YouTubePlayList = await play.playlist_info(url).catch((err) => { throw err; });
            if (!info) {
                throw "No playlist details found.";
            }
            // Get all songs within playlist
            const allSongs: Array<YouTubeVideo> = await info.all_videos().catch((err) => { throw err; });
            if (allSongs.length === 0) {
                throw `Was unable to find any songs in this playlist.`;
            }
            // const songlist = createArrayWaiter(allSongs.length);
            // Add songs to newSongs
            allSongs.forEach((songData) => {
                newSongs.push(new Song(songData, this.handler))
                // songlist.addElement(new Song(songData, this.handler))
            })
            // newSongs = await songlist.waitForFill() as Song[];
        } else if (url.includes('spotify.com')) {
            if (play.is_expired()) {
                await play.refreshToken().catch((err) => { throw err; })
            }
            const sp_data: SpotifyTrack | SpotifyAlbum | SpotifyPlaylist | void = await play.spotify(url).catch((err) => { logError(err, __filename); return; })
            if (!sp_data) {
                throw "Could not find playlist.";
            }
            if (sp_data.type === 'playlist') {
                const data = sp_data as SpotifyPlaylist;
                // Get songs from playlist
                const allSongs: Array<SpotifyTrack> = await data.all_tracks().catch((err) => { throw err; });
                if (allSongs.length === 0) {
                    throw `Was unable to find any songs in this playlist.`;
                }
                // const songlist = createArrayWaiter(allSongs.length);
                allSongs.forEach(async (songData) => {
                    // const search = await play.search(`${songData.name} ${songData.artists.map((v, i) => v.name).join(" ")}`, {
                    //     limit: 1
                    // });
                    // const info: InfoData = await play.video_info(search[0].url);
                    // if (!info.video_details) {
                    //     throw "No video details found.";
                    // }
                    newSongs.push(new Song(songData, this.handler))
                    // songlist.addElement(new Song(songData, this.handler))
                })
                // newSongs = await songlist.waitForFill() as Song[];
            } else if (sp_data.type === 'album') {
                const data = sp_data as SpotifyAlbum;
                // Get songs from playlist
                const allSongs: Array<SpotifyTrack> = await data.all_tracks().catch((err) => { throw err; });
                if (allSongs.length === 0) {
                    throw `Was unable to find any songs in this album.`;
                }
                // const songlist = createArrayWaiter(allSongs.length);
                allSongs.forEach(async (songData) => {
                    // const search = await play.search(`${songData.name} ${songData.artists.map((v, i) => v.name).join(" ")}`, {
                    //     limit: 1
                    // });
                    // const info: InfoData = await play.video_info(search[0].url);
                    // if (!info.video_details) {
                    //     throw "No video details found.";
                    // }
                    newSongs.push(new Song(songData, this.handler))
                    // songlist.addElement(new Song(songData, this.handler))
                })
                // newSongs = await songlist.waitForFill() as Song[];
            } else {
                throw `This url is not a playlist or album.`;
            }
        } else if (url.includes('soundcloud.com')) {
            const sc_data = (await play.soundcloud(url).catch((err) => { throw err; })) as SoundCloudPlaylist
            if (sc_data.type !== 'playlist') {
                throw `This url is not a playlist.`;
            }
            const allSongs: Array<SoundCloudTrack> = await sc_data.all_tracks().catch((err) => { throw err; });
            if (allSongs.length === 0) {
                throw `Was unable to find any songs in this playlist.`;
            }
            // const songlist = createArrayWaiter(allSongs.length);
            allSongs.forEach(async (songData) => {
                // const search = await play.search(`${songData.name} by ${songData.user.name}`, {
                //     limit: 1
                // });
                // const info: InfoData = await play.video_info(search[0].url);
                // if (!info.video_details) {
                //     throw "No video details found.";
                // }
                newSongs.push(new Song(songData, this.handler))

                // songlist.addElement(new Song(songData, this.handler))
            });
            // newSongs = await songlist.waitForFill() as Song[];
        } else {
            throw "This url is not from YouTube, Spotify, or SoundCloud.";
        }
        if (newSongs.length === 0) {
            throw "No songs were found.";
        }
        // Check if song is in db
        // const allSongs = await songSchema.find({ _id: { $in: newSongs.map((v, i) => v.id) } });
        newSongs.forEach(async (songData: Song) => {
            // if (!allSongs.find((song) => song._id === songData.id)) {
            //     await songSchema.create({
            //         _id: songData.id,
            //         songURL: songData.url,
            //         name: songData.name,
            //         channel: songData.channel,
            //         thumbnailURL: songData.thumbnail,
            //         durationInSec: songData.duration,
            //         durationRaw: songData.durationRaw
            //     })
            //     logDebug(`Added song (${songData.id}).`);
            // }
            // Check if song is already in queue
            if (!this.songs.find((s: Song) => s.id === songData.id)) {
                this.songs.push(songData);
            }
        })
        // Update queue in db
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            },
            {
                upsert: true
            }
        )
        return true;
        function createArrayWaiter(targetLength: number) {
            const eventEmitter: EventEmitter = new EventEmitter();
            let newSongs: Song[] = [];

            return {
                newSongs,
                addElement(element: Song) {
                    newSongs.push(element);
                    if (newSongs.length >= targetLength) {
                        eventEmitter.emit('filled', newSongs);
                    }
                },
                waitForFill() {
                    return new Promise((resolve) => {
                        eventEmitter.on('filled', resolve);
                    });
                },
            };
        }

    }

    async clear(): Promise<Boolean> {
        this.songs = new Array();
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            }
        )
        if (fs.existsSync('./temp')) {
            const tempFolder = fs.readdirSync('./temp');
            if (tempFolder.length > 0) {
                for (const tmpFile of tempFolder) {
                    fs.rmSync(`./temp/${tmpFile}`);
                }
                logDebug("Cleared temp folder (./temp).");
            }
        }
        logDebug(`Cleared the queue for bot (${clientId}).`);
        return true;
    }

    async removeSong(songId: string) {
        const tmpFile = `./temp/${songId}-temp_audio.mp3`;
        if (existsSync(tmpFile)) {
            try {
                fs.rmSync(tmpFile);
            } catch (error) {
                console.log(error)
            }
        }
        if (this.songs[1] && this.songs[1].id === songId && this.songs[2]) {
            await this.songs[2].createBufferedResource().catch((err) => {
                throw err;
            })
        }
        // Check if song is in queue
        const targetSong = this.songs.find((s) => s.id === songId);
        if (!targetSong) {
            throw `This song is not in the queue.`;
        }
        this.songs = this.songs.filter((v) => v.id !== songId);
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            }
        )
    }

    async moveSong(songId: string, newPosition: number): Promise<Boolean> {
        // Check if queue is empty or has only one song
        if (this.songs.length < 2) {
            throw `The queue is not large enough to move this song.`;
        }
        // Check if song exists in queue
        const targetSong = this.songs.find((s) => s.id === songId);
        if (!targetSong) {
            throw `This song is not in the queue.`;
        }
        // Check if newPosition is valid
        if (newPosition - 1 >= this.songs.length) {
            throw `This position is not valid.`;
        }
        // Create new song list
        let newList: Song[] = new Array();
        this.songs.filter((song) => song.id !== songId).forEach((v, i) => {
            if (i === newPosition - 1) {
                newList.push(targetSong);
            }
            newList.push(v);
        });
        // Check if song is in correct position
        if (newList[newPosition - 1].id !== songId) {
            return false;
        }
        if (this.songs[1].id !== newList[1].id) {
            await newList[1].createBufferedResource().catch((err) => {
                throw err;
            })
            const tmpFile = `./temp/${newList[1].id}-temp_audio.mp3`;
            if (existsSync(tmpFile)) {
                fs.rm(tmpFile, () => logDebug(`Removed temp audio file (${tmpFile})`));
            }
        }
        this.songs = newList;
        // Update queue in db
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            },
            {
                upsert: true
            }
        )
        return true
    }

    async shuffle() {
        // Exclude the first element for shuffling
        const toShuffle = this.songs.slice(1);

        // Shuffle the array using Fisher-Yates Algorithm
        for (let i = toShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
        }
        this.songs = [this.songs[0], ...toShuffle];
    }
}
function getRandomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function cr(songIndex: number, queue: Queue) {
    if (queue.songs.length === 0) {
        return false;
    }
    const result2 = await queue.songs[songIndex].createBufferedResource();
    if (result2 === true) {
        return true;
    } else {
        queue.removeSong(queue.songs[songIndex].id);
        if (queue.songs.length > songIndex) {
            return await cr(songIndex, queue);
        } else {
            return false;
        }
    }
}
