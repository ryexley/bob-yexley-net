import { cn } from "@/lib/util"
import type {
  ContentProps,
  DescriptionProps,
  DynamicProps,
  LabelProps,
} from "@corvu/drawer"
import DrawerPrimitive from "@corvu/drawer"
import type { ComponentProps, ParentProps, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

export { useContext } from "@corvu/drawer"
export const Drawer = DrawerPrimitive
export const DrawerTrigger = DrawerPrimitive.Trigger
export const DrawerClose = DrawerPrimitive.Close

type drawerContentProps<T extends ValidComponent = "div"> = ParentProps<
  ContentProps<T> & {
    class?: string
  }
>

export const DrawerContent = <T extends ValidComponent = "div">(
  props: DynamicProps<T, drawerContentProps<T>>,
) => {
  const [local, rest] = splitProps(props as drawerContentProps, [
    "class",
    "children",
  ])
  // const ctx = DrawerPrimitive.useContext()

  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay
        class="fixed inset-0 z-50 data-[transitioning]:transition-colors data-[transitioning]:duration-250 data-[open]:bg-[rgba(var(--colors-bg-main-rgb),0.8)]"
        style={{
          // "background-color": `hsl(var(--colors-bg-main) / ${0.8 * ctx.openPercentage()})`,
          "background-color": "",
        }}
      />
      <DrawerPrimitive.Content
        class={cn(
          "fixed z-50 flex flex-col rounded-none border bg-background data-[transitioning]:transition-transform data-[transitioning]:duration-250 md:select-none",
          local.class,
        )}
        {...rest}>
        {/* <div class="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" /> */}
        {local.children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

export const DrawerHeader = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <div
      class={cn(local.class)}
      {...rest}
    />
  )
}

export const DrawerFooter = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <div
      class={cn("mt-auto flex flex-col gap-2 p-4", local.class)}
      {...rest}
    />
  )
}

type DrawerLabelProps = LabelProps & {
  class?: string
}

export const DrawerLabel = <T extends ValidComponent = "h2">(
  props: DynamicProps<T, DrawerLabelProps>,
) => {
  const [local, rest] = splitProps(props as DrawerLabelProps, ["class"])

  return (
    <DrawerPrimitive.Label
      class={cn(local.class)}
      {...rest}
    />
  )
}

type DrawerDescriptionProps = DescriptionProps & {
  class?: string
}

export const DrawerDescription = <T extends ValidComponent = "p">(
  props: DynamicProps<T, DrawerDescriptionProps>,
) => {
  const [local, rest] = splitProps(props as DrawerDescriptionProps, ["class"])

  return (
    <DrawerPrimitive.Description
      class={cn(local.class)}
      {...rest}
    />
  )
}
