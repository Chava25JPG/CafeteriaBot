import sys
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuración de credenciales y servicios
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

def initialize_services():
    credentials = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    drive_service = build('drive', 'v3', credentials=credentials)
    sheets_service = build('sheets', 'v4', credentials=credentials)
    return drive_service, sheets_service

def get_or_create_sheet(drive_service, sheets_service, group_name, folder_id):
    # Buscar la hoja de cálculo por nombre
    response = drive_service.files().list(q=f"name='{group_name}' and mimeType='application/vnd.google-apps.spreadsheet' and '{folder_id}' in parents").execute()
    files = response.get('files', [])

    if not files:
        # Si no existe, crea una nueva hoja de cálculo
        file_metadata = {
            'name': group_name,
            'mimeType': 'application/vnd.google-apps.spreadsheet',
            'parents': [folder_id]
        }
        file = drive_service.files().create(body=file_metadata, fields='id').execute()
        spreadsheet_id = file.get('id')
    else:
        # Si existe, usa la primera coincidencia
        spreadsheet_id = files[0]['id']

    # Preparar la hoja para uso asegurando que los encabezados estén establecidos
    try:
        sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range='A1:B2').execute()
    except HttpError:
        # Si la hoja está vacía, inicializar encabezados
        body = {
            'values': [['Nombre', 'Identificador']]
        }
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id, range='A1:B1', valueInputOption='USER_ENTERED', body=body).execute()
    return spreadsheet_id

def update_sheet(sheets_service, spreadsheet_id, admin_data):
    # Encuentra la siguiente fila vacía
    result = sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range='A2:B').execute()
    values = result.get('values', [])
    start_row = len(values) + 2  # Comenzar después de la última fila con datos

    # Preparar datos para la inserción
    body = {
        'values': [[admin['name'], str(admin['id'])] for admin in json.loads(admin_data)]
    }

    # Escribir datos en la hoja
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id, range=f'A{start_row}:B{start_row + len(body['values']) - 1}',
        valueInputOption='USER_ENTERED', body=body).execute()

def main(group_name, admin_data, folder_id):
    drive_service, sheets_service = initialize_services()
    spreadsheet_id = get_or_create_sheet(drive_service, sheets_service, group_name, folder_id)
    update_sheet(sheets_service, spreadsheet_id, admin_data)

if __name__ == '__main__':
    group_name = sys.argv[1]
    admin_data = sys.argv[2]
    folder_id = sys.argv[3]
    main(group_name, admin_data, folder_id)
