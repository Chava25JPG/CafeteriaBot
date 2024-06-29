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
        // Existing tasks...
        '🧊 Refrigeradores Cerrados y Funcionando': false,
        '🧊 Hielera Funcionando': false,
        '🌡️ Temperatura 3-4 Grados': false,
        '🧼 Rational en Lavado': false,
        '🔇 Reproductor Apagado': false,
        '🌿 Riego de Plantas': false,
        '🚫 Toma de Gas Cerrada': false,
        '🚰 Llaves de Agua Cerradas': false,
        '💧 Fuga de Agua en Baños': false,
        '🔒 Alarma y Reja Aseguradas': false,
        '🧹 Limpieza profunda de salones': false,
        '🧹 Limpieza profunda de bodega': false,
        '🧹 Limpieza profunda de barra': false,
        '🗑️ Sacar basura': false,
        '🍹 Refill de barra': false
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
    if (task in taskCompletion[chatId] && taskCompletion[chatId][task]) {
        await bot.sendMessage(chatId, "Esta tarea ya se registró como completada.");
        await showTaskMenu(chatId);
        return;
    }
    
    switch (task) {
        // Existing cases...
        case '🧹 Limpieza profunda de salones':
            await checkDeepCleaningRooms(chatId);
            break;
        case '🧹 Limpieza profunda de bodega':
            await checkDeepCleaningStorage(chatId);
            break;
        case '🧹 Limpieza profunda de barra':
            await checkDeepCleaningBar(chatId);
            break;
        case '🗑️ Sacar basura':
            await checkTrashRemoval(chatId);
            break;
        case '🍹 Refill de barra':
            await checkBarRefill(chatId);
            break;
        case '🧊 Refrigeradores Cerrados y Funcionando':
            await checkRefrigeratorsClosedAndWorking(chatId);
            break;
        case '🧊 Hielera Funcionando':
            await checkCoolerWorking(chatId);
            break;
        case '🌡️ Temperatura 3-4 Grados':
            await checkRefrigeratorTemperature(chatId);
            break;
        case '🧼 Rational en Lavado':
            await checkRationalCleaningMode(chatId);
            break;
        case '🔇 Reproductor Apagado':
            await checkPlayerOff(chatId);
            break;
        case '🌿 Riego de Plantas':
            await checkPlantsWatered(chatId);
            break;
        case '🚫 Toma de Gas Cerrada':
            await checkGasValveClosed(chatId);
            break;
        case '🚰 Llaves de Agua Cerradas':
            await checkWaterValvesClosed(chatId);
            break;
        case '💧 Fuga de Agua en Baños':
            await checkWaterLeakInBathrooms(chatId);
            break;
        case '🔒 Alarma y Reja Aseguradas':
            await checkAlarmAndGate(chatId);
            break;
        
    }
    
    taskCompletion[chatId][task] = true; // Update task status
    await showTaskMenu(chatId); // Show the menu again after a task is handled
}


async function registerEquipmentStatus(chatId, tipo, descripcion) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const file_url = ''; // Dejar vacío ya que no se sube foto
    const sucursal = sessions[chatId].sucursal;
    await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_url, tipo, descripcion, sucursal);
  }


async function checkDeepCleaningRooms(chatId) {
    await bot.sendMessage(chatId, "¿Limpieza profunda de salones realizada?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'limpieza profunda de salones';
        const descripcion = msg.text === 'Sí ✅' ? 'Salones limpios profundamente' : 'Limpieza profunda de salones pendiente';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkDeepCleaningStorage(chatId) {
    await bot.sendMessage(chatId, "¿Limpieza profunda de bodega realizada?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'limpieza profunda de bodega';
        const descripcion = msg.text === 'Sí ✅' ? 'Bodega limpia profundamente' : 'Limpieza profunda de bodega pendiente';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkDeepCleaningBar(chatId) {
    await bot.sendMessage(chatId, "¿Limpieza profunda de barra realizada?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'limpieza profunda de barra';
        const descripcion = msg.text === 'Sí ✅' ? 'Barra limpia profundamente' : 'Limpieza profunda de barra pendiente';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkTrashRemoval(chatId) {
    await bot.sendMessage(chatId, "¿Se sacó la basura?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'extracción de basura';
        const descripcion = msg.text === 'Sí ✅' ? 'Basura sacada correctamente' : 'Basura pendiente de sacar';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkBarRefill(chatId) {
    await bot.sendMessage(chatId, "¿Refill de barra realizado?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'refill de barra';
        const descripcion = msg.text === 'Sí ✅' ? 'Refill de barra completado' : 'Refill de barra pendiente';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  async function checkRefrigeratorsClosedAndWorking(chatId) {
    await bot.sendMessage(chatId, "¿Refrigeradores cerrados y funcionando?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'refrigeradores cerrados y funcionando';
        const descripcion = msg.text === 'Sí ✅' ? 'Refrigeradores operativos y cerrados' : 'Refrigeradores abiertos o no funcionando';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkCoolerWorking(chatId) {
    await bot.sendMessage(chatId, "¿Hielera funcionando correctamente?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'hielera funcionando';
        const descripcion = msg.text === 'Sí ✅' ? 'Hielera operativa' : 'Hielera no funciona';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkRefrigeratorTemperature(chatId) {
    await bot.sendMessage(chatId, "¿Temperatura correcta entre 3-4 grados en los refrigeradores?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'temperatura de refrigeradores';
        const descripcion = msg.text === 'Sí ✅' ? 'Temperatura adecuada' : 'Temperatura inadecuada';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkRationalCleaningMode(chatId) {
    await bot.sendMessage(chatId, "¿Rational en función de lavado?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'Rational en lavado';
        const descripcion = msg.text === 'Sí ✅' ? 'Rational en modo de lavado' : 'Rational no está en lavado';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkPlayerOff(chatId) {
    await bot.sendMessage(chatId, "¿Reproductor apagado?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'reproductor apagado';
        const descripcion = msg.text === 'Sí ✅' ? 'Reproductor apagado' : 'Reproductor encendido';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkPlantsWatered(chatId) {
    await bot.sendMessage(chatId, "¿Se regaron las plantas (cada 3 días)?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'riego de plantas';
        const descripcion = msg.text === 'Sí ✅' ? 'Plantas regadas recientemente' : 'Plantas no regadas';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkGasValveClosed(chatId) {
    await bot.sendMessage(chatId, "¿La toma de gas está cerrada?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'toma de gas cerrada';
        const descripcion = msg.text === 'Sí ✅' ? 'Toma de gas cerrada correctamente' : 'Toma de gas abierta';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkWaterValvesClosed(chatId) {
    await bot.sendMessage(chatId, "¿Las llaves de agua están cerradas?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'llaves de agua cerradas';
        const descripcion = msg.text === 'Sí ✅' ? 'Llaves de agua cerradas' : 'Llaves de agua abiertas';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkWaterLeakInBathrooms(chatId) {
    await bot.sendMessage(chatId, "¿Hay alguna fuga de agua en los baños?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'fuga de agua en baños';
        const descripcion = msg.text === 'Sí ✅' ? 'Fuga de agua presente' : 'No hay fuga de agua';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
  }
  
  async function checkAlarmAndGate(chatId) {
    await bot.sendMessage(chatId, "¿Alarma y reja aseguradas?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    return new Promise((resolve) => {
      bot.once('message', async (msg) => {
        const tipo = 'alarma y reja';
        const descripcion = msg.text === 'Sí ✅' ? 'Alarma y reja aseguradas' : 'Alarma o reja no aseguradas';
        await registerEquipmentStatus(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
        resolve();
      });
    });
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