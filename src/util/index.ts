import type { ClassValue } from "clsx"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

export { cva } from "class-variance-authority"
export { twMerge as merge } from "tailwind-merge"

export const cx = (...classLists: ClassValue[]) => twMerge(clsx(classLists))

export * from "./assertions"
