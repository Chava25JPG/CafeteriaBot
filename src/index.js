require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const bot = require('./confBot.js')
const sessions = {};
const { handleCambioCommand } = require('./cambioTurn.js');

const { askDesmonte } = require('./Cierre.js')
const { getAdminsAndStore } = require('./funciones.js');
const axios = require('axios');  // Asegúrate de tener Axios instalado
let dateFormat;
import('dateformat').then((module) => {
    dateFormat = module.default;
}).catch(error => console.log('Error loading the dateFormat module', error));


const app = express();
const upload = multer({ dest: 'uploads/' });

const auth = new google.auth.GoogleAuth({
  keyFile: './cafeteriabot-423500-4f883c22c073.json',
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });
const token = '7010537118:AAGqMOUsovqefCvfeMM05XIZHoXB-8e37rc';






bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
  // Intenta reiniciar el polling después de un breve retraso
  setTimeout(() => {
    console.log("Reiniciando polling...");
    bot.startPolling();
  }, 5000); // Espera 5 segundos antes de reiniciar
});






async function ensureFolderExists(parentId, folderName) {
  if (!folderName || typeof folderName !== 'string' || !parentId || typeof parentId !== 'string') {
    console.error('Datos inválidos para folderName o parentId:', {folderName, parentId});
    return null;  // Retorna null para evitar crear carpetas incorrectas.
  }

  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files.length > 0) {
      console.log(`Carpeta '${folderName}' encontrada con ID: ${response.data.files[0].id}`);
      return response.data.files[0].id;
    } else {
      console.log(`Carpeta '${folderName}' no encontrada, se procederá a crearla.`);
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      };
      const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id'
      });
      console.log(`Carpeta '${folderName}' creada con ID: ${folder.data.id}`);
      return folder.data.id;
    }
  } catch (error) {
    console.error('Error al verificar o crear la carpeta:', error);
    return null;  // Retorna null para manejo de error en llamadas.
  }
}

bot.onText(/\/apertura_turno/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { employees: [] };  // Inicializar sesión para el usuario

  const replyMarkup = JSON.stringify({
    inline_keyboard: [
      [{ text: "Satelite", callback_data: "Satelite" }],
      [{ text: "Roma", callback_data: "Roma" }],
      [{ text: "Polanco", callback_data: "Polanco" }],
      [{ text: "Coyoacan", callback_data: "Coyoacan" }],
      [{ text: "Condesa", callback_data: "Condesa" }]
    ]
  });

  bot.sendMessage(chatId, "Seleccione la sucursal:", { reply_markup: replyMarkup });
});

bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const sucursal = callbackQuery.data;

  

  // Ejecutar el script de Python para obtener los empleados de la sucursal
  const pythonProcess = spawn('python3', ['src/obtener_empleados.py', sucursal]);

  let dataOutput = '';
  pythonProcess.stdout.on('data', (data) => {
      dataOutput += data.toString();
  });

  pythonProcess.on('close', (code) => {
      console.log("Full output received from Python:", dataOutput);
      if (code !== 0) {
          console.error(`Python script exited with code ${code}`);
          bot.sendMessage(chatId, "Error al cargar los empleados de la sucursal.");
          return;
      }

      try {
          const result = JSON.parse(dataOutput);
          if (result.status === 'success') {
            sessions[chatId] = {
              employees: result.data,
              sucursal: sucursal
            }; // Almacenar empleados en la sesión
            
              bot.sendMessage(chatId, "Empleados cargados. Seleccione su turno:", {
                  reply_markup: {
                      keyboard: [['🌞Turno Matutino🌞', '🌕Turno Vespertino🌕'], ['🚪Cierre🚪', '❕Mas opciones❕']],
                      one_time_keyboard: true,
                      resize_keyboard: true
                  }
              });
          } else {
              bot.sendMessage(chatId, `Error: ${result.message}`);
          }
      } catch (err) {
          console.error(`Error parsing JSON from Python script: ${err}`);
          bot.sendMessage(chatId, "Error al procesar la respuesta del servidor.");
      }
  });
});
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId] || sessions[chatId].employees.length === 0) {
    return; // Si no hay empleados cargados, se ignora el mensaje
  }
  const employees = sessions[chatId].employees;
  const sucursal = sessions[chatId].sucursal;

  switch (msg.text) {
    case '🌞Turno Matutino🌞':
      handleAsistenciaCommand(chatId, employees, sucursal);
      break;
    case '🌕Turno Vespertino🌕':
      handleAsistenciaCommand(chatId, employees, sucursal);
      break;
    case '🚪Cierre🚪':
      askDesmonte(chatId, sucursal);
      break;
    case '❕Mas opciones❕':
      handleAdditionalOptions1(chatId);
      break;
    default:
      
  }
});

async function deleteExistingFile(folderId, filename) {
  const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
  const existingFiles = await drive.files.list({
    q: query,
    fields: 'files(id)'
  });

  if (existingFiles.data.files.length > 0) {
    await drive.files.delete({
      fileId: existingFiles.data.files[0].id
    });
    console.log(`Archivo existente borrado: ${filename}`);
  }
}




bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text) {
    if (msg.text.toString().toLowerCase().indexOf("hola") === 0) {
      bot.sendMessage(chatId, "Hola, ¿qué tal?");
    } else if (msg.text.toString().toLowerCase().includes("adiós")) {
      bot.sendMessage(chatId, "¡Hasta luego!");
    }
  }
});


bot.on('document', async (msg) => {
  

  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const mimeType = msg.document.mime_type;

  bot.sendMessage(chatId, `Por favor espere, en un momento se le avisara cuando el archivo se suba`);
  console.log(`procesando...`);
  
  const response = await axios({
    method: 'get',
    url: await bot.getFileLink(fileId),
    responseType: 'stream'
}).catch(error => {
    console.error("Error during HTTP request:", error.message);
    throw error;  // Propagate error
});

  const now = new Date();
  const year = dateFormat(now, "yyyy");
  const month = dateFormat(now, "mm");
  const week = `Week_${Math.ceil(now.getDate() / 7)}`;
  const dayOfWeek = dateFormat(now, "dddd");

  const yearFolderId = await ensureFolderExists('1pS-L0xpDzIeuh9e0XliVhzjZUa7mYkvt', year);
  const monthFolderId = await ensureFolderExists(yearFolderId, month);
  const weekFolderId = await ensureFolderExists(monthFolderId, week);

  await deleteExistingFile(weekFolderId, dayOfWeek);  // Borrar archivo existente si existe

  const fileMetadata = {
    name: dayOfWeek,  // Usar día de la semana como nombre de archivo
    parents: [weekFolderId]
  };
  const media = {
    mimeType: mimeType,
    body: response.data
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  });

  bot.sendMessage(chatId, `Archivo subido con éxito a la carpeta`); //: ${file.data.id}
  console.log(`Archivo subido con éxito: ${dayOfWeek}`);
});
//////////////////////////////////////////////////////////////////////////////////

async function getFileLink(fileId) {
  try {
      const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${response.data.result.file_path}`;
  } catch (error) {
      console.error("Error fetching file link:", error);
      throw error; // Ensure the error is not unhandled
  }
}


function obtenerEmpleados() {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'listar', '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', 'Asistencia']);
    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python Error: ${errorString}`);
        reject(new Error(`Python script exited with code ${code}. Error: ${errorString}`));
      } else {
        try {
          resolve(JSON.parse(dataString.trim()));
        } catch (e) {
          reject(new Error("Failed to parse python script output: " + e.message + ". Output was: " + dataString));
        }
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error("Failed to start python script: " + err.message));
    });
  });
}




function registrarAsistencia(empleado, fecha, hora, rol, sucursal, motivo) {
  return new Promise((resolve, reject) => {
    const args = ['asistencia', '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', 'Asistencia', empleado, fecha, hora, rol, sucursal, motivo];
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



async function handleAsistenciaCommand(chatId, employees, sucursal) {
  
  
  if (!employees || employees.length === 0) {
    await bot.sendMessage(chatId, "No se encontraron empleados.");
    return;
  }

  // Start the process to choose employee and role
  await chooseEmployee(chatId, employees, sucursal);
}

async function chooseEmployee(chatId, employees, sucursal) {
  await bot.sendMessage(chatId, "Quien en turno? 👤:", {
    reply_markup: {
      keyboard: employees.map(name => [{ text: name }]),
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  bot.once('message', msg => handleRoleSelection(chatId, msg.text, sucursal));
}

async function handleRoleSelection(chatId, empleado, sucursal) {
  const roles = ['servicio🍴', 'barra', 'cocina 👨‍🍳', 'runner🏃', 'lava loza'];
  await bot.sendMessage(chatId, "Seleccione el rol :", {
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
    askForMore(chatId);
  });
}

async function askForMore(chatId) {
  await bot.sendMessage(chatId, "¿Desea registrar a otro empleado? 👥", {
      reply_markup: {
          keyboard: [['Sí ✅', 'No ⛔']],
          one_time_keyboard: true,  // Asegura que el teclado desaparezca después de la selección
          resize_keyboard: true
      }
  });

  // Escuchar sólo por una respuesta válida
  function listenForValidResponse() {
      bot.once('message', msg => {
          if (msg.text === 'Sí ✅' || msg.text === 'Si') {
            const employees = sessions[chatId].employees;
            const sucursal = sessions[chatId].sucursal;
              handleAsistenciaCommand(chatId, employees, sucursal);
          } else if (msg.text === 'No ⛔' || msg.text === 'No') {
              handleAdditionalOptions(chatId);
          } else {
              // Si la respuesta no es válida, pide de nuevo
              bot.sendMessage(chatId, "Por favor, seleccione una opción válida del teclado.", {
                  reply_markup: {
                      keyboard: [['Sí ✅', 'No ⛔']],
                      one_time_keyboard: true,
                      resize_keyboard: true
                  }
              });
              listenForValidResponse(); // Vuelve a escuchar hasta obtener una respuesta válida
          }
      });
  }

  listenForValidResponse(); // Iniciar la escucha de respuestas válidas
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
      if (msg.text) {
          switch (msg.text.toLowerCase()) {
              case 'marcar falta⛔':
              case 'marcar retardo⛔🕐':
                  await handleFaltaRetardo(chatId, msg.text);
                  break;
              case 'finalizar registro✨':
                  await showTaskMenu1(chatId)
                  await showTaskMenu(chatId);
                  break;
          }
      } else {
          await bot.sendMessage(chatId, "Por favor, envíe un mensaje de texto.");
      }
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
      '🌿 Limpieza Hojas Plantas': false
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

      //mio
      //const groupId = 1503769017;
      sendSheetLinkToTelegramGroup(chatId,groupId);
      await bot.sendMessage(chatId, "Recuerda, a partir de ahora tu barra debe tener el 100% de sus insumos por lo que no podra ir a bodega a resurtirse mientras se encuentra en turno")
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

async function sendSheetLinkToTelegramGroup(chatId,groupId) {
  if (!sessions[chatId] || !sessions[chatId].sucursal) {
    console.error(`No sucursal defined for session: ${chatId}`);
    bot.sendMessage(chatId, "La sucursal no ha sido definida. Por favor, inicie de nuevo el proceso de selección.");
    return;
  }

  const sucursal = sessions[chatId].sucursal;
  
   folderId= '1shYJJk3NQyauF8zp4HD7amhlZGmsC35H';
   
   
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
           bot.sendMessage(groupId, `Aquí está el enlace del archivo de el reporte Matutino: ${dataOutput.trim()}`).catch(console.error);
       } else {
           console.error(`Python Error: ${errorOutput}`);
           bot.sendMessage(chatId, "Hubo un error al obtener el archivo Matutino").catch(console.error);
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
      // Continuar añadiendo casos según sean necesarios
      
  }
  await showTaskMenu(chatId); // Volver a mostrar el menú
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

async function handleFaltaRetardo1(chatId, tipo) {
  const now = moment().tz('America/Mexico_City');
  const fecha = now.format('YYYY-MM-DD');
  const employees = sessions[chatId].employees;

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
      const sucursal = sessions[chatId].sucursal;
      await registrarAsistencia(empleado, fecha, hora, rol,sucursal, motivo);
      await bot.sendMessage(chatId, `Se ha registrado un ${tipo.toLowerCase()} para ${empleado}.`);
      handleAdditionalOptions1(chatId);
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
    const sucursal = sessions[chatId].sucursal;
    await subirFoto('1shYJJk3NQyauF8zp4HD7amhlZGmsC35H', fecha, file_path, tipo, descripcion, sucursal);
    await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
  } else {
    await bot.sendMessage(chatId, "Por favor envíe una foto.");
  }
}

function getFileLink(file_id) {
  return bot.getFileLink(file_id);
}

function subirFoto(folder_id,fecha ,file_url, tipo, descripcion, sucursal) {
  return new Promise((resolve, reject) => {
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

function subirReporteDanio(folder_id, fecha, file_url, tipo, descripcion, sucursal, reporter) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_reporte_danio', folder_id, fecha, file_url, tipo, descripcion, sucursal, reporter]);

    let dataOutput = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      dataOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python Output: ${dataOutput}`);
      if (code === 0) {
        resolve();
      } else {
        console.error(`Python Error: ${errorOutput}`);
        reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
      }
    });
  });
}


async function handlePhotoUpload1(chatId, msg, tipo, descripcion = '', reporter) {
  if (msg.photo) {
    const chatId = msg.chat.id;
    const photo = msg.photo.pop();
    const file_id = photo.file_id;
    const file_path = await getFileLink(file_id);
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const sucursal = sessions[chatId].sucursal;
    await subirReporteDanio('1pS-L0xpDzIeuh9e0XliVhzjZUa7mYkvt', fecha, file_path, tipo, descripcion, sucursal, reporter);
    await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
  } else {
    await bot.sendMessage(chatId, "Por favor envíe una foto.");
  }
}

async function manageEquipmentIssues2(chatId, employees) {
  // Solicitar al usuario que seleccione quién reporta el equipo dañado
  await bot.sendMessage(chatId, "¿Quién reporta el equipo dañado? 👤", {
      reply_markup: {
          keyboard: employees.map(name => [{ text: name }]),
          one_time_keyboard: true,
          resize_keyboard: true
      }
  });

  bot.once('message', async msg => {
      const reporter = msg.text; // Capturar quién reporta el daño

      // Solicitar al usuario que escriba el nombre del equipo dañado
      await bot.sendMessage(chatId, "Por favor, escriba el nombre del equipo dañado.");

      // Esperar a que el usuario proporcione el nombre del equipo
      bot.once('message', async tipoMsg => {
          if (tipoMsg.text) {
              const tipo = tipoMsg.text; // Usar el texto proporcionado por el usuario como 'tipo'

              // Solicitar la descripción del problema
              await bot.sendMessage(chatId, "Describa ampliamente el problema del equipo.🔨");
              bot.once('message', async descMsg => {
                  if (descMsg.text) {
                      // Solicitar una foto del equipo dañado
                      await bot.sendMessage(chatId, "Ahora, por favor suba una foto del equipo dañado.📸📸");
                      bot.once('photo', async (photoMsg) => {
                          const descripcion = descMsg.text;
                          await handlePhotoUpload1(chatId, photoMsg, tipo, descripcion, reporter);
                          await bot.sendMessage(chatId, "Reporte de equipo dañado completado. 😀");
                          handleAdditionalOptions1(chatId);
                      });
                  } else {
                      await bot.sendMessage(chatId, "Por favor proporcione una descripción del problema.");
                  }
              });
          } else {
              await bot.sendMessage(chatId, "Por favor, escriba un nombre válido para el equipo.");
          }
      });
  });
}

//no se reportaron equipos daniados!!!!!!!
bot.onText(/\/reporte_danio/, (msg) => {
  const chatId = msg.chat.id;  // Extrae el chat_id del mensaje recibido
  const employees = sessions[chatId].employees;

  manageEquipmentIssues2(chatId, employees);         // Llama a la función y pasa el chat_id
});

bot.onText(/\/cambio_de_turno/, handleCambioCommand);


bot.onText(/\/cierre/, (msg) => {
  const chatId = msg.chat.id;  // Extrae el chat_id del mensaje recibido
  askDesmonte(chatId);         // Llama a la función y pasa el chat_id
});























async function handleAdditionalOptions1(chatId) {
  await bot.sendMessage(chatId, "Seleccione una opción:", {
      reply_markup: {
          keyboard: [
              ['Marcar falta⛔', 'Marcar retardo⛔🕐'],
              ['Finalizar registro✨', 'Reportar equipo dañado⚠️']
          ],
          one_time_keyboard: true,
          resize_keyboard: true
      }
  });

  bot.once('message', async msg => {
      if (msg.text) {
          switch (msg.text.toLowerCase()) {
              case 'marcar falta⛔':
              case 'marcar retardo⛔🕐':
                  await handleFaltaRetardo1(chatId, msg.text);
                  break;
              case 'finalizar registro✨':
                  await bot.sendMessage(chatId, "Regresando a apertura de turno.");
                  await bot.emit('text', {chat: {id: chatId}, text: '/apertura_turno'}); // Simula el comando /apertura_turno
                  break;
              case 'reportar equipo dañado⚠️':
                  await manageEquipmentIssues2(chatId);
                  break;
          }
      } else {
          await bot.sendMessage(chatId, "Por favor, envíe un mensaje de texto.");
      }
  });
}



bot.onText(/\/start/, async (msg) => {
  groupidw = -4224013774;
  getAdminsAndStore(groupidw)
});



async function handleShiftStart(chatId, callback) {
  bot.sendMessage(chatId, "¿Te entregaron algún equipo dañado?", {
    reply_markup: {
      keyboard: [['Sí', 'No']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  bot.once('message', msg => {
    if (msg.text === 'Sí') {
      manageEquipmentIssues2(chatId, callback); // Asegúrate de que manageEquipmentIssues2 también acepte y ejecute el callback
    } else {
      callback(chatId); // Ejecuta el callback si la respuesta es 'No'
    }
  });
}


bot.onText(/\/marcarRetardoFalta/, (msg) => {
  const chatId = msg.chat.id;  // Extrae el chat_id del mensaje recibido
  handleAdditionalOptions(chatId);         // Llama a la función y pasa el chat_id
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));





