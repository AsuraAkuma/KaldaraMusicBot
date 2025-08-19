// Slash command for playing songs from YouTube, Spotify, or SoundCloud in the music bot.
import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, GuildChannel, Guild, GuildMember, Colors } from 'discord.js';
import { botImage, botName, clientId } from '../../config.json';
import { MusicHandler, Song, Queue } from '../../MusicHandler';
import logError from '../../logError';
import play, { YouTubeVideo } from 'play-dl';
import { ActionRowBuilder, EmbedBuilder, SlashCommandNumberOption, StringSelectMenuBuilder } from '@discordjs/builders';
import settingsSchema from '../../schemas/settings-schema';
import playlistSchema from '../../schemas/playlist-schema';
import songSchema from '../../schemas/song-schema';
// const mongo = require('../mongo');
// Create musichandler

const embedFooter = {
    text: botName,
    iconURL: botImage
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

module.exports = {
    run: async (client: Client, interaction: any, handler: MusicHandler) => {
        const channel: GuildChannel = interaction.channel;
        const guild: Guild = interaction.guild;
        const options: any = interaction.options;
        const member: GuildMember = interaction.member;
        const { _hoistedOptions, _subcommand, _group } = options
        try {
            if (_subcommand === "song") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                const songURL = _hoistedOptions[0].value;
                await handler.queue.addSong(songURL);
                // Check if song is currently playing
                const clientMember = guild.members.cache.get(clientId);
                if (!clientMember) {
                    throw `I am lost, try again.`;
                }
                if (handler.isPlaying === false) {
                    // Check if bot is in voice channel
                    handler.play(member.voice.channel);
                }

                const replyEmbed = new EmbedBuilder()
                    .setTitle('**Play Song**')
                    .setDescription(`Your song has been added to the queue!`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "playlist") {
                const playlistURL = _hoistedOptions[0].value;
                const res = await handler.queue.addPlaylist(playlistURL).catch((reason) => { throw reason })
                if (res === true) {
                    // Check if song is currently playing
                    if (handler.isPlaying === false) {
                        if (!member.voice) {
                            throw `You are not connected to a voice channel.`;
                        }
                        if (!member.voice.channel) {
                            throw `You are not connected to a voice channel.`;
                        }

                        handler.play(member.voice.channel);
                    }
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Play Playlist**')
                        .setDescription(`Your songs have been added to the queue!`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                }
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "search") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                const search: YouTubeVideo[] = await play.search(`${options._hoistedOptions[0].value}`, {
                    limit: 10
                }).catch(() => {
                    throw "Was not able to search for that song, try again later.";
                });
                const menuOptions = new Array();
                for (let i = 0; i < search.length; i++) {
                    const searchResult = search[i];
                    const option = {
                        label: `[${i + 1}.]${(searchResult.title) ? searchResult.title.slice(0, 94) : "Unknown"}`,
                        value: searchResult.url,
                        description: `Channel: [${(searchResult.channel) ? (searchResult.channel.name) ? searchResult.channel.name.slice(0, 69) : "Unknown" : "Unknown"}] Duration: [${searchResult.durationRaw}]`,
                        default: false
                    }
                    menuOptions.push(option)
                }
                const menu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`music-search-${member.id}`)
                            .setMaxValues(1)
                            .setMinValues(1)
                            .setOptions(menuOptions)
                            .setPlaceholder("Select a song")
                    )
                const embed = new EmbedBuilder()
                    .setTitle(`**Search**`)
                    .setDescription(`**Pick a song that you wish to play.**\n${search.map((v, i) => `**[${i + 1}.]** **${(v.title) ? v.title : "Unknown"}**\n┣━Duration: **${v.durationRaw}**\n\t\t┗━Channel: **${(v.channel) ? (v.channel.name) ? v.channel.name : "Unknown" : "Unknown"}**`).join("\n\n")}`)
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed],
                    components: [menu]
                });
            } else if (_subcommand === "custom_playlist") {
                const playlistId = `${member.id}-${_hoistedOptions[0].value}`;
                const targetPlaylist = await playlistSchema.findOne({ _id: playlistId });
                if (!targetPlaylist) {
                    throw "That playlist doesn\'t exist";
                }
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                const songs = await songSchema.find({ _id: { $in: targetPlaylist.songs.sort((a, b) => a.index - b.index).map((v, i) => v.songId) } });
                songs.forEach(async (song) => {
                    if (!handler.queue.songs.find(s => s.id === song._id)) {
                        await handler.queue.addDbSong(song as dbSong);
                    }
                })
                if (handler.isPlaying === false) {
                    await handler.play(member.voice.channel);
                }
                const embed = new EmbedBuilder()
                    .setTitle(`**Play Custom Playlist**`)
                    .setDescription(`Your playlist has been added to the queue.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "skip") {
                const settings = await settingsSchema.findOne({ _id: guild.id });
                if (!settings) {
                    throw "There are no settings.";
                }
                if (settings.skipEnabled === false) {
                    throw "Skipping is not enabled.";
                }
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.skip();
                const embed = new EmbedBuilder()
                    .setTitle(`**Play Skip**`)
                    .setDescription(`You have skipped the currently playing song.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "stop") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.stop();
                const embed = new EmbedBuilder()
                    .setTitle(`**Play Stop**`)
                    .setDescription(`You have stopped the bot from playing music and cleared the queue.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "pause") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.pause();
                const embed = new EmbedBuilder()
                    .setTitle(`**Play Pause**`)
                    .setDescription(`You have paused the bot from playing music.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
            } else if (_subcommand === "unpause") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                // Check if bot is in voice channel
                const clientMember = guild.members.cache.get(clientId);
                if (!clientMember) {
                    throw `I am lost, try again.`;
                }
                if (!handler.connection) {
                    await handler.connect(member.voice.channel);
                }
                await handler.unpause().catch((err) => {
                    throw err;
                });
                const embed = new EmbedBuilder()
                    .setTitle(`**Play Unpause**`)
                    .setDescription(`You have unpaused the bot from playing.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "seek") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                const seconds = (_hoistedOptions[0].value * 60 * 60) + (_hoistedOptions[1].value * 60) + _hoistedOptions[2].value;
                if (seconds === 0) {
                    throw "You can not seek for 0 seconds.";
                }
                await handler.seek(seconds);
                const hoursFormatted = `${(_hoistedOptions[0].value > 0) ? `${(_hoistedOptions[0].value <= 9) ? "0" : ""}${_hoistedOptions[0].value}:` : ""}`;
                const minutesFormatted = `${(_hoistedOptions[1].value <= 9) ? "0" : ""}${_hoistedOptions[1].value}`;
                const secondsFormatted = `${(_hoistedOptions[2].value <= 9) ? "0" : ""}${_hoistedOptions[2].value}`;

                const embed = new EmbedBuilder()
                    .setTitle(`**Play Seek**`)
                    .setDescription(`You have seeked to **${hoursFormatted}${minutesFormatted}:${secondsFormatted}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [embed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            }
        } catch (content: any) {
            if (typeof content === "object") {
                // Is error
                logError(content, __filename);
                const replyEmbed = new EmbedBuilder()
                    .setTitle('**ERROR**')
                    .setDescription(`An error has occured, notify <@339917839483797504> of this error time **${new Date().toUTCString()}**.`)
                    .setColor(Colors.Red)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: []
                });
            } else {
                const replyEmbed = new EmbedBuilder()
                    .setTitle('**ERROR**')
                    .setDescription(content)
                    .setColor(Colors.Red)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: []
                });
            }
        }
    },
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription('Plays a song, playlist, or searched key terms.')
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('song')
                .setDescription('Play a song from the url.')
                .addStringOption((option: SlashCommandStringOption) =>
                    option
                        .setName('song_url')
                        .setDescription('The url of the song.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('playlist')
                .setDescription('Play a playlist from the url.')
                .addStringOption(option =>
                    option
                        .setName('playlist_url')
                        .setDescription('The url of the playlist.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search songs and pick one to play.')
                .addStringOption(option =>
                    option
                        .setName('song_name')
                        .setDescription('Key words used to find the song.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('custom_playlist')
                .setDescription('Play a custom playlist.')
                .addStringOption(option =>
                    option
                        .setName('playlist_id')
                        .setDescription('The id of one of your playlists.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip the current song playing.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the current song playing.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Pause the current song playing.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unpause')
                .setDescription('Unpause the current song playing.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('seek')
                .setDescription('Seek to a time in the song.')
                .addNumberOption((option: SlashCommandNumberOption) =>
                    option
                        .setName('hours')
                        .setDescription('The hours')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(23)
                )
                .addNumberOption((option: SlashCommandNumberOption) =>
                    option
                        .setName('minutes')
                        .setDescription('The minutes')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(59)
                )
                .addNumberOption((option: SlashCommandNumberOption) =>
                    option
                        .setName('seconds')
                        .setDescription('The seconds')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(59)
                )
        )
}
