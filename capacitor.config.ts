import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nomansland.game',
  appName: 'No Mans Land',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
