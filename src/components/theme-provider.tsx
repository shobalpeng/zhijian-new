import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
type ColorTheme = "blue" | "pink" | "green" | "red" | "gray"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultColorTheme?: ColorTheme
  storageKey?: string
  colorStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  colorTheme: ColorTheme
  setTheme: (theme: Theme) => void
  setColorTheme: (color: ColorTheme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  // 默认配色 = 玫瑰粉，与品牌 Logo 的房子+爱心同色
  colorTheme: "pink",
  setTheme: () => null,
  setColorTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultColorTheme = "pink",
  storageKey = "vite-ui-theme",
  colorStorageKey = "vite-ui-color-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    () => (localStorage.getItem(colorStorageKey) as ColorTheme) || defaultColorTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    const resolved: "light" | "dark" =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme

    root.classList.add(resolved)

    // 让手机状态栏/地址栏颜色跟着明暗走（否则深色页面顶上是白色条，很割裂）
    // 取值 = index.css 的 --background：dark 为 oklch(0.145) ≈ #0a0a0a
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#0a0a0a" : "#ffffff")
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("color-blue", "color-pink", "color-green", "color-red", "color-gray")
    root.classList.add(`color-${colorTheme}`)
  }, [colorTheme])

  const value = {
    theme,
    colorTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    setColorTheme: (color: ColorTheme) => {
      localStorage.setItem(colorStorageKey, color)
      setColorTheme(color)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}