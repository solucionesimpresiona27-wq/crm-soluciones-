
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "actividades": {
                  Row: {
                    "cliente_id": string,"created_at": string,"descripcion": string,"fecha": string,"id": string,"oportunidad_id": string | null,"tipo": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"created_at"?: string,"descripcion": string,"fecha"?: string,"id"?: string,"oportunidad_id"?: string | null,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "cliente_id"?: string,"created_at"?: string,"descripcion"?: string,"fecha"?: string,"id"?: string,"oportunidad_id"?: string | null,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "actividades_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividades_oportunidad_id_fkey"
      columns: ["oportunidad_id"]
isOneToOne: false
      referencedRelation: "oportunidades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividades_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"archivos": {
                  Row: {
                    "aprobacion_at": string | null,"aprobacion_notas": string | null,"aprobacion_registrada_por": string | null,"aprobado_por_nombre": string | null,"categoria": string,"cliente_id": string | null,"created_at": string,"enlace_externo": string | null,"estado_aprobacion": Database["public"]['Enums']["estado_archivo"],"id": string,"mime": string | null,"nombre": string,"path": string | null,"pedido_id": string | null,"subido_por": string | null,"tamano": number | null,"updated_at": string,"version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aprobacion_at"?: string | null,"aprobacion_notas"?: string | null,"aprobacion_registrada_por"?: string | null,"aprobado_por_nombre"?: string | null,"categoria"?: string,"cliente_id"?: string | null,"created_at"?: string,"enlace_externo"?: string | null,"estado_aprobacion"?: Database["public"]['Enums']["estado_archivo"],"id"?: string,"mime"?: string | null,"nombre": string,"path"?: string | null,"pedido_id"?: string | null,"subido_por"?: string | null,"tamano"?: number | null,"updated_at"?: string,"version"?: number | null
                  }
                  Update: {
                    "aprobacion_at"?: string | null,"aprobacion_notas"?: string | null,"aprobacion_registrada_por"?: string | null,"aprobado_por_nombre"?: string | null,"categoria"?: string,"cliente_id"?: string | null,"created_at"?: string,"enlace_externo"?: string | null,"estado_aprobacion"?: Database["public"]['Enums']["estado_archivo"],"id"?: string,"mime"?: string | null,"nombre"?: string,"path"?: string | null,"pedido_id"?: string | null,"subido_por"?: string | null,"tamano"?: number | null,"updated_at"?: string,"version"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "archivos_aprobacion_registrada_por_fkey"
      columns: ["aprobacion_registrada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archivos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archivos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archivos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archivos_subido_por_fkey"
      columns: ["subido_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bitacora": {
                  Row: {
                    "accion": string,"cambios": Json | null,"created_at": string,"datos": Json | null,"etiqueta": string | null,"id": number,"registro_id": string | null,"tabla": string,"usuario_id": string | null,"usuario_nombre": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": string,"cambios"?: Json | null,"created_at"?: string,"datos"?: Json | null,"etiqueta"?: string | null,"id"?: never,"registro_id"?: string | null,"tabla": string,"usuario_id"?: string | null,"usuario_nombre"?: string | null
                  }
                  Update: {
                    "accion"?: string,"cambios"?: Json | null,"created_at"?: string,"datos"?: Json | null,"etiqueta"?: string | null,"id"?: never,"registro_id"?: string | null,"tabla"?: string,"usuario_id"?: string | null,"usuario_nombre"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bitacora_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "activo": boolean,"created_at": string,"descripcion": string | null,"grupo": string,"id": string,"nombre": string,"orden": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"descripcion"?: string | null,"grupo": string,"id"?: string,"nombre": string,"orden"?: number,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"descripcion"?: string | null,"grupo"?: string,"id"?: string,"nombre"?: string,"orden"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clientes": {
                  Row: {
                    "activo": boolean,"busqueda": string | null,"ciudad": string | null,"codigo_postal_fiscal": string | null,"created_at": string,"created_by": string | null,"dias_credito": number,"direccion": string | null,"email": string | null,"email_facturacion": string | null,"etiquetas": (string)[],"id": string,"lista_precio": Database["public"]['Enums']["lista_precio"],"nombre": string,"notas": string | null,"origen": string | null,"razon_social": string | null,"regimen_fiscal": string | null,"requiere_factura": boolean,"rfc": string | null,"telefono": string | null,"tipo": string,"ultima_compra_at": string | null,"updated_at": string,"uso_cfdi": string | null,"vendedor_id": string | null,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"busqueda"?: never,"ciudad"?: string | null,"codigo_postal_fiscal"?: string | null,"created_at"?: string,"created_by"?: string | null,"dias_credito"?: number,"direccion"?: string | null,"email"?: string | null,"email_facturacion"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lista_precio"?: Database["public"]['Enums']["lista_precio"],"nombre": string,"notas"?: string | null,"origen"?: string | null,"razon_social"?: string | null,"regimen_fiscal"?: string | null,"requiere_factura"?: boolean,"rfc"?: string | null,"telefono"?: string | null,"tipo"?: string,"ultima_compra_at"?: string | null,"updated_at"?: string,"uso_cfdi"?: string | null,"vendedor_id"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"busqueda"?: never,"ciudad"?: string | null,"codigo_postal_fiscal"?: string | null,"created_at"?: string,"created_by"?: string | null,"dias_credito"?: number,"direccion"?: string | null,"email"?: string | null,"email_facturacion"?: string | null,"etiquetas"?: (string)[],"id"?: string,"lista_precio"?: Database["public"]['Enums']["lista_precio"],"nombre"?: string,"notas"?: string | null,"origen"?: string | null,"razon_social"?: string | null,"regimen_fiscal"?: string | null,"requiere_factura"?: boolean,"rfc"?: string | null,"telefono"?: string | null,"tipo"?: string,"ultima_compra_at"?: string | null,"updated_at"?: string,"uso_cfdi"?: string | null,"vendedor_id"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion": {
                  Row: {
                    "anticipo_pct": number,"ciudad": string | null,"color_primario": string,"color_secundario": string,"condiciones_cotizacion": string | null,"datos_bancarios": string | null,"dias_reactivacion": number,"direccion": string | null,"email": string | null,"eslogan": string | null,"facebook": string | null,"id": number,"instagram": string | null,"iva_pct": number,"logo_url": string | null,"metodos_pago_activos": (Database["public"]['Enums']["metodo_pago"])[],"mostrar_datos_fiscales": boolean,"nombre_comercial": string,"notas_pie_cotizacion": string | null,"prefijo_cotizacion": string,"prefijo_pedido": string,"razon_social": string | null,"regimen_fiscal": string | null,"rfc": string | null,"sitio_web": string | null,"telefono": string | null,"tiempo_entrega_default": string | null,"tiktok": string | null,"updated_at": string,"vigencia_dias": number,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anticipo_pct"?: number,"ciudad"?: string | null,"color_primario"?: string,"color_secundario"?: string,"condiciones_cotizacion"?: string | null,"datos_bancarios"?: string | null,"dias_reactivacion"?: number,"direccion"?: string | null,"email"?: string | null,"eslogan"?: string | null,"facebook"?: string | null,"id"?: number,"instagram"?: string | null,"iva_pct"?: number,"logo_url"?: string | null,"metodos_pago_activos"?: (Database["public"]['Enums']["metodo_pago"])[],"mostrar_datos_fiscales"?: boolean,"nombre_comercial"?: string,"notas_pie_cotizacion"?: string | null,"prefijo_cotizacion"?: string,"prefijo_pedido"?: string,"razon_social"?: string | null,"regimen_fiscal"?: string | null,"rfc"?: string | null,"sitio_web"?: string | null,"telefono"?: string | null,"tiempo_entrega_default"?: string | null,"tiktok"?: string | null,"updated_at"?: string,"vigencia_dias"?: number,"whatsapp"?: string | null
                  }
                  Update: {
                    "anticipo_pct"?: number,"ciudad"?: string | null,"color_primario"?: string,"color_secundario"?: string,"condiciones_cotizacion"?: string | null,"datos_bancarios"?: string | null,"dias_reactivacion"?: number,"direccion"?: string | null,"email"?: string | null,"eslogan"?: string | null,"facebook"?: string | null,"id"?: number,"instagram"?: string | null,"iva_pct"?: number,"logo_url"?: string | null,"metodos_pago_activos"?: (Database["public"]['Enums']["metodo_pago"])[],"mostrar_datos_fiscales"?: boolean,"nombre_comercial"?: string,"notas_pie_cotizacion"?: string | null,"prefijo_cotizacion"?: string,"prefijo_pedido"?: string,"razon_social"?: string | null,"regimen_fiscal"?: string | null,"rfc"?: string | null,"sitio_web"?: string | null,"telefono"?: string | null,"tiempo_entrega_default"?: string | null,"tiktok"?: string | null,"updated_at"?: string,"vigencia_dias"?: number,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"contactos": {
                  Row: {
                    "cliente_id": string,"created_at": string,"email": string | null,"id": string,"nombre": string,"notas": string | null,"principal": boolean,"puesto": string | null,"telefono": string | null,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"created_at"?: string,"email"?: string | null,"id"?: string,"nombre": string,"notas"?: string | null,"principal"?: boolean,"puesto"?: string | null,"telefono"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "cliente_id"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"nombre"?: string,"notas"?: string | null,"principal"?: boolean,"puesto"?: string | null,"telefono"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contactos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"cortes_caja": {
                  Row: {
                    "cerrado_por": string | null,"created_at": string,"diferencia": number,"efectivo_contado": number,"efectivo_inicial": number,"esperado": number,"fecha": string,"id": string,"notas": string | null,"resumen": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "cerrado_por"?: string | null,"created_at"?: string,"diferencia": number,"efectivo_contado": number,"efectivo_inicial"?: number,"esperado": number,"fecha": string,"id"?: string,"notas"?: string | null,"resumen"?: NonNullable<Json>
                  }
                  Update: {
                    "cerrado_por"?: string | null,"created_at"?: string,"diferencia"?: number,"efectivo_contado"?: number,"efectivo_inicial"?: number,"esperado"?: number,"fecha"?: string,"id"?: string,"notas"?: string | null,"resumen"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "cortes_caja_cerrado_por_fkey"
      columns: ["cerrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cotizaciones": {
                  Row: {
                    "aceptada_at": string | null,"anticipo_pct": number,"aplica_iva": boolean,"cliente_id": string,"condiciones": string | null,"contacto_id": string | null,"created_at": string,"created_by": string | null,"descuento": number,"descuento_tipo": string,"descuento_valor": number,"enviada_at": string | null,"estado": Database["public"]['Enums']["estado_cotizacion"],"fecha": string,"fecha_vencimiento": string | null,"folio": string,"id": string,"iva": number,"iva_pct": number,"motivo_rechazo": string | null,"notas": string | null,"notas_internas": string | null,"oportunidad_id": string | null,"pdf_path": string | null,"pedido_id": string | null,"recargo": number,"recargo_concepto": string,"recargo_pct": number,"subtotal": number,"tiempo_entrega": string | null,"titulo": string | null,"total": number,"updated_at": string,"vendedor_id": string | null,"vigencia_dias": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada_at"?: string | null,"anticipo_pct"?: number,"aplica_iva"?: boolean,"cliente_id": string,"condiciones"?: string | null,"contacto_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descuento"?: number,"descuento_tipo"?: string,"descuento_valor"?: number,"enviada_at"?: string | null,"estado"?: Database["public"]['Enums']["estado_cotizacion"],"fecha"?: string,"fecha_vencimiento"?: never,"folio": string,"id"?: string,"iva"?: number,"iva_pct"?: number,"motivo_rechazo"?: string | null,"notas"?: string | null,"notas_internas"?: string | null,"oportunidad_id"?: string | null,"pdf_path"?: string | null,"pedido_id"?: string | null,"recargo"?: number,"recargo_concepto"?: string,"recargo_pct"?: number,"subtotal"?: number,"tiempo_entrega"?: string | null,"titulo"?: string | null,"total"?: number,"updated_at"?: string,"vendedor_id"?: string | null,"vigencia_dias"?: number
                  }
                  Update: {
                    "aceptada_at"?: string | null,"anticipo_pct"?: number,"aplica_iva"?: boolean,"cliente_id"?: string,"condiciones"?: string | null,"contacto_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descuento"?: number,"descuento_tipo"?: string,"descuento_valor"?: number,"enviada_at"?: string | null,"estado"?: Database["public"]['Enums']["estado_cotizacion"],"fecha"?: string,"fecha_vencimiento"?: never,"folio"?: string,"id"?: string,"iva"?: number,"iva_pct"?: number,"motivo_rechazo"?: string | null,"notas"?: string | null,"notas_internas"?: string | null,"oportunidad_id"?: string | null,"pdf_path"?: string | null,"pedido_id"?: string | null,"recargo"?: number,"recargo_concepto"?: string,"recargo_pct"?: number,"subtotal"?: number,"tiempo_entrega"?: string | null,"titulo"?: string | null,"total"?: number,"updated_at"?: string,"vendedor_id"?: string | null,"vigencia_dias"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cotizaciones_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_contacto_id_fkey"
      columns: ["contacto_id"]
isOneToOne: false
      referencedRelation: "contactos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_oportunidad_id_fkey"
      columns: ["oportunidad_id"]
isOneToOne: false
      referencedRelation: "oportunidades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_pedido_fk"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_pedido_fk"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cotizaciones_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"folios": {
                  Row: {
                    "siguiente": number,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "siguiente"?: number,"tipo": string
                  }
                  Update: {
                    "siguiente"?: number,"tipo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gastos": {
                  Row: {
                    "cancelado": boolean,"cancelado_at": string | null,"cancelado_por": string | null,"categoria": Database["public"]['Enums']["categoria_gasto"],"comprobante_path": string | null,"concepto": string,"created_at": string,"fecha": string,"id": string,"metodo_pago": Database["public"]['Enums']["metodo_pago"],"monto": number,"motivo_cancelacion": string | null,"notas": string | null,"pedido_id": string | null,"proveedor_id": string | null,"referencia": string | null,"updated_at": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelado"?: boolean,"cancelado_at"?: string | null,"cancelado_por"?: string | null,"categoria"?: Database["public"]['Enums']["categoria_gasto"],"comprobante_path"?: string | null,"concepto": string,"created_at"?: string,"fecha"?: string,"id"?: string,"metodo_pago"?: Database["public"]['Enums']["metodo_pago"],"monto": number,"motivo_cancelacion"?: string | null,"notas"?: string | null,"pedido_id"?: string | null,"proveedor_id"?: string | null,"referencia"?: string | null,"updated_at"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "cancelado"?: boolean,"cancelado_at"?: string | null,"cancelado_por"?: string | null,"categoria"?: Database["public"]['Enums']["categoria_gasto"],"comprobante_path"?: string | null,"concepto"?: string,"created_at"?: string,"fecha"?: string,"id"?: string,"metodo_pago"?: Database["public"]['Enums']["metodo_pago"],"monto"?: number,"motivo_cancelacion"?: string | null,"notas"?: string | null,"pedido_id"?: string | null,"proveedor_id"?: string | null,"referencia"?: string | null,"updated_at"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gastos_cancelado_por_fkey"
      columns: ["cancelado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gastos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gastos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gastos_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gastos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"material_costos": {
                  Row: {
                    "costo_unitario": number,"material_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "costo_unitario"?: number,"material_id": string,"updated_at"?: string
                  }
                  Update: {
                    "costo_unitario"?: number,"material_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_costos_material_id_fkey"
      columns: ["material_id"]
isOneToOne: true
      referencedRelation: "materiales"
      referencedColumns: ["id"]
    }
                  ]
                },"materiales": {
                  Row: {
                    "activo": boolean,"bajo_minimo": boolean | null,"busqueda": string | null,"categoria": string | null,"created_at": string,"created_by": string | null,"existencia": number,"id": string,"nombre": string,"notas": string | null,"proveedor_id": string | null,"stock_minimo": number,"ubicacion": string | null,"unidad": Database["public"]['Enums']["unidad_material"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"bajo_minimo"?: never,"busqueda"?: never,"categoria"?: string | null,"created_at"?: string,"created_by"?: string | null,"existencia"?: number,"id"?: string,"nombre": string,"notas"?: string | null,"proveedor_id"?: string | null,"stock_minimo"?: number,"ubicacion"?: string | null,"unidad"?: Database["public"]['Enums']["unidad_material"],"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"bajo_minimo"?: never,"busqueda"?: never,"categoria"?: string | null,"created_at"?: string,"created_by"?: string | null,"existencia"?: number,"id"?: string,"nombre"?: string,"notas"?: string | null,"proveedor_id"?: string | null,"stock_minimo"?: number,"ubicacion"?: string | null,"unidad"?: Database["public"]['Enums']["unidad_material"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "materiales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "materiales_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["id"]
    }
                  ]
                },"movimientos_inventario": {
                  Row: {
                    "cantidad": number,"created_at": string,"existencia_resultante": number,"fecha": string,"id": string,"material_id": string,"notas": string | null,"pedido_id": string | null,"proveedor_id": string | null,"referencia": string | null,"tipo": Database["public"]['Enums']["tipo_movimiento"],"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"created_at"?: string,"existencia_resultante"?: number,"fecha"?: string,"id"?: string,"material_id": string,"notas"?: string | null,"pedido_id"?: string | null,"proveedor_id"?: string | null,"referencia"?: string | null,"tipo": Database["public"]['Enums']["tipo_movimiento"],"usuario_id"?: string | null
                  }
                  Update: {
                    "cantidad"?: number,"created_at"?: string,"existencia_resultante"?: number,"fecha"?: string,"id"?: string,"material_id"?: string,"notas"?: string | null,"pedido_id"?: string | null,"proveedor_id"?: string | null,"referencia"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_movimiento"],"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimientos_inventario_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "materiales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_inventario_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_inventario_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_inventario_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_inventario_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"oportunidades": {
                  Row: {
                    "cerrada_at": string | null,"cliente_id": string,"created_at": string,"created_by": string | null,"descripcion": string | null,"etapa": Database["public"]['Enums']["etapa_comercial"],"id": string,"motivo_perdida": string | null,"origen": string | null,"proxima_accion": string | null,"proxima_accion_fecha": string | null,"responsable_id": string | null,"titulo": string,"updated_at": string,"valor_estimado": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cerrada_at"?: string | null,"cliente_id": string,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"etapa"?: Database["public"]['Enums']["etapa_comercial"],"id"?: string,"motivo_perdida"?: string | null,"origen"?: string | null,"proxima_accion"?: string | null,"proxima_accion_fecha"?: string | null,"responsable_id"?: string | null,"titulo": string,"updated_at"?: string,"valor_estimado"?: number | null
                  }
                  Update: {
                    "cerrada_at"?: string | null,"cliente_id"?: string,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"etapa"?: Database["public"]['Enums']["etapa_comercial"],"id"?: string,"motivo_perdida"?: string | null,"origen"?: string | null,"proxima_accion"?: string | null,"proxima_accion_fecha"?: string | null,"responsable_id"?: string | null,"titulo"?: string,"updated_at"?: string,"valor_estimado"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "oportunidades_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oportunidades_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "oportunidades_responsable_id_fkey"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pagos": {
                  Row: {
                    "cancelado": boolean,"cancelado_at": string | null,"cancelado_por": string | null,"cliente_id": string | null,"comprobante_path": string | null,"created_at": string,"fecha": string,"id": string,"importe": number,"metodo": Database["public"]['Enums']["metodo_pago"],"motivo_cancelacion": string | null,"notas": string | null,"pedido_id": string,"referencia": string | null,"registrado_por": string | null,"tipo": Database["public"]['Enums']["tipo_pago"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelado"?: boolean,"cancelado_at"?: string | null,"cancelado_por"?: string | null,"cliente_id"?: string | null,"comprobante_path"?: string | null,"created_at"?: string,"fecha"?: string,"id"?: string,"importe": number,"metodo": Database["public"]['Enums']["metodo_pago"],"motivo_cancelacion"?: string | null,"notas"?: string | null,"pedido_id": string,"referencia"?: string | null,"registrado_por"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_pago"],"updated_at"?: string
                  }
                  Update: {
                    "cancelado"?: boolean,"cancelado_at"?: string | null,"cancelado_por"?: string | null,"cliente_id"?: string | null,"comprobante_path"?: string | null,"created_at"?: string,"fecha"?: string,"id"?: string,"importe"?: number,"metodo"?: Database["public"]['Enums']["metodo_pago"],"motivo_cancelacion"?: string | null,"notas"?: string | null,"pedido_id"?: string,"referencia"?: string | null,"registrado_por"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_pago"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagos_cancelado_por_fkey"
      columns: ["cancelado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"partida_costos": {
                  Row: {
                    "calculo": NonNullable<Json>,"costo_fijo": number,"costo_mano_obra": number,"costo_material": number,"costo_total": number,"desperdicio_pct": number,"ganancia_pct": number,"partida_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calculo"?: NonNullable<Json>,"costo_fijo"?: number,"costo_mano_obra"?: number,"costo_material"?: number,"costo_total"?: number,"desperdicio_pct"?: number,"ganancia_pct"?: number,"partida_id": string,"updated_at"?: string
                  }
                  Update: {
                    "calculo"?: NonNullable<Json>,"costo_fijo"?: number,"costo_mano_obra"?: number,"costo_material"?: number,"costo_total"?: number,"desperdicio_pct"?: number,"ganancia_pct"?: number,"partida_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partida_costos_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: true
      referencedRelation: "orden_partidas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partida_costos_partida_id_fkey"
      columns: ["partida_id"]
isOneToOne: true
      referencedRelation: "partidas"
      referencedColumns: ["id"]
    }
                  ]
                },"partidas": {
                  Row: {
                    "alto": number | null,"ancho": number | null,"cantidad": number,"concepto": string,"cotizacion_id": string | null,"created_at": string,"descripcion": string | null,"descuento_pct": number,"id": string,"importe": number | null,"largo": number | null,"metodo_calculo": Database["public"]['Enums']["metodo_calculo"],"notas_produccion": string | null,"orden": number,"pedido_id": string | null,"precio_unitario": number,"producto_id": string | null,"tipo": Database["public"]['Enums']["tipo_partida"],"unidad": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alto"?: number | null,"ancho"?: number | null,"cantidad"?: number,"concepto": string,"cotizacion_id"?: string | null,"created_at"?: string,"descripcion"?: string | null,"descuento_pct"?: number,"id"?: string,"importe"?: never,"largo"?: number | null,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"],"notas_produccion"?: string | null,"orden"?: number,"pedido_id"?: string | null,"precio_unitario"?: number,"producto_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_partida"],"unidad"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alto"?: number | null,"ancho"?: number | null,"cantidad"?: number,"concepto"?: string,"cotizacion_id"?: string | null,"created_at"?: string,"descripcion"?: string | null,"descuento_pct"?: number,"id"?: string,"importe"?: never,"largo"?: number | null,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"],"notas_produccion"?: string | null,"orden"?: number,"pedido_id"?: string | null,"precio_unitario"?: number,"producto_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_partida"],"unidad"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partidas_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    }
                  ]
                },"pedido_eventos": {
                  Row: {
                    "created_at": string,"estado_a": Database["public"]['Enums']["estado_pedido"] | null,"estado_de": Database["public"]['Enums']["estado_pedido"] | null,"id": number,"mensaje": string | null,"pedido_id": string,"tipo": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"estado_a"?: Database["public"]['Enums']["estado_pedido"] | null,"estado_de"?: Database["public"]['Enums']["estado_pedido"] | null,"id"?: never,"mensaje"?: string | null,"pedido_id": string,"tipo": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"estado_a"?: Database["public"]['Enums']["estado_pedido"] | null,"estado_de"?: Database["public"]['Enums']["estado_pedido"] | null,"id"?: never,"mensaje"?: string | null,"pedido_id"?: string,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedido_eventos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedido_eventos_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedido_eventos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pedidos": {
                  Row: {
                    "anticipo_pct": number,"aplica_iva": boolean,"cancelado_at": string | null,"cliente_id": string,"condiciones": string | null,"contacto_id": string | null,"cotizacion_id": string | null,"created_at": string,"created_by": string | null,"descripcion": string | null,"descuento": number,"descuento_tipo": string,"descuento_valor": number,"direccion_instalacion": string | null,"disenador_id": string | null,"entregado_at": string | null,"estado": Database["public"]['Enums']["estado_pedido"],"estado_anterior": Database["public"]['Enums']["estado_pedido"] | null,"estado_pago": Database["public"]['Enums']["estado_pago"],"etapas_omitidas": (Database["public"]['Enums']["estado_pedido"])[],"facturado": boolean,"fecha_entrega": string | null,"fecha_factura": string | null,"fecha_limite_pago": string | null,"finalizado_at": string | null,"folio": string,"folio_factura": string | null,"id": string,"iva": number,"iva_pct": number,"motivo_estado": string | null,"notas_internas": string | null,"pagado": number,"prioridad": Database["public"]['Enums']["prioridad"],"recargo": number,"recargo_concepto": string,"recargo_pct": number,"requiere_factura": boolean,"requiere_instalacion": boolean,"responsable_id": string | null,"saldo": number | null,"subtotal": number,"titulo": string,"total": number,"updated_at": string,"vendedor_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anticipo_pct"?: number,"aplica_iva"?: boolean,"cancelado_at"?: string | null,"cliente_id": string,"condiciones"?: string | null,"contacto_id"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"descuento"?: number,"descuento_tipo"?: string,"descuento_valor"?: number,"direccion_instalacion"?: string | null,"disenador_id"?: string | null,"entregado_at"?: string | null,"estado"?: Database["public"]['Enums']["estado_pedido"],"estado_anterior"?: Database["public"]['Enums']["estado_pedido"] | null,"estado_pago"?: Database["public"]['Enums']["estado_pago"],"etapas_omitidas"?: (Database["public"]['Enums']["estado_pedido"])[],"facturado"?: boolean,"fecha_entrega"?: string | null,"fecha_factura"?: string | null,"fecha_limite_pago"?: string | null,"finalizado_at"?: string | null,"folio": string,"folio_factura"?: string | null,"id"?: string,"iva"?: number,"iva_pct"?: number,"motivo_estado"?: string | null,"notas_internas"?: string | null,"pagado"?: number,"prioridad"?: Database["public"]['Enums']["prioridad"],"recargo"?: number,"recargo_concepto"?: string,"recargo_pct"?: number,"requiere_factura"?: boolean,"requiere_instalacion"?: boolean,"responsable_id"?: string | null,"saldo"?: never,"subtotal"?: number,"titulo": string,"total"?: number,"updated_at"?: string,"vendedor_id"?: string | null
                  }
                  Update: {
                    "anticipo_pct"?: number,"aplica_iva"?: boolean,"cancelado_at"?: string | null,"cliente_id"?: string,"condiciones"?: string | null,"contacto_id"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"descuento"?: number,"descuento_tipo"?: string,"descuento_valor"?: number,"direccion_instalacion"?: string | null,"disenador_id"?: string | null,"entregado_at"?: string | null,"estado"?: Database["public"]['Enums']["estado_pedido"],"estado_anterior"?: Database["public"]['Enums']["estado_pedido"] | null,"estado_pago"?: Database["public"]['Enums']["estado_pago"],"etapas_omitidas"?: (Database["public"]['Enums']["estado_pedido"])[],"facturado"?: boolean,"fecha_entrega"?: string | null,"fecha_factura"?: string | null,"fecha_limite_pago"?: string | null,"finalizado_at"?: string | null,"folio"?: string,"folio_factura"?: string | null,"id"?: string,"iva"?: number,"iva_pct"?: number,"motivo_estado"?: string | null,"notas_internas"?: string | null,"pagado"?: number,"prioridad"?: Database["public"]['Enums']["prioridad"],"recargo"?: number,"recargo_concepto"?: string,"recargo_pct"?: number,"requiere_factura"?: boolean,"requiere_instalacion"?: boolean,"responsable_id"?: string | null,"saldo"?: never,"subtotal"?: number,"titulo"?: string,"total"?: number,"updated_at"?: string,"vendedor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_contacto_id_fkey"
      columns: ["contacto_id"]
isOneToOne: false
      referencedRelation: "contactos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_disenador_id_fkey"
      columns: ["disenador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_responsable_id_fkey"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"perfiles": {
                  Row: {
                    "activo": boolean,"comision_pct": number,"created_at": string,"email": string,"id": string,"nombre": string,"permisos": NonNullable<Json>,"puesto": string | null,"rol": Database["public"]['Enums']["rol_usuario"],"telefono": string | null,"ultimo_acceso": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"comision_pct"?: number,"created_at"?: string,"email"?: string,"id": string,"nombre"?: string,"permisos"?: NonNullable<Json>,"puesto"?: string | null,"rol"?: Database["public"]['Enums']["rol_usuario"],"telefono"?: string | null,"ultimo_acceso"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"comision_pct"?: number,"created_at"?: string,"email"?: string,"id"?: string,"nombre"?: string,"permisos"?: NonNullable<Json>,"puesto"?: string | null,"rol"?: Database["public"]['Enums']["rol_usuario"],"telefono"?: string | null,"ultimo_acceso"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plantillas_mensaje": {
                  Row: {
                    "activo": boolean,"clave": string,"contexto": string,"created_at": string,"id": string,"nombre": string,"orden": number,"texto": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"clave": string,"contexto"?: string,"created_at"?: string,"id"?: string,"nombre": string,"orden"?: number,"texto": string,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"clave"?: string,"contexto"?: string,"created_at"?: string,"id"?: string,"nombre"?: string,"orden"?: number,"texto"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"portal_enlaces": {
                  Row: {
                    "cotizacion_id": string | null,"created_at": string,"created_by": string | null,"expira_at": string,"id": string,"pedido_id": string | null,"revocado": boolean,"revocado_at": string | null,"revocado_por": string | null,"tipo": string,"token": string,"ultimo_acceso_at": string | null,"vistas": number,"portal_pedido_de_enlace": string | null
                  }
                  ComputedFields: "portal_pedido_de_enlace"
                  Insert: {
                    "cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"expira_at"?: string,"id"?: string,"pedido_id"?: string | null,"revocado"?: boolean,"revocado_at"?: string | null,"revocado_por"?: string | null,"tipo": string,"token"?: string,"ultimo_acceso_at"?: string | null,"vistas"?: number
                  }
                  Update: {
                    "cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"expira_at"?: string,"id"?: string,"pedido_id"?: string | null,"revocado"?: boolean,"revocado_at"?: string | null,"revocado_por"?: string | null,"tipo"?: string,"token"?: string,"ultimo_acceso_at"?: string | null,"vistas"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "portal_enlaces_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_enlaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_enlaces_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_enlaces_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_enlaces_revocado_por_fkey"
      columns: ["revocado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"portal_respuestas": {
                  Row: {
                    "accion": string,"archivo_id": string | null,"comentario": string | null,"cotizacion_id": string | null,"created_at": string,"enlace_id": string,"id": number,"ip": string | null,"nombre": string,"pedido_id": string | null,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": string,"archivo_id"?: string | null,"comentario"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"enlace_id": string,"id"?: never,"ip"?: string | null,"nombre": string,"pedido_id"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "accion"?: string,"archivo_id"?: string | null,"comentario"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"enlace_id"?: string,"id"?: never,"ip"?: string | null,"nombre"?: string,"pedido_id"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "portal_respuestas_archivo_id_fkey"
      columns: ["archivo_id"]
isOneToOne: false
      referencedRelation: "archivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_respuestas_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_respuestas_enlace_id_fkey"
      columns: ["enlace_id"]
isOneToOne: false
      referencedRelation: "portal_enlaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_respuestas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portal_respuestas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    }
                  ]
                },"producto_costos": {
                  Row: {
                    "costo_fijo": number,"costo_mano_obra": number,"costo_material": number,"desperdicio_pct": number,"ganancia_pct": number,"notas": string | null,"producto_id": string,"proveedor": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "costo_fijo"?: number,"costo_mano_obra"?: number,"costo_material"?: number,"desperdicio_pct"?: number,"ganancia_pct"?: number,"notas"?: string | null,"producto_id": string,"proveedor"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "costo_fijo"?: number,"costo_mano_obra"?: number,"costo_material"?: number,"desperdicio_pct"?: number,"ganancia_pct"?: number,"notas"?: string | null,"producto_id"?: string,"proveedor"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "producto_costos_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: true
      referencedRelation: "productos"
      referencedColumns: ["id"]
    }
                  ]
                },"producto_precios": {
                  Row: {
                    "created_at": string,"escalas": NonNullable<Json>,"lista": Database["public"]['Enums']["lista_precio"],"precio": number,"precio_minimo": number | null,"producto_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"escalas"?: NonNullable<Json>,"lista": Database["public"]['Enums']["lista_precio"],"precio": number,"precio_minimo"?: number | null,"producto_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"escalas"?: NonNullable<Json>,"lista"?: Database["public"]['Enums']["lista_precio"],"precio"?: number,"precio_minimo"?: number | null,"producto_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "producto_precios_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    }
                  ]
                },"productos": {
                  Row: {
                    "activo": boolean,"busqueda": string | null,"categoria_id": string | null,"created_at": string,"created_by": string | null,"descripcion": string | null,"escalas": NonNullable<Json>,"id": string,"metodo_calculo": Database["public"]['Enums']["metodo_calculo"],"nombre": string,"precio_minimo": number | null,"precio_venta": number | null,"requiere_diseno": boolean,"requiere_instalacion": boolean,"requiere_produccion": boolean,"sku": string | null,"tiempo_entrega": string | null,"unidad": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"busqueda"?: never,"categoria_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"escalas"?: NonNullable<Json>,"id"?: string,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"],"nombre": string,"precio_minimo"?: number | null,"precio_venta"?: number | null,"requiere_diseno"?: boolean,"requiere_instalacion"?: boolean,"requiere_produccion"?: boolean,"sku"?: string | null,"tiempo_entrega"?: string | null,"unidad"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"busqueda"?: never,"categoria_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"escalas"?: NonNullable<Json>,"id"?: string,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"],"nombre"?: string,"precio_minimo"?: number | null,"precio_venta"?: number | null,"requiere_diseno"?: boolean,"requiere_instalacion"?: boolean,"requiere_produccion"?: boolean,"sku"?: string | null,"tiempo_entrega"?: string | null,"unidad"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "productos_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "productos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"proveedores": {
                  Row: {
                    "activo": boolean,"busqueda": string | null,"categoria": string | null,"contacto": string | null,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"nombre": string,"notas": string | null,"rfc": string | null,"telefono": string | null,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"busqueda"?: never,"categoria"?: string | null,"contacto"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"nombre": string,"notas"?: string | null,"rfc"?: string | null,"telefono"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"busqueda"?: never,"categoria"?: string | null,"contacto"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"nombre"?: string,"notas"?: string | null,"rfc"?: string | null,"telefono"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proveedores_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tareas": {
                  Row: {
                    "cliente_id": string | null,"completada": boolean,"completada_at": string | null,"completada_por": string | null,"cotizacion_id": string | null,"created_at": string,"created_by": string | null,"descripcion": string | null,"fecha": string,"hora": string | null,"id": string,"oportunidad_id": string | null,"pedido_id": string | null,"prioridad": Database["public"]['Enums']["prioridad"],"responsable_id": string | null,"tipo": Database["public"]['Enums']["tipo_tarea"],"titulo": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id"?: string | null,"completada"?: boolean,"completada_at"?: string | null,"completada_por"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"fecha"?: string,"hora"?: string | null,"id"?: string,"oportunidad_id"?: string | null,"pedido_id"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad"],"responsable_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_tarea"],"titulo": string,"updated_at"?: string
                  }
                  Update: {
                    "cliente_id"?: string | null,"completada"?: boolean,"completada_at"?: string | null,"completada_por"?: string | null,"cotizacion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"descripcion"?: string | null,"fecha"?: string,"hora"?: string | null,"id"?: string,"oportunidad_id"?: string | null,"pedido_id"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad"],"responsable_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_tarea"],"titulo"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_completada_por_fkey"
      columns: ["completada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_oportunidad_id_fkey"
      columns: ["oportunidad_id"]
isOneToOne: false
      referencedRelation: "oportunidades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_responsable_id_fkey"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "orden_partidas": {
                  Row: {
                    "alto": number | null,"ancho": number | null,"cantidad": number | null,"concepto": string | null,"descripcion": string | null,"descuento_pct": number | null,"id": string | null,"importe": number | null,"largo": number | null,"metodo_calculo": Database["public"]['Enums']["metodo_calculo"] | null,"notas_produccion": string | null,"orden": number | null,"pedido_id": string | null,"precio_unitario": number | null,"producto_id": string | null,"tipo": Database["public"]['Enums']["tipo_partida"] | null,"unidad": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "alto"?: number | null,"ancho"?: number | null,"cantidad"?: number | null,"concepto"?: string | null,"descripcion"?: string | null,"descuento_pct"?: never,"id"?: string | null,"importe"?: never,"largo"?: number | null,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"] | null,"notas_produccion"?: string | null,"orden"?: number | null,"pedido_id"?: string | null,"precio_unitario"?: never,"producto_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_partida"] | null,"unidad"?: string | null
                         }
                        Update: {
                           "alto"?: number | null,"ancho"?: number | null,"cantidad"?: number | null,"concepto"?: string | null,"descripcion"?: string | null,"descuento_pct"?: never,"id"?: string | null,"importe"?: never,"largo"?: number | null,"metodo_calculo"?: Database["public"]['Enums']["metodo_calculo"] | null,"notas_produccion"?: string | null,"orden"?: number | null,"pedido_id"?: string | null,"precio_unitario"?: never,"producto_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_partida"] | null,"unidad"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "partidas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "ordenes_trabajo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partidas_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    }
                  ]
                },"ordenes_trabajo": {
                  Row: {
                    "anticipo_recibido": boolean | null,"atrasado": boolean | null,"cliente_id": string | null,"cliente_nombre": string | null,"cliente_whatsapp": string | null,"contacto_id": string | null,"cotizacion_id": string | null,"created_at": string | null,"descripcion": string | null,"direccion_instalacion": string | null,"disenador_id": string | null,"entregado_at": string | null,"estado": Database["public"]['Enums']["estado_pedido"] | null,"estado_anterior": Database["public"]['Enums']["estado_pedido"] | null,"estado_pago": Database["public"]['Enums']["estado_pago"] | null,"etapas_omitidas": (Database["public"]['Enums']["estado_pedido"])[] | null,"facturado": boolean | null,"fecha_entrega": string | null,"finalizado_at": string | null,"folio": string | null,"id": string | null,"motivo_estado": string | null,"num_disenos": number | null,"num_partidas": number | null,"pagado": number | null,"prioridad": Database["public"]['Enums']["prioridad"] | null,"requiere_factura": boolean | null,"requiere_instalacion": boolean | null,"responsable_id": string | null,"saldo": number | null,"titulo": string | null,"total": number | null,"updated_at": string | null,"vendedor_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "pedidos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_contacto_id_fkey"
      columns: ["contacto_id"]
isOneToOne: false
      referencedRelation: "contactos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_cotizacion_id_fkey"
      columns: ["cotizacion_id"]
isOneToOne: false
      referencedRelation: "cotizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_disenador_id_fkey"
      columns: ["disenador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_responsable_id_fkey"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "actualizar_notas_partida":
{ Args: { "p_notas": string,"p_partida": string }; Returns: undefined
                           },
"agenda":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "cliente": string,"cliente_id": string,"completada": boolean,"cotizacion_id": string,"detalle": string,"estado": string,"fecha": string,"folio": string,"hora": string,"id": string,"oportunidad_id": string,"origen": string,"pedido_id": string,"prioridad": Database["public"]['Enums']["prioridad"],"responsable_id": string,"tipo": string,"titulo": string
            }[]
                           },
"agregar_nota_pedido":
{ Args: { "p_mensaje": string,"p_pedido": string }; Returns: number
                           },
"ajustar_existencia":
{ Args: { "p_existencia": number,"p_material": string,"p_notas"?: string }; Returns: Json
                           },
"busqueda_global":
{ Args: { "p_texto": string }; Returns: Json
                           },
"cambiar_estado_pedido":
{ Args: { "p_estado": Database["public"]['Enums']["estado_pedido"],"p_motivo"?: string,"p_pedido": string }; Returns: undefined
                           },
"cantidad_texto":
{ Args: { "p": number }; Returns: string
                           },
"cerrar_caja":
{ Args: { "p_efectivo_contado": number,"p_efectivo_inicial": number,"p_fecha": string,"p_notas"?: string }; Returns: Json
                           },
"clientes_inactivos":
{ Args: { "p_dias"?: number }; Returns: {
              "cliente_id": string,"dias_sin_compra": number,"email": string,"etiquetas": (string)[],"nombre": string,"pedidos": number,"telefono": string,"total_comprado": number,"ultima_compra": string,"vendedor": string,"vendedor_id": string,"whatsapp": string
            }[]
                           },
"comisiones":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "base_comision": number,"cobrado": number,"comision": number,"comision_pct": number,"nombre": string,"pagos": number,"pedidos": number,"vendedor_id": string
            }[]
                           },
"comisiones_detalle":
{ Args: { "p_desde": string,"p_hasta": string,"p_vendedor"?: string }; Returns: {
              "base_comision": number,"cliente": string,"cobrado": number,"comision": number,"comision_pct": number,"folio": string,"pagos": number,"pedido_id": string,"vendedor": string,"vendedor_id": string
            }[]
                           },
"convertir_cotizacion_a_pedido":
{ Args: { "p_cotizacion": string,"p_fecha_entrega"?: string,"p_responsable"?: string,"p_titulo"?: string }; Returns: string
                           },
"copiar_partidas":
{ Args: { "p_destino_cotizacion": string,"p_destino_pedido": string,"p_origen_cotizacion": string,"p_origen_pedido": string }; Returns: undefined
                           },
"corte_caja_calcular":
{ Args: { "p_detalle_gastos": boolean,"p_efectivo_inicial": number,"p_fecha": string }; Returns: Json
                           },
"corte_caja_resumen":
{ Args: { "p_efectivo_inicial"?: number,"p_fecha"?: string }; Returns: Json
                           },
"crear_enlace_portal":
{ Args: { "p_dias"?: number,"p_id": string,"p_nuevo"?: boolean,"p_tipo": string }; Returns: Json
                           },
"cuentas_por_cobrar":
{ Args: Record<PropertyKey, never>; Returns: {
              "cliente": string,"cliente_id": string,"creado": string,"dias_transcurridos": number,"dias_vencido": number,"estado": Database["public"]['Enums']["estado_pedido"],"estado_pago": Database["public"]['Enums']["estado_pago"],"fecha_entrega": string,"fecha_limite": string,"folio": string,"pagado": number,"pedido_id": string,"saldo": number,"titulo": string,"total": number,"vencido": boolean,"vendedor": string,"vendedor_id": string,"whatsapp": string
            }[]
                           },
"dashboard_resumen":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delta_inventario":
{ Args: { "p_cantidad": number,"p_tipo": Database["public"]['Enums']["tipo_movimiento"] }; Returns: number
                           },
"duplicar_cotizacion":
{ Args: { "p_cotizacion": string }; Returns: string
                           },
"es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"generar_token_portal":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"guardar_cotizacion":
{ Args: { "p_datos": Json }; Returns: Json
                           },
"lista_permisos":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"mis_permisos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"normalizar":
{ Args: { "t": string }; Returns: string
                           },
"permiso_por_defecto":
{ Args: { "p_permiso": string,"p_rol": Database["public"]['Enums']["rol_usuario"] }; Returns: boolean
                           },
"portal_aprobar_cotizacion":
{ Args: { "p_comentario"?: string,"p_nombre": string,"p_token": string }; Returns: Json
                           },
"portal_archivos_firmables":
{ Args: { "p_archivo_id"?: string,"p_token": string }; Returns: {
              "id": string,"mime": string,"nombre": string,"path": string,"version": number
            }[]
                           },
"portal_enlace_vigente":
{ Args: { "p_token": string }; Returns: {
              "cotizacion_id": string | null,
"created_at": string,
"created_by": string | null,
"expira_at": string,
"id": string,
"pedido_id": string | null,
"revocado": boolean,
"revocado_at": string | null,
"revocado_por": string | null,
"tipo": string,
"token": string,
"ultimo_acceso_at": string | null,
"vistas": number
            }
                          SetofOptions: {
        from: "*"
        to: "portal_enlaces"
        isOneToOne: true
        isSetofReturn: false
      } },
"portal_obtener":
{ Args: { "p_token": string }; Returns: Json
                           },
"portal_origen_solicitud":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"portal_partidas":
{ Args: { "p_cotizacion": string,"p_pedido": string }; Returns: Json
                           },
"portal_pedido_de_enlace":
{ Args: { "e": Omit<Database["public"]['Tables']["portal_enlaces"]['Row'], Database["public"]['Tables']["portal_enlaces"]['ComputedFields']> }; Returns: string
                           },
"portal_responder_diseno":
{ Args: { "p_aprobado": boolean,"p_archivo_id": string,"p_comentario"?: string,"p_nombre": string,"p_token": string }; Returns: Json
                           },
"portal_texto_cliente":
{ Args: { "p_comentario": string,"p_nombre": string }; Returns: (string)[]
                           },
"puede_ver_caja":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reabrir_caja":
{ Args: { "p_fecha": string,"p_motivo": string }; Returns: undefined
                           },
"registrar_acceso":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"reporte_clientes":
{ Args: { "p_desde": string,"p_hasta": string,"p_limite"?: number }; Returns: {
              "cliente_id": string,"cobrado": number,"nombre": string,"pedidos": number,"saldo": number,"ticket_promedio": number,"ultima_compra": string,"vendido": number,"whatsapp": string
            }[]
                           },
"reporte_productos":
{ Args: { "p_desde": string,"p_hasta": string,"p_limite"?: number }; Returns: {
              "cantidad": number,"categoria": string,"importe": number,"pedidos": number,"producto": string,"producto_id": string,"tipo": string,"unidad": string,"unidades": number
            }[]
                           },
"reporte_vendedores":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "aceptadas": number,"cobrado": number,"cotizaciones": number,"cotizado": number,"nombre": string,"pedidos": number,"rechazadas": number,"tasa_cierre": number,"ticket_promedio": number,"vendedor_id": string,"vendido": number
            }[]
                           },
"reporte_ventas":
{ Args: { "p_agrupar"?: string,"p_desde": string,"p_hasta": string }; Returns: {
              "cobrado": number,"cotizaciones": number,"cotizado": number,"pedidos": number,"periodo": string,"vendido": number
            }[]
                           },
"resumen_cliente":
{ Args: { "p_cliente": string }; Returns: Json
                           },
"revocar_enlace_portal":
{ Args: { "p_enlace": string }; Returns: undefined
                           },
"tiene_permiso":
{ Args: { "p_permiso": string }; Returns: boolean
                           },
"unidades_cobro":
{ Args: { "p_alto": number,"p_ancho": number,"p_cantidad": number,"p_largo": number,"p_metodo": Database["public"]['Enums']["metodo_calculo"] }; Returns: number
                           },
"usuario_activo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"utilidad_pedidos":
{ Args: { "p_desde": string,"p_hasta": string }; Returns: {
              "cliente": string,"cliente_id": string,"consumo_material": number,"consumos_sin_costo": number,"costo_estimado": number,"costo_real": number,"estado": Database["public"]['Enums']["estado_pedido"],"estado_pago": Database["public"]['Enums']["estado_pago"],"fecha": string,"folio": string,"gastos": number,"margen_estimado_pct": number,"margen_real_pct": number,"pedido_id": string,"titulo": string,"utilidad_estimada": number,"utilidad_real": number,"vendedor_id": string,"venta": number
            }[]
                           },
"validar_rango_reporte":
{ Args: { "p_desde": string,"p_hasta": string,"p_max_dias"?: number }; Returns: undefined
                           }
          }
          Enums: {
            "categoria_gasto": "material"|"maquila"|"servicios"|"renta"|"nomina"|"transporte"|"publicidad"|"impuestos"|"otros","estado_archivo": "no_aplica"|"pendiente"|"aprobado"|"cambios"|"rechazado","estado_cotizacion": "borrador"|"enviada"|"aceptada"|"rechazada"|"cancelada","estado_pago": "pendiente"|"anticipo"|"parcial"|"liquidado"|"reembolsado","estado_pedido": "nuevo"|"en_diseno"|"esperando_aprobacion"|"aprobado"|"en_produccion"|"acabados"|"listo_entrega"|"en_instalacion"|"entregado"|"finalizado"|"pausado"|"cancelado","etapa_comercial": "prospecto_nuevo"|"contactado"|"interesado"|"cotizacion_enviada"|"en_seguimiento"|"ganado"|"perdido","lista_precio": "publico"|"mayoreo"|"agencia","metodo_calculo": "pieza"|"m2"|"metro_lineal"|"millar"|"hora"|"servicio"|"proyecto"|"mensualidad","metodo_pago": "transferencia"|"efectivo"|"deposito"|"tarjeta","prioridad": "baja"|"normal"|"alta"|"urgente","rol_usuario": "admin"|"ventas"|"diseno"|"produccion","tipo_movimiento": "entrada"|"consumo"|"ajuste"|"merma","tipo_pago": "anticipo"|"abono"|"liquidacion"|"devolucion","tipo_partida": "concepto"|"instalacion"|"transporte"|"diseno"|"extra","tipo_tarea": "tarea"|"llamada"|"seguimiento"|"entrega"|"instalacion"|"recordatorio","unidad_material": "m2"|"metro"|"hoja"|"pieza"|"litro"|"rollo"|"kg"|"millar"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "categoria_gasto": ["material", "maquila", "servicios", "renta", "nomina", "transporte", "publicidad", "impuestos", "otros"],"estado_archivo": ["no_aplica", "pendiente", "aprobado", "cambios", "rechazado"],"estado_cotizacion": ["borrador", "enviada", "aceptada", "rechazada", "cancelada"],"estado_pago": ["pendiente", "anticipo", "parcial", "liquidado", "reembolsado"],"estado_pedido": ["nuevo", "en_diseno", "esperando_aprobacion", "aprobado", "en_produccion", "acabados", "listo_entrega", "en_instalacion", "entregado", "finalizado", "pausado", "cancelado"],"etapa_comercial": ["prospecto_nuevo", "contactado", "interesado", "cotizacion_enviada", "en_seguimiento", "ganado", "perdido"],"lista_precio": ["publico", "mayoreo", "agencia"],"metodo_calculo": ["pieza", "m2", "metro_lineal", "millar", "hora", "servicio", "proyecto", "mensualidad"],"metodo_pago": ["transferencia", "efectivo", "deposito", "tarjeta"],"prioridad": ["baja", "normal", "alta", "urgente"],"rol_usuario": ["admin", "ventas", "diseno", "produccion"],"tipo_movimiento": ["entrada", "consumo", "ajuste", "merma"],"tipo_pago": ["anticipo", "abono", "liquidacion", "devolucion"],"tipo_partida": ["concepto", "instalacion", "transporte", "diseno", "extra"],"tipo_tarea": ["tarea", "llamada", "seguimiento", "entrega", "instalacion", "recordatorio"],"unidad_material": ["m2", "metro", "hoja", "pieza", "litro", "rollo", "kg", "millar"]
          }
        }
} as const
