1. Terminal 1 — levantar backend:
   cd Iners && npm run dev
   → Servidor en http://127.0.0.1:3000 (o localhost, internamente es igual)

2. Terminal 2 — levantar ngrok:
   npm run ngrok
   → Copiar la URL HTTPS que muestra ngrok:
     Forwarding  https://XXXX-XXX-XXX.ngrok-free.app → http://localhost:3000
     ↑ Esta URL cambia CADA VEZ que reinicias ngrok (plan gratuito) [web:87]

3. Spotify Dashboard → tu app → Edit Settings:
   Redirect URIs → Agregar:
   https://XXXX-XXX-XXX.ngrok-free.app/auth/spotify/callback
   → Guardar (botón Save al fondo)

4. Actualizar Iners/.env:
   SPOTIFY_REDIRECT_URI=https://XXXX-XXX-XXX.ngrok-free.app/auth/spotify/callback

5. Reiniciar backend (Ctrl+C → npm run dev)
   ⚠️ Obligatorio: el .env se carga al iniciar, no en caliente

6. Abrir en el navegador (NO en Thunder Client — necesita redirigir):
   http://localhost:3000/auth/spotify/authorize
   → Redirige a Spotify → Login → Aceptar scopes
   → Spotify redirige a ngrok → ngrok al backend → callback procesa tokens

7. Verificar resultado:
   GET http://localhost:3000/auth/spotify/status
   → { "success": true, "data": { "authenticated": true } }

8. Probar búsqueda autenticada:
   GET http://localhost:3000/api/songs/search/spotify?q=drake
   → 200 con resultados reales de Spotify