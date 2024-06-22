const bot = require('./confBot.js')
const { spawn } = require('child_process');


const GOOGLE_DRIVE_FOLDER = '1QqK-zY5dom7WW-fhfAG5TsYkCml05g8B';

async function getAdminsAndStore(chatId) {
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

    } catch (error) {
        console.error("Error fetching admins:", error);
    }
}

// Example: Call this function every 5 minutes
setInterval(() => {
    const chatId = '-123456789'; // Replace with your supergroup chat ID
    getAdminsAndStore(chatId);
}, 300000); // 300000 milliseconds == 5 minutes