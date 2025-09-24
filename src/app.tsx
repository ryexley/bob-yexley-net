import { MetaProvider } from "@solidjs/meta"
import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { onMount, Suspense } from "solid-js"
import { AuthProvider } from "@/context/auth-context"
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
          <Suspense fallback={<div>Loading...</div>}>
            <AuthProvider>
              <IntlProvider
                locale="en"
                messages={messages}>
                <MainLayout>{props.children}</MainLayout>
              </IntlProvider>
            </AuthProvider>
          </Suspense>
        )}>
        <FileRoutes />
      </Router>
    </MetaProvider>
  )
}
