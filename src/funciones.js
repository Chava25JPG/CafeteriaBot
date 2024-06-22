const bot = require('./confBot.js')
const { spawn } = require('child_process');


const GOOGLE_DRIVE_FOLDER = '1QqK-zY5dom7WW-fhfAG5TsYkCml05g8B';

async function getAdminsAndStore(chatId) {
    if (!(await checkBotPermissions(chatId))) {
        console.log("Bot doesn't have necessary permissions");
        return;
      }
    try {
        const admins = await bot.getChatAdministrators(chatId);
        const adminData = admins.map(admin => ({
            name: `${admin.user.first_name}${admin.user.last_name ? ' ' + admin.user.last_name : ''}`,
            id: admin.user.id
        }));

        const groupName = await bot.getChat(chatId).then(chat => chat.title);

        const pythonProcess = spawn('python3', ['./src/OCRAsis.py', groupName, JSON.stringify(adminData), GOOGLE_DRIVE_FOLDER]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

    }  catch (error) {
        console.error("Error fetching admins:", error);
        if (error.response) {
          console.error("Error response:", error.response);
        }
        if (error.code) {
          console.error("Error code:", error.code);
        }
      }
    }

    async function checkBotPermissions(chatId) {
        try {
          const chatMember = await bot.getChatMember(chatId, bot.botInfo.id);
          console.log("Bot permissions:", chatMember);
          return chatMember.status === 'administrator';
        } catch (error) {
          console.error("Error checking bot permissions:", error);
          return false;
        }
      }
// Example: Call this function every 5 minutes
setInterval(() => {
    const chatId = -2207878165; // Replace with your supergroup chat ID
    getAdminsAndStore(chatId);
}, 3000); // 300000 milliseconds == 5 minutes