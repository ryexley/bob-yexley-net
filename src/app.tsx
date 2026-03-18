import { MetaProvider } from "@solidjs/meta"
import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { onMount, Suspense } from "solid-js"
import { ConfirmationProvider } from "@/components/confirm-dialog"
import { NotificationProvider } from "@/components/notification"
import { AuthProvider } from "@/context/auth-context"
import { ServicesProvider } from "@/context/services-context"
import { ViewportProvider } from "@/context/viewport"
import { IntlProvider, messages } from "@/i18n"
import { MainLayout } from "@/layouts"
import { generateRGBColorVarsFromHexVars } from "@/util/colors"
import { handleIconsReady } from "@/util/fonts"
import "@/styles/global.css"

export default function App() {
  onMount(() => {
    handleIconsReady()
    generateRGBColorVarsFromHexVars()
  })

  return (
    <MetaProvider>
      <Router
        root={props => (
          <Suspense fallback={null}>
            <ServicesProvider>
              <AuthProvider>
                <IntlProvider
                  locale="en"
                  messages={messages}>
                  <ViewportProvider>
                    <NotificationProvider>
                      <ConfirmationProvider>
                        <MainLayout>{props.children}</MainLayout>
                      </ConfirmationProvider>
                    </NotificationProvider>
                  </ViewportProvider>
                </IntlProvider>
              </AuthProvider>
            </ServicesProvider>
          </Suspense>
        )}>
        <FileRoutes />
      </Router>
    </MetaProvider>
  )
}
