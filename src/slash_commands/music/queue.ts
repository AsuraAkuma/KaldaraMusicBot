import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, GuildChannel, Guild, GuildMember, Colors, APIMessageComponentEmoji, ButtonStyle } from 'discord.js';
import { botImage, botName, clientId } from '../../config.json';
import { MusicHandler, Song, Queue } from '../../MusicHandler';
import logError from '../../logError';
import play, { InfoData, YouTubeVideo } from 'play-dl';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandNumberOption, StringSelectMenuBuilder } from '@discordjs/builders';
import settingsSchema from '../../schemas/settings-schema';
// const mongo = require('../mongo');
// Create musichandler

const embedFooter = {
    text: botName,
    iconURL: botImage
}

module.exports = {
    run: async (client: Client, interaction: any, handler: MusicHandler) => {
        const channel: GuildChannel = interaction.channel;
        const guild: Guild = interaction.guild;
        const options: any = interaction.options;
        const member: GuildMember = interaction.member;
        const { _hoistedOptions, _subcommand, _group } = options
        try {
            if (_subcommand === "view") {
                // Check if anything is playing currently
                if (handler.queue.songs.length === 0) {
                    throw "There is nothing in the queue.";
                }
                let textList: any = [];
                let charCount: any = [];
                let index = 1;
                let listIndex = 0;
                handler.queue.songs.forEach((songData) => {
                    const text = `**[${index}.]** [**${songData.name}**](${songData.url})\n┣━Duration: ** ${songData.durationRaw}**\n\t\t┗━Channel: ** ${songData.channel}**\n\n`;
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
                const embedFooter = {
                    text: `${botName} [1 / ${textList.length}]`,
                    iconURL: botImage
                }
                const row = new ActionRowBuilder()
                    .setComponents(
                        new ButtonBuilder()
                            .setCustomId(`music-queue-prev-0`)
                            .setLabel('Prev')
                            .setEmoji({ name: "⬅️" })
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`music-queue-next-0`)
                            .setLabel('Next')
                            .setEmoji({ name: "➡️" })
                            .setStyle(ButtonStyle.Primary)
                    )
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue View**`)
                    .setDescription(textList[0].join(""))
                    .setColor(Colors.Blue)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed],
                    components: (textList.length > 1) ? [row] : []
                });
            } else if (_subcommand === "clear") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.queue.clear();
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Clear**`)
                    .setDescription("You have cleared the queue.")
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "shuffle") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.queue.shuffle();
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Shuffle**`)
                    .setDescription("You have shuffled the queue.")
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "repeat_single") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.setRepeatSingle(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Repeat Single**`)
                    .setDescription(`You have set repeat single to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "repeat_all") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.setRepeatAll(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Repeat All**`)
                    .setDescription(`You have set repeat all to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "autoplay") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                await handler.setAutoplay(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Autoplay**`)
                    .setDescription(`You have set autoplay to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "move_song") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                // Check if anything is playing currently
                if (handler.queue.songs.length === 0) {
                    throw "There is nothing in the queue.";
                }
                if (_hoistedOptions[0].value > handler.queue.songs.length || _hoistedOptions[1].value > handler.queue.songs.length) {
                    throw "Invalid song position.";
                }
                let textList: Array<any> = [];
                let charCount: Array<any> = [];
                let index = 1;
                let listIndex = 0;
                let songIndex: Array<any> = [];
                await handler.queue.moveSong(handler.queue.songs[_hoistedOptions[0].value - 1].id, _hoistedOptions[1].value);

                // handler.queue.songs.forEach((songData) => {
                //     const text = `**[${index}.]** [**${songData.name}**](${songData.url})\n┣━Duration: ** ${songData.durationRaw}**\n\t\t┗━Channel: ** ${songData.channel}**\n\n`;
                //     if (!textList[listIndex]) {
                //         textList[listIndex] = [];
                //     }
                //     if (!charCount[listIndex]) {
                //         charCount[listIndex] = 0;
                //     }
                //     if (!songIndex[listIndex]) {
                //         songIndex[listIndex] = [];
                //     }
                //     if (charCount[listIndex] > 3900) {
                //         listIndex++;
                //         textList[listIndex] = [];
                //         charCount[listIndex] = 0;
                //         songIndex[listIndex] = [];
                //     }
                //     textList[listIndex].push(text);
                //     songIndex[listIndex].push(songData);
                //     charCount[listIndex] += text.length;
                //     index++;
                // })
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Move Song**`)
                    .setDescription(`You have moved a song from position **${_hoistedOptions[0].value}** to **${_hoistedOptions[1].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
                setTimeout(() => {
                    interaction.deleteReply();
                }, 10000);
            } else if (_subcommand === "remove_song") {
                if (!member.voice) {
                    throw `You are not connected to a voice channel.`;
                }
                if (!member.voice.channel) {
                    throw `You are not connected to a voice channel.`;
                }
                // Check if anything is playing currently
                if (handler.queue.songs.length === 0) {
                    throw "There is nothing in the queue.";
                }
                if (_hoistedOptions[0].value > handler.queue.songs.length) {
                    throw "Invalid song position.";
                }
                const targetSong = handler.queue.songs[_hoistedOptions[0].value - 1];
                await handler.queue.removeSong(targetSong.id);

                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Remove Song**`)
                    .setDescription(`You have removed **${targetSong.name}** from the queue.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
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
        .setName("queue")
        .setDescription('Manage the queue.')
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('view')
                .setDescription('View the queue.')
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('clear')
                .setDescription('Remove all songs from the queue.')
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('shuffle')
                .setDescription('Randomly change songs positions in the queue.')
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('repeat_single')
                .setDescription('Repeat the currently playing song until turned off.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('If repeat is on.')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('repeat_all')
                .setDescription('Repeat the queue until turned off.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('If repeat is on.')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('autoplay')
                .setDescription('Repeat the queue until turned off.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('If repeat is on.')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('move_song')
                .setDescription('Move a song in the queue.')
                .addNumberOption(option =>
                    option
                        .setName('old_position')
                        .setDescription('The old song position.')
                        .setRequired(true)
                        .setMinValue(2)
                )
                .addNumberOption(option =>
                    option
                        .setName('new_position')
                        .setDescription('Where the song will be placed.')
                        .setRequired(true)
                        .setMinValue(2)
                )
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('remove_song')
                .setDescription('Remove a song from the queue.')
                .addNumberOption(option =>
                    option
                        .setName('position')
                        .setDescription('The song\'s position.')
                        .setRequired(true)
                        .setMinValue(2)
                )
        )

}
