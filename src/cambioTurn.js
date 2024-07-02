require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');  // Asegúrate de tener Axios instalado
let dateFormat;
import('dateformat').then((module) => {
    dateFormat = module.default;
}).catch(error => console.log('Error loading the dateFormat module', error));
const bot = require('./confBot.js');    

const sessions = {};


async function getFileLink(fileId) {
  try {
      const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${response.data.result.file_path}`;
  } catch (error) {
      console.error("Error fetching file link:", error);
      throw error; // Ensure the error is not unhandled
  }
}


async function handleCambioCommand(chatId, employees, sucursal) {
  // Asumimos que esta función existe
 if (!employees || employees.length === 0) {
   await bot.sendMessage(chatId, "No se encontraron empleados.");
   return;
 }
 sessions[chatId] = {
   employees: employees,
   sucursal: sucursal
 };

 // Iniciar el proceso de elegir empleado y rol
 await chooseEmployee(chatId, employees, sucursal);
}
  
  function obtenerEmpleados() {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['./src/archivo.py', 'listar', '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', 'Asistencia']);
      let dataString = '';
  
      pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });
  
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data.toString()}`);
        reject(new Error(`Python Error: ${data.toString()}`));
      });
  
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}`));
        } else {
          try {
            resolve(JSON.parse(dataString.trim()));
          } catch (e) {
            reject(new Error("Failed to parse python script output: " + e.message));
          }
        }
      });
  
      pythonProcess.on('error', (err) => {
        reject(new Error("Failed to start python script: " + err.message));
      });
    });
  }
  
  function registrarAsistencia(empleado, fecha, hora, rol,sucursal ,motivo) {
    return new Promise((resolve, reject) => {
      
      
      const args = ['asistencia', '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', 'Asistencia', empleado, fecha, hora, rol,sucursal, motivo];
      const pythonProcess = spawn('python3', ['./src/archivo.py', ...args]);
  
      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
  
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Python Output:', output); // Log output from Python script
          resolve(output); // Resolve the promise with the output
        } else {
          reject(new Error(`Python script exited with code ${code}`));
        }
      });
  
      pythonProcess.stderr.on('data', (data) => {
        console.error('Python Error:', data.toString());
        reject(new Error(`Python Error: ${data.toString()}`));
      });
    });
  }
  
  
  
  let asistencia = {
    llegaron: [],
    faltas_retardos: []
  };
  
  
  
  async function chooseEmployee(chatId, employees, sucursal) {
    await bot.sendMessage(chatId, "¿Quién está en turno? 👤:", {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => handleRoleSelection(chatId, msg.text, sucursal, employees));
  }
  
  async function handleRoleSelection(chatId, empleado, sucursal, employees) {
    const roles = ['servicio', 'barra', 'cocina', 'runner', 'lava loza'];
    await bot.sendMessage(chatId, "Seleccione el rol:", {
      reply_markup: {
        keyboard: roles.map(rol => [{ text: rol }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      
      const rol = msg.text;
      const now = moment().tz('America/Mexico_City');
      const fecha = now.format('YYYY-MM-DD');
      const hora = now.format('HH:mm:ss');

      const result = await registrarAsistencia(empleado, fecha, hora, rol, sucursal);
      asistencia.llegaron.push({ nombre: empleado, rol: rol });
      await bot.sendMessage(chatId, `Asistencia registrada para ${empleado} como ${rol}.`);
      askForMore(chatId, sucursal, employees);
    });
  }
  
  async function askForMore(chatId, sucursal, employees) {
    await bot.sendMessage(chatId, "¿Desea registrar a otro empleado? 👥", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => {
      if (msg.text === 'Sí ✅') {
        handleCambioCommand(chatId, employees, sucursal);
      } else {
        handleAdditionalOptions(chatId, sucursal);
      }
    });
  }
  
  async function handleAdditionalOptions(chatId) {
    await bot.sendMessage(chatId, "Seleccione una opción:", {
      reply_markup: {
        keyboard: [
          ['Marcar falta⛔', 'Marcar retardo⛔🕐'],
          ['Finalizar registro✨']
        ],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      if (msg.text === 'Marcar falta⛔' || msg.text === 'Marcar retardo⛔🕐') {
        await handleFaltaRetardo(chatId, msg.text, sucursal);
      } else if (msg.text === 'Finalizar registro✨') {
        await showTaskMenu1(chatId);
        await showTaskMenu(chatId);
        
      }
    });
  }
  


  async function handleFaltaRetardo(chatId, tipo, sucursal) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const employees = await obtenerEmpleados();
  
    await bot.sendMessage(chatId, `Seleccione el empleado para ${tipo.toLowerCase()}:`, {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      const empleado = msg.text;
      await bot.sendMessage(chatId, `Ingrese el motivo del ${tipo.toLowerCase()}:`);
      bot.once('message', async msg => {
        const motivo = msg.text;
        const hora = now.format('HH:mm:ss');
        const rol = tipo === 'Marcar falta' ? 'Falta' : 'Retardo';
        await registrarAsistencia(empleado, fecha, hora, rol,sucursal ,motivo);
        await bot.sendMessage(chatId, `Se ha registrado un ${tipo.toLowerCase()} para ${empleado}.`);
        asistencia.faltas_retardos.push({ nombre: msg.text, tipo: falta_o_retardo });
       askForMore(chatId);
      });
    });
  }




  async function showTaskMenu1(chatId) {
    await bot.sendMessage(chatId, "¿Sale el servicio?", {
        reply_markup: {
            keyboard: [['Sí ✅', 'No ⛔']],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    return new Promise((resolve, reject) => {
        bot.once('message', async msg => {
            try {
                const sucursal = sessions[chatId].sucursal;
                const sale_servicio = msg.text === 'Sí ✅' ? '✅Sí sale✅' : '⛔⚠No sale⚠⛔';
                let message = `SUC ${sucursal} ${sale_servicio}\nllegó:\n`;
                asistencia.llegaron.forEach(emp => {
                    message += `${emp.nombre}-----------------${emp.rol}\n`;
                });
                message += 'Falta o Retardo\n';
                asistencia.faltas_retardos.forEach(emp => {
                    message += `${emp.nombre}----${emp.tipo}\n`;
                });
                message += '-------------------'; // Para separar secciones si es necesario

                groupChatId = -4224013774;

                // Envía el mensaje al grupo especificado
                await bot.sendMessage(groupChatId, message);

                resetAsistencia(); // Reinicia la lista de asistencia para el próximo uso
                resolve(); // Resuelve la promesa después de enviar el mensaje
            } catch (error) {
                reject(error); // Rechaza la promesa si hay un error
            }
        });
    });
}

  
  function resetAsistencia() {
    asistencia = { llegaron: [], faltas_retardos: [] };
  }

  const taskCompletion = {};

  function initializeTaskCompletion(chatId) {
    taskCompletion[chatId] = {
        
        '🧊 Congeladores': false,
        '🧊 Refrigeradores': false,
        '🚪 Limpieza Rational': false,
        '🍵 Tazas Remojándose': false,
        '🥛 Tarros Remojándose': false,
        '🔥 Vaporización Tazas': false,
        '🍴 Montaje Cocina': false,
        '🍸 Montaje Barra': false,
        '🍰 Montaje Vitrina': false,
        '🥞 Montaje Panques': false,
        '🍾 Acomodo Embotellados': false,
        '❄️ Coldbrew Fridge': false,
        'Volumen de bocinas': false,
        '🪑 Salones Limpios': false,
        '🍽️ Servicios en Mesa': false,
        '🖼️ Cuadros y Bocinas': false,
        '🛒 Carrito Rojo': false,
        '📦 Limpieza Bodega': false,
        '🌿 Limpieza Hojas Plantas': false,
        'Botes de Basura': false, 
        'baños limpios': false
    };
  }
  
async function showTaskMenu(chatId) {
  initializeTaskCompletion(chatId); // Asegura que taskCompletion[chatId] esté inicializado

  const options = Object.entries(taskCompletion[chatId])
    .filter(([task, done]) => !done)
    .map(([task]) => [task]);

  if (options.length === 0) {
    await bot.sendMessage(chatId, "Todas las tareas han sido registradas. ¡Buen trabajo!");
    delete taskCompletion[chatId]; // Limpia el estado al ✅✅📜Enviar Registro📜✅✅
    return;
  }

  options.push(['✅✅📜Enviar Registro📜✅✅']); // Opción para ✅✅📜Enviar Registro📜✅✅ y cerrar el menú

  await bot.sendMessage(chatId, "Seleccione la tarea a registrar:", {
    reply_markup: {
      keyboard: options,
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  // Manejar la respuesta del usuario
  bot.once('message', async (msg) => {
    const text = msg.text;
    if (text === '✅✅📜Enviar Registro📜✅✅') {
      await bot.sendMessage(chatId, "Registro completo.");
      const groupId = -4224013774;  

      sendSheetLinkToTelegramGroup(groupId);
      await bot.sendMessage(chatId, "Para volver al menu principal, presione /apertura_turno");
      delete taskCompletion[chatId]; // Limpia el estado al ✅✅📜Enviar Registro📜✅✅
      return;
    }
    if (taskCompletion[chatId][text] === false) {
      taskCompletion[chatId][text] = true;  // Marca como completada
      await handleTask(text, chatId);
    } else {
      await bot.sendMessage(chatId, "Seleccione una opción válida.");
      await showTaskMenu(chatId);
    }
  });
}

async function sendSheetLinkToTelegramGroup(chatId) {
  folderId= '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H';
  const sucursal = sessions[chatId].sucursal;
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
          bot.sendMessage(chatId, `Aquí está el enlace del archivo de el reporte Actualizado a Vespertino: ${dataOutput.trim()}`).catch(console.error);
      } else {
          console.error(`Python Error: ${errorOutput}`);
          bot.sendMessage(chatId, "Hubo un error al obtener el archivo Actualizado a Vespertino").catch(console.error);
      }
  });
}

async function handleTask(task, chatId) {
  switch (task) {
      case '🧊 Congeladores':
          await checkFreezers(chatId);
          break;
      case '🧊 Refrigeradores':
          await checkRefrigerators(chatId);
          break;
      case '🚪 Limpieza Rational':
          await checkRationalDoorCleaning(chatId);
          break;
      case '🍵 Tazas Remojándose':
          await checkSoakingCups(chatId);
          break;
      case '🥛 Tarros Remojándose':
          await checkSoakingJars(chatId);
          break;
      case '🔥 Vaporización Tazas':
          await checkCupSteaming(chatId);
          break;
      case '🍴 Montaje Cocina':
          await checkKitchenSetup(chatId);
          break;
      case '🍸 Montaje Barra':
          await checkBarSetup(chatId);
          break;
      case '🍰 Montaje Vitrina':
          await checkShowcaseSetup(chatId);
          break;
      case '🥞 Montaje Panques':
          await checkPancakeSetup(chatId);
          break;
      case '🍾 Acomodo Embotellados':
          await checkBottledArrangement(chatId);
          break;
      case '❄️ Coldbrew Fridge':
          await checkColdbrewFridgeArrangement(chatId);
          break;
      case '🪑 Salones Limpios':
          await checkCleanRooms(chatId);
          break;
      case '🍽️ Servicios en Mesa':
          await checkTableService(chatId);
          break;
      case '🖼️ Cuadros y Bocinas':
          await checkFramesAndSpeakers(chatId);
          break;
      case '🛒 Carrito Rojo':
          await checkRedCartSetup(chatId);
          break;
      case 'Volumen de bocinas':
          await checkSpeakersVolumeAndPlaylist(chatId);
          break;
      case '📦 Limpieza Bodega':
          await checkStorageCleaning(chatId);
          break;
      case '🌿 Limpieza Hojas Plantas':
          await checkPlantLeafCleaning(chatId);
          break;
      case 'Botes de basura':
          await checkTrashBinsCleaning(chatId);
          break;
      case 'Baños limios':
          await checkBathroomsCleaningAndStocking(chatId);
          break;
      // Continuar añadiendo casos según sean necesarios
      
  }
  await showTaskMenu(chatId); // Volver a mostrar el menú
}



async function checkTrashBinsCleaning(chatId) {
  await bot.sendMessage(chatId, "¿Botes de basura limpios?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'botes de basura limpios';
      const descripcion = msg.text === 'Sí ✅' ? 'Botes de basura limpios' : 'Botes de basura sucios';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkBathroomsCleaningAndStocking(chatId) {
  await bot.sendMessage(chatId, "¿Baños limpios y abastecidos?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'baños limpios y abastecidos';
      const descripcion = msg.text === 'Sí ✅' ? 'Baños limpios y abastecidos correctamente' : 'Baños sucios o desabastecidos';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}


async function checkFreezers(chatId) {
  await bot.sendMessage(chatId, "¿Los congeladores están alrededor de -18 grados centígrados?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'congeladores';
      const descripcion = msg.text === 'Sí ✅' ? 'Congeladores en temperatura adecuada' : 'Congeladores fuera de temperatura';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de los ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkRefrigerators(chatId) {
  await bot.sendMessage(chatId, "¿Los refrigeradores están en un rango de 3 - 4 grados centígrados?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'refrigeradores';
      const descripcion = msg.text === 'Sí ✅' ? 'Refrigeradores en temperatura adecuada' : 'Refrigeradores fuera de temperatura';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de los ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkRationalDoorCleaning(chatId) {
  await bot.sendMessage(chatId, "¿Se hizo la limpieza de la puerta del Rational?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'puerta rational';
      const descripcion = msg.text === 'Sí ✅' ? 'Puerta del Rational limpia' : 'Puerta del Rational no limpia';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Limpieza de la ${tipo} registrada correctamente.`);
      resolve();
    });
  });
}

async function checkSoakingCups(chatId) {
  await bot.sendMessage(chatId, "¿Recibiste tazas remojándose?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'tazas remojándose';
      const descripcion = msg.text === 'Sí ✅' ? 'Tazas remojándose recibidas' : 'No se recibieron tazas remojándose';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkSoakingJars(chatId) {
  await bot.sendMessage(chatId, "¿Recibiste tarros remojándose?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'tarros remojándose';
      const descripcion = msg.text === 'Sí ✅' ? 'Tarros remojándose recibidos' : 'No se recibieron tarros remojándose';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkCupSteaming(chatId) {
  await bot.sendMessage(chatId, "¿Se vaporizaron tazas?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'vaporización de tazas';
      const descripcion = msg.text === 'Sí ✅' ? 'Tazas vaporizadas' : 'Tazas no vaporizadas';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkKitchenSetup(chatId) {
  await bot.sendMessage(chatId, "¿Montaje de cocina realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'montaje de cocina';
      const descripcion = msg.text === 'Sí ✅' ? 'Montaje de cocina realizado' : 'Montaje de cocina no realizado';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkBarSetup(chatId) {
  await bot.sendMessage(chatId, "¿Montaje de barra realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'montaje de barra';
      const descripcion = msg.text === 'Sí ✅' ? 'Barra montada correctamente' : 'Barra no montada';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkShowcaseSetup(chatId) {
  await bot.sendMessage(chatId, "¿Montaje de vitrina realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'montaje de vitrina';
      const descripcion = msg.text === 'Sí ✅' ? 'Vitrina montada correctamente' : 'Vitrina no montada';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkPancakeSetup(chatId) {
  await bot.sendMessage(chatId, "¿Montaje de panques realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'montaje de panques';
      const descripcion = msg.text === 'Sí ✅' ? 'Panques montados correctamente' : 'Panques no montados';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkBottledArrangement(chatId) {
  await bot.sendMessage(chatId, "¿Acomodo y surtido de embotellados realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'surtido de embotellados';
      const descripcion = msg.text === 'Sí ✅' ? 'Embotellados surtidos y acomodados correctamente' : 'Embotellados no surtidos ni acomodados';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkColdbrewFridgeArrangement(chatId) {
  await bot.sendMessage(chatId, "¿Refrigerador coldbrew surtido y acomodo realizado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'surtido de refrigerador coldbrew';
      const descripcion = msg.text === 'Sí ✅' ? 'Refrigerador coldbrew surtido y acomodado correctamente' : 'Refrigerador coldbrew no surtido ni acomodado';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkCleanRooms(chatId) {
  await bot.sendMessage(chatId, "¿Salones limpios?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'limpieza de salones';
      const descripcion = msg.text === 'Sí ✅' ? 'Salones limpios' : 'Salones no limpios';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkTableService(chatId) {
  await bot.sendMessage(chatId, "¿Servicios en mesa colocados?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'servicios en mesa';
      const descripcion = msg.text === 'Sí ✅' ? 'Servicios en mesa colocados correctamente' : 'Servicios en mesa no colocados';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkFramesAndSpeakers(chatId) {
  await bot.sendMessage(chatId, "¿Cuadros derechos y limpios?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'cuadros derechos y limpios';
      const descripcion = msg.text === 'Sí ✅' ? 'Cuadros derechos y limpios' : 'Cuadros no derechos o limpios';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkSpeakersVolumeAndPlaylist(chatId) {
  await bot.sendMessage(chatId, "¿Bocinas en buen volumen y reproducción de playlist Boicot Café?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'bocinas y playlist';
      const descripcion = msg.text === 'Sí ✅' ? 'Bocinas en buen volumen y playlist en reproducción' : 'Bocinas o playlist no adecuados';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkRedCartSetup(chatId) {
  await bot.sendMessage(chatId, "¿Carrito rojo montado?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'carrito rojo montado';
      const descripcion = msg.text === 'Sí ✅' ? 'Carrito rojo montado correctamente' : 'Carrito rojo no montado';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkStorageCleaning(chatId) {
  await bot.sendMessage(chatId, "¿Limpieza y acomodo de bodega realizada?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'limpieza de bodega';
      const descripcion = msg.text === 'Sí ✅' ? 'Bodega limpia y acomodada' : 'Bodega no limpia ni acomodada';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}

async function checkPlantLeafCleaning(chatId) {
  await bot.sendMessage(chatId, "¿Se limpiaron las hojas de plantas?", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      const tipo = 'limpieza de hojas de plantas';
      const descripcion = msg.text === 'Sí ✅' ? 'Hojas de plantas limpias' : 'Hojas de plantas no limpias';
      await registerEquipmentStatus(chatId, tipo, descripcion);
      await bot.sendMessage(chatId, `Estado de ${tipo} registrado correctamente.`);
      resolve();
    });
  });
}


async function registerEquipmentStatus(chatId, tipo, descripcion) {
  const now = moment().tz('America/Mexico_City');
  const fecha = now.format('YYYY-MM-DD');
  const file_url = ''; // Dejar vacío ya que no se sube foto
  const sucursal = sessions[chatId].sucursal;
  await subirFoto('1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', fecha, file_url, tipo, descripcion, sucursal);
}



  
  
  async function handleFaltaRetardo(chatId, tipo) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const employees = await obtenerEmpleados();
  
    await bot.sendMessage(chatId, `Seleccione el empleado para ${tipo.toLowerCase()}:`, {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      const empleado = msg.text;
      await bot.sendMessage(chatId, `Ingrese el motivo del ${tipo.toLowerCase()}:`);
      bot.once('message', async msg => {
        const motivo = msg.text;
        const hora = now.format('HH:mm:ss');
        const rol = tipo === 'Marcar falta' ? 'Falta' : 'Retardo';
        await registrarAsistencia(empleado, fecha, hora, rol, motivo);
        await bot.sendMessage(chatId, `Se ha registrado un ${tipo.toLowerCase()} para ${empleado}.`);
        handleAdditionalOptions(chatId);
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
      
      await subirFoto('1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', fecha, file_path, tipo, descripcion);
      await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
    } else {
      await bot.sendMessage(chatId, "Por favor envíe una foto.");
    }
  }
  
  function getFileLink(file_id) {
    return bot.getFileLink(file_id);
  }
  
  function subirFoto(folder_id,fecha ,file_url, tipo, descripcion) {
    return new Promise((resolve, reject) => {
      const sucursal = sessions[chatId].sucursal;
      const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_foto', folder_id,fecha, file_url, tipo, descripcion, sucursal]);
  
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
    handleCambioCommand
};