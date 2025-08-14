import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, SlashCommandSubcommandGroupBuilder, SlashCommandChannelOption, ChannelType, SlashCommandRoleOption, Colors, GuildMember, GuildChannel, CommandInteractionOption, Guild, CommandInteractionOptionResolver, Role, PermissionsBitField } from 'discord.js';
import { botImage, botName } from '../../config.json';
import { EmbedBuilder, SlashCommandNumberOption } from '@discordjs/builders';
import settingsSchema from '../../schemas/settings-schema';
import logError from '../../logError';
import logDebug from '../../logDebug';
import { MusicHandler } from '../../MusicHandler';
// const mongo = require('../mongo');

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
            // Check for guild
            if (!guild) {
                throw new Error("No guild found.");
            }
            const allowed = ["339917839483797504", "160593366332080131", "781624383319965707", "648972356475420682"];
            if (_group === "set") {
                // Check if member has manage messages perms or matches ids
                if (!member.permissions.any(PermissionsBitField.Flags.ManageMessages) && !allowed.includes(member.id)) {
                    throw `You do not have access to this command.`;
                }
                // Check if settings exist
                const settings = await settingsSchema.findOne({ _id: guild.id });
                if (!settings) {
                    // Create settings with default values
                    await settingsSchema.create({
                        _id: guild.id,
                        channelId: null,
                        djRoleId: null,
                        skipEnabled: true,
                        volumeEnabled: true,
                        volume: 60
                    })
                    logDebug(`Created settings for guild (${guild.id})`);
                }
                if (_subcommand === "channel") {
                    const targetChannel: GuildChannel = _hoistedOptions[0].channel;
                    if (settings?.channelId === targetChannel.id) {
                        throw "This channel is already the music command channel.";
                    }
                    await settingsSchema.findOneAndUpdate(
                        {
                            _id: guild.id
                        },
                        {
                            channelId: targetChannel.id
                        }
                    )
                    logDebug(`Updated channelId for guild (${guild.id}): ${settings?.channelId} -> ${targetChannel.id}`);
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Settings Set Channel**')
                        .setDescription(`You have set the music updates channel to ${targetChannel}.`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                    setTimeout(() => {
                        interaction.deleteReply();
                    }, 10000);
                } else if (_subcommand === "dj_role") {
                    const targetRole: Role = _hoistedOptions[0].role;
                    if (settings?.djRoleId === targetRole.id) {
                        throw "This role is already the dj role.";
                    }
                    await settingsSchema.findOneAndUpdate(
                        {
                            _id: guild.id
                        },
                        {
                            djRoleId: targetRole.id
                        }
                    )
                    logDebug(`Updated djRoleId for guild (${guild.id}): ${settings?.djRoleId} -> ${targetRole.id}`);
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Settings Set Dj Role**')
                        .setDescription(`You have set the music dj role to ${targetRole}.`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                    setTimeout(() => {
                        interaction.deleteReply();
                    }, 10000);
                } else if (_subcommand === "skip_enabled") {
                    const enabled: Boolean = _hoistedOptions[0].value;
                    if (settings?.skipEnabled === enabled) {
                        throw `Skip is already ${(enabled === false) ? "off" : "on"}.`;
                    }
                    await settingsSchema.findOneAndUpdate(
                        {
                            _id: guild.id
                        },
                        {
                            skipEnabled: enabled
                        }
                    )
                    logDebug(`Updated skipEnabled for guild (${guild.id}): ${settings?.skipEnabled} -> ${enabled}`);
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Settings Set Skip Enabled**')
                        .setDescription(`You have set the skip enabled to **${enabled}**.`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                    setTimeout(() => {
                        interaction.deleteReply();
                    }, 10000);
                } else if (_subcommand === "volume_enabled") {
                    const enabled: Boolean = _hoistedOptions[0].value;
                    if (settings?.skipEnabled === enabled) {
                        throw `Volume is already ${(enabled === false) ? "off" : "on"}.`;
                    }
                    await settingsSchema.findOneAndUpdate(
                        {
                            _id: guild.id
                        },
                        {
                            volumeEnabled: enabled
                        }
                    )
                    logDebug(`Updated volumeEnabled for guild (${guild.id}): ${settings?.volumeEnabled} -> ${enabled}`);
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Settings Set Volume Enabled**')
                        .setDescription(`You have set volume enabled to **${enabled}**.`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                    setTimeout(() => {
                        interaction.deleteReply();
                    }, 10000);
                }
                else if (_subcommand === "volume") {
                    const volume: number = _hoistedOptions[0].value;
                    if (!settings) {
                        throw "There are no settings.";
                    }
                    if (settings.volumeEnabled === false) {
                        throw `Volume control is not enabled.`;
                    }
                    await settingsSchema.findOneAndUpdate(
                        {
                            _id: guild.id
                        },
                        {
                            volume: volume
                        }
                    )
                    await handler.setVolume(volume);
                    logDebug(`Updated volume for guild (${guild.id}): ${settings.volume}% -> ${volume}%`);
                    const replyEmbed = new EmbedBuilder()
                        .setTitle('**Settings Set Volume**')
                        .setDescription(`You have set the volume to **${volume}**%.`)
                        .setColor(Colors.Green)
                        .setFooter(embedFooter)
                    interaction.editReply({
                        embeds: [replyEmbed]
                    });
                    setTimeout(() => {
                        interaction.deleteReply();
                    }, 10000);
                }
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
        .setName("settings")
        .setDescription('Adjust music settings')
        .addSubcommandGroup((group: SlashCommandSubcommandGroupBuilder) =>
            group
                .setName("set")
                .setDescription("Set music settings")
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    subcommand
                        .setName('channel')
                        .setDescription('Channel where music updates send.')
                        .addChannelOption((option: SlashCommandChannelOption) =>
                            option
                                .setName('channel')
                                .setDescription('The text channel.')
                                .setRequired(true)
                                .addChannelTypes([ChannelType.GuildText])
                        )
                )
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    subcommand
                        .setName('dj_role')
                        .setDescription('Role that is allowed to use music commands.')
                        .addRoleOption((option: SlashCommandRoleOption) =>
                            option
                                .setName('role')
                                .setDescription('The role.')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    subcommand
                        .setName('volume')
                        .setDescription('Set the volume.')
                        .addNumberOption((option: SlashCommandNumberOption) =>
                            option
                                .setName('percent')
                                .setDescription('The percent from 0% to 100%.')
                                .setRequired(true)
                                .setMinValue(0)
                                .setMaxValue(100)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('skip_enabled')
                        .setDescription('If skipping is allowed.')
                        .addStringOption(option =>
                            option
                                .setName('enabled')
                                .setDescription('If skipping is enabled')
                                .setRequired(true)
                                .setChoices(
                                    {
                                        name: "Yes",
                                        value: "yes"
                                    },
                                    {
                                        name: "No",
                                        value: "no"
                                    }
                                )
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('volume_enabled')
                        .setDescription('If volume control is allowed.')
                        .addStringOption(option =>
                            option
                                .setName('enabled')
                                .setDescription('If volume control is enabled')
                                .setRequired(true)
                                .setChoices(
                                    {
                                        name: "Yes",
                                        value: "yes"
                                    },
                                    {
                                        name: "No",
                                        value: "no"
                                    }
                                )
                        )
                )
        )
}
