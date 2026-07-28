NOVEDADES_FORM = {
    # campos que el usuario diligencia
    
        'titulo': "Registro de Novedades",
        'campos': [
            {
                "nombre": "vehiculo_id",
                "tipo": "hidden"  
            },
            {
                "nombre": "cliente_id",
                "tipo": "hidden"
            },
            {
                "nombre": "grupo_flota_id",
                "tipo": "hidden"  
            },
            {
                'nombre': 'placa',
                'label': 'Placa',
                'tipo': 'lookup',
                'endpoint': '/api/vehiculo/buscar/',
                'readonly': False,
            },
            {
                'nombre': 'numero_interno',
                'label': 'Número Interno',
                'tipo': 'text',
                'readonly': True,
            },
            {
                'nombre': 'grupo_flota',
                'label': 'Flota',
                'tipo': 'text',
                'readonly': True,
            },
            {
                'nombre': 'cliente',
                'label': 'Cliente',
                'tipo': 'text',
                'readonly': True,
            },
            {
                'nombre': 'conductor',
                'label': 'Conductor',
                'tipo': 'text',
                'requerido': True,
            },
            {
                'nombre': 'ruta',
                'label': 'Ruta',
                'tipo': 'select',
                'endpoint': '/api/rutas/',
                'requerido': True,
            },
            {
                'nombre': 'area_solicitante',
                'label': 'Área Solicitante',
                'tipo': 'select',
                'endpoint': '/api/areas/',
                'requerido': True,
            },
            {
                'nombre': 'tipo_informe',
                'label': 'Tipo Informe',
                'tipo': 'select-agrupado',
                'endpoint': '/api/categorias-tipos-informes/',
                'requerido': True,
            },
            {
                'nombre': 'estado_dd',
                'label': 'Estado de Disco duro',
                'tipo': 'select',
                'requerido': True,
                'opciones': [
                    {
                        'value': 'PENDIENTE_DD',
                        'label': 'PENDIENTE DD'
                    },
                    {
                        'value': 'ENCOLADO',
                        'label': 'ENCOLADO'
                    },
                    {
                        'value': 'EN_REVISION',
                        'label': 'EN REVISION'
                    },
                    {
                        'value': 'TERMINADO',
                        'label': 'TERMINADO'
                    }
                ]
            },
            {
                'nombre': 'fecha_novedad',
                'label': 'Fecha Novedad',
                'tipo': 'date',
                'requerido': True,
            },
            {
                'nombre': 'fecha_solicitud',
                'label': 'Fecha Solicitud a Colfenix',
                'tipo': 'date',
                'requerido': True,
            },
            {
                'nombre': 'observaciones',
                'label': 'Observaciones',
                'tipo': 'textarea',
                'requerido': True,
                'colspan': 2
            }
        ]
    }
