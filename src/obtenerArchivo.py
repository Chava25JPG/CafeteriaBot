import sys
import json
from datetime import datetime
from pytz import timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os
from PIL import Image
import base64
from googleapiclient.http import MediaFileUpload
import requests

# Configuración de las credenciales
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Construir el servicio de Google Drive y Google Sheets
drive_service = build('drive', 'v3', credentials=credentials)

def obtener_o_crear_archivo_dia_especifico():
    """Encuentra o crea un archivo de Google Sheets para el día actual y lo hace público."""
    mx_zone = timezone('America/Mexico_City')
    today = datetime.now(mx_zone).date()
    formatted_file_name = f"Registro de Asistencia {today.strftime('%Y-%m-%d')}"

    query = f"name='{formatted_file_name}' and mimeType='application/vnd.google-apps.spreadsheet'"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])

    if not files:
        file_metadata = {'name': formatted_file_name, 'mimeType': 'application/vnd.google-apps.spreadsheet'}
        file = drive_service.files().create(body=file_metadata, fields='id').execute()
        file_id = file.get('id')
        print(f"Archivo creado con ID: {file_id}")
    else:
        file_id = files[0]['id']
        print(f"Archivo encontrado con ID: {file_id}")

    # Hacer el archivo visible para cualquiera con el enlace
    permission = {
        'type': 'anyone',
        'role': 'reader'
    }
    drive_service.permissions().create(fileId=file_id, body=permission).execute()

    # Obtener el enlace webViewLink para compartir
    file = drive_service.files().get(fileId=file_id, fields='webViewLink').execute()
    link = file.get('webViewLink')
    print(f"Enlace para compartir: {link}")
    return link

if __name__ == '__main__':
    link = obtener_o_crear_archivo_dia_especifico()
    print(link)
