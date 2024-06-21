const bot = require('./confBot.js')


const getGroupAdmins = async (chatId) => {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.map(admin => ({
            id: admin.user.id,
            name: `${admin.user.first_name} ${admin.user.last_name || ''}`
        }));
    } catch (error) {
        console.error('Error al obtener los administradores del grupo:', error);
        throw new Error('No se pudo obtener la lista de administradores');
    }
};

module.exports = { getGroupAdmins };