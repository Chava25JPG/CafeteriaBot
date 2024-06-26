import sys
import json
from datetime import datetime
from pytz import timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Configuración de las credenciales
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

def buscar_crear_carpeta(folder_name, parent_id=None):
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder'"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    response = drive_service.files().list(q=query).execute()
    folders = response.get('files', [])
    if not folders:
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id] if parent_id else []
        }
        folder = drive_service.files().create(body=folder_metadata, fields='id').execute()
        return folder['id']
    return folders[0]['id']

def buscar_archivo_en_carpeta(nombre_archivo, folder_id):
    query = f"name = '{nombre_archivo}' and '{folder_id}' in parents and trashed = false"
    response = drive_service.files().list(q=query, fields='files(id, webViewLink)').execute()
    files = response.get('files', [])
    if files:
        return files[0]['webViewLink']
    return None

def obtener_link_archivo_diario(folder_id,sucursal):
    # Establecer zona horaria de México
    mx_zone = timezone('America/Mexico_City')
    today = datetime.now(mx_zone)
    year = today.strftime('%Y')
    month = today.strftime('%m')
    day = today.strftime('%d')
    weekday = today.strftime('%A')

    # Buscar carpeta del año y mes
    year_folder_id = buscar_crear_carpeta(year, folder_id)
    month_folder_id = buscar_crear_carpeta(month, year_folder_id)

    # Nombre del archivo con formato día-mes-díaSemanaReporte
    formatted_file_name = f"{day}{month}{weekday}Reporte{sucursal}"
    file_link = buscar_archivo_en_carpeta(formatted_file_name, month_folder_id)
    if file_link:
        return file_link
    else:
        print("No se encontró el archivo correspondiente al día actual.")
        return None

# Ejemplo de uso
if __name__ == '__main__':
    folder_id = sys.argv[1]  # El ID de la carpeta se pasa como argumento al script
    sucursal = sys.argv[2]
    link = obtener_link_archivo_diario(folder_id, sucursal)
    if link:
        print(f"Enlace al archivo: {link}")