// Сгенерировано консолью DocDD из токенов дизайна v1.5.0 (docs/16-design-system.md). Не правьте руками: меняются токены.
// Размеры в rem. Языки — точка подключения словарей (@nuxtjs/i18n и подобные).

export const designTokens = {
  "unit": "rem",
  "spacing": {
    "xs": 0.25,
    "sm": 0.5,
    "md": 0.75,
    "lg": 1,
    "xl": 1.5,
    "xxl": 2
  },
  "radius": {
    "sm": 0.5,
    "md": 0.75,
    "pill": 62.5
  },
  "typography": {
    "caption": {
      "size": 0.75,
      "line": 1.0625,
      "weight": 400
    },
    "small": {
      "size": 0.8125,
      "line": 1.1875,
      "weight": 400
    },
    "body": {
      "size": 0.9375,
      "line": 1.375,
      "weight": 400
    },
    "lead": {
      "size": 1.0625,
      "line": 1.5625,
      "weight": 500
    },
    "title": {
      "size": 1.375,
      "line": 2,
      "weight": 600
    },
    "display": {
      "size": 1.75,
      "line": 2.5625,
      "weight": 700
    }
  },
  "border": {
    "thin": 0.0625,
    "thick": 0.125
  },
  "icon": {
    "sm": 1,
    "md": 1.25,
    "lg": 1.5
  },
  "motion": {
    "fast": 120,
    "base": 200,
    "slow": 320
  },
  "fonts": {
    "body": "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace"
  },
  "measure": 70,
  "grid": {
    "columns": 12,
    "gutter": 1.5,
    "breakpoints": {
      "xs": 0,
      "sm": 36,
      "md": 48,
      "lg": 62,
      "xl": 75,
      "xxl": 87.5
    },
    "containers": {
      "sm": 33.75,
      "md": 45,
      "lg": 60,
      "xl": 71.25,
      "xxl": 82.5
    }
  },
  "palette": {
    "light": {
      "bg": "#F6F7FB",
      "surface": "#FFFFFF",
      "surfaceAlt": "#ECEFF7",
      "ink": "#0F1530",
      "muted": "#566079",
      "line": "#D8DDEA",
      "accent": "#3F62AE",
      "onAccent": "#FFFFFF",
      "core": "#96602A",
      "ok": "#2E7A4F",
      "warn": "#8F6A22",
      "danger": "#B8403A",
      "onDanger": "#FFFFFF",
      "focus": "#3F62AE"
    },
    "dark": {
      "bg": "#0E111A",
      "surface": "#161A25",
      "surfaceAlt": "#202636",
      "ink": "#E8EBF5",
      "muted": "#9AA3BC",
      "line": "#2C3345",
      "accent": "#8AA4E0",
      "onAccent": "#0B1020",
      "core": "#D6A062",
      "ok": "#72C096",
      "warn": "#D4B466",
      "danger": "#E2877E",
      "onDanger": "#2A0A07",
      "focus": "#8AA4E0"
    }
  },
  "themes": {
    "contrast": {
      "minContrast": 7,
      "label": "High contrast",
      "labels": {
        "ru": "Высокий контраст",
        "en": "High contrast"
      },
      "mode": "dark",
      "palette": {
        "bg": "#000000",
        "surface": "#0A0A0A",
        "surfaceAlt": "#1A1A1A",
        "ink": "#FFFFFF",
        "muted": "#E0E0E0",
        "line": "#FFFFFF",
        "accent": "#FFE600",
        "onAccent": "#000000",
        "core": "#FFB000",
        "ok": "#00FF7F",
        "warn": "#FFD54F",
        "danger": "#FF8A80",
        "onDanger": "#000000",
        "focus": "#FFE600"
      }
    },
    "oled": {
      "minContrast": 4.5,
      "label": "OLED",
      "labels": {
        "ru": "OLED",
        "en": "OLED"
      },
      "mode": "dark",
      "palette": {
        "bg": "#000000",
        "surface": "#090B10",
        "surfaceAlt": "#12151D",
        "ink": "#E8EBF5",
        "muted": "#9AA3BC",
        "line": "#232838",
        "accent": "#8AA4E0",
        "onAccent": "#0B1020",
        "core": "#D6A062",
        "ok": "#72C096",
        "warn": "#D4B466",
        "danger": "#E2877E",
        "onDanger": "#2A0A07",
        "focus": "#8AA4E0"
      }
    }
  },
  "i18n": {
    "default": "ru",
    "fallback": "en",
    "locales": [
      "ru",
      "en"
    ]
  }
} as const;

export type DesignTokens = typeof designTokens;
export const locales = designTokens.i18n.locales;
