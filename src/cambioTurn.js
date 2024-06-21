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
  
  
  
  let asistencia = {
    llegaron: [],
    faltas_retardos: []
  };
  
  async function handleCambioCommand(chatId) {
    const employees = await obtenerEmpleados(); // Asumimos que esta función existe
    if (!employees || employees.length === 0) {
      await bot.sendMessage(chatId, "No se encontraron empleados.");
      return;
    }
  
    // Iniciar el proceso de elegir empleado y rol
    await chooseEmployee(chatId, employees);
  }
  
  async function chooseEmployee(chatId, employees) {
    await bot.sendMessage(chatId, "¿Quién está en turno? 👤:", {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => handleRoleSelection(chatId, msg.text));
  }
  
  async function handleRoleSelection(chatId, empleado) {
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
      asistencia.llegaron.push({ nombre: empleado, rol: rol });
      await bot.sendMessage(chatId, `Asistencia registrada para ${empleado} como ${rol}.`);
      askForMore(chatId);
    });
  }
  
  async function askForMore(chatId) {
    await bot.sendMessage(chatId, "¿Desea registrar a otro empleado? 👥", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => {
      if (msg.text === 'Sí ✅') {
        handleCambioCommand(chatId);
      } else {
        handleAdditionalOptions(chatId);
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
        await handleFaltaRetardo(chatId, msg.text);
      } else if (msg.text === 'Finalizar registro✨') {
        await showTaskMenu1(chatId);
        await showTaskMenu(chatId);
        
      }
    });
  }
  
  async function handleFaltaRetardo(chatId, tipo) {
    const falta_o_retardo = tipo.includes('falta') ? 'Falta' : 'Retardo';
    await bot.sendMessage(chatId, "Indique el nombre del empleado:", {
      reply_markup: {
        force_reply: true
      }
    });
  
    bot.once('message', async msg => {
      asistencia.faltas_retardos.push({ nombre: msg.text, tipo: falta_o_retardo });
      askForMore(chatId);
    });
  }
  
  async function showTaskMenu1(chatId) {
    await bot.sendMessage(chatId, "¿Sale servicio?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      const sale_servicio = msg.text === 'Sí ✅' ? 'Sí sale' : 'No sale';
      let message = `SUC X ${sale_servicio}\nllegó:\n`;
      asistencia.llegaron.forEach(emp => {
        message += `${emp.nombre}-----------------${emp.rol}\n`;
      });
      message += 'Falta o Retardo\n';
      asistencia.faltas_retardos.forEach(emp => {
        message += `${emp.nombre}----${emp.tipo}\n`;
      });
      await bot.sendMessage(chatId, message);
      resetAsistencia(); // Reinicia la lista de asistencia para el próximo uso
    });
  }
  
  function resetAsistencia() {
    asistencia = { llegaron: [], faltas_retardos: [] };
  }

const taskCompletion = {};

function initializeTaskCompletion(chatId) {
    taskCompletion[chatId] = {
        'Barra de Food': false,
        'Barra de Panques': false,
        'Barra de Bebidas': false,
        
        'Playlist': false,
        'Volumen de Bocinas': false
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
      const groupId = -4224013774;  

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
  folderId= '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl';
  const pythonProcess = spawn('python3', ['./src/obtenerArchivo.py', folderId]);  // Asumiendo que el script se llama obtenerArchivo.py y está en el directorio src/

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
    case 'Barra de Food':
      await manageBarSetup(chatId, 'food', 'Barra de Food');
      break;
    case 'Barra de Panques':
      await manageBarSetup(chatId, 'panques', 'Barra de Panques');
      break;
    case 'Barra de Bebidas':
      await manageBarSetup(chatId, 'bebidas', 'Barra de Bebidas');
      break;
    case 'Playlist':
      await askPlaylistInfo(chatId);
      break;
    case 'Volumen de Bocinas':
      await askSpeakersVolume(chatId);
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
  
  
module.exports = {
    handleCambioCommand
};