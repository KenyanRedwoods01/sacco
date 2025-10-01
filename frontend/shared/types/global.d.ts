declare global {
  // Tembea Sacco theme types
  interface TembeaTheme {
    colors: {
      primary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
      };
      accent: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
      };
    };
    borderRadius: {
      DEFAULT: string;
      md: string;
      lg: string;
      xl: string;
      full: string;
    };
  }

  // Component props for rounded design system
  interface RoundedComponentProps {
    rounded?: 'sm' | 'DEFAULT' | 'md' | 'lg' | 'xl' | 'full';
    shadow?: 'soft' | 'medium' | 'large' | 'floating' | 'none';
  }

  // Navigation types for sidebar
  interface NavigationItem {
    name: string;
    href: string;
    icon: string;
    current: boolean;
    children?: NavigationItem[];
  }
}

export {};
