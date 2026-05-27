"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

// Controlled via `value` + `onValueChange(value, eventDetails)`, NOT onChange.
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "z-10 inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn(
        "flex-1 outline-none transition-opacity duration-150 data-[hidden]:hidden focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel }
