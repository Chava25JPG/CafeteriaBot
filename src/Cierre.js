const bot = require('./confBot.js');
const moment = require('moment-timezone');
const { spawn } = require('child_process');
const axios = require('axios');

async function askDesmonte(chatId) {
    await bot.sendMessage(chatId, "Se ha cerrado la sucursal?🏡", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'cierre de sucursal';
            const descripcion = 'Sucursal desmontada';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌");
            // Llamar a la función que maneja el siguiente paso
            await askForRefillFood(chatId);
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando desmonte la sucursal.");
        }
    });
}

async function registerClosure(chatId, tipo, descripcion) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const file_url = ''; // Dejar vacío ya que no se sube foto
    await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_url, tipo, descripcion);
}

async function askForRefillFood(chatId) {
    await bot.sendMessage(chatId, "¿Ha realizado el refill de food?🍲", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            await bot.sendMessage(chatId, "Por favor, suba una foto del refill de food.📸🍲");
            bot.once('photo', async msg => {
                const tipo = 'refill de food';
                await handlePhotoUpload(chatId, msg, tipo);
                await bot.sendMessage(chatId, "Registrado👌");
                await askForRefillBarra(chatId)
            });
        } else {
            await bot.sendMessage(chatId, "Por favor realice el refill de food y suba la foto.");
        }
    });
}

async function askForRefillBarra(chatId) {
    await bot.sendMessage(chatId, "¿Ha realizado el refill de Barra?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            await bot.sendMessage(chatId, "Por favor, suba una foto del refill de Barra.");
            bot.once('photo', async msg => {
                const tipo = 'refill de Barra';
                await handlePhotoUpload(chatId, msg, tipo);
                await bot.sendMessage(chatId, "Registrado");
                await askPlantas(chatId);
            });
        } else {
            await bot.sendMessage(chatId, "Por favor realice el refill de Barra y suba la foto.");
        }
    });
}


async function askPlantas(chatId) {
    await bot.sendMessage(chatId, "Se han regado las plantas?💐", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Plantas';
            const descripcion = 'Plantas Regadas💦';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado");
            // Llamar a la función que maneja el siguiente paso
            await askForLimpiezaFood(chatId);
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando riegue las plantas.");
        }
    });
}

async function askForLimpiezaFood(chatId) {
    await bot.sendMessage(chatId, "¿Ha realizado la limpieza de food?🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            await bot.sendMessage(chatId, "Por favor, suba las fotos de la limpieza de food🧽📸. Puede enviar hasta 5 fotos.");
            bot.once('message', async msg => {
                if (msg.photo) {
                    const photos = msg.photo;
                    for (let photo of photos) {
                        await handlePhotoUpload(chatId, photo, 'limpieza de food');
                    }
                    await bot.sendMessage(chatId, "Todas las fotos han sido registradas👌👌");
                    await askForMontadaBebidas(chatId);
                } else {
                    await bot.sendMessage(chatId, "Por favor, asegúrese de enviar fotos.");
                }
            });
        } else {
            await bot.sendMessage(chatId, "Por favor realice la limpieza de food y suba la foto.");
        }
    });
}

async function askForMontadaBebidas(chatId) {
    await bot.sendMessage(chatId, "¿Ha realizado la montada de la barra de Bebidas🍹?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            await bot.sendMessage(chatId, "Por favor, suba una foto de la montada de Bebidas🍹📸");
            bot.once('photo', async msg => {
                const tipo = 'Montada de bebidas';
                await handlePhotoUpload(chatId, msg, tipo);
                await bot.sendMessage(chatId, "Registrado");
                await askLimpiezaSalones(chatId);
                ;
            });
        } else {
            await bot.sendMessage(chatId, "Por favor realice la montada de Bebidas y suba la foto.");
        }
    });
}

async function askLimpiezaSalones(chatId) {
    await bot.sendMessage(chatId, "Se han limpiado los salones?🧽🧽🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Limpieza de Salones';
            const descripcion = 'Salones Limpios';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌");
            // Llamar a la función que maneja el siguiente paso
            await askLimpiezaBodega(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando riegue limpie los Salones.");
        }
    });
}

async function askLimpiezaBodega(chatId) {
    await bot.sendMessage(chatId, "Se han limpiado la Bodega?🏡🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Limpieza de Bodega';
            const descripcion = 'Bodega Limpia';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado");
            // Llamar a la función que maneja el siguiente paso
            await askFumigacion(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando limpie la bodega.");
        }
    });
}

async function askFumigacion(chatId) {
    await bot.sendMessage(chatId, "Se ha fumigado?💨", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Reporte Fumigacion';
            const descripcion = 'Fumigado';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌👌");
            // Llamar a la función que maneja el siguiente paso
            await askBasura(chatId);
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando Fumigue.");
        }
    });
}
async function askBasura(chatId) {
    await bot.sendMessage(chatId, "Ya ha sacado la Basura?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Sacar Basura';
            const descripcion = 'Se ha sacado la basura';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado");
            // Llamar a la función que maneja el siguiente paso
            await askAlarma(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' Saque la Basura.");
        }
    });
}

async function askAlarma(chatId) {
    await bot.sendMessage(chatId, "Ya ha puesto la Alarma?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Alarma';
            const descripcion = 'Se ha puesto la Alarma';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado");
            // Llamar a la función que maneja el siguiente paso
            await askApagar(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' ponga la Alarma.");
        }
    });
}
async function askApagar(chatId) {
    await bot.sendMessage(chatId, "Ya apago todo?💡", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Apagar todo';
            const descripcion = 'Todo apagado';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌👌");
            // Llamar a la función que maneja el siguiente paso
            await askRefrigerador(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando Apague todo.");
        }
    });
}

async function askRefrigerador(chatId) {
    await bot.sendMessage(chatId, "Ya reviso que los refrigeradores esten cerrados y conectados?🚪🚪🚪", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Refrigeradores';
            const descripcion = 'Refrigeradores Conectados y Cerrados';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌👌👌");
            // Llamar a la función que maneja el siguiente paso
            await askHielera(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando verifique.");
        }
    });
}

async function askHielera(chatId) {
    await bot.sendMessage(chatId, "Ya reviso que la hielera este cerrado y conectado?🚪🚪", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Hielera';
            const descripcion = 'Hielera Conectada y Cerrada';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌");
            // Llamar a la función que maneja el siguiente paso
            await askRational(chatId);
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando verifique.");
        }
    });
}
async function askRational(chatId) {
    await bot.sendMessage(chatId, "el Rational este en lavado?🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
    bot.once('message', async msg => {
        if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
            const tipo = 'Rational en lavado';
            const descripcion = 'Rational esta en Lavado';
            await registerClosure(chatId, tipo, descripcion);
            await bot.sendMessage(chatId, "Registrado👌👌");
            // Llamar a la función que maneja el siguiente paso
            
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando verifique que el Rational este en lavado.");
        }
    });
}













async function handlePhotoUpload(chatId, msg, tipo, descripcion = '') {
    if (msg.photo) {
        const chatId = msg.chat.id;
        const photo = msg.photo.pop();
        const file_id = photo.file_id;
        const file_path = await getFileLink(file_id);
        const now = moment().tz('America/Mexico_City');
        const fecha = now.format('YYYY-MM-DD');
        await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_path, tipo, descripcion);
        await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
    } else {
        await bot.sendMessage(chatId, "Por favor envíe una foto.");
    }
}

async function getFileLink(fileId) {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${response.data.result.file_path}`;
    } catch (error) {
        console.error("Error fetching file link:", error);
        throw error; // Ensure the error is not unhandled
    }
}

function subirFoto(folder_id, fecha, file_url, tipo, descripcion) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_foto', folder_id, fecha, file_url, tipo, descripcion]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python Output: ${data.toString()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data.toString()}`);
            reject(new Error(`Python Error: ${data.toString()}`));
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Python script exited with code ${code}`));
            }
        });
    });
}

module.exports = {
    askDesmonte
  };