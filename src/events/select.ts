// Handles Discord select menu interactions for the music bot, such as song and playlist selection.
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { AnySelectMenuInteraction, ButtonStyle, Client, Colors } from "discord.js";
import logError from "../logError";
import { MusicHandler } from "../MusicHandler";
import { botName, botImage } from '../config.json';
import songSchema from "../schemas/song-schema";
import playlistSchema from "../schemas/playlist-schema";
const embedFooter = {
    text: botName,
    iconURL: botImage
}

export default async function selectHandler(client: Client, interaction: any, handler: MusicHandler) {
    try {
        const { member, guild, message, channel, values, user } = interaction;
        const customId = interaction.customId.split("-");
        if (!member) {
            interaction.deleteReply().catch((err: any) => logError(err, __filename));
            return;
        }
        if (!guild) {
            interaction.deleteReply().catch((err: any) => logError(err, __filename));
            return;
        }
        if (customId[0] === "music") {
            if (customId[1] === "search") {
                if (!interaction.deferred) {
                    await interaction.deferUpdate({ fetchReply: true });
                }
                const targetMember = guild.members.cache.get(user.id);
                if (!targetMember) {
                    interaction.deleteReply().catch((err: any) => logError(err, __filename));
                    return;
                }
                if (!targetMember.voice) {
                    throw "You are not in a voice channel.";
                }
                if (!targetMember.voice.channel) {
                    throw "You are not in a voice channel.";
                }
                await handler.queue.addSong(values[0]);
                if (handler.isPlaying === false) {
                    handler.play(targetMember.voice.channel);
                }

                const replyEmbed = new EmbedBuilder()
                    .setTitle('**Play Search**')
                    .setDescription(`Your song has been added to the queue.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: []
                });
            } else if (customId[1] === "playlist") {
                if (!interaction.deferred) {
                    await interaction.deferUpdate({ fetchReply: true });
                }
                if (customId[2] === "add") {
                    const id = interaction.customId.split("[")[1];
                    values.forEach(async (value: string) => {
                        const result = await playlistSchema.findOne({ _id: value });
                        if (result) {
                            if (result.songs.length > 0) {
                                const songs = result.songs.sort((a, b) => b.index - a.index);
                                let newSongList: Array<any> = [];
                                for (let i = 0; i < songs.length; i++) {
                                    newSongList.push({ songId: songs[i].songId, index: i });
                                }
                                newSongList.push({ songId: id, index: newSongList.length });
                                await playlistSchema.updateOne(
                                    {
                                        _id: value
                                    },
                                    {
                                        songs: newSongList
                                    }
                                )
                            } else {
                                await playlistSchema.updateOne(
                                    {
                                        _id: value
                                    },
                                    {
                                        songs: [{ songId: id, index: 0 }]
                                    }
                                )
                            }
                        }
                    })
                    const playlists = await playlistSchema.find({ _id: { $in: values } });
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Playlist Add Song**')
                        .setDescription(`Your song has been added to these playlists: ${playlists.map((v, i) => v.name).join("|")}`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed],
                        components: []
                    });
                } else if (customId[2] === "remove") {
                    if (customId[3] === "select") { // Selected playlist to remove songs from
                        const targetUser = guild.members.cache.get(customId[4]);
                        if (!targetUser) {
                            throw "This member is not in the server.";
                        }
                        const targetPlaylist = await playlistSchema.findOne({ _id: values[0] });
                        let textList: any = [];
                        let charCount: any = [];
                        let selectionList: Array<any> = [];
                        let index = 1;
                        let listIndex = 0;
                        if (!targetPlaylist) {
                            throw "This playlist does not exist.";
                        }
                        const songList = await songSchema.find({ _id: { $in: targetPlaylist.songs.sort((a, b) => a.index - b.index).map((v, i) => v.songId) } });
                        if (songList.length === 0) {
                            throw "Could not find any songs in this playlist.";
                        }
                        textList[0] = (targetPlaylist.description) ? [`## ${targetPlaylist.name}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`] : [];
                        charCount[0] = (targetPlaylist.description) ? (`## ${targetPlaylist.name}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`).length : 0;
                        songList.forEach((song) => {
                            let text;
                            if (song.songURL !== "Unknown") {
                                text = `[**${song.name}**](${song.songURL})\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                            } else {
                                text = `**${song.name}**\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                            }
                            if (!textList[listIndex]) {
                                textList[listIndex] = [];
                            }
                            if (!selectionList[listIndex]) {
                                selectionList[listIndex] = [];
                            }
                            if (!charCount[listIndex]) {
                                charCount[listIndex] = 0;
                            }
                            if (charCount[listIndex] > 3900 || selectionList[listIndex].length === 25) {
                                listIndex++;
                                textList[listIndex] = [];
                                charCount[listIndex] = 0;
                                selectionList[listIndex] = [];
                            }
                            textList[listIndex].push(text);
                            selectionList[listIndex].push({ label: song.name, value: song._id });
                            charCount[listIndex] += text.length;
                            index++;
                        })
                        const row0 = new ActionRowBuilder()
                            .setComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`music-playlist-remove-finish-[${targetPlaylist._id}`)
                                    .setMinValues(1)
                                    .setMaxValues(selectionList[0].length)
                                    .setOptions(selectionList[0])
                                    .setPlaceholder("Select the songs to remove")
                            )
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-back1-${targetUser.id}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-prev1-0-[${targetPlaylist._id}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-next1-0-[${targetPlaylist._id}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-delete`)
                                    .setLabel('Done')
                                    .setEmoji({ name: "✔️" })
                                    .setStyle(ButtonStyle.Success)
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-back1-${targetUser.id}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-remove-delete`)
                                    .setLabel('Done')
                                    .setEmoji({ name: "✔️" })
                                    .setStyle(ButtonStyle.Success)
                            )
                        const embedFooter = {
                            text: `${botName} [1 / ${textList.length}]`,
                            iconURL: botImage
                        }
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist: Remove Song**`)
                            .setDescription(textList[0].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        if (targetPlaylist.thumbnail) {
                            replyEmbed.setThumbnail(targetPlaylist.thumbnail);
                        }
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row0, row] : [row0, row2]
                        });
                    } else if (customId[3] === "finish") { // Remove song from playlist
                        let targetPlaylist = await playlistSchema.findOne({ _id: interaction.customId.split("[")[1] });
                        const songsRemoved = await songSchema.find({ _id: { $in: values } });
                        if (!targetPlaylist) {
                            throw "This playlist does not exist.";
                        }
                        (targetPlaylist.songs as any) = targetPlaylist.songs.filter((song) => !values.includes(song.songId));
                        await playlistSchema.updateOne(
                            {
                                _id: targetPlaylist._id
                            },
                            {
                                songs: targetPlaylist.songs
                            }
                        )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist: Remove Song**`)
                            .setDescription(`Song(s) removed from **${targetPlaylist.name}**:\n${songsRemoved?.map((song) => `- ${song.name}`).join("\n")}!`)
                            .setColor(Colors.Green)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: []
                        });
                        // Reset display
                        setTimeout(async () => {
                            const targetUser = guild.members.cache.get(member.id);
                            if (!targetUser) {
                                throw "This member is not in the server.";
                            }
                            let textList: any = [];
                            let charCount: any = [];
                            let selectionList: any = [];
                            let index = 1;
                            let listIndex = 0;
                            if (!targetPlaylist) {
                                throw "This playlist does not exist.";
                            }
                            const songList = await songSchema.find({ _id: { $in: targetPlaylist.songs.sort((a, b) => a.index - b.index).map((v, i) => v.songId) } });
                            if (songList.length === 0) {
                                throw "Could not find any songs in this playlist.";
                            }
                            textList[0] = (targetPlaylist.description) ? [`## ${targetPlaylist.name}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`] : [];
                            charCount[0] = (targetPlaylist.description) ? (`## ${targetPlaylist.name}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`).length : 0;
                            songList.forEach((song) => {
                                let text;
                                if (song.songURL !== "Unknown") {
                                    text = `[**${song.name}**](${song.songURL})\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                                } else {
                                    text = `**${song.name}**\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                                }
                                if (!textList[listIndex]) {
                                    textList[listIndex] = [];
                                }
                                if (!selectionList[listIndex]) {
                                    selectionList[listIndex] = [];
                                }
                                if (!charCount[listIndex]) {
                                    charCount[listIndex] = 0;
                                }
                                if (charCount[listIndex] > 3900 || selectionList[listIndex].length === 25) {
                                    listIndex++;
                                    textList[listIndex] = [];
                                    charCount[listIndex] = 0;
                                    selectionList[listIndex] = [];
                                }
                                textList[listIndex].push(text);
                                selectionList[listIndex].push({ label: song.name, value: song._id });
                                charCount[listIndex] += text.length;
                                index++;
                            })
                            const row0 = new ActionRowBuilder()
                                .setComponents(
                                    new StringSelectMenuBuilder()
                                        .setCustomId(`music-playlist-remove-finish-[${targetPlaylist._id}`)
                                        .setMinValues(1)
                                        .setMaxValues(selectionList[0].length)
                                        .setOptions(selectionList[0])
                                        .setPlaceholder("Select the songs to remove")
                                )
                            const row = new ActionRowBuilder()
                                .setComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-back1-${targetUser.id}`)
                                        .setLabel('Back')
                                        .setEmoji({ name: "↩️" })
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-prev1-0-[${targetPlaylist._id}`)
                                        .setLabel('Prev')
                                        .setEmoji({ name: "⬅️" })
                                        .setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-next1-0-[${targetPlaylist._id}`)
                                        .setLabel('Next')
                                        .setEmoji({ name: "➡️" })
                                        .setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-delete`)
                                        .setLabel('Done')
                                        .setEmoji({ name: "✔️" })
                                        .setStyle(ButtonStyle.Success)
                                )
                            const row2 = new ActionRowBuilder()
                                .setComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-back1-${targetUser.id}`)
                                        .setLabel('Back')
                                        .setEmoji({ name: "↩️" })
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId(`music-playlist-remove-delete`)
                                        .setLabel('Done')
                                        .setEmoji({ name: "✔️" })
                                        .setStyle(ButtonStyle.Success)
                                )
                            const embedFooter2 = {
                                text: `${botName} [1 / ${textList.length}]`,
                                iconURL: botImage
                            }
                            const replyEmbed2 = new EmbedBuilder()
                                .setTitle(`**Playlist: Remove Song**`)
                                .setDescription(textList[0].join(""))
                                .setColor(Colors.Blue)
                                .setFooter(embedFooter2)
                            if (targetPlaylist.thumbnail) {
                                replyEmbed.setThumbnail(targetPlaylist.thumbnail);
                            }
                            interaction.editReply({
                                embeds: [replyEmbed2],
                                components: (textList.length > 1) ? [row0, row] : [row0, row2]
                            });
                        }, 5000);
                    }
                } else if (customId[2] === "copy") {
                    const allPlaylists = await playlistSchema.find({ owner: member.id });
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
                                .setCustomId(`music-playlist-copyFinish-[${values[0]}`)
                                .setMinValues(1)
                                .setMaxValues(1)
                                .setPlaceholder("Select the target playlist")
                                .setOptions(components[listIndex])
                        )
                    const row2 = new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-copyFinish-prev-0-[${values[0]}`)
                                .setLabel('Prev')
                                .setEmoji({ name: "⬅️" })
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-copyFinish-next-0-[${values[0]}`)
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
                } else if (customId[2] === "copyFinish") {
                    // Grab all songs from target playlist and add them to selected playlist
                    const targetPlaylist = await playlistSchema.findOne({ _id: interaction.customId.split("[")[1] });
                    if (!targetPlaylist) {
                        throw "No other user\'s playlist does not exist.";
                    }
                    // Check for current user playlist
                    const result = await playlistSchema.findOne({ _id: values[0] });
                    if (!result) {
                        throw "Your target playlist does not exist.";
                    }
                    await playlistSchema.updateOne(
                        {
                            _id: values[0]
                        },
                        {
                            $addToSet: {
                                songs: targetPlaylist.songs
                            }
                        }
                    )
                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`**Playlist Copy**`)
                        .setDescription(`You have copied all songs from **${targetPlaylist.name}** to **${result.name}**!`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed],
                        components: []
                    });
                } else if (customId[2] === "view") {
                    const targetUser = guild.members.cache.get(customId[3]);
                    if (!targetUser) {
                        throw "This member is not in the server.";
                    }
                    const targetPlaylist = await playlistSchema.findOne({ _id: values[0] });
                    let textList: any = [];
                    let charCount: any = [];
                    let index = 1;
                    let listIndex = 0;
                    if (!targetPlaylist) {
                        throw "This playlist does not exist.";
                    }
                    const songList = await songSchema.find({ _id: { $in: targetPlaylist.songs.sort((a, b) => a.index - b.index).map((v, i) => v.songId) } });
                    if (songList.length === 0) {
                        throw "Could not find any songs in this playlist.";
                    }
                    textList[0] = (targetPlaylist.description) ? [`## ${targetPlaylist.name}\nID: ${targetPlaylist._id.split("-")[1]}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`] : [];
                    charCount[0] = (targetPlaylist.description) ? (`## ${targetPlaylist.name}\nID: ${targetPlaylist._id.split("-")[1]}\n### Description:\n> ${targetPlaylist.description}\n### Songs:\n`).length : 0;
                    songList.forEach((song) => {
                        let text;
                        if (song.songURL !== "Unknown") {
                            text = `[**${song.name}**](${song.songURL})\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                        } else {
                            text = `**${song.name}**\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
                        }
                        if (!textList[listIndex]) {
                            textList[listIndex] = [];
                        }
                        if (!charCount[listIndex]) {
                            charCount[listIndex] = 0;
                        }
                        if (charCount[listIndex] > 3900) {
                            listIndex++;
                            textList[listIndex] = [];
                            charCount[listIndex] = 0;
                        }
                        textList[listIndex].push(text);
                        charCount[listIndex] += text.length;
                        index++;
                    })
                    const row = new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-viewSong-back-${targetUser.id}`)
                                .setLabel('Back')
                                .setEmoji({ name: "↩️" })
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-viewSong-prev-0-[${targetPlaylist._id}`)
                                .setLabel('Prev')
                                .setEmoji({ name: "⬅️" })
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-viewSong-next-0-[${targetPlaylist._id}`)
                                .setLabel('Next')
                                .setEmoji({ name: "➡️" })
                                .setStyle(ButtonStyle.Primary)
                        )
                    const row2 = new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId(`music-playlist-viewSong-back-${targetUser.id}`)
                                .setLabel('Back')
                                .setEmoji({ name: "↩️" })
                                .setStyle(ButtonStyle.Secondary),
                        )
                    const embedFooter = {
                        text: `${botName} [1 / ${textList.length}]`,
                        iconURL: botImage
                    }
                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`**View Playlist**`)
                        .setDescription(textList[0].join(""))
                        .setColor(Colors.Blue)
                        .setFooter(embedFooter)
                    if (targetPlaylist.thumbnail) {
                        replyEmbed.setThumbnail(targetPlaylist.thumbnail);
                    }
                    interaction.editReply({
                        embeds: [replyEmbed],
                        components: (textList.length > 1) ? [row] : [row2]
                    });

                }
            }
        }
    } catch (content: any) {
        if (!interaction.deferred) {
            await interaction.deferUpdate({ flags: 64 });
        }
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
}