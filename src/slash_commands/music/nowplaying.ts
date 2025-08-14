import { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, Client, Interaction, CommandInteraction, GuildChannel, Guild, GuildMember, Colors } from 'discord.js';
import { botImage, botName, clientId } from '../../config.json';
import { MusicHandler, Song, Queue } from '../../MusicHandler';
import logError from '../../logError';
import play, { InfoData, YouTubeVideo } from 'play-dl';
import { ActionRowBuilder, EmbedBuilder, SlashCommandNumberOption, StringSelectMenuBuilder } from '@discordjs/builders';
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
            // Check if anything is playing currently
            if (handler.isPlaying === false) {
                throw "There is nothing currently playing.";
            }
            if (!handler.nowPlaying) {
                throw "There is nothing currently playing.";
            }
            const songData: InfoData = await play.video_info(handler.nowPlaying.url);
            const replyEmbed = new EmbedBuilder()
                .setTitle(`**Now Playing:** ${songData.video_details.title}`)
                .addFields(
                    {
                        name: `**Duration**`,
                        value: `[${songData.video_details.durationRaw}]`,
                        inline: true

                    },
                    {
                        name: '**Channel**',
                        value: `${songData.video_details.channel}`,
                        inline: true
                    }
                )
                .setThumbnail(songData.video_details.thumbnails[0].url)
                .setColor(Colors.Blue)
                .setFooter(embedFooter)
            interaction.editReply({
                embeds: [replyEmbed]
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
        .setName("now_playing")
        .setDescription('Check what song is currently playing.')
}
