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
sheets_service = build('sheets', 'v4', credentials=credentials)




def obtener_o_crear_hoja(sheet_id, title):
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    for sheet in sheet_metadata.get('sheets', []):
        if sheet['properties']['title'] == title:
            return sheet['properties']['sheetId']
    # Crear una nueva hoja si no existe
    body = {
        'requests': [{
            'addSheet': {
                'properties': {
                    'title': title
                }
            }
        }]
    }
    response = sheets_service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=body).execute()
    return response['replies'][0]['addSheet']['properties']['sheetId']



def obtener_id_hoja(sheet_id):
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    return sheet_metadata.get('sheets', [])[0]['properties']['sheetId'] if sheet_metadata.get('sheets', []) else None


def buscar_archivo(nombre_archivo, folder_id):
    query = f"name = '{nombre_archivo}' and '{folder_id}' in parents and trashed = false"
    response = drive_service.files().list(q=query).execute()
    return response.get('files', [])[0]['id'] if response.get('files', []) else None

def leer_datos(sheet_id, range_name):
    result = sheets_service.spreadsheets().values().get(spreadsheetId=sheet_id, range=range_name).execute()
    return result.get('values', [])

def actualizar_datos(sheet_id, range_name, values, value_input_option='USER_ENTERED'):
    body = {'values': values}
    result = sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=range_name, valueInputOption=value_input_option, body=body).execute()
    return result

def formatar_celda(sheet_id, sheet_index, range_name, color):
    requests = [{
        "repeatCell": {
            "range": {
                "sheetId": sheet_index,  # ID de la hoja específica
                "startRowIndex": range_name[1],
                "endRowIndex": range_name[1] + 1,
                "startColumnIndex": range_name[0],
                "endColumnIndex": range_name[0] + 1
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {
                        "red": color[0],
                        "green": color[1],
                        "blue": color[2]
                    }
                }
            },
            "fields": "userEnteredFormat.backgroundColor"
        }
    }]
    body = {'requests': requests}
    response = sheets_service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=body).execute()
    return response


def obtener_id_hoja(sheet_id):
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    sheets = sheet_metadata.get('sheets', '')
    return sheets[0]['properties']['sheetId'] if sheets else None

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

def obtener_lista_empleados(folder_id, archivo_nombre):
    sheet_id = buscar_archivo(archivo_nombre, folder_id)
    if sheet_id:
        datos = leer_datos(sheet_id, 'A3:A')  # Ajusta el rango según tus necesidades para incluir solo nombres
        if datos:
            empleados = [item[0] for item in datos if item]  # Asume que los nombres están en la primera columna
            print(json.dumps(empleados))
        else:
            print(json.dumps([]))
    else:
        print(json.dumps([]))

def registrar_asistencia(folder_id, archivo_nombre, empleado, fecha, hora, rol, motivo=None):
    try:
        mx_zone = timezone('America/Mexico_City')
        now = datetime.now(mx_zone)
        fecha_actual = now.strftime('%Y-%m-%d')
        hora_actual = now.strftime('%H:%M')

        # Si no se especifica fecha y hora, usar la actual
        fecha = fecha if fecha else fecha_actual
        hora = hora if hora else hora_actual

        mx_time = datetime.strptime(fecha, "%Y-%m-%d").astimezone(mx_zone)
        year = mx_time.strftime('%Y')
        month = mx_time.strftime('%m')
        day = mx_time.strftime('%d')
        weekday = mx_time.strftime('%A')

        # Crear/Buscar carpetas de año y mes
        year_folder_id = buscar_crear_carpeta(year, folder_id)
        month_folder_id = buscar_crear_carpeta(month, year_folder_id)

        # Formatear nombre de archivo con día y día de la semana
        formatted_file_name = f"{day}{month}{weekday}Reporte"
        sheet_id = buscar_archivo(formatted_file_name, month_folder_id)
        if not sheet_id:  # Si no existe, crearlo
            file_metadata = {
                'name': formatted_file_name,
                'mimeType': 'application/vnd.google-apps.spreadsheet',
                'parents': [month_folder_id]
            }
            file = drive_service.files().create(body=file_metadata, fields='id').execute()
            sheet_id = file.get('id')
            # Inicializar la hoja si es nuevo
            headers = ['Empleado', 'Hora', 'Rol', 'Motivo']
            actualizar_datos(sheet_id, 'A1:D1', [headers], 'USER_ENTERED')

        # Actualizar datos
        fecha_hora = f"{fecha} {hora}"
        data = [empleado, fecha_hora, rol, motivo or '']
        empleados = leer_datos(sheet_id, 'A2:A')
        fila_empleado = len(empleados) + 2  # Sumar dos para considerar la fila de encabezados
        actualizar_datos(sheet_id, f'A{fila_empleado}:D{fila_empleado}', [data], 'USER_ENTERED')
        print("Asistencia registrada correctamente.")
    except Exception as e:
        print(f"Error registrando asistencia: {str(e)}")


def obtener_o_crear_archivo():
    query = "name='Registro de Asistencia'"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])
    if not files:
        file_metadata = {
            'name': 'Registro de Asistencia',
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        file = drive_service.files().create(body=file_metadata, fields='id').execute()
        return file.get('id')
    return files[0]['id']




























def obtener_o_crear_archivo_con_fecha(fecha):
    """Busca o crea un archivo de Google Sheets basado en la fecha dada."""
    mx_zone = timezone('America/Mexico_City')
    mx_time = datetime.strptime(fecha, "%Y-%m-%d").astimezone(mx_zone)
    formatted_date = mx_time.strftime('%Y-%m-%d')
    file_name = f'Registro de Asistencia {formatted_date}'

    query = f"name='{file_name}' and mimeType='application/vnd.google-apps.spreadsheet'"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])

    if not files:
        file_metadata = {'name': file_name, 'mimeType': 'application/vnd.google-apps.spreadsheet'}
        file = drive_service.files().create(body=file_metadata, fields='id').execute()
        print(f"Archivo creado: {file['id']} con nombre {file_name}")
        return file['id']
    else:
        print(f"Archivo encontrado: {files[0]['id']} con nombre {file_name}")
        return files[0]['id']

def obtener_o_crear_hoja(sheet_id, title):
    """Obtiene o crea una hoja dentro de una hoja de cálculo."""
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    for sheet in sheet_metadata.get('sheets', []):
        if sheet['properties']['title'] == title:
            print(f"Hoja '{title}' encontrada en el archivo {sheet_id}")
            return sheet['properties']['sheetId']
    # Crear una nueva hoja si no existe
    body = {
        'requests': [{
            'addSheet': {
                'properties': {
                    'title': title
                }
            }
        }]
    }
    response = sheets_service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=body).execute()
    print(f"Hoja '{title}' creada en el archivo {sheet_id}")
    return response['replies'][0]['addSheet']['properties']['sheetId']

def obtener_o_crear_archivo_dia_especifico(fecha):
    """ Busca o crea un archivo de Google Sheets para un día específico basado en la fecha. """
    mx_zone = timezone('America/Mexico_City')
    mx_time = datetime.strptime(fecha, "%Y-%m-%d").astimezone(mx_zone)
    day = mx_time.strftime('%d')
    month = mx_time.strftime('%m')
    weekday = mx_time.strftime('%A')
    formatted_file_name = f"{day}{month}{weekday}Reporte"

    query = f"name='{formatted_file_name}' and mimeType='application/vnd.google-apps.spreadsheet'"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])

    if not files:
        file_metadata = {'name': formatted_file_name, 'mimeType': 'application/vnd.google-apps.spreadsheet'}
        file = drive_service.files().create(body=file_metadata, fields='id').execute()
        print(f"Archivo creado: {file['id']} con nombre {formatted_file_name}")
        return file.get('id')
    print(f"Archivo encontrado: {files[0]['id']} con nombre {formatted_file_name}")
    return files[0]['id']

def encontrar_siguiente_fila_vacia(sheet_id, sheet_name):
    """Estima la siguiente fila vacía buscando en la columna A."""
    range_name = f"{sheet_name}!A:A"
    result = sheets_service.spreadsheets().values().get(spreadsheetId=sheet_id, range=range_name).execute()
    values = result.get('values', [])
    next_row = len(values) + 1 if values else 1
    print(f"Siguiente fila vacía en {sheet_name}: {next_row}")
    return next_row

def subir_foto_a_hoja(sheet_id, file_url, tipo, fecha, descripcion=''):
    """Inserta una foto y un tipo en la hoja de cálculo, además de una descripción opcional del problema en la columna siguiente."""
    sheet_name = "Inicio"
    image_sheet_id = obtener_o_crear_hoja(sheet_id, sheet_name)
    next_row = encontrar_siguiente_fila_vacia(sheet_id, sheet_name)

    # Insertar el tipo en la columna A
    range_name = f"{sheet_name}!A{next_row}"
    values = [[tipo]]
    body = {'values': values}
    sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=range_name, valueInputOption='USER_ENTERED', body=body).execute()

    # Insertar la URL de la imagen en la columna B utilizando la fórmula IMAGE
    image_range_name = f"{sheet_name}!B{next_row}"
    image_values = [[f'=IMAGE("{file_url}")']]
    image_body = {'values': image_values}
    sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=image_range_name, valueInputOption='USER_ENTERED', body=image_body).execute()

    if descripcion:
        # Insertar la descripción en la columna C si está presente
        desc_range_name = f"{sheet_name}!C{next_row}"
        desc_values = [[descripcion]]
        desc_body = {'values': desc_values}
        sheets_service.spreadsheets().values().update(
            spreadsheetId=sheet_id, range=desc_range_name, valueInputOption='USER_ENTERED', body=desc_body).execute()

    print(f"Datos insertados en {sheet_name}!A{next_row}:C{next_row} en la hoja {sheet_name}: {values}, {image_values}, {'N/A' if not descripcion else desc_values}")



if __name__ == '__main__':
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'asistencia':
            folder_id = sys.argv[2]
            archivo_nombre = sys.argv[3]
            empleado = sys.argv[4]
            fecha = sys.argv[5]
            hora = sys.argv[6]
            rol = sys.argv[7]
            motivo = sys.argv[8] if len(sys.argv) > 8 else None  # Añadir motivo si está presente
            registrar_asistencia(folder_id, archivo_nombre, empleado, fecha, hora, rol, motivo)
        elif command == 'listar':
            folder_id = sys.argv[2]
            archivo_nombre = sys.argv[3]
            obtener_lista_empleados(folder_id, archivo_nombre)

        elif command == 'subir_foto':
            fecha = sys.argv[3]
            file_url = sys.argv[4]
            tipo = sys.argv[5]
            descripcion = sys.argv[6]
            sheet_id = obtener_o_crear_archivo_dia_especifico(fecha)
            hoja_id = obtener_o_crear_hoja(sheet_id, "Inicio")
            subir_foto_a_hoja(sheet_id, file_url, tipo, fecha, descripcion)
