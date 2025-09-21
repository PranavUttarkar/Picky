import React, { PropsWithChildren } from "react";
import { Appearance, ColorSchemeName, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const Colors = {
  light: {
    background: "#f9fafb",
    card: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    primary: "#10b981",
    accent: "#f59e0b",
  },
  dark: {
    background: "#0b1220",
    card: "#111827",
    text: "#f9fafb",
    muted: "#9ca3af",
    primary: "#22d3ee",
    accent: "#f59e0b",
  },
};

export const useThemeColors = () => {
  const scheme = useColorScheme() ?? "light";
  return Colors[scheme === "dark" ? "dark" : "light"];
};

export function ThemeProvider({ children }: PropsWithChildren) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
