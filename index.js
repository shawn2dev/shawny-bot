require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} 봇이 온라인 상태입니다!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '다빈') {
        message.reply('다빈이는 셔니에게 상납해!!');
    }

    if (message.content === '셔니') {
        message.reply('셔니는 다빈이랑 놀아줘!!');
    }
});

client.login(process.env.TOKEN);
