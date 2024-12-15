import { EmbedBuilder } from "@discordjs/builders";
import { AudioPlayer, AudioResource, VoiceConnection, StreamType } from "@discordjs/voice";
import { Colors, Guild, TextBasedChannel, TextChannel, VoiceBasedChannel, VoiceChannel } from "discord.js";
import { botName, botImage, clientId } from "./config.json";
import { InfoData, SoundCloudPlaylist, SoundCloudTrack, SpotifyAlbum, SpotifyPlaylist, SpotifyTrack, YouTubePlayList, YouTubeVideo } from "play-dl";
import { AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior } from '@discordjs/voice';
import songSchema from "./schemas/song-schema";
import queueSchema from "./schemas/queue-schema";
import logDebug from "./logDebug";
import client from "./index";
import ffmpeg from 'fluent-ffmpeg';
const youtubedl = require('youtube-dl-exec');
import play from 'play-dl';
import prism from 'prism-media';
import { client_id, client_secret, refresh_token } from './data/spotify.json';
import { WritableStreamBuffer } from 'stream-buffers';
import { EventEmitter, Readable } from 'stream';
import fs, { existsSync, rmSync } from 'fs';
import logError from "./logError";
import settingsSchema from "./schemas/settings-schema";
import path from "path";
import { cookies } from './data/cookies.json';
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
    loopSong: Boolean;
    loopQueue: Boolean;
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
        this.loopSong = false;
        this.loopQueue = false;
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
        this.isAutoplay = true;
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
        await this.queue.songs[0].createBufferedResource();
        const resource = await this.queue.songs[0].getBufferedResource();
        this.player.play(resource);
        this.connection.subscribe(this.player);
        this.isPlaying = true;
        this.nowPlaying = this.queue.songs[0];
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
            const resource = await this.queue.songs[0].getBufferedResource();
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
        await this.queue.clear();
        this.player.stop(true);
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
        this.isSeeking = true;
        this.player.stop(true);
        const resource: any = await this.nowPlaying.getBufferedResource(seconds);
        this.player.play(resource);
        this.isSeeking = false;
    }

    async skip() {
        // Check if song is currently playing
        if (this.isPlaying === false) {
            throw `There is nothing currently playing.`;
        }
        if (!this.nowPlaying) {
            throw `There is nothing currently playing.`;
        }
        this.player.stop(true);
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
    startListeners() {
        const clientMember = this.guild.members.cache.get(clientId);
        if (!clientMember) {
            throw "No client member detected.";
        }
        // Check for commands channel
        settingsSchema.findOne({ _id: this.guild.id }).then((result) => {
            // Check for channel
            const targetChannel: TextChannel = this.guild.channels.cache.get(result?.channelId as string) as TextChannel;
            if (targetChannel) {
                // Buffering
                this.player.on(AudioPlayerStatus.Buffering, () => {
                    logDebug('Audio is now buffering!');
                });
                // Playing
                this.player.on(AudioPlayerStatus.Playing, () => {
                    if (this.isSeeking === true) {
                        return;
                    }
                    this.isPlaying = true;
                    logDebug('Audio is now playing!');
                    if (this.isPaused === true) {
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`Music Unpaused`)
                            .setDescription(`The music has been unpaused.`)
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        targetChannel.send({
                            embeds: [replyEmbed]
                        });
                    } else {
                        if (result?.channelId !== null) {
                            if (this.nowPlaying) {
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
                        if (this.queue.songs.length > 1) {
                            this.queue.songs[1].createBufferedResource();
                        }
                    }
                });
                // Paused
                this.player.on(AudioPlayerStatus.Paused, () => {
                    logDebug('Audio is now paused!');
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
                });
                // Idle
                this.player.on(AudioPlayerStatus.Idle, async () => {
                    try {
                        if (this.isSeeking === true) {
                            return;
                        }
                        if (this.isRepeatSingle === true) {
                            if (!this.nowPlaying) {
                                this.isRepeatSingle = false;
                                throw "Nothing currently playing.";
                            }
                            const resource = await this.nowPlaying.getBufferedResource();
                            this.player.play(resource);
                        } else if (this.isRepeatAll === true) {
                            if (this.queue.songs.length <= 1) {
                                if (!this.nowPlaying) {
                                    this.isRepeatAll = false;
                                    throw "Nothing currently playing.";
                                }
                                const resource = await this.nowPlaying.getBufferedResource();
                                this.player.play(resource);
                            } else {
                                if (!this.nowPlaying) {
                                    this.isRepeatAll = false;
                                    throw "Nothing currently playing.";
                                }
                                this.queue.songs.push(this.nowPlaying);
                                this.queue.songs.shift();
                                this.nowPlaying = this.queue.songs[0];
                                const resource = await this.queue.songs[0].getBufferedResource();
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
                                    const resource = await this.queue.songs[0].getBufferedResource();
                                    this.player.play(resource);
                                } else {
                                    if (result?.channelId !== null) {
                                        logDebug('Audio has finished playing.');
                                        const replyEmbed = new EmbedBuilder()
                                            .setTitle('**Finished Playing**')
                                            .setDescription(`Audio has finished playing, add more songs using \`/play\``)
                                            .setColor(Colors.Blue)
                                            .setFooter(embedFooter)
                                        targetChannel.send({
                                            embeds: [replyEmbed]
                                        });
                                    }
                                    if (this.connection) {
                                        this.connection.destroy();
                                    }
                                }
                            } else {
                                // Remove old buffer file
                                if (this.nowPlaying) {
                                    const tmpFile = `./src/temp/${this.nowPlaying.id}-temp_audio.pcm`;
                                    if (existsSync(tmpFile)) {
                                        fs.rm(tmpFile, () => logDebug(`Removed temp audio file (${tmpFile})`));
                                    }
                                }
                                await this.queue.removeSong(this.queue.songs[0].id);
                                // Set now playing to next song
                                this.nowPlaying = this.queue.songs[0];
                                const resource = await this.nowPlaying.getBufferedResource();
                                this.player.play(resource);
                                this.queue.removeSong(this.nowPlaying.id);
                            }
                            this.isPlaying = false;
                        }
                    } catch (error: any) {
                        logError(error, __filename);
                    }
                });
                // Error
                this.player.on('error', (error) => {
                    logError(error, __filename);
                    if (result?.channelId !== null) {
                        const replyEmbed = new EmbedBuilder()
                            .setTitle('**Music Status**')
                            .setDescription(`Audio has stopped playing due to an error.`)
                            .setColor(Colors.Red)
                            .setFooter(embedFooter)
                        targetChannel.send({
                            embeds: [replyEmbed]
                        });
                    }
                    if (this.connection) {
                        this.connection.destroy();
                    }
                });
                // Voice state update
                client.on('voiceStateUpdate', (oldState, newState) => {
                    if (newState) {
                        if (newState.channel) {
                            if (newState.member) {
                                if (newState.member.id === clientId) {
                                    this.connection = joinVoiceChannel({
                                        channelId: targetChannel.id, // Ensure you save the old channel ID
                                        guildId: this.guild.id,
                                        adapterCreator: this.guild.voiceAdapterCreator
                                    });
                                }
                            }
                        }
                    }
                });
            }
        })
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
            this.durationRaw = info.durationRaw;
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
            this.durationRaw = "Unknown";
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
            this.durationRaw = "Unknown";
            this.id = `SC-${info.id}`;
            this.thumbnail = "Unknown";
            this.handler = musicHandler;
            this.type = "SoundCloudTrack";
        } else {
            const info2: dbSong = info;
            if (!info2) {
                throw "No video details found.";
            }
            if (!info2.name) {
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

    async getBufferedResource(seekInSeconds?: number): Promise<AudioResource> {
        // Stream the audio data into the buffer
        // Create FFmpeg command
        const tmpFile = `./src/temp/${this.id}-temp_audio.pcm`;
        const archFile = path.resolve(__dirname, `./src/archive/${this.id}-temp_audio.pcm`);
        if (!existsSync(archFile)) {
            const output = await youtubedl(this.url, {
                format: 'bestaudio', // Get the best audio or change to "best" for video+audio
                dumpSingleJson: true, // Return metadata in JSON format
            });
            const volumeFactor = parseFloat((this.handler.volume / 1000).toPrecision(2));
            if (existsSync(tmpFile)) {
                await rmSync(tmpFile);
            }
            const ffmpegPromise = new Promise((resolve, reject) => {
                ffmpeg(output.url)
                    .seekInput((seekInSeconds) ? seekInSeconds : 0)
                    .audioCodec('pcm_s16le')
                    .audioFilters(`volume=${volumeFactor}`) // Apply volume adjustment
                    .format('s16le')
                    .output(tmpFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            await ffmpegPromise;
            logDebug(`Created buffer file (${tmpFile}) for song (${this.id}).`);
        } else {
            const volumeFactor = parseFloat((this.handler.volume / 1000).toPrecision(2));
            if (existsSync(tmpFile)) {
                await rmSync(tmpFile);
            }
            const ffmpegPromise = new Promise((resolve, reject) => {
                ffmpeg(archFile)
                    .seekInput((seekInSeconds) ? seekInSeconds : 0)
                    .audioCodec('pcm_s16le')
                    .audioFilters(`volume=${volumeFactor}`) // Apply volume adjustment
                    .format('s16le')
                    .output(tmpFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            await ffmpegPromise;
            logDebug(`Created buffer file (${tmpFile}) for song (${this.id}).`);
        }
        // Read the file into a stream
        const fileStream = fs.createReadStream(tmpFile);
        return createAudioResource(fileStream, { inputType: StreamType.Raw });
    }

    async createBufferedResource() {
        if (this.type === "SoundCloudTrack") {
            const search = await play.search(`${this.name} by ${this.channel}`, {
                limit: 1
            });
            const infoData: InfoData = await play.video_info(search[0].url);
            if (!infoData.video_details) {
                throw "No video details found.";
            }
            const info = infoData.video_details;
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
            this.durationRaw = info.durationRaw;
            this.id = info.id;
            this.thumbnail = (info.thumbnails[0]) ? info.thumbnails[0].url : null;
            this.handler = this.handler;
            this.type = "YouTubeVideo";
            const songData = await songSchema.findOne({ _id: info.id });
            if (!songData) {
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
        } else if (this.type === "SpotifyTrack") {
            const search = await play.search(`${this.name} ${this.channel}`, {
                limit: 1
            });
            const infoData: InfoData = await play.video_info(search[0].url);
            if (!infoData.video_details) {
                throw "No video details found.";
            }
            const info = infoData.video_details;
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
            this.durationRaw = info.durationRaw;
            this.id = info.id;
            this.thumbnail = (info.thumbnails[0]) ? info.thumbnails[0].url : null;
            this.handler = this.handler;
            this.type = "YouTubeVideo";

            this.url = info.url
            const songData = await songSchema.findOne({ _id: info.id });
            if (!songData) {
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
        }
        const archFile = `./src/archive/${this.id}-temp_audio.pcm`;
        if (!existsSync(archFile)) {
            const output = await youtubedl(this.url, {
                format: 'bestaudio', // Get the best audio or change to "best" for video+audio
                dumpSingleJson: true, // Return metadata in JSON format
            });
            const volumeFactor = parseFloat((this.handler.volume / 1000).toPrecision(2));
            const ffmpegPromise = new Promise((resolve, reject) => {
                ffmpeg(output.url)
                    .audioCodec('pcm_s16le')
                    .audioFilters(`volume=${volumeFactor}`) // Apply volume adjustment
                    .format('s16le')
                    .output(archFile)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            await ffmpegPromise;
            logDebug(`Created buffer file (${archFile}) for song (${this.id}).`);
        }
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
        queueSchema.findOne({ _id: clientId }).then((result) => {
            if (result) {
                if (result.songs.length > 0) {
                    // Get song data from db
                    songSchema.find({ _id: { $in: result.songs } }).then((result) => {
                        result.forEach((song) => {
                            // play.video_info(`https://www.youtube.com/watch?v=${songId}`).then((infoData) => {
                            //     this.songs.push(new Song(infoData.video_details, this.handler));
                            // })
                            this.songs.push(new Song(song as dbSong, this.handler));
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
            const info: InfoData = await play.video_info(url);
            if (!info.video_details) {
                throw "No video details found.";
            }
            newSong = new Song(info.video_details, this.handler);
        } else if (url.includes('spotify.com')) {
            if (play.is_expired()) {
                await play.refreshToken()
            }
            const sp_data: SpotifyTrack | SpotifyAlbum | SpotifyPlaylist = await play.spotify(url)
            if (sp_data.type === 'track') {
                const data = sp_data as SpotifyTrack;
                const search = await play.search(`${data.name} ${data.artists.map((v, i) => v.name).join(" ")}`, {
                    limit: 1
                });
                const info: InfoData = await play.video_info(search[0].url);
                if (!info.video_details) {
                    throw "No video details found.";
                }
                newSong = new Song(info.video_details, this.handler);
            } else {
                throw `This url is not a single song.`;
            }
        } else if (url.includes('soundcloud.com')) {
            const sc_data: SoundCloudTrack | SoundCloudPlaylist = await play.soundcloud(url)
            if (sc_data.type !== 'track') {
                throw "The url was not for a single song.";
            }
            const data: SoundCloudTrack = sc_data as SoundCloudTrack;
            const search = await play.search(`${data.name} by ${data.user.name}`, {
                limit: 1
            });
            const info: InfoData = await play.video_info(search[0].url);
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
                newSong.createBufferedResource();
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
                newSong.createBufferedResource();
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
        type arrayWaiter = {
            newSongs: Song[],
            addElement(element: Song): void,
            waitForFill(): Promise<unknown>
        }
        let newSongs: Song[] = [];
        if (url.includes('youtube.com')) {
            const info: YouTubePlayList = await play.playlist_info(url);
            if (!info) {
                throw "No playlist details found.";
            }
            // Get all songs within playlist
            const allSongs: Array<YouTubeVideo> = await info.all_videos();
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
                await play.refreshToken()
            }
            const sp_data: SpotifyTrack | SpotifyAlbum | SpotifyPlaylist | void = await play.spotify(url).catch((err) => { logError(err, __filename); return; })
            if (!sp_data) {
                throw "Could not find playlist.";
            }
            if (sp_data.type === 'playlist') {
                const data = sp_data as SpotifyPlaylist;
                // Get songs from playlist
                const allSongs: Array<SpotifyTrack> = await data.all_tracks();
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
                const allSongs: Array<SpotifyTrack> = await data.all_tracks();
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
            const sc_data = (await play.soundcloud(url)) as SoundCloudPlaylist
            if (sc_data.type !== 'playlist') {
                throw `This url is not a playlist.`;
            }
            const allSongs: Array<SoundCloudTrack> = await sc_data.all_tracks();
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
        // const allSongs = await songSchema.find({ _id: { $in: songs.map((v, i) => v.id) } });
        newSongs.forEach(async (songData: Song) => {
            // if (!allSongs.find((song) => song._id === songData.id)) {
            //     songSchema.create({
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
        })
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
                        console.log('waiting')
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
        if (fs.existsSync('./src/temp')) {
            const tempFolder = fs.readdirSync('./src/temp');
            if (tempFolder.length > 0) {
                for (const tmpFile of tempFolder) {
                    fs.rmSync(`./src/temp/${tmpFile}`);
                }
                logDebug("Cleared temp folder (./src/temp).");
            }
        }
        logDebug(`Cleared the queue for bot (${clientId}).`);
        return true;
    }

    async removeSong(songId: string) {
        const tmpFile = `./src/temp/${songId}-temp_audio.pcm`;
        if (existsSync(tmpFile)) {
            fs.rmSync(tmpFile);
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
        const newList = new Array();
        for (let i = 0; i < this.songs.length; i++) {
            let tempSong = this.songs[i];
            if (i === newPosition) {
                newList.push(tempSong);
                i++;
                tempSong = this.songs[i];
                newList.push(tempSong);
            } else {
                newList.push(tempSong);
            }
        }
        this.songs = newList;
        // Check if song is in correct position
        if (this.songs[newPosition - 1].id !== songId) {
            return false;
        }
        // Update queue in db
        await queueSchema.findOneAndUpdate(
            {
                _id: clientId
            },
            {
                songs: this.songs.map((v, i) => v.id)
            }
        )
        return true
    }

    async shuffle() {
        let newList: Song[] = [];
        let randomNUmList: number[] = [];
        let usedNums: number[] = [];
        while (randomNUmList.length < this.songs.length) {
            const randomNum = getRandomInteger(0, this.songs.length - 1);
            if (!usedNums.includes(randomNum)) {
                randomNUmList.push(getRandomInteger(0, this.songs.length - 1));
                usedNums.push(randomNum);
            }
        }
        randomNUmList.forEach((num: number) => {
            newList.push(this.songs[num]);
        })
        this.songs = newList;
    }
}
function getRandomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
