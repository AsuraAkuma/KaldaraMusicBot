// Slash command for managing playlists, including creation, editing, and playback in the music bot.
import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, GuildChannel, Guild, GuildMember, Colors, APIMessageComponentEmoji, ButtonStyle } from 'discord.js';
import { botImage, botName, clientId } from '../../config.json';
import { MusicHandler, Song, Queue } from '../../MusicHandler';
import logError from '../../logError';
import play, { InfoData, SoundCloudPlaylist, SoundCloudTrack, SpotifyAlbum, SpotifyPlaylist, SpotifyTrack, YouTubePlayList, YouTubeVideo } from 'play-dl';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandNumberOption, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from '@discordjs/builders';
import settingsSchema from '../../schemas/settings-schema';
import playlistSchema from '../../schemas/playlist-schema';
import songSchema from '../../schemas/song-schema';
import logDebug from '../../logDebug';
import { EventEmitter } from 'stream';
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
            if (_subcommand === "create") {
                const playlist = {
                    name: "",
                    description: null,
                    thumbnailURL: null
                }
                _hoistedOptions.forEach((option: any) => {
                    if (option.name === "name") {
                        playlist['name'] = option.value;
                    }
                    if (option.name === "description") {
                        playlist['description'] = option.value;
                    }
                    if (option.name === "thumbnail_url") {
                        const isValidUrl = (urlString: string) => {
                            var urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
                                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
                                '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
                                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
                                '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
                                '(\\#[-a-z\\d_]*)?$', 'i'); // validate fragment locator
                            return !!urlPattern.test(urlString);
                        }
                        if (isValidUrl(option.value) === false) {
                            throw "URL is not valid";
                        }
                        playlist['thumbnailURL'] = option.value;
                    }
                })
                // Check if playlist exists for user
                const result = await playlistSchema.findOne({ name: playlist.name });
                const allUserPlaylists = (await playlistSchema.find({ owner: member.id })).sort((a, b) => parseInt(b._id.split("-")[1]) - parseInt(a._id.split("-")[1]));
                if (result) {
                    throw "This playlist name is already used.";
                }
                const playlistId = `${member.id}-${(allUserPlaylists.length > 0) ? parseInt(allUserPlaylists[0]._id.split("-")[1]) + 1 : 0}`
                await playlistSchema.create({
                    _id: playlistId,
                    owner: member.id,
                    name: playlist.name,
                    description: playlist.description,
                    thumbnail: playlist.thumbnailURL,
                    songs: []
                }).catch((err) => { throw new Error(err) });
                const newPlaylist = await playlistSchema.findOne({ _id: playlistId });
                const replyEmbed = new EmbedBuilder()
                    .setTitle('**Playlist Create**')
                    .setDescription(`You have created a new playlist named **${playlist.name}** with id **${playlistId.split("-")[1]}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "edit") {
                const allPlaylists = await playlistSchema.find({ owner: member.id });
                if (allPlaylists.length === 0) {
                    throw "You don\'t have any playlists.";
                }
                const targetId = `${member.id}-${_hoistedOptions[0].value}`;
                const targetPlaylist = allPlaylists.find((p) => p._id === targetId);
                if (!targetPlaylist) {
                    throw "This playlist doesn\'t exist.";
                }
                if (_hoistedOptions.length === 1) {
                    throw "You haven\'t edited anything.";
                }
                _hoistedOptions.forEach((option: any) => {
                    if (option.name === "name") {
                        if (targetPlaylist.name === option.value) {
                            throw "The name provided is already used.";
                        }
                        targetPlaylist['name'] = option.value;
                    }
                    if (option.name === "description") {
                        if (targetPlaylist.description === option.value) {
                            throw "The name provided is already used.";
                        }
                        targetPlaylist['description'] = option.value;
                    }
                    if (option.name === "thumbnail_url") {
                        if (targetPlaylist.thumbnail === option.value) {
                            throw "The name provided is already used.";
                        }
                        targetPlaylist['thumbnail'] = option.value;
                    }
                })
                await playlistSchema.findOneAndUpdate(
                    {
                        _id: targetId,
                    },
                    {
                        name: targetPlaylist.name,
                        description: targetPlaylist.description,
                        thumbnail: targetPlaylist.thumbnail
                    }
                ).catch((err) => { throw new Error(err) });
                const replyEmbed = new EmbedBuilder()
                    .setTitle('**Playlist Edit**')
                    .setDescription(`You have edited the playlist with id **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "delete") {
                // Check for playlist
                const result = await playlistSchema.findOne({ _id: `${member.id}-${_hoistedOptions[0].value}` }).catch((err) => { throw new Error(err) });
                if (!result) {
                    throw "This playlist doesn\'t exist.";
                }
                await playlistSchema.findOneAndDelete({ _id: `${member.id}-${_hoistedOptions[0].value}` }).catch((err) => { throw new Error(err) });
                const replyEmbed = new EmbedBuilder()
                    .setTitle('**Playlist Delete**')
                    .setDescription(`You have deleted the playlist with id **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "add_song") {
                // Get all playlists
                const allPlaylists = await playlistSchema.find({ owner: member.id });
                if (allPlaylists.length === 0) {
                    throw "You have no playlists.";
                }
                let newSong: Song | null = null;
                const url = _hoistedOptions[0].value;
                if (url.includes('www.youtube.com') || url.includes('www.youtu.be')) {
                    if (url.includes('www.youtube.com')) {
                        const id = url.split("=")[1].split("&")[0];
                        // Check for song data in db
                        const songData = await songSchema.findOne({ _id: id });
                        if (songData) {
                            newSong = new Song(songData as dbSong, handler);
                        }
                    } else if (url.includes('www.youtu.be')) {
                        const id = url.split("be/")[1].split("?")[0];
                        // Check for song data in db
                        const songData = await songSchema.findOne({ _id: id });
                        if (songData) {
                            newSong = new Song(songData as dbSong, handler);
                        }
                    } else {
                        const info: InfoData = await play.video_info(url);
                        if (!info.video_details) {
                            throw "No video details found.";
                        }
                        newSong = new Song(info.video_details, handler);
                    }
                } else if (url.includes('www.spotify.com')) {
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
                        newSong = new Song(info.video_details, handler);
                    } else {
                        throw `This url is not a single song.`;
                    }
                } else if (url.includes('www.soundcloud.com')) {
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
                    newSong = new Song(info.video_details, handler);
                } else {
                    throw "This url is not from YouTube, Spotify, or SoundCloud.";
                }
                if (newSong === null) {
                    throw new Error("The song was never created.");
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
                let textList: any = [];
                let charCount: any = [];
                let components: any = [];
                let index = 1;
                let listIndex = 0;
                allPlaylists.forEach((playlist) => {
                    // const text = `**[${index}.]** **${songData.name}**\n┣━Duration: ** ${songData.durationRaw}**\n\t\t┗━Channel: ** ${songData.channel}**\n\n`;
                    const text = `**${playlist.name}**\n> ${playlist.description}\nSongs: **${playlist.songs.length}**\n\n`;
                    if (!textList[listIndex]) {
                        textList[listIndex] = [];
                    }
                    if (!charCount[listIndex]) {
                        charCount[listIndex] = 0;
                    }
                    if (!components[listIndex]) {
                        components[listIndex] = [];
                    }
                    if (charCount[listIndex] > 3900 || components[listIndex].length === 24) {
                        listIndex++;
                        textList[listIndex] = [];
                        charCount[listIndex] = 0;
                        components[listIndex] = [];
                    }
                    textList[listIndex].push(text);
                    charCount[listIndex] += text.length;
                    const component = new StringSelectMenuOptionBuilder()
                        .setLabel(playlist.name)
                        .setValue(playlist.id)
                        .setDescription(`Songs: ${playlist.songs.length}`)
                    components[listIndex].push(component);
                    index++;
                })
                const row = new ActionRowBuilder()
                    .setComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`music-playlist-add-[${newSong.id}`)
                            .setMinValues(1)
                            .setMaxValues(components[listIndex].length)
                            .setOptions(components[listIndex])
                    )
                const row2 = new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-prev-0`)
                            .setLabel('Prev')
                            .setEmoji({ name: "⬅️" })
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-next-0`)
                            .setLabel('Next')
                            .setEmoji({ name: "➡️" })
                            .setStyle(ButtonStyle.Primary)
                    )
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Playlist Add Song**`)
                    .setDescription(textList[0].join(""))
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: (textList.length > 1) ? [row, row2] : [row]
                });

            } else if (_subcommand === "remove_song") {
                const targetUser = (!_hoistedOptions[0]) ? member : guild.members.cache.get(_hoistedOptions[0].value);
                if (!targetUser) {
                    throw "This member is not in the server.";
                }
                const allPlaylists = await playlistSchema.find({ owner: targetUser.id });
                let textList: any = [];
                let charCount: any = [];
                let components: any = [];
                let index = 1;
                let listIndex = 0;
                allPlaylists.forEach((playlist) => {
                    const text = `**${playlist.name}**\nID: **${playlist.id.split("-")[1]}**\n${(playlist.description) ? `> ${playlist.description}\n` : ""}Songs: **${playlist.songs.length}**\n\n`;
                    if (!textList[listIndex]) {
                        textList[listIndex] = [];
                    }
                    if (!charCount[listIndex]) {
                        charCount[listIndex] = 0;
                    }
                    if (!components[listIndex]) {
                        components[listIndex] = [];
                    }
                    if (charCount[listIndex] > 3900 || components[listIndex].length === 24) {
                        listIndex++;
                        textList[listIndex] = [];
                        charCount[listIndex] = 0;
                        components[listIndex] = [];
                    }
                    textList[listIndex].push(text);
                    charCount[listIndex] += text.length;
                    const component = new StringSelectMenuOptionBuilder()
                        .setLabel(playlist.name)
                        .setValue(playlist.id)
                        .setDescription(`Songs: ${playlist.songs.length}`)
                    components[listIndex].push(component);
                    index++;
                })
                const row = new ActionRowBuilder()
                    .setComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`music-playlist-remove-select-${targetUser.id}`)
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setOptions(components[listIndex])
                    )
                const row2 = new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-remove-prev-0-${targetUser.id}`)
                            .setLabel('Prev')
                            .setEmoji({ name: "⬅️" })
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-remove-next-0-${targetUser.id}`)
                            .setLabel('Next')
                            .setEmoji({ name: "➡️" })
                            .setStyle(ButtonStyle.Primary)
                    )
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**${targetUser.displayName}\'s Playlists**`)
                    .setDescription(textList[0].join(""))
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: (textList.length > 1) ? [row, row2] : [row]
                });
            } else if (_subcommand === "add_playlist") {
                // Get all playlists
                const allPlaylists = await playlistSchema.find({ owner: member.id });
                if (allPlaylists.length === 0) {
                    throw "You have no playlists.";
                }
                const playlistId = `${member.id}-${_hoistedOptions[0].value}`;
                const targetPlaylist = allPlaylists.find((p) => p._id === playlistId);
                if (!targetPlaylist) {
                    throw "This playlist does not exist.";
                }
                const url = _hoistedOptions[1].value;
                let newSongs: Song[] = await getSongs();
                async function getSongs() {
                    let newSongs: Song[] = [];
                    if (url.includes('www.youtube.com')) {
                        const info: YouTubePlayList = await play.playlist_info(url, { incomplete: true });
                        if (!info) {
                            throw "No playlist details found.";
                        }
                        // Get all songs within playlist
                        const allSongs: Array<YouTubeVideo> = await info.all_videos().catch((err) => { throw err.message });
                        if (allSongs.length === 0) {
                            throw `Was unable to find any songs in this playlist.`;
                        }
                        // const songlist = createArrayWaiter(allSongs.length);
                        // Add songs to newSongs
                        allSongs.forEach((songData) => {
                            newSongs.push(new Song(songData, handler))
                            // songlist.addElement(new Song(songData, this.handler))
                        })
                        // newSongs = await songlist.waitForFill() as Song[];
                    } else if (url.includes('www.spotify.com')) {
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
                            const songlist = createArrayWaiter(allSongs.length);
                            allSongs.forEach(async (songData: SpotifyTrack) => {
                                // const search = await play.search(`${songData.name} ${songData.artists.map((v, i) => v.name).join(" ")}`, {
                                //     limit: 1
                                // });
                                // const info: InfoData = await play.video_info(search[0].url);
                                // newSongs.push(new Song(info.video_details, handler))
                                songlist.addElement(new Song(songData, handler))
                            })
                            newSongs = await songlist.waitForFill() as Song[];
                        } else if (sp_data.type === 'album') {
                            const data = sp_data as SpotifyAlbum;
                            // Get songs from playlist
                            const allSongs: Array<SpotifyTrack> = await data.all_tracks();
                            if (allSongs.length === 0) {
                                throw `Was unable to find any songs in this album.`;
                            }
                            const songlist = createArrayWaiter(allSongs.length);
                            newSongs = (await songlist.waitForFill()) as Song[];
                            allSongs.forEach(async (songData: SpotifyTrack) => {
                                // const search = await play.search(`${songData.name} ${songData.artists.map((v, i) => v.name).join(" ")}`, {
                                //     limit: 1
                                // });
                                // const info: InfoData = await play.video_info(search[0].url);
                                // if (!info.video_details) {
                                //     throw "No video details found.";
                                // }
                                // newSongs.push(new Song(info.video_details, handler))
                                songlist.addElement(new Song(songData, handler))
                            })
                        } else {
                            throw `This url is not a playlist or album.`;
                        }
                    } else if (url.includes('www.soundcloud.com')) {
                        const sc_data = (await play.soundcloud(url)) as SoundCloudPlaylist
                        if (sc_data.type !== 'playlist') {
                            throw `This url is not a playlist.`;
                        }
                        const allSongs: Array<SoundCloudTrack> = await sc_data.all_tracks();
                        if (allSongs.length === 0) {
                            throw `Was unable to find any songs in this playlist.`;
                        }
                        const songlist = createArrayWaiter(allSongs.length);
                        allSongs.forEach(async (songData: SoundCloudTrack) => {
                            // const search = await play.search(`${songData.name} by ${songData.user.name}`, {
                            //     limit: 1
                            // });
                            // const info: InfoData = await play.video_info(search[0].url);
                            // if (!info.video_details) {
                            //     throw "No video details found.";
                            // }
                            // newSongs.push(new Song(info.video_details, handler))

                            songlist.addElement(new Song(songData, handler))
                        });
                        newSongs = (await songlist.waitForFill()) as Song[];
                    } else {
                        throw "This url is not from YouTube, Spotify, or SoundCloud.";
                    }
                    return newSongs;
                }
                if (newSongs.length === 0) {
                    throw "No songs were found.";
                }
                // Check if song is in db
                const songData = await songSchema.find({ _id: { $in: newSongs.map((v, i) => v.id) } });
                newSongs.forEach(async (newSong) => {
                    if (!songData.find(s => s.id === newSong.id)) {
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
                })
                if (targetPlaylist.songs.length > 0) {
                    const songs = targetPlaylist.songs.sort((a, b) => b.index - a.index);
                    let newSongList: Array<any> = [];
                    for (let i = 0; i < songs.length; i++) {
                        newSongList.push({ songId: songs[i].songId, index: i });
                    }
                    for (let i = 0; i < newSongs.length; i++) {
                        if (!newSongList.find((ns) => ns.songId === newSongs[i].id)) {
                            newSongList.push({ songId: newSongs[i].id, index: newSongList.length });
                        }
                    }
                    await playlistSchema.updateOne(
                        {
                            _id: targetPlaylist._id
                        },
                        {
                            songs: newSongList
                        }
                    )
                } else {
                    await playlistSchema.updateOne(
                        {
                            _id: targetPlaylist._id
                        },
                        {
                            songs: newSongs.map((v, i) => { return { songId: v.id, index: i } })
                        }
                    )
                }
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Playlist Add Playlist**`)
                    .setDescription(`You have added the songs to your playlist with id **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "copy") {
                const targetUser = guild.members.cache.get(_hoistedOptions[0].value);
                if (!targetUser) {
                    throw "This member is not in the server.";
                }
                const allPlaylists = await playlistSchema.find({ owner: targetUser.id });
                let textList: any = [];
                let charCount: any = [];
                let components: any = [];
                let index = 1;
                let listIndex = 0;
                allPlaylists.forEach((playlist) => {
                    const text = `**${playlist.name}**\nID: **${playlist.id.split("-")[1]}**\n${(playlist.description) ? `> ${playlist.description}\n` : ""}Songs: **${playlist.songs.length}**\n\n`;
                    if (!textList[listIndex]) {
                        textList[listIndex] = [];
                    }
                    if (!charCount[listIndex]) {
                        charCount[listIndex] = 0;
                    }
                    if (!components[listIndex]) {
                        components[listIndex] = [];
                    }
                    if (charCount[listIndex] > 3900 || components[listIndex].length === 24) {
                        listIndex++;
                        textList[listIndex] = [];
                        charCount[listIndex] = 0;
                        components[listIndex] = [];
                    }
                    textList[listIndex].push(text);
                    charCount[listIndex] += text.length;
                    const component = new StringSelectMenuOptionBuilder()
                        .setLabel(playlist.name)
                        .setValue(playlist.id)
                        .setDescription(`Songs: ${playlist.songs.length}`)
                    components[listIndex].push(component);
                    index++;
                })
                const row = new ActionRowBuilder()
                    .setComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`music-playlist-copy`)
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setPlaceholder("Pick the source playlist")
                            .setOptions(components[listIndex])
                    )
                const row2 = new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-copy-prev-0-${targetUser.id}`)
                            .setLabel('Prev')
                            .setEmoji({ name: "⬅️" })
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-copy-next-0-${targetUser.id}`)
                            .setLabel('Next')
                            .setEmoji({ name: "➡️" })
                            .setStyle(ButtonStyle.Primary)
                    )
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Playlist Copy**`)
                    .setDescription(textList[0].join(""))
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: (textList.length > 1) ? [row, row2] : [row]
                });

            } else if (_subcommand === "view") {
                const targetUser = (!_hoistedOptions[0]) ? member : guild.members.cache.get(_hoistedOptions[0].value);
                if (!targetUser) {
                    throw "This member is not in the server.";
                }
                const allPlaylists = await playlistSchema.find({ owner: targetUser.id });
                let textList: any = [];
                let charCount: any = [];
                let components: any = [];
                let index = 1;
                let listIndex = 0;
                allPlaylists.forEach((playlist) => {
                    const text = `**${playlist.name}**\nID: **${playlist.id.split("-")[1]}**\n${(playlist.description) ? `> ${playlist.description}\n` : ""}Songs: **${playlist.songs.length}**\n\n`;
                    if (!textList[listIndex]) {
                        textList[listIndex] = [];
                    }
                    if (!charCount[listIndex]) {
                        charCount[listIndex] = 0;
                    }
                    if (!components[listIndex]) {
                        components[listIndex] = [];
                    }
                    if (charCount[listIndex] > 3900 || components[listIndex].length === 24) {
                        listIndex++;
                        textList[listIndex] = [];
                        charCount[listIndex] = 0;
                        components[listIndex] = [];
                    }
                    textList[listIndex].push(text);
                    charCount[listIndex] += text.length;
                    const component = new StringSelectMenuOptionBuilder()
                        .setLabel(playlist.name)
                        .setValue(playlist.id)
                        .setDescription(`Songs: ${playlist.songs.length}`)
                    components[listIndex].push(component);
                    index++;
                })
                const row = new ActionRowBuilder()
                    .setComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`music-playlist-view-${targetUser.id}`)
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setOptions(components[listIndex])
                    )
                const row2 = new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-view-prev-0-${targetUser.id}`)
                            .setLabel('Prev')
                            .setEmoji({ name: "⬅️" })
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music-playlist-view-next-0-${targetUser.id}`)
                            .setLabel('Next')
                            .setEmoji({ name: "➡️" })
                            .setStyle(ButtonStyle.Primary)
                    )
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**${targetUser.displayName}\'s Playlists**`)
                    .setDescription(textList[0].join(""))
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: (textList.length > 1) ? [row, row2] : [row]
                });
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
        .setName("playlist")
        .setDescription('Manage your custom playlists.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a custom playlist.')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('The name of your new playlist.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('A piece of text to describe your playlist.')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('thumbnail_url')
                        .setDescription('A public URL of a picture.')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit a custom playlist.')
                .addNumberOption(option =>
                    option
                        .setName('playlist_id')
                        .setDescription('The id for your playlist')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('The new name for your playlist.')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('A piece of text to describe your playlist.')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('thumbnail_url')
                        .setDescription('A public URL of a picture.')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a custom playlist.')
                .addNumberOption(option =>
                    option
                        .setName('playlist_id')
                        .setDescription('The id for your playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_song')
                .setDescription('Add a single song to custom playlist(s).')
                .addStringOption(option =>
                    option
                        .setName('url')
                        .setDescription('The url to a song.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove_song')
                .setDescription('Remove a single song from custom playlist(s).')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_playlist')
                .setDescription('Add a whole playlist to custom playlist(s).')
                .addNumberOption(option =>
                    option
                        .setName('playlist_id')
                        .setDescription('The id for your playlist')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('url')
                        .setDescription('The url to a playlist.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('copy')
                .setDescription('Copy someone else\'s custom playlist to yours.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The owner of the playlist you want to copy.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View a user\'s playlists.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The owner of the playlist(s) you want to view.')
                        .setRequired(false)
                )
        )
}
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
            if (newSongs.length >= targetLength) {
                return newSongs;
            } else {
                return new Promise((resolve) => {
                    eventEmitter.on('filled', resolve);
                });
            }
        },
    };
}
