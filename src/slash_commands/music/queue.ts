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
                await handler.queue.clear();
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Clear**`)
                    .setDescription("You have cleared the queue.")
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "shuffle") {
                await handler.queue.shuffle();
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Shuffle**`)
                    .setDescription("You have shuffled the queue.")
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "repeat_single") {
                await handler.setRepeatSingle(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Repeat Single**`)
                    .setDescription(`You have set repeat single to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "repeat_all") {
                await handler.setRepeatAll(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Repeat All**`)
                    .setDescription(`You have set repeat all to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
                });
            } else if (_subcommand === "autoplay") {
                await handler.setAutoplay(_hoistedOptions[0].value);
                const replyEmbed = new EmbedBuilder()
                    .setTitle(`**Queue Autoplay**`)
                    .setDescription(`You have set autoplay to **${_hoistedOptions[0].value}**.`)
                    .setColor(Colors.Green)
                    .setFooter(embedFooter)
                interaction.editReply({
                    embeds: [replyEmbed]
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
        .setName("queue")
        .setDescription('View the queue.')
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
}
