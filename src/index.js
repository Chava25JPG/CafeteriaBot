require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const bot = require('./confBot.js')
const { handleCambioCommand } = require('./cambioTurn.js');
const groupId = -2207878165;  
const { askDesmonte } = require('./Cierre.js')
const { getGroupAdmins } = require('./funciones.js');
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
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'listar', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'Asistencia']);
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




function registrarAsistencia(empleado, fecha, hora, rol, motivo) {
  return new Promise((resolve, reject) => {
    const args = ['asistencia', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'Asistencia', empleado, fecha, hora, rol, motivo];
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



async function handleAsistenciaCommand(chatId) {
  
  const employees = await obtenerEmpleados();
  if (!employees || employees.length === 0) {
    await bot.sendMessage(chatId, "No se encontraron empleados.");
    return;
  }

  // Start the process to choose employee and role
  await chooseEmployee(chatId, employees);
}

async function chooseEmployee(chatId, employees) {
  await bot.sendMessage(chatId, "Quien en turno? 👤:", {
    reply_markup: {
      keyboard: employees.map(name => [{ text: name }]),
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  bot.once('message', msg => handleRoleSelection(chatId, msg.text));
}

async function handleRoleSelection(chatId, empleado) {
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
    const result = await registrarAsistencia(empleado, fecha, hora, rol);
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
              handleAsistenciaCommand(chatId);
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
                  await showTaskMenu(chatId);
                  break;
          }
      } else {
          await bot.sendMessage(chatId, "Por favor, envíe un mensaje de texto.");
      }
  });
}

const taskCompletion = {};

function initializeTaskCompletion(chatId) {
    taskCompletion[chatId] = {
        'Barra de Food': false,
        'Barra de Panques': false,
        'Barra de Bebidas': false,
        'Rational': false,
        'Playlist': false,
        'Volumen de Bocinas': false,
        'Plataformas Digitales': false
    };
}

async function showTaskMenu(chatId) {
  initializeTaskCompletion(chatId); // Asegura que taskCompletion[chatId] esté inicializado

  const options = Object.entries(taskCompletion[chatId])
    .filter(([task, done]) => !done)
    .map(([task]) => [task]);

  if (options.length === 0) {
    await bot.sendMessage(chatId, "Todas las tareas han sido registradas. ¡Buen trabajo!");
    delete taskCompletion[chatId]; // Limpia el estado al terminar
    return;
  }

  options.push(['Terminar']); // Opción para terminar y cerrar el menú

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
    if (text === 'Terminar') {
      await bot.sendMessage(chatId, "Registro completo.");
      sendSheetLinkToTelegramGroup(groupId);
      await bot.sendMessage(chatId, "Para volver al menu principal, presione /apertura_turno");
      delete taskCompletion[chatId]; // Limpia el estado al terminar
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

  bot.sendMessage(groupId, "Tu mensaje")
  .then(() => console.log("Mensaje enviado con éxito"))
  .catch(error => {
    console.error("Error completo:", error);
    console.error("Código de error:", error.code);
    console.error("Descripción del error:", error.description);
  });
  // folderId= '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl';
  // const pythonProcess = spawn('python3', ['./src/obtenerArchivo.py', folderId]);  // Asumiendo que el script se llama obtenerArchivo.py y está en el directorio src/

  // let dataOutput = '';
  // let errorOutput = '';

  // pythonProcess.stdout.on('data', (data) => {
  //     dataOutput += data.toString();
  // });

  // pythonProcess.stderr.on('data', (data) => {
  //     errorOutput += data.toString();
  // });

  // pythonProcess.on('close', (code) => {
  //     if (code === 0) {
  //         console.log(`Python Output: ${dataOutput}`);
  //         bot.sendMessage(chatId, `Aquí está el enlace del archivo de el reporte Matutino: ${dataOutput.trim()}`).catch(console.error);
  //     } else {
  //         console.error(`Python Error: ${errorOutput}`);
  //         bot.sendMessage(chatId, "Hubo un error al obtener el archivo Matutino").catch(console.error);
  //     }
  // });
}

async function handleTask(task, chatId) {
  switch (task) {
    case 'Barra de Food':
      await manageBarSetup(chatId, 'food', 'Barra de Food');
      break;
    case 'Barra de Panques':
      await manageBarSetup(chatId, 'panques', 'Barra de Panques');
      break;
    case 'Barra de Bebidas':
      await manageBarSetup(chatId, 'bebidas', 'Barra de Bebidas');
      break;
    case 'Rational':
      await askRationalWindow(chatId);
      break;
    case 'Playlist':
      await askPlaylistInfo(chatId);
      break;
    case 'Volumen de Bocinas':
      await askSpeakersVolume(chatId);
      break;
      case 'Plataformas Digitales':
        await askDigitalPlatforms(chatId);
        break;
    default:
      await bot.sendMessage(chatId, "Por favor, seleccione una opción válida del menú.");
      break;
  }
  await showTaskMenu(chatId);
}

async function manageBarSetup(chatId, barType, displayName) {
  await bot.sendMessage(chatId, `¿Ha montado ya la ${displayName}?`, {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      if (msg.text === 'Sí ✅') {
        await bot.sendMessage(chatId, `Por favor, suba una foto de la ${displayName}.`);
        bot.once('photo', async (msg) => {
          const tipo = `barra de ${barType}`;
          await handlePhotoUpload(chatId, msg, tipo);
          await bot.sendMessage(chatId, `Foto de la ${displayName} registrada correctamente.`);
          resolve();
        });
      } else if (msg.text === 'No ⛔') {
        await bot.sendMessage(chatId, `Por favor, monte la ${displayName} antes de continuar.`);
        resolve();
      } else {
        await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
        await manageBarSetup(chatId, barType, displayName);
        resolve();
      }
    });
  });
}

async function askSpeakersVolume(chatId) {
  await bot.sendMessage(chatId, "¿Las bocinas están en un buen nivel de volumen?🔊", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      if (msg.text === 'Sí ✅') {
        const tipo = 'bocinas';
        const descripcion = 'Bocinas en buen nivel';
        await registerSpeakersVolume(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, "Información de las bocinas registrada correctamente.👌");
        resolve();
      } else if (msg.text === 'No ⛔') {
        await bot.sendMessage(chatId, "Por favor, asegúrese de que las bocinas estén en un buen nivel de volumen.");
        await askSpeakersVolume(chatId);
        resolve();
      } else {
        await bot.sendMessage(chatId, "Por favor, seleccione una opción válida.");
        await askSpeakersVolume(chatId);
        resolve();
      }
    });
  });
}

async function registerSpeakersVolume(chatId, tipo, descripcion) {
  const now = moment().tz('America/Mexico_City');
  const fecha = now.format('YYYY-MM-DD');
  const file_url = ''; // Dejar vacío ya que no se sube foto
  await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_url, tipo, descripcion);
}

async function askPlaylistInfo(chatId) {
  await bot.sendMessage(chatId, "La playlist de Boicot Cafe se esta reproduciendo?💚🎶💚", {
    reply_markup: {
      keyboard: [['Sí ✅', 'No ⛔']],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });

  return new Promise((resolve) => {
    bot.once('message', async (msg) => {
      if (msg.text) {
        const playlistName = msg.text;
        await bot.sendMessage(chatId, "Por favor, suba una foto de la pantalla que muestra la playlist.📸💚");

        bot.once('photo', async (msg) => {
          const tipo = 'playlist';
          const descripcion = playlistName;
          await handlePhotoUpload(chatId, msg, tipo, descripcion);
          await bot.sendMessage(chatId, "Información de la playlist registrada correctamente.💚👌");
          resolve();
        });
      } else {
        await bot.sendMessage(chatId, "Por favor, envíe el nombre de la playlist como un mensaje de texto.");
        await askPlaylistInfo(chatId);
        resolve();
      }
    });
  });
}
async function askRationalWindow(chatId) {
  await bot.sendMessage(chatId, "Por favor, suba una foto de la ventana Rational limpia.");

  return new Promise((resolve) => {
    bot.once('photo', async (msg) => {
      const tipo = 'ventana rational';
      const descripcion = 'Ventana Rational limpia';
      await handlePhotoUpload(chatId, msg, tipo, descripcion);
      await bot.sendMessage(chatId, "Foto de la ventana Rational registrada correctamente.👌👌");
      resolve();
    });
  });
}
async function askDigitalPlatforms(chatId) {
  await bot.sendMessage(chatId, "Por favor, suba una foto de las plataformas digitales funcionando.📲📲");

  return new Promise((resolve) => {
    bot.once('photo', async (msg) => {
      const tipo = 'plataformas digitales';
      const descripcion = 'Plataformas digitales funcionando';
      await handlePhotoUpload(chatId, msg, tipo, descripcion);
      await bot.sendMessage(chatId, "Foto de las plataformas digitales registrada correctamente👌👌.");
      resolve();
    });
  });
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
    await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_path, tipo, descripcion);
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
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_foto', folder_id,fecha, file_url, tipo, descripcion]);

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

function subirReporteDanio(folder_id, fecha, file_url, tipo, descripcion) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_reporte_danio', folder_id, fecha, file_url, tipo, descripcion]);

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


async function handlePhotoUpload1(chatId, msg, tipo, descripcion = '') {
  if (msg.photo) {
    const chatId = msg.chat.id;
    const photo = msg.photo.pop();
    const file_id = photo.file_id;
    const file_path = await getFileLink(file_id);
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    await subirReporteDanio('1pS-L0xpDzIeuh9e0XliVhzjZUa7mYkvt', fecha, file_path, tipo, descripcion);
    await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
  } else {
    await bot.sendMessage(chatId, "Por favor envíe una foto.");
  }
}

async function manageEquipmentIssues2(chatId) {
  // Solicitar al usuario que escriba el nombre del equipo dañado
  await bot.sendMessage(chatId, "Por favor, escriba el nombre del equipo dañado.");

  // Esperar a que el usuario proporcione el nombre del equipo
  bot.once('message', async tipoMsg => {
      if (tipoMsg.text) {
          const tipo = tipoMsg.text; // Usar el texto proporcionado por el usuario como 'tipo'

          // Solicitar la descripción del problema
          await bot.sendMessage(chatId, "Describa el problema del equipo.🔨");
          bot.once('message', async descMsg => {
              if (descMsg.text) {
                  // Solicitar una foto del equipo dañado
                  await bot.sendMessage(chatId, "Ahora, por favor suba una foto del equipo dañado.📸📸");
                  bot.once('photo', async (msg) => {
                      const descripcion = descMsg.text;
                      await handlePhotoUpload1(chatId, msg, tipo, descripcion);
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
}
//no se reportaron equipos daniados!!!!!!!
bot.onText(/\/reporte_danio/, (msg) => {
  const chatId = msg.chat.id;  // Extrae el chat_id del mensaje recibido
  manageEquipmentIssues2(chatId);         // Llama a la función y pasa el chat_id
});

bot.onText(/\/cambio_de_turno/, handleCambioCommand);


bot.onText(/\/cierre/, (msg) => {
  const chatId = msg.chat.id;  // Extrae el chat_id del mensaje recibido
  askDesmonte(chatId);         // Llama a la función y pasa el chat_id
});


bot.onText(/\/apertura_turno/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Seleccione su turno:", {
    reply_markup: {
      keyboard: [
        ['🌞Turno Matutino🌞', '🌕Turno Vespertino🌕'],
        ['🚪Cierre🚪', '❕Mas opciones❕']
      ],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text === '🌞Turno Matutino🌞') {
    handleAsistenciaCommand(chatId);
  } else if (msg.text === '🚪Cierre🚪') {
    askDesmonte(chatId);
  } else if (msg.text === '🌕Turno Vespertino🌕') {
    handleCambioCommand(chatId);
  } else if (msg.text === '❕Mas opciones❕') {
    handleAdditionalOptions1(chatId); 
  }
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
  const chatId = msg.chat.id;

  // Asegúrate de que esto es en un grupo o supergrupo
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      try {
          const admins = await getGroupAdmins(chatId);
          let response = "Administradores del grupo:\n";
          admins.forEach(admin => {
              response += `ID: ${admin.id}, Nombre: ${admin.name}\n`;
          });
          bot.sendMessage(chatId, response);
      } catch (error) {
          console.error('Error:', error);
          bot.sendMessage(chatId, "Ocurrió un error al intentar obtener los administradores del grupo.");
      }
  } else {
      bot.sendMessage(chatId, "Este comando solo funciona en grupos.");
  }
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





