import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude` — рабочие деревья задач (`.claude/worktrees/*`) и прочее хозяйство
  // Клода: это копии репозитория, а не его код. Без этого `eslint .` из главного
  // чекаута лезет в сборочный мусор чужой ветки (её `.nuxt` паттерном выше не
  // накрыт — он на один уровень, а не вглубь).
  { ignores: ['node_modules', 'dist', '.nuxt', '.output', '.claude'] },
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
