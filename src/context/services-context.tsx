import { createContext, useContext, ParentComponent } from "solid-js"
import { supabase } from "@/lib/vendor/supabase"
import { isEmpty } from "@/util"

type ServicesContextValue = {
  supabase: typeof supabase
}

const ServicesContext = createContext<ServicesContextValue>()

export const ServicesProvider: ParentComponent = props => {
  const value: ServicesContextValue = {
    supabase,
  }

  return (
    <ServicesContext.Provider value={value}>
      {props.children}
    </ServicesContext.Provider>
  )
}

export const useServices = () => {
  const context = useContext(ServicesContext)
  if (isEmpty(context)) {
    throw new Error("useServices must be used within ServicesProvider")
  }

  return context
}

export const useSupabase = () => {
  const { supabase } = useServices()
  return supabase
}
