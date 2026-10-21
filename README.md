# MiDinero — PWA personal de finanzas

Aplicación **HTML + CSS + JavaScript puros**, sin frameworks, servidor, cuenta o base de datos. Está preparada para GitHub Pages y para instalarse en iPhone desde Safari.

## Qué trae configurado

- Contrato fijo: **1.409 € netos al mes**, 12 pagas. Cobro entre los días **28–30** (no se registra automáticamente).
- Vivienda **400 €**, gasolina **150 €**, seguro **64 €**, cuota de deuda **98 € hasta abril de 2027**.
- Presupuesto orientativo: gastos personales **100 €**, ocio **150 €**, ahorro de moto **275 €**, colchón de emergencia **110 €**, margen **62 €**.
- Moto: **3.000 € antes del 11/09/2027**. Colchón: primer objetivo **1.000 €**, luego ampliar a unos tres meses de gastos necesarios.
- Ahorros actuales y saldo inicial: **0 €**.

> La app no conoce el saldo real del banco; registra movimientos manualmente. El salario previsto **no aumenta tu saldo hasta que confirmes que has cobrado**. Ahorrar en la app reserva dinero dentro del presupuesto, no hace ninguna transferencia bancaria.

## Publicarla gratis con GitHub Pages

1. Descarga y **descomprime** `MiDinero_PWA.zip`.
2. En GitHub, crea un repositorio nuevo (por ejemplo, `midinero-personal`). Recomendado: publica en un repositorio nuevo para no sustituir una app existente sin respaldo.
3. Sube a la **raíz** del repositorio los archivos `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js` y la carpeta `icons/`. (No subas el ZIP sin descomprimir.)
4. En el repositorio ve a **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, rama **main** y carpeta **/(root)**. Guarda.
5. Accede a la URL `https://TU-USUARIO.github.io/midinero-personal/` cuando GitHub la haya publicado.
6. En iPhone, abre esa dirección en Safari → **Compartir → Añadir a pantalla de inicio**.

Con HTTPS, el Service Worker dejará disponible la app para uso **sin conexión** tras la primera carga. No requiere instalación de dependencias ni compilación.

## Uso

- En **Inicio**, ve el dinero registrado, el ahorro, el presupuesto, el gasto diario orientativo y alertas de cobro.
- En **Gastos**, pulsa **He cobrado la nómina** solamente cuando llegue. Registra vivienda, gasolina, seguro, ocio, otros gastos e ingresos. Para registrar ahorro de moto o colchón, usa el tipo **Apartar dinero para ahorrar**.
- En **Metas**, sigue el avance de la moto y el colchón y cuánto deberías apartar cada nómina. También puedes pulsar **Sacar dinero del colchón**, escribir el importe y el motivo, y consultar el **historial de retiradas**.
- En **Ajustes**, cambia cualquier cifra, fecha límite o rango de cobro. Configura **Saldo inicial** si ya tienes dinero en la cuenta.
- **Exportar copia JSON** guarda tus ajustes, aportaciones y retiradas, e **Importar copia** los recupera. También puedes exportar los movimientos en CSV.

## Retiradas del colchón (novedad)

1. Primero registra una aportación al colchón con dinero real disponible en la cuenta.
2. En **Metas → Sacar dinero del colchón**, indica **importe, fecha y motivo** y pulsa **Registrar retirada**.
3. El saldo del colchón se reduce; el saldo disponible en la app aumenta en la misma cantidad. Se muestra un **historial** con la fecha, motivo y cantidad; también aparece en **Movimientos**.
4. Si usas esos fondos para pagar algo, **registra después el gasto** en Movimientos. La retirada es un movimiento interno, no un gasto extra.
5. No puedes retirar más de lo que has apartado para la fecha elegida. Puedes deshacer una retirada desde su historial.
6. Las exportaciones JSON/CSV incluyen también las retiradas. Las instalaciones existentes conservan sus ajustes guardados en `localStorage` al actualizar los archivos en la **misma URL**. Para cambiar de URL/dispositivo, exporta e importa una copia JSON.

## Privacidad y advertencias

- Los datos se almacenan con `localStorage` **solo en el navegador/dispositivo y origen web actual**. No hay sincronización entre móviles, cifrado propio, identificación de usuario ni copias remotas.
- Si se borran los datos de Safari, se desinstala la PWA o cambias de dominio/URL, puedes perder acceso a esos registros. **Haz copias JSON con frecuencia** y guárdalas en un lugar privado.
- GitHub Pages sirve los archivos públicos del programa, **no publica tus movimientos** porque nunca se suben al repositorio (salvo que tú mismo los subas).
- No registres contraseñas ni números completos de cuentas bancarias en descripciones.
- Los cálculos son orientativos y no constituyen asesoramiento financiero profesional. El objetivo de moto no incluye casco, seguro, tasas o mantenimiento si los 3.000 € no los cubren.

## Estructura

```
MiDinero_PWA/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
└── README.md
```