import { Client, IntentsBitField, Collection, EmbedBuilder, MessageCollector, InteractionCollector, ActionRowBuilder, ButtonBuilder, PermissionsBitField, ButtonStyle, ChannelType, Colors, Interaction, BaseInteraction, ButtonInteraction, Partials } from 'discord.js';
import { clientId, token, botName, botImage } from './config.json';
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
import mongo from './mongo';
import { MusicHandler } from './MusicHandler';
import fs from 'fs';
import logDebug from './logDebug';
import buttonHandler from './events/button';
import selectHandler from './events/select';
import commandSchema from './schemas/command-schema';
// import settingsSchema from './schemas/settings-schema';
// Initialize client
const client: Client = new Client({ partials: [Partials.Channel], intents: [IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates] });
const express = require('express');
const app = express();
const { port } = require('./config.json');
app.use(express.json());
app.use("/", require('./routes'));
app.listen(port, "127.0.0.1", () => console.log(`Listening on port ${port}!`))
console.log('Kaldara Music Server is online!');

// Compile slash commands
let commands: any = [];
const slashCommands = new Collection();
const commandFolders = fs.readdirSync('./src/slash_commands');
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./src/slash_commands/${folder}`).filter((file: any) => file.endsWith('.ts'));
    for (const file of commandFiles) {
        const command: any = require(`./slash_commands/${folder}/${file}`);
        slashCommands.set(command.data.name, command);
        commands.push(command.data);
    };
};
const rest = new REST({ version: 10 }).setToken(token);
console.log('Deploying slash commands!');
client.once('ready', async () => {
    // Connect to db
    await mongo();
    const commandArr = new Array();
    slashCommands.forEach((command: any) => {
        commandArr.push(command.data)
    });
    console.log('Successfully Loaded!');
    client.setMaxListeners(Infinity);
    if (client.user) {
        client.user.setPresence({ status: "online" })
        client.user.setActivity(`🎶Bumping tunes🎶`);
    }
    const embedFooter = {
        text: botName,
        iconURL: botImage
    };
    let handlers: any = [];
    // Clear temp folder
    if (fs.existsSync('./src/temp')) {
        const tempFolder = fs.readdirSync('./src/temp');
        if (tempFolder.length > 0) {
            for (const tmpFile of tempFolder) {
                fs.rmSync(`./src/temp/${tmpFile}`);
            }
            logDebug("Cleared temp folder (./src/temp).");
        }
    } else {
        fs.mkdirSync('./src/temp');
        logDebug("Created temp folder (./src/temp).");
    }
    if (!fs.existsSync('./src/archive')) {
        fs.mkdirSync('./src/archive');
        logDebug("Created archive folder (./src/archive).");
    }
    client.guilds.cache.forEach(async (guild) => {
        rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands }).then(() => { });
        if (!handlers[guild.id]) {
            handlers[guild.id] = new MusicHandler(guild);
        }
    });

    client.on('interactionCreate', async (interaction: Interaction) => {
        const guild = interaction.guild;
        if (!guild) {
            throw "No guild found for interaction";
        }
        const handler: MusicHandler = handlers[guild.id];
        // handler.setVolume()
        if (interaction.isCommand()) {
            const errEmbedBuilder = new EmbedBuilder()
                .setTitle('**Error**')
                .setDescription(`Not a valid slash command!`)
                .setColor(Colors.Red)
                .setFooter(embedFooter)
            const slashCommand: any = slashCommands.get(interaction.commandName);
            if (!slashCommand) {
                interaction.reply({
                    embeds: [errEmbedBuilder],
                    ephemeral: true
                })
            };
            await interaction.deferReply({ ephemeral: true });
            try {
                await slashCommand.run(client, interaction, handler);
            } catch (error) {
                console.log(error)
            }
        } else if (interaction.isButton()) {
            const ButtonInteraction = interaction as ButtonInteraction;
            await buttonHandler(client, ButtonInteraction, handler);
        } else if (interaction.isAnySelectMenu()) {
            await selectHandler(client, interaction, handler);
        }

    })
    client.on('guildCreate', async (guild) => {
        rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands }).then(() => { });
    });
    // Send commands to db
    await commandSchema.findOneAndUpdate({ _id: clientId }, { commands: commands }, { upsert: true });
    console.log('Kaldara Music Server is online!');
});

client.login(token);
export default client;