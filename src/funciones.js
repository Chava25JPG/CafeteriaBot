const bot = require('./confBot.js')
const { spawn } = require('child_process');


const GOOGLE_DRIVE_FOLDER = '1QqK-zY5dom7WW-fhfAG5TsYkCml05g8B';

async function getAdminsAndStore(chatId) {
    // if (!(await checkBotPermissions(chatId))) {
    //     console.log("Bot doesn't have necessary permissions");
    //     return;
    // }

    try {
        const adminData = await getAdmins(chatId);
        const groupName = await getGroupName(chatId);

        runPythonProcess(groupName, adminData);
    } catch (error) {
        console.error("Error in getAdminsAndStore:", error);
    }
}
function runPythonProcess(groupName, adminData) {
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
}
async function getAdmins(chatId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.map(admin => ({
            id: admin.user.id,
            name: `${admin.user.first_name}${admin.user.last_name ? ' ' + admin.user.last_name : ''}`
        }));
    } catch (error) {
        console.error("Error fetching admins:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


async function checkBotPermissions(chatId) {
    if (!bot.botInfo || typeof bot.botInfo.id === 'undefined') {
        console.error("Bot info or bot ID is undefined.");
        return false;
    }

    try {
        const chatMember = await bot.getChatMember(chatId, bot.botInfo.id);
        if (!chatMember || typeof chatMember.status === 'undefined') {
            console.error("Chat member data is incomplete or undefined.");
            return false;
        }

        console.log("Bot permissions for chat ID " + chatId + ":", chatMember.status);
        return chatMember.status === 'administrator' && chatMember.can_manage_chat;
    } catch (error) {
        console.error("Error checking bot permissions for chat ID " + chatId + ":", error);
        return false;
    }
}

module.exports = { getAdminsAndStore };
// Example: Call this function every 5 minutes
// // setInterval(() => {
// //     const chatId = -2207878165; // Replace with your supergroup chat ID
// //     getAdminsAndStore(chatId);
// // }, 3000); // 300000 milliseconds == 5 minutes