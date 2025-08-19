// Slash command for displaying help information and usage instructions for the music bot.
import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, GuildChannel, Guild, GuildMember, Colors, APIMessageComponentEmoji, ButtonStyle, ApplicationCommand, ApplicationCommandOption, ApplicationCommandOptionType, ApplicationCommandSubCommand, ApplicationCommandSubGroup, Message, InteractionResponse } from 'discord.js';
import { botImage, botName, clientId } from '../../config.json';
import { MusicHandler, Song, Queue } from '../../MusicHandler';
import commandSchema from '../../schemas/command-schema';
import logError from '../../logError';
import play, { InfoData, YouTubeVideo } from 'play-dl';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBooleanOption, SlashCommandNumberOption, StringSelectMenuBuilder } from '@discordjs/builders';
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
            // Get all command data from the client
            let pageIndex = 0;
            let charCount = 0;
            const pages = new Array();
            const commands = await commandSchema.findOne({ _id: clientId });
            if (commands === null) {
                throw "No commands found.";
            }
            if (commands.commands.length === 0) {
                throw "No commands found.";
            }
            pages[0] = [`\`\`\`ansi\n[2;34m[2;31m[2;33m*[option]*[0m[2;31m[0m[2;34m[0m = Required | [2;34m[option][0m = Optional\n\n[2;34mWhen entering a command press tab or press outside any required boxes to see optional boxes.[0m\`\`\``];
            commands.commands.forEach((command: ApplicationCommand) => {
                if (!pages[pageIndex]) pages[pageIndex] = [];
                if (charCount >= 3900) {
                    pageIndex++;
                    charCount = 0;
                    pages[pageIndex] = [];
                }
                // Check command depth
                if (command.name !== "settings") {
                    let text = `\`\`\`ansi\n/${command.name} ${command.description}\n`;
                    const subCommands = command.options//.filter((commandOption: any) => { return commandOption.options !== undefined && commandOption.options[0] !== undefined && commandOption.options[0].options === undefined });
                    subCommands.forEach((option: any) => {
                        // if (option.options !== undefined && option.options[0] !== undefined && option.options[0].option === undefined) {
                        text += `\n/${command.name} ${option.name} ${option.options.map((subOption: any) => `${(subOption.required) ? "[2;34m[2;31m[2;33m*" : "[2;34m"}[${subOption.name}]${(subOption.required) ? "*[0m[2;31m[0m[2;34m[0m" : "[0m"}`).join(' ')}\n`;
                        // }
                    });
                    text += `\`\`\``;
                    if (charCount + text.length >= 3900) {
                        pageIndex++;
                        charCount = 0;
                        pages[pageIndex] = [];
                    }
                    charCount += text.length;
                    pages[pageIndex].push(text);
                }
            });
            const embedFooter = {
                text: `${botName} | [1 / ${pageIndex + 1}] `,
                iconURL: botImage
            }
            const replyEmbed = new EmbedBuilder()
                .setTitle('**Help**')
                .setDescription(pages[0].join(''))
                .setColor(Colors.Blue)
                .setFooter(embedFooter)
            interaction.editReply({
                embeds: [replyEmbed],
                components: (pages.length > 1) ? [
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('help-back-0')
                                .setLabel('Back')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji({ name: "⬅️" }),
                            new ButtonBuilder()
                                .setCustomId('help-next-0')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji({ name: "➡️" })
                        )
                ] : []
            });
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
        .setName("help")
        .setDescription('View info on all commands.')
}
