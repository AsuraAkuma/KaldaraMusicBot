import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { BaseInteraction, ButtonInteraction, ButtonStyle, Client, Colors, Interaction } from "discord.js";
import logError from "../logError";
import { MusicHandler } from "../MusicHandler";
import { botName, botImage } from '../config.json';
import playlistSchema from "../schemas/playlist-schema";
import songSchema from "../schemas/song-schema";
const embedFooter = {
    text: botName,
    iconURL: botImage
}

export default async function buttonHandler(client: Client, interaction: any, handler: MusicHandler) {
    try {
        const { member, guild, channel, user } = interaction;
        const customId = interaction.customId.split("-");
        if (!member) {
            interaction.deleteReply().catch((err: any) => logError(err, __filename));
            return;
        }
        if (customId[0] === "music") {
            if (customId[1] === "queue") {
                if (!interaction.deferred) {
                    await interaction.deferUpdate({ fetchReply: true });
                }
                if (customId[2] === "prev") {
                    const currPage = parseInt(customId[3]);
                    let textList: any = [];
                    let charCount: any = [];
                    let index = 1;
                    let listIndex = 0;
                    handler.queue.songs.forEach((songData) => {
                        const text = `**[${index}.]** **${songData.name}**\n┣━Duration: ** ${songData.durationRaw}**\n\t\t┗━Channel: ** ${songData.channel}**\n\n`;
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
                    const nextPage = (currPage === 0) ? textList.length - 1 : currPage - 1;
                    const row = new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId(`music-queue-prev-${nextPage}`)
                                .setLabel('Prev')
                                .setEmoji({ name: "⬅️" })
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`music-queue-next-${nextPage}`)
                                .setLabel('Next')
                                .setEmoji({ name: "➡️" })
                                .setStyle(ButtonStyle.Primary)
                        )
                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`**Queue**`)
                        .setDescription(textList[nextPage].join(""))
                        .setColor(Colors.Blue)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed],
                        components: (textList.length > 1) ? [row] : []
                    });
                } else if (customId[2] === "next") {
                    const currPage = parseInt(customId[3]);
                    let textList: any = [];
                    let charCount: any = [];
                    let index = 1;
                    let listIndex = 0;
                    await handler.queue.songs.forEach((songData) => {
                        const text = `**[${index}.]** **${songData.name}**\n┣━Duration: ** ${songData.durationRaw}**\n\t\t┗━Channel: ** ${songData.channel}**\n\n`;
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
                    const nextPage = (currPage === textList.length - 1) ? 0 : currPage + 1;
                    const row = new ActionRowBuilder()
                        .setComponents(
                            new ButtonBuilder()
                                .setCustomId(`music-queue-prev-${nextPage}`)
                                .setLabel('Prev')
                                .setEmoji({ name: "⬅️" })
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`music-queue-next-${nextPage}`)
                                .setLabel('Next')
                                .setEmoji({ name: "➡️" })
                                .setStyle(ButtonStyle.Primary)
                        )
                    const replyEmbed = new EmbedBuilder()
                        .setTitle(`**Queue**`)
                        .setDescription(textList[nextPage].join(""))
                        .setColor(Colors.Blue)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed],
                        components: (textList.length > 1) ? [row] : []
                    });
                }
            } else if (customId[1] === "playlist") {
                if (!interaction.deferred) {
                    await interaction.deferUpdate({ fetchReply: true });
                }
                if (customId[2] === "copy") {
                    if (customId[3] === "prev") {
                        const currPage = parseInt(customId[4]);
                        const targetUser = guild.members.cache.get(customId[5]);
                        let textList: any = [];
                        let charCount: any = [];
                        let components: any = [];
                        let index = 1;
                        let listIndex = 0;
                        const allPlaylists = await playlistSchema.find({ owner: targetUser.id });
                        allPlaylists.forEach((playlist) => {
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
                        const nextPage = (currPage === 0) ? textList.length - 1 : currPage - 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`music-playlist-copy-${member.id}`)
                                    .setMinValues(1)
                                    .setMaxValues(1)
                                    .setOptions(components[listIndex])
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copy-prev-${nextPage}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copy-next-${nextPage}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist Copy**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    } else if (customId[3] === "next") {
                        const currPage = parseInt(customId[4]);
                        const targetUser = guild.members.cache.get(customId[5]);
                        let textList: any = [];
                        let charCount: any = [];
                        let components: any = [];
                        let index = 1;
                        let listIndex = 0;
                        const allPlaylists = await playlistSchema.find({ owner: targetUser.id });
                        allPlaylists.forEach((playlist) => {
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
                        const nextPage = (currPage === textList.length - 1) ? 0 : currPage + 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`music-playlist-copy-${member.id}`)
                                    .setMinValues(1)
                                    .setMaxValues(1)
                                    .setOptions(components[listIndex])
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copy-prev-${nextPage}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copy-next-${nextPage}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist Copy**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    }
                } else if (customId[2] === "copyFinish") {
                    if (customId[3] === "prev") {
                        const currPage = parseInt(customId[4]);
                        let textList: any = [];
                        let charCount: any = [];
                        let components: any = [];
                        let index = 1;
                        let listIndex = 0;
                        const allPlaylists = await playlistSchema.find({ owner: member.id });
                        allPlaylists.forEach((playlist) => {
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
                        const nextPage = (currPage === 0) ? textList.length - 1 : currPage - 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`music-playlist-copyFinish-[${interaction.customId.split("[")[1]}`)
                                    .setMinValues(1)
                                    .setMaxValues(1)
                                    .setOptions(components[listIndex])
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copyFinish-prev-${nextPage}-[${interaction.customId.split("[")[1]}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copyFinish-next-${nextPage}-[${interaction.customId.split("[")[1]}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist Copy**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    } else if (customId[3] === "next") {
                        const currPage = parseInt(customId[4]);
                        let textList: any = [];
                        let charCount: any = [];
                        let components: any = [];
                        let index = 1;
                        let listIndex = 0;
                        const allPlaylists = await playlistSchema.find({ owner: member.id });
                        allPlaylists.forEach((playlist) => {
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
                        const nextPage = (currPage === textList.length - 1) ? 0 : currPage + 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`music-playlist-copyFinish-[${interaction.customId.split("[")[1]}`)
                                    .setMinValues(1)
                                    .setMaxValues(1)
                                    .setOptions(components[listIndex])
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copyFinish-prev-${nextPage}-[${interaction.customId.split("[")[1]}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-copyFinish-next-${nextPage}-[${interaction.customId.split("[")[1]}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**Playlist Copy**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    }
                } else if (customId[2] === "view") {
                    if (customId[3] === "prev") {
                        const currPage = parseInt(customId[4]);
                        const targetUser = guild.members.cache.get(customId[4]);
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
                        const nextPage = (currPage === 0) ? textList.length - 1 : currPage - 1;
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
                                    .setCustomId(`music-playlist-view-prev-${nextPage}-${targetUser.id}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-view-next-${nextPage}-${targetUser.id}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**${targetUser.displayName}\'s Playlists**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    } else if (customId[3] === "next") {
                        const currPage = parseInt(customId[4]);
                        const targetUser = guild.members.cache.get(customId[4]);
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
                        const nextPage = (currPage === textList.length - 1) ? 0 : currPage + 1;
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
                                    .setCustomId(`music-playlist-view-prev-${nextPage}-${targetUser.id}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-view-next-${nextPage}-${targetUser.id}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**${targetUser.displayName}\'s Playlists**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row, row2] : [row]
                        });
                    }
                } else if (customId[2] === "viewSong") {
                    if (customId[3] === "prev") {
                        const currPage = parseInt(customId[4]);
                        const targetPlaylist = await playlistSchema.findOne({ _id: interaction.customId.split("[")[1] });
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
                        textList[0] = (targetPlaylist.description) ? [`> ${targetPlaylist.description}\n`] : [];
                        charCount[0] = (targetPlaylist.description) ? (`> ${targetPlaylist.description}\n`).length : 0;
                        songList.forEach((song) => {
                            const text = `[**${song.name}**](${song.songURL})\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
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
                        const nextPage = (currPage === 0) ? textList.length - 1 : currPage - 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-back-${targetPlaylist.owner}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-prev-${nextPage}-[${targetPlaylist._id}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-next-${nextPage}-[${targetPlaylist._id}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-back-${targetPlaylist.owner}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                            )
                        const embedFooter = {
                            text: `${botName} [${nextPage + 1} / ${textList.length}]`,
                            iconURL: botImage
                        }
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**${targetPlaylist.name}**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        if (targetPlaylist.thumbnail) {
                            replyEmbed.setThumbnail(targetPlaylist.thumbnail);
                        }
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row] : [row2]
                        });
                    } else if (customId[3] === "next") {
                        const currPage = parseInt(customId[4]);
                        const targetPlaylist = await playlistSchema.findOne({ _id: interaction.customId.split("[")[1] });
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
                        textList[0] = (targetPlaylist.description) ? [`> ${targetPlaylist.description}\n`] : [];
                        charCount[0] = (targetPlaylist.description) ? (`> ${targetPlaylist.description}\n`).length : 0;
                        songList.forEach((song) => {
                            const text = `[**${song.name}**](${song.songURL})\nDuration: **${song.durationRaw}**\nChannel: **${song.channel}**\n\n`;
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
                        const nextPage = (currPage === textList.length - 1) ? 0 : currPage + 1;
                        const row = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-back-${targetPlaylist.owner}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-prev-${nextPage}-[${targetPlaylist._id}`)
                                    .setLabel('Prev')
                                    .setEmoji({ name: "⬅️" })
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-next-${nextPage}-[${targetPlaylist._id}`)
                                    .setLabel('Next')
                                    .setEmoji({ name: "➡️" })
                                    .setStyle(ButtonStyle.Primary)
                            )
                        const row2 = new ActionRowBuilder()
                            .setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`music-playlist-viewSong-back-${targetPlaylist.owner}`)
                                    .setLabel('Back')
                                    .setEmoji({ name: "↩️" })
                                    .setStyle(ButtonStyle.Secondary),
                            )
                        const embedFooter = {
                            text: `${botName} [${nextPage + 1} / ${textList.length}]`,
                            iconURL: botImage
                        }
                        const replyEmbed = new EmbedBuilder()
                            .setTitle(`**${targetPlaylist.name}**`)
                            .setDescription(textList[nextPage].join(""))
                            .setColor(Colors.Blue)
                            .setFooter(embedFooter)
                        if (targetPlaylist.thumbnail) {
                            replyEmbed.setThumbnail(targetPlaylist.thumbnail);
                        }
                        interaction.editReply({
                            embeds: [replyEmbed],
                            components: (textList.length > 1) ? [row] : [row2]
                        });
                    } else if (customId[3] === "back") {
                        const targetUser = guild.members.cache.get(customId[4]);
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
                            const text = `**${playlist.name}**\n${(playlist.description) ? `> ${playlist.description}\n` : ""}Songs: **${playlist.songs.length}**\n\n`;
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
                }
            }
        }
    } catch (content: any) {
        if (!interaction.deferred) {
            interaction.deferReply({ fetchReply: true });
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