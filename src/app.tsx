import { MetaProvider } from "@solidjs/meta"
import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { ErrorBoundary, onMount, Suspense } from "solid-js"
import { ConfirmationProvider } from "@/components/confirm-dialog"
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator"
import { RouteError, RouteFallback } from "@/components/route-boundary"
import { NotificationProvider } from "@/components/notification"
import { AuthProvider } from "@/context/auth-context"
import { ServicesProvider } from "@/context/services-context"
import { ViewportProvider } from "@/context/viewport"
import { IntlProvider, messages } from "@/i18n"
import { MainLayout } from "@/layouts"
import { VisitorAuthProvider } from "@/modules/auth/components/visitor-auth-modal"
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
          <ServicesProvider>
            <AuthProvider>
              <IntlProvider
                locale="en"
                messages={messages}>
                <ViewportProvider>
                  <NotificationProvider>
                    <ConfirmationProvider>
                      <VisitorAuthProvider>
                        <GlobalLoadingIndicator />
                        <MainLayout>
                          {/*
                            These boundaries wrap only the route, deliberately
                            leaving the providers and the site chrome outside
                            them. They used to sit around the whole tree, so a
                            page whose data was still resolving took the header
                            and the dock down with it and left a blank screen.

                            ErrorBoundary goes outside Suspense so it also
                            catches a rejection thrown while resolving. Without
                            one, a failed query threw during render with nothing
                            to catch it, and a manual refresh was the only way
                            back.
                          */}
                          <ErrorBoundary
                            fallback={(error, reset) => (
                              <RouteError
                                error={error}
                                onReset={reset}
                              />
                            )}>
                            <Suspense fallback={<RouteFallback />}>
                              {props.children}
                            </Suspense>
                          </ErrorBoundary>
                        </MainLayout>
                      </VisitorAuthProvider>
                    </ConfirmationProvider>
                  </NotificationProvider>
                </ViewportProvider>
              </IntlProvider>
            </AuthProvider>
          </ServicesProvider>
        )}>
        <FileRoutes />
      </Router>
    </MetaProvider>
  )
}
