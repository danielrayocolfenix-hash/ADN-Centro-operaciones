FORM_INFORMES = {
    'titulo': "Registro de informes",
    'campos': [
        {
            'nombre': 'novedad_relacionada',
            'label': 'Novedad Relacionada',
            'tipo': 'lookup',
            'endpoint': '/',
            'readonly': True,
        },
        {
            'nombre': 'operador',
            'label': 'Operador',
            'tipo': 'text',
            'required': True
        }
    ]
}