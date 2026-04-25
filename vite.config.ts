import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  const getEnv = (key: string) => (process.env[key] || process.env['VITE_' + key] || env[key] || env['VITE_' + key] || '').trim();
  
  const firebaseApiKey = getEnv('FIREBASE_API_KEY');
  const firebaseAuthDomain = getEnv('FIREBASE_AUTH_DOMAIN');
  const firebaseProjectId = getEnv('FIREBASE_PROJECT_ID');
  
  console.log('Build-time Firebase Check:');
  console.log('- API Key:', firebaseApiKey ? 'YES (len: ' + firebaseApiKey.length + ')' : 'NO');
  console.log('- Auth Domain:', firebaseAuthDomain ? 'YES' : 'NO');
  console.log('- Project ID:', firebaseProjectId ? 'YES' : 'NO');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(firebaseApiKey),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(firebaseAuthDomain),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(firebaseProjectId),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(getEnv('FIREBASE_STORAGE_BUCKET')),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(getEnv('FIREBASE_MESSAGING_SENDER_ID')),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(getEnv('FIREBASE_APP_ID')),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(getEnv('FIREBASE_MEASUREMENT_ID')),
      'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(getEnv('FIREBASE_DATABASE_ID')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
