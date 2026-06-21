import type { Metadata, Viewport } from 'next'
import './globals.css'
import { I18nProvider } from '@/components/i18n-provider'
import { getLocale, getMessages } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: '干饭厨子 · GanCook',
  description: '可自部署到 NAS 的家庭点菜系统 · 让每一顿饭都充满期待',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.webp', type: 'image/webp' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#f4f6f4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const messages = getMessages(locale)
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
