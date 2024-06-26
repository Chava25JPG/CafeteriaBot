const bot = require('./confBot.js');
const moment = require('moment-timezone');
const { spawn } = require('child_process');
const axios = require('axios');

const sessions = {};

async function askDesmonte(chatId, sucursal) {
    await showTaskMenu(chatId, sucursal);
    sessions[chatId] = {
        sucursal: sucursal
      };
}

const taskCompletion = {};

function initializeTaskCompletion(chatId) {
    taskCompletion[chatId] = {
        'Refill de Food': false,
        'Refill de Barra': false,
        'Riego de Plantas': false,
        'Limpieza de Food': false,
        'Montada de Bebidas': false,
        'Limpieza de Salones': false,
        'Limpieza de Bodega': false,
        'Fumigación': false,
        'Sacar Basura': false,
        'Alarma': false,
        'Apagar Todo': false,
        'Revisión de Refrigeradores': false,
        'Revisión de Hielera': false,
        'Rational en Lavado': false,
        'Desmonte de Sucursal': false
    };
}

async function showTaskMenu(chatId, sucursal) {
    initializeTaskCompletion(chatId);

    const options = Object.entries(taskCompletion[chatId])
        .filter(([task, done]) => !done)
        .map(([task]) => [task]);

    if (options.length === 0) {
        await bot.sendMessage(chatId, "Todas las tareas han sido registradas. ¡Buen trabajo!");
        delete taskCompletion[chatId];
        return;
    }

    options.push(['✅✅📜Enviar Registro📜✅✅']);

    await bot.sendMessage(chatId, "Seleccione la tarea a registrar:", {
        reply_markup: {
            keyboard: options,
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    bot.once('message', async (msg) => {
        const text = msg.text;
        if (text === '✅✅📜Enviar Registro📜✅✅') {
            await bot.sendMessage(chatId, "Registro completo.");
            const groupId = -4224013774;  
            sendSheetLinkToTelegramGroup(groupId, sucursal);
            await bot.sendMessage(chatId, "Para volver al menu principal, presione /apertura_turno");
            delete taskCompletion[chatId];
            return;
        }
        if (taskCompletion[chatId][text] === false) {
            taskCompletion[chatId][text] = true;
            await handleTask(text, chatId);
        } else {
            await bot.sendMessage(chatId, "Seleccione una opción válida.");
            await showTaskMenu(chatId);
        }
    });
}

async function sendSheetLinkToTelegramGroup(chatId, sucursal) {
    folderId= '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl';
    
    const pythonProcess = spawn('python3', ['./src/obtenerArchivo.py', folderId, sucursal]);  // Asumiendo que el script se llama obtenerArchivo.py y está en el directorio src/
  
    let dataOutput = '';
    let errorOutput = '';
  
    pythonProcess.stdout.on('data', (data) => {
        dataOutput += data.toString();
    });
  
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
  
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Python Output: ${dataOutput}`);
            bot.sendMessage(chatId, `Aquí está el enlace del archivo de el reporte Del dia de Hoy: ${dataOutput.trim()}`).catch(console.error);
        } else {
            console.error(`Python Error: ${errorOutput}`);
            bot.sendMessage(chatId, "Hubo un error al obtener el reporte Del dia de Hoy").catch(console.error);
        }
    });
  }
  

async function handleTask(task, chatId) {
    switch (task) {
        case 'Refill de Food':
            await askForRefillFood(chatId);
            break;
        case 'Refill de Barra':
            await askForRefillBarra(chatId);
            break;
        case 'Riego de Plantas':
            await askPlantas(chatId);
            break;
        case 'Limpieza de Food':
            await askForLimpiezaFood(chatId);
            break;
        case 'Montada de Bebidas':
            await askForMontadaBebidas(chatId);
            break;
        case 'Limpieza de Salones':
            await askLimpiezaSalones(chatId);
            break;
        case 'Limpieza de Bodega':
            await askLimpiezaBodega(chatId);
            break;
        case 'Fumigación':
            await askFumigacion(chatId);
            break;
        case 'Sacar Basura':
            await askBasura(chatId);
            break;
        case 'Alarma':
            await askAlarma(chatId);
            break;
        case 'Apagar Todo':
            await askApagar(chatId);
            break;
        case 'Revisión de Refrigeradores':
            await askRefrigerador(chatId);
            break;
        case 'Revisión de Hielera':
            await askHielera(chatId);
            break;
        case 'Rational en Lavado':
            await askRational(chatId);
            break;
        case 'Desmonte de Sucursal':
            await askDesmonte1(chatId);
            break;
        default:
            await bot.sendMessage(chatId, "Por favor, seleccione una opción válida del menú.");
            break;
    }
    await showTaskMenu(chatId);
}



async function askDesmonte1(chatId) {
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
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando desmonte la sucursal.");
        }
    });
}

async function registerClosure(chatId, tipo, descripcion) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const file_url = ''; // Dejar vacío ya que no se sube foto
    await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_url, tipo, descripcion, chatId);
}

async function askForRefillFood(chatId) {
    await bot.sendMessage(chatId, "¿Ha realizado el refill de food?🍲", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅') {
                await bot.sendMessage(chatId, "Por favor, suba una foto del refill de food.📸🍲");
                bot.once('photo', async (msg) => {
                    const tipo = 'refill de food';
                    await handlePhotoUpload(chatId, msg, tipo);
                    await bot.sendMessage(chatId, "Foto de refill de food registrada correctamente.");
                    resolve();
                });
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor realice el refill de food y suba la foto.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askForRefillFood(chatId); // Recursivamente llama a sí misma si la opción no es válida
                resolve();
            }
        });
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

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                await bot.sendMessage(chatId, "Por favor, suba una foto del refill de Barra.");
                bot.once('photo', async (msg) => {
                    const tipo = 'refill de Barra';
                    await handlePhotoUpload(chatId, msg, tipo);
                    await bot.sendMessage(chatId, "Foto del refill de Barra registrada correctamente.");
                    
                    resolve();
                });
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor realice el refill de Barra y suba la foto.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askForRefillBarra(chatId); // Recursivamente llama a sí misma si la opción no es válida
                resolve();
            }
        });
    });
}


async function askPlantas(chatId) {
    await bot.sendMessage(chatId, "¿Se han regado las plantas?💐", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Plantas';
                const descripcion = 'Plantas regadas';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Plantas regadas correctamente registradas.");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, riegue las plantas y confirme completando esta tarea.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askPlantas(chatId); // Recursivamente llama a sí misma si la opción no es válida
                resolve();
            }
        });
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

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                await bot.sendMessage(chatId, "Por favor, suba las fotos de la limpieza de food🧽📸. Puede enviar hasta 5 fotos.");
                bot.once('message', async (msg) => {
                    if (msg.photo) {
                        const photos = msg.photo;
                        for (let photo of photos) {
                            await handlePhotoUpload(chatId, photo, 'limpieza de food');
                        }
                        await bot.sendMessage(chatId, "Todas las fotos han sido registradas👌👌");
                        resolve();
                    } else {
                        await bot.sendMessage(chatId, "Por favor, asegúrese de enviar fotos.");
                        resolve();
                    }
                });
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, realice la limpieza de food y suba las fotos.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askForLimpiezaFood(chatId);
                resolve();
            }
        });
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

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                await bot.sendMessage(chatId, "Por favor, suba una foto de la montada de Bebidas🍹📸.");
                bot.once('photo', async (msg) => {
                    if (msg.photo) {
                        const tipo = 'montada de bebidas';
                        await handlePhotoUpload(chatId, msg, tipo);
                        await bot.sendMessage(chatId, "Foto de la montada de Bebidas registrada correctamente.");
                        resolve();
                    } else {
                        await bot.sendMessage(chatId, "Por favor, asegúrese de enviar una foto.");
                        resolve();
                    }
                });
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, realice la montada de Bebidas y suba la foto.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askForMontadaBebidas(chatId);
                resolve();
            }
        });
    });
}


async function askLimpiezaSalones(chatId) {
    await bot.sendMessage(chatId, "¿Se han limpiado los salones?🧽🧽🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                await bot.sendMessage(chatId, "Por favor, suba una foto de los salones limpios.");
                bot.once('photo', async (msg) => {
                    if (msg.photo) {
                        const tipo = 'limpieza de salones';
                        await handlePhotoUpload(chatId, msg, tipo);
                        await bot.sendMessage(chatId, "Foto de los salones limpios registrada correctamente.");
                        resolve();
                    } else {
                        await bot.sendMessage(chatId, "Por favor, asegúrese de enviar una foto.");
                        resolve();
                    }
                });
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, limpie los salones antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askLimpiezaSalones(chatId);
                resolve();
            }
        });
    });
}

async function askLimpiezaBodega(chatId) {
    await bot.sendMessage(chatId, "¿Se ha limpiado la Bodega?🏡🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Limpieza de Bodega';
                const descripcion = 'Bodega Limpia';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, limpie la bodega antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askLimpiezaBodega(chatId);
                resolve();
            }
        });
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
            
        } else {
            await bot.sendMessage(chatId, "Por favor, presione 'Sí ✅' cuando Fumigue.");
        }
    });
}
async function askBasura(chatId) {
    await bot.sendMessage(chatId, "¿Ya ha sacado la Basura?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Sacar Basura';
                const descripcion = 'Se ha sacado la basura';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, saque la Basura antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askBasura(chatId);
                resolve();
            }
        });
    });
}

async function askAlarma(chatId) {
    await bot.sendMessage(chatId, "¿Ya ha puesto la Alarma?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Alarma';
                const descripcion = 'Se ha puesto la Alarma';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, ponga la Alarma antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askAlarma(chatId);
                resolve();
            }
        });
    });
}

async function askApagar(chatId) {
    await bot.sendMessage(chatId, "¿Ya apagó todo?💡", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Apagar todo';
                const descripcion = 'Todo apagado';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado👌👌");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, asegúrese de apagar todo antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askApagar(chatId);
                resolve();
            }
        });
    });
}


async function askRefrigerador(chatId) {
    await bot.sendMessage(chatId, "¿Ya revisó que los refrigeradores estén cerrados y conectados?🚪🚪🚪", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Refrigeradores';
                const descripcion = 'Refrigeradores Conectados y Cerrados';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado👌👌👌");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, asegúrese de que los refrigeradores estén cerrados y conectados antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askRefrigerador(chatId);
                resolve();
            }
        });
    });
}

async function askHielera(chatId) {
    await bot.sendMessage(chatId, "¿Ya revisó que la hielera esté cerrada y conectada?🚪🚪", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Hielera';
                const descripcion = 'Hielera Conectada y Cerrada';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado👌");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, asegúrese de que la hielera esté cerrada y conectada antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askHielera(chatId);
                resolve();
            }
        });
    });
}

async function askRational(chatId) {
    await bot.sendMessage(chatId, "¿El Rational está en lavado?🧽", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve) => {
        bot.once('message', async (msg) => {
            if (msg.text === 'Sí ✅' || msg.text.toLowerCase() === 'si') {
                const tipo = 'Rational en lavado';
                const descripcion = 'Rational está en Lavado';
                await registerClosure(chatId, tipo, descripcion);
                await bot.sendMessage(chatId, "Registrado👌👌");
                resolve();
            } else if (msg.text === 'No ⛔') {
                await bot.sendMessage(chatId, "Por favor, asegúrese de que el Rational esté en lavado antes de continuar.");
                resolve();
            } else {
                await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
                await askRational(chatId);
                resolve();
            }
        });
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
        await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_path, tipo, descripcion, chatId);
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

function subirFoto(folder_id, fecha, file_url, tipo, descripcion, chatId) {
    return new Promise((resolve, reject) => {
        const sucursal = sessions[chatId].sucursal;
        const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_foto', folder_id, fecha, file_url, tipo, descripcion, sucursal]);

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