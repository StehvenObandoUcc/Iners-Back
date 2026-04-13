# Spotify OAuth Test Checklist

1. Crear archivo `.env` en la raiz de `Iners` con:

```env
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=https://tu-subdominio.ngrok.app/auth/spotify/callback
PORT=3000
DB_PATH=./database.sqlite
```

2. Iniciar backend:

```bash
npm run dev
```

3. Exponer puerto con ngrok (en otra terminal):

```bash
ngrok http 3000
```

4. Copiar URL HTTPS de ngrok y actualizar:

- `.env` -> `SPOTIFY_REDIRECT_URI`
- Spotify Developer Dashboard -> Redirect URI exacta

5. Probar flujo:

- Abrir `GET /auth/spotify/authorize` en navegador
- Aceptar login/scopes en Spotify
- Verificar respuesta exitosa en `callback`
- Confirmar `GET /auth/spotify/status` devuelve `authenticated: true`

6. Probar busqueda Spotify:

- `GET /api/songs/search/spotify?q=drake`
- Esperado: `200` con canciones `source=SPOTIFY`

7. Probar logout:

- `POST /auth/spotify/logout`
- `GET /auth/spotify/status` debe volver a `authenticated: false`

Notas:
- Si `authorize` falla, revisa variables faltantes en `.env`.
- Si `callback` falla, verifica que Redirect URI sea identica en Spotify y `.env`.
- Si `search/spotify` da `401`, no hay sesion autenticada activa.
