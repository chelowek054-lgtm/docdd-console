import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', '.nuxt', '.output'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // any требует объяснения в комментарии — правило CLAUDE.md, здесь оно
      // держится предупреждением, чтобы точечный интероп с CommonJS не валил сборку.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Подчёркивание — принятый способ сказать «значение отброшено намеренно».
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
);
